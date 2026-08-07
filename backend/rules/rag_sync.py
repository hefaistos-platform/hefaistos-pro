"""
RAG sync pipeline for HEFAISTOS.

Reads JSONL or native KQL/detection files from a configured ``RuleRepository``
via the existing GitPython / token-authenticated clone pattern, normalises each
entry to a common template payload, and upserts it into the Qdrant
``hefaistos_rule_templates`` collection.

Entry point:  ``sync_repository_rag(repo_id)``

JSONL format expected (one JSON object per line):
  {"title": "...", "description": "...", "query": "...", "author": "...",
   "language": "KQL", "tags": [...]}

Plain .kql / .txt files are ingested as raw-content entries with the filename
as the title.
"""

from __future__ import annotations

import fnmatch
import hashlib
import json
import logging
import os
import tempfile
from pathlib import Path
from typing import TYPE_CHECKING

from django.utils import timezone

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from rules.models import RuleRepository


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clone_repo(repo: "RuleRepository", work_dir: str) -> "git.Repo":  # type: ignore[name-defined]
    """Shallow-clone the repository into *work_dir* using stored credentials."""
    try:
        import git  # type: ignore
    except ImportError as exc:
        raise ImportError("GitPython is required for RAG sync.") from exc

    git_url = repo.git_url or ""
    token = repo.token  # decrypted via property
    username = repo.username or ""
    branch = repo.rag_branch or None

    # Inject credentials into the URL for HTTPS clones
    if token and git_url.startswith("https://"):
        if username:
            auth_url = git_url.replace("https://", f"https://{username}:{token}@")
        else:
            auth_url = git_url.replace("https://", f"https://x-access-token:{token}@")
    else:
        auth_url = git_url

    clone_kwargs: dict = {"depth": 1, "single_branch": True}
    if branch:
        clone_kwargs["branch"] = branch

    cloned = git.Repo.clone_from(auth_url, work_dir, **clone_kwargs)
    return cloned


def _iter_matching_paths(root: Path, pattern: str | None) -> list[Path]:
    """Return all files under *root* matching *pattern* (glob or directory prefix)."""
    if not pattern:
        # Default: look for .jsonl files anywhere
        return list(root.rglob("*.jsonl"))

    # If pattern ends with a directory separator or has no extension/wildcard,
    # treat it as a directory prefix and collect all .jsonl and .kql files inside.
    p = Path(pattern)
    if not p.suffix and "*" not in pattern:
        sub = root / pattern
        if sub.is_dir():
            return list(sub.rglob("*.jsonl")) + list(sub.rglob("*.kql")) + list(sub.rglob("*.txt"))
        return []

    # Otherwise treat as a glob relative to root
    return [f for f in root.rglob("*") if fnmatch.fnmatch(f.relative_to(root).as_posix(), pattern)]


def _parse_jsonl_file(file_path: Path, repo_name: str) -> list[dict]:
    """Parse a JSONL file and return a list of normalised entry dicts."""
    entries = []
    try:
        with open(file_path, encoding="utf-8", errors="replace") as fh:
            for lineno, line in enumerate(fh, 1):
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    logger.debug("Skipping malformed JSON line %d in %s", lineno, file_path)
                    continue

                if not isinstance(obj, dict):
                    continue

                rel_path = file_path.name
                source_id = _make_source_id(repo_name, rel_path, lineno, obj)
                entry = {
                    "source_id": source_id,
                    "language": _resolve_language(obj),
                    "title": obj.get("title") or obj.get("name") or f"{rel_path}:{lineno}",
                    "description": obj.get("description") or obj.get("details") or "",
                    "query": obj.get("query") or obj.get("detection") or obj.get("rule") or "",
                    "raw_content": obj.get("raw_content") or "",
                    "author": obj.get("author") or "",
                    "tags": obj.get("tags") or [],
                    "repo_name": repo_name,
                    "repo_path": str(file_path),
                }
                entries.append(entry)
    except Exception as exc:
        logger.warning("Failed to parse JSONL file %s: %s", file_path, exc)
    return entries


