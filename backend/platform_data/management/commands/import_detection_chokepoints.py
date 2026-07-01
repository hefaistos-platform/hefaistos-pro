from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any, Iterable

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from platform_data.chokepoints_sync import (
    DEFAULT_CHOKEPOINTS_REF,
    DEFAULT_CHOKEPOINTS_REPO,
    fetch_latest_ref_sha,
    fetch_remote_chokepoint_text,
    list_remote_chokepoint_paths,
    normalize_git_ref,
)
from platform_data.models import ChokepointEntry, ChokepointSnapshot

try:
    import yaml
except Exception:  # pragma: no cover - dependency availability is validated at runtime
    yaml = None


TECHNIQUE_RE = re.compile(r"\bT\d{4}(?:\.\d{3})?\b", re.IGNORECASE)
DET_RE = re.compile(r"\bDET\d{3,}\b", re.IGNORECASE)


def _norm_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").strip().lower())


def _to_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return str(value)
    if isinstance(value, list):
        parts = [_to_text(v) for v in value]
        return "\n".join([p for p in parts if p])
    if isinstance(value, dict):
        try:
            return json.dumps(value, ensure_ascii=False)
        except Exception:
            return str(value)
    return str(value)


def _to_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        result = []
        for item in value:
            text = _to_text(item)
            if text:
                result.append(text)
        return result
    if isinstance(value, dict):
        result = []
        for key, item in value.items():
            text = _to_text(item)
            if text:
                result.append(f"{key}: {text}")
        return result
    text = _to_text(value)
    return [text] if text else []


def _iter_nodes(node: Any) -> Iterable[Any]:
    yield node
    if isinstance(node, list):
        for item in node:
            yield from _iter_nodes(item)
    elif isinstance(node, dict):
        for item in node.values():
            yield from _iter_nodes(item)


def _find_first_value(node: Any, key_aliases: set[str]) -> Any:
    if isinstance(node, dict):
        for key, value in node.items():
            if _norm_key(str(key)) in key_aliases:
                return value
        for value in node.values():
            found = _find_first_value(value, key_aliases)
            if found is not None:
                return found
    elif isinstance(node, list):
        for item in node:
            found = _find_first_value(item, key_aliases)
            if found is not None:
                return found
    return None


def _extract_codes(node: Any, pattern: re.Pattern[str]) -> list[str]:
    seen = set()
    ordered = []
    for n in _iter_nodes(node):
        if isinstance(n, str):
            for raw in pattern.findall(n):
                code = raw.upper()
                if code not in seen:
                    seen.add(code)
                    ordered.append(code)
    return ordered


def _unique_keep_order(values: Iterable[str]) -> list[str]:
    seen = set()
    ordered = []
    for value in values:
        if value not in seen:
            seen.add(value)
            ordered.append(value)
    return ordered


def _slug(value: str) -> str:
    value = (value or "").strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value or "entry"


def _iter_candidate_entries(data: Any) -> Iterable[tuple[int, dict[str, Any]]]:
    if isinstance(data, list):
        for idx, row in enumerate(data):
            if isinstance(row, dict):
                yield idx, row
        return

    if not isinstance(data, dict):
        return

    list_containers = {
        "chokepoints",
        "entries",
        "items",
        "chokepointentries",
        "detectionchokepoints",
    }
    for key, value in data.items():
        if _norm_key(str(key)) in list_containers and isinstance(value, list):
            for idx, row in enumerate(value):
                if isinstance(row, dict):
                    yield idx, row
            return

    yield 0, data


def _map_confidence(raw_value: Any) -> str:
    text = _to_text(raw_value).upper()
    if "HIGH" in text:
        return ChokepointEntry.Confidence.HIGH
    if "MEDIUM" in text:
        return ChokepointEntry.Confidence.MEDIUM
    if "LOW" in text:
        return ChokepointEntry.Confidence.LOW
    return ChokepointEntry.Confidence.UNKNOWN


def _extract_native_rule_hints(candidate: dict[str, Any]) -> dict[str, list[str]]:
    hints: dict[str, list[str]] = {"kql": [], "spl": [], "wazuh_xml": []}
    kql_keys = {"kql", "kusto", "sentinel", "microsoftsentinel"}
    spl_keys = {"spl", "splunk", "splquery"}
    wazuh_keys = {"wazuh", "wazuhxml", "xmlwazuh"}

    def _append(bucket: str, values: Any) -> None:
        hints[bucket].extend(_to_list(values))
        hints[bucket] = _unique_keep_order([v for v in hints[bucket] if v])

    def _walk(node: Any) -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                nk = _norm_key(str(key))
                if nk in kql_keys:
                    _append("kql", value)
                    continue
                if nk in spl_keys:
                    _append("spl", value)
                    continue
                if nk in wazuh_keys:
                    _append("wazuh_xml", value)
                    continue
                _walk(value)
        elif isinstance(node, list):
            for item in node:
                _walk(item)

    _walk(candidate)
    return hints