def _parse_raw_file(file_path: Path, repo_name: str, language: str = "KQL") -> list[dict]:
    """Parse a raw .kql / .txt / other text file as a single entry."""
    try:
        content = file_path.read_text(encoding="utf-8", errors="replace").strip()
    except Exception as exc:
        logger.warning("Failed to read file %s: %s", file_path, exc)
        return []

    if not content:
        return []

    rel_path = file_path.name
    source_id = _make_source_id(repo_name, rel_path, 0, {"content": content})
    return [{
        "source_id": source_id,
        "language": language,
        "title": file_path.stem,
        "description": "",
        "query": "",
        "raw_content": content,
        "author": "",
        "tags": [],
        "repo_name": repo_name,
        "repo_path": str(file_path),
    }]


def _make_source_id(repo_name: str, rel_path: str, lineno: int, obj: dict) -> str:
    """Create a stable content-addressed source ID."""
    content = json.dumps(obj, sort_keys=True, ensure_ascii=False)
    digest = hashlib.sha256(f"{repo_name}:{rel_path}:{lineno}:{content}".encode()).hexdigest()[:16]
    return f"{repo_name}:{rel_path}:{lineno}:{digest}"


def _resolve_language(obj: dict) -> str:
    """Detect the rule language from an entry dict, defaulting to KQL."""
    lang = (obj.get("language") or obj.get("format") or "KQL").upper()
    known = {"KQL", "EQL", "SPL", "WAZUH", "AQL", "SIGMA", "OTHER"}
    if lang in known:
        return lang
    return "KQL"


def _get_openai_key_for_repo(repo: "RuleRepository") -> str | None:
    """
    Retrieve an OpenAI key usable for embedding.  We try (in order):
      1. The organisation's AI settings (if any admin user has configured one).
      2. The OPENAI_API_KEY environment variable.
    """
    # Try env var first (fast path)
    env_key = os.environ.get("OPENAI_API_KEY")
    if env_key:
        return env_key

    # Try the first admin/configured key in the organisation
    try:
        from ai_assistant.models import UserAISettings  # noqa: PLC0415
        settings = (
            UserAISettings.objects
            .filter(user__organization=repo.organization)
            .exclude(_openai_key=None)
            .exclude(_openai_key="")
            .first()
        )
        if settings:
            return settings.get_openai_key()
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# Main sync entry point
# ---------------------------------------------------------------------------

def sync_repository_rag(repo_id: int) -> dict:
    """
    Sync RAG templates from the given ``RuleRepository``.

    Returns a result dict with keys: ``ok``, ``upserted``, ``skipped``, ``error``.
    Updates ``rag_last_sync_*`` fields on the model.
    """
    from rules.models import RuleRepository  # noqa: PLC0415

    try:
        repo = RuleRepository.objects.get(pk=repo_id)
    except RuleRepository.DoesNotExist:
        return {"ok": False, "upserted": 0, "skipped": 0, "error": "Repository not found"}

    # Mark as pending; reset counts from any previous run
    repo.rag_last_sync_at = timezone.now()
    repo.rag_last_sync_status = "pending"
    repo.rag_last_sync_error = None
    repo.rag_last_sync_upserted = 0
    repo.rag_last_sync_skipped = 0
    repo.save(update_fields=[
        "rag_last_sync_at", "rag_last_sync_status", "rag_last_sync_error",
        "rag_last_sync_upserted", "rag_last_sync_skipped",
    ])

    openai_key = _get_openai_key_for_repo(repo)
    if not openai_key:
        error_msg = "No OpenAI API key available for embedding. Configure one in AI Settings or set OPENAI_API_KEY env var."
        repo.rag_last_sync_status = "error"
        repo.rag_last_sync_error = error_msg
        repo.rag_last_sync_upserted = 0
        repo.rag_last_sync_skipped = 0
        repo.save(update_fields=["rag_last_sync_status", "rag_last_sync_error", "rag_last_sync_upserted", "rag_last_sync_skipped"])
        return {"ok": False, "upserted": 0, "skipped": 0, "error": error_msg}

    # Import Qdrant store helpers
    try:
        from rules.rag_store import get_qdrant_client, ensure_collection, upsert_template  # noqa: PLC0415
        qdrant_client = get_qdrant_client()
        ensure_collection(qdrant_client)
    except Exception as exc:
        error_msg = f"Qdrant connection failed: {exc}"
        logger.error("RAG sync – %s (repo=%s)", error_msg, repo.name)
        repo.rag_last_sync_status = "error"
        repo.rag_last_sync_error = error_msg
        repo.rag_last_sync_upserted = 0
        repo.rag_last_sync_skipped = 0
        repo.save(update_fields=["rag_last_sync_status", "rag_last_sync_error", "rag_last_sync_upserted", "rag_last_sync_skipped"])
        return {"ok": False, "upserted": 0, "skipped": 0, "error": error_msg}

    # Clone and parse
    upserted = 0
    skipped = 0

    try:
        with tempfile.TemporaryDirectory(prefix="hef_rag_sync_") as tmp_dir:
            try:
                _clone_repo(repo, tmp_dir)
            except Exception as exc:
                error_msg = f"Git clone failed: {exc}"
                logger.error("RAG sync – %s (repo=%s)", error_msg, repo.name)
                repo.rag_last_sync_status = "error"
                repo.rag_last_sync_error = error_msg
                repo.rag_last_sync_upserted = 0
                repo.rag_last_sync_skipped = 0
                repo.save(update_fields=["rag_last_sync_status", "rag_last_sync_error", "rag_last_sync_upserted", "rag_last_sync_skipped"])
                return {"ok": False, "upserted": 0, "skipped": 0, "error": error_msg}

            root = Path(tmp_dir)
            pattern = repo.rag_dataset_path or None
            matching_files = _iter_matching_paths(root, pattern)

            for file_path in matching_files:
                suffix = file_path.suffix.lower()
                if suffix == ".jsonl":
                    entries = _parse_jsonl_file(file_path, repo.name)
                elif suffix in (".kql", ".txt"):
                    entries = _parse_raw_file(file_path, repo.name, language="KQL")
                else:
                    continue

                for entry in entries:
                    ok = upsert_template(qdrant_client, entry, openai_key)
                    if ok:
                        upserted += 1
                    else:
                        skipped += 1

    except Exception as exc:
        error_msg = f"Unexpected error during RAG sync: {exc}"
        logger.exception("RAG sync – unexpected error (repo=%s)", repo.name)
        repo.rag_last_sync_status = "error"
        repo.rag_last_sync_error = error_msg
        repo.rag_last_sync_upserted = upserted
        repo.rag_last_sync_skipped = skipped
        repo.save(update_fields=["rag_last_sync_status", "rag_last_sync_error", "rag_last_sync_upserted", "rag_last_sync_skipped"])
        return {"ok": False, "upserted": upserted, "skipped": skipped, "error": error_msg}

    # Success – update schedule
    repo.rag_last_sync_status = "ok"
    repo.rag_last_sync_error = None
    repo.rag_last_sync_upserted = upserted
    repo.rag_last_sync_skipped = skipped
    _update_next_rag_sync(repo)
    repo.save(update_fields=[
        "rag_last_sync_status", "rag_last_sync_error",
        "rag_last_sync_upserted", "rag_last_sync_skipped",
        "rag_next_scheduled_sync",
    ])

    logger.info(
        "RAG sync completed for repo '%s': upserted=%d skipped=%d",
        repo.name, upserted, skipped,
    )
    return {"ok": True, "upserted": upserted, "skipped": skipped, "error": None}


def _update_next_rag_sync(repo: "RuleRepository") -> None:
    """Set ``rag_next_scheduled_sync`` based on ``rag_schedule``."""
    import datetime
    schedule = repo.rag_schedule or "DISABLED"
    delta_map = {
        "24H": datetime.timedelta(hours=24),
        "48H": datetime.timedelta(hours=48),
        "72H": datetime.timedelta(hours=72),
        "WEEKLY": datetime.timedelta(weeks=1),
    }
    delta = delta_map.get(schedule)
    repo.rag_next_scheduled_sync = (timezone.now() + delta) if delta else None


def run_due_rag_syncs() -> dict:
    """
    Check all repositories with RAG enabled + a due schedule and sync them.
    Called by the scheduler loop.

    Returns ``{"ran": N, "failed": N}``.
    """
    from rules.models import RuleRepository  # noqa: PLC0415

    now = timezone.now()
    due = RuleRepository.objects.filter(
        rag_enabled=True,
        rag_next_scheduled_sync__lte=now,
    ).exclude(rag_schedule="DISABLED")

    ran = failed = 0
    for repo in due:
        result = sync_repository_rag(repo.pk)
        if result.get("ok"):
            ran += 1
        else:
            failed += 1
    return {"ran": ran, "failed": failed}