def _load_yaml_documents(text: str) -> list[Any]:
    if yaml is None:
        raise CommandError("PyYAML is required to import detection chokepoints.")
    return list(yaml.safe_load_all(text))


class Command(BaseCommand):
    help = "Import detection chokepoints as a staged snapshot."

    def add_arguments(self, parser):
        parser.add_argument(
            "--source-repo",
            type=str,
            default=DEFAULT_CHOKEPOINTS_REPO,
            help="Git repository URL for chokepoints content.",
        )
        parser.add_argument(
            "--ref",
            type=str,
            default=DEFAULT_CHOKEPOINTS_REF,
            help="Git ref (branch/tag/commit) to import.",
        )
        parser.add_argument(
            "--mode",
            type=str,
            choices=["remote", "local"],
            default="remote",
            help="remote = fetch from GitHub, local = read filesystem path.",
        )
        parser.add_argument(
            "--dir",
            type=str,
            default=None,
            help="Local directory (required when --mode=local).",
        )
        parser.add_argument(
            "--snapshot-id",
            type=str,
            default=None,
            help="Optional existing ChokepointSnapshot UUID to update.",
        )

    def handle(self, *args, **options):
        mode = (options.get("mode") or "remote").lower().strip()
        source_repo = (options.get("source_repo") or DEFAULT_CHOKEPOINTS_REPO).strip()
        source_ref = normalize_git_ref(options.get("ref"), default=DEFAULT_CHOKEPOINTS_REF)
        snapshot_id = (options.get("snapshot_id") or "").strip() or None

        if mode == "local" and not options.get("dir"):
            raise CommandError("--dir is required when --mode=local")

        if snapshot_id:
            snapshot = ChokepointSnapshot.objects.get(id=snapshot_id)
            snapshot.status = ChokepointSnapshot.Status.STAGED
            snapshot.source_repo = source_repo
            snapshot.source_ref = source_ref
            snapshot.validation_errors = ""
            snapshot.summary = {}
            snapshot.entry_count = 0
            snapshot.save(update_fields=[
                "status", "source_repo", "source_ref", "validation_errors",
                "summary", "entry_count", "updated_at",
            ])
        else:
            snapshot = ChokepointSnapshot.objects.create(
                source_repo=source_repo,
                source_ref=source_ref,
                status=ChokepointSnapshot.Status.STAGED,
            )

        processed_files = 0
        failed_files = 0
        raw_candidate_entries = 0
        imported_entries = 0
        failed_paths: list[str] = []
        warnings: list[str] = []
        resolved_sha = ""
        created_rows: list[ChokepointEntry] = []
        seen_entry_keys: set[str] = set()

        try:
            file_rows: list[tuple[str, str]] = []
            if mode == "remote":
                try:
                    resolved_sha = fetch_latest_ref_sha(source_repo, source_ref) or ""
                except Exception as exc:
                    warnings.append(f"Could not resolve latest SHA for ref '{source_ref}': {exc}")

                paths = list_remote_chokepoint_paths(source_repo, source_ref)
                if not paths:
                    raise CommandError("No chokepoint YAML files found under chokepoints/ in the remote repository.")

                for path in paths:
                    try:
                        text = fetch_remote_chokepoint_text(source_repo, source_ref, path)
                    except Exception as exc:
                        failed_files += 1
                        failed_paths.append(path)
                        warnings.append(f"Failed to fetch {path}: {exc}")
                        continue
                    file_rows.append((path, text))
            else:
                base_dir = Path(options["dir"]).expanduser().resolve()
                if not base_dir.exists():
                    raise CommandError(f"Local directory does not exist: {base_dir}")
                search_root = base_dir / "chokepoints" if (base_dir / "chokepoints").exists() else base_dir
                paths = sorted([
                    p for p in search_root.rglob("*")
                    if p.is_file() and p.suffix.lower() in {".yml", ".yaml"}
                ])
                if not paths:
                    raise CommandError(f"No YAML files found under {search_root}")
                for path in paths:
                    rel_path = str(path.relative_to(base_dir))
                    file_rows.append((rel_path, path.read_text(encoding="utf-8")))

            for source_path, text in file_rows:
                processed_files += 1
                try:
                    docs = _load_yaml_documents(text)
                except Exception as exc:
                    failed_files += 1
                    failed_paths.append(source_path)
                    warnings.append(f"YAML parse error in {source_path}: {exc}")
                    continue

                for doc_idx, doc in enumerate(docs):
                    if doc is None:
                        continue
                    for entry_idx, candidate in _iter_candidate_entries(doc):
                        raw_candidate_entries += 1
                        title = _to_text(_find_first_value(candidate, {
                            "title", "name", "chokepoint", "chokepointname", "component", "artifact",
                        }))
                        technique_name = _to_text(_find_first_value(candidate, {
                            "techniquename", "mitretechniquename", "attacktechniquename",
                        }))
                        tactic = _to_text(_find_first_value(candidate, {"tactic", "mitretactic", "attacktactic"}))
                        telemetry = _to_text(_find_first_value(candidate, {
                            "telemetry", "telemetryprerequisites", "requiredtelemetry", "requireddata",
                        }))
                        detection_context = _to_text(_find_first_value(candidate, {
                            "description", "detectioncontext", "logic", "notes", "details",
                        }))

                        platforms = _to_list(_find_first_value(candidate, {"platform", "platforms"}))
                        data_components = _to_list(_find_first_value(candidate, {
                            "datacomponents", "datasources", "logsources",
                        }))
                        references = _to_list(_find_first_value(candidate, {
                            "reference", "references", "externalreferences", "urls", "links",
                        }))
                        tags = _to_list(_find_first_value(candidate, {"tags", "keywords", "labels"}))

                        technique_codes = _extract_codes(candidate, TECHNIQUE_RE)
                        det_codes = _extract_codes(candidate, DET_RE)
                        primary_code = technique_codes[0] if technique_codes else ""
                        sub_code = ""
                        if primary_code and "." in primary_code:
                            sub_code = primary_code
                            primary_code = primary_code.split(".")[0]
                        elif len(technique_codes) > 1:
                            for code in technique_codes[1:]:
                                if "." in code:
                                    sub_code = code
                                    break

                        if not title:
                            fallback = technique_codes[0] if technique_codes else "unknown"
                            title = f"Chokepoint {fallback} ({Path(source_path).stem})"

                        source_hash = hashlib.sha256(
                            json.dumps(candidate, ensure_ascii=False, sort_keys=True, default=str).encode("utf-8")
                        ).hexdigest()
                        native_rule_hints = _extract_native_rule_hints(candidate)
                        confidence = _map_confidence(_find_first_value(candidate, {"confidence", "quality", "status"}))
                        upstream_id = _to_text(_find_first_value(candidate, {"id", "uid", "slug", "key"}))
                        key_seed = upstream_id or title or f"{doc_idx}-{entry_idx}"
                        entry_key = f"{source_path}::{_slug(key_seed)}"

                        suffix = 2
                        candidate_key = entry_key
                        while candidate_key in seen_entry_keys:
                            candidate_key = f"{entry_key}#{suffix}"
                            suffix += 1
                        entry_key = candidate_key
                        seen_entry_keys.add(entry_key)

                        created_rows.append(
                            ChokepointEntry(
                                snapshot=snapshot,
                                entry_key=entry_key[:320],
                                source_path=source_path[:512],
                                source_hash=source_hash,
                                title=title[:255],
                                primary_technique_id=primary_code[:20],
                                sub_technique_id=sub_code[:20],
                                technique_name=technique_name[:255],
                                tactic=tactic[:120],
                                telemetry_prerequisites=telemetry,
                                detection_context=detection_context,
                                platforms=platforms,
                                data_components=data_components,
                                detection_strategy_hints=det_codes,
                                native_rule_hints=native_rule_hints,
                                references=references,
                                tags=tags,
                                confidence=confidence,
                                metadata={
                                    "technique_codes": technique_codes,
                                    "det_codes": det_codes,
                                    "source_doc_index": doc_idx,
                                    "source_entry_index": entry_idx,
                                },
                            )
                        )
                        imported_entries += 1

            summary = {
                "mode": mode.upper(),
                "source_repo": source_repo,
                "source_ref": source_ref,
                "source_sha": resolved_sha,
                "processed_files": processed_files,
                "failed_files": failed_files,
                "raw_candidate_entries": raw_candidate_entries,
                "imported_entries": imported_entries,
                "failed_paths": failed_paths[:100],
                "warning_count": len(warnings),
            }

            with transaction.atomic():
                ChokepointEntry.objects.filter(snapshot=snapshot).delete()
                if created_rows:
                    ChokepointEntry.objects.bulk_create(created_rows, batch_size=500)

                snapshot.source_sha = resolved_sha or snapshot.source_sha
                snapshot.status = (
                    ChokepointSnapshot.Status.STAGED
                    if imported_entries > 0
                    else ChokepointSnapshot.Status.FAILED
                )
                snapshot.entry_count = imported_entries
                snapshot.summary = summary
                snapshot.validation_errors = "\n".join(warnings[:500])
                snapshot.save(update_fields=[
                    "source_sha", "status", "entry_count", "summary", "validation_errors", "updated_at",
                ])

            if imported_entries == 0:
                raise CommandError("Chokepoint import produced zero entries.")

            self.stdout.write(self.style.SUCCESS(
                f"Imported {imported_entries} chokepoint entries from {processed_files} files "
                f"(failed files: {failed_files}). Snapshot={snapshot.id}"
            ))

        except Exception as exc:
            snapshot.status = ChokepointSnapshot.Status.FAILED
            snapshot.validation_errors = (
                f"{exc}\n\n{snapshot.validation_errors}".strip()
                if snapshot.validation_errors
                else str(exc)
            )
            snapshot.save(update_fields=["status", "validation_errors", "updated_at"])
            raise
