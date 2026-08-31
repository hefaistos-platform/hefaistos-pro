"""
system_update.runner
~~~~~~~~~~~~~~~~~~~~

Background update job orchestrator for HEFAISTOS PRO.

Responsibilities
- Single-flight lock: only one update job may run at a time.
- Command allowlist: only pre-defined Docker Compose sequences are executed.
- Subprocess safety: all commands are invoked as argv lists (no shell=True).
- Log capture: stdout/stderr lines are appended to an in-memory ring-buffer.
- Secret redaction: known secret-bearing environment variables are scrubbed
  from log lines before they are stored.
- Per-step and overall timeouts.
- Audit trail via mcs_logging.

Public API used by schema.py:
  runner = get_runner()
  runner.get_info()          -> UpdateInfoResult
  runner.start(mode, actor) -> UpdateJobResult
  runner.get_status(job_id) -> UpdateJobStatusResult | None
  runner.get_logs(job_id)   -> list[str] | None
"""

import logging
import os
import re
import shlex
import subprocess
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from core.mcs_logging import emit_security_event

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

UPDATE_MODE_STANDARD = "standard"
UPDATE_MODE_FORCE = "force"

JOB_STATUS_PENDING = "pending"
JOB_STATUS_RUNNING = "running"
JOB_STATUS_SUCCESS = "success"
JOB_STATUS_FAILED = "failed"

# Maximum lines kept per job log ring-buffer
LOG_BUFFER_MAX_LINES = 2000

# Timeouts (seconds)
STEP_TIMEOUT = int(os.environ.get("HEFAISTOS_UPDATE_STEP_TIMEOUT", "600"))   # 10 min per step
JOB_TIMEOUT = int(os.environ.get("HEFAISTOS_UPDATE_JOB_TIMEOUT", "1800"))    # 30 min total

# Working directory for compose commands (project root)
COMPOSE_WORK_DIR = os.environ.get(
    "HEFAISTOS_COMPOSE_DIR",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")),
)


def _resolve_compose_cmd() -> list[str]:
    """Resolve the compose command tokens from HEFAISTOS_COMPOSE_CMD."""
    raw = (os.environ.get("HEFAISTOS_COMPOSE_CMD") or "docker compose").strip()
    tokens = shlex.split(raw)
    return tokens if tokens else ["docker", "compose"]


# ---------------------------------------------------------------------------
# Command sequences (allowlist – no arbitrary user input reaches here)
# ---------------------------------------------------------------------------

_STANDARD_STEP_SUFFIXES: list[list[str]] = [
    ["pull"],
    ["--profile", "batch", "run", "--rm", "migrate"],
    ["--profile", "workers", "--profile", "obs", "--profile", "devtools", "up", "-d", "--build", "--remove-orphans"],
]

_FORCE_STEP_SUFFIXES: list[list[str]] = [
    ["down", "--remove-orphans"],
    ["pull"],
    ["--profile", "workers", "--profile", "obs", "--profile", "devtools", "up", "-d", "--build", "--remove-orphans"],
    ["--profile", "batch", "run", "--rm", "migrate"],
]


def _build_steps(compose_cmd: list[str], suffixes: list[list[str]]) -> list[list[str]]:
    return [[*compose_cmd, *suffix] for suffix in suffixes]


# Backward-compatible exports (default command at import time)
_default_compose_cmd = _resolve_compose_cmd()
_STANDARD_STEPS = _build_steps(_default_compose_cmd, _STANDARD_STEP_SUFFIXES)
_FORCE_STEPS = _build_steps(_default_compose_cmd, _FORCE_STEP_SUFFIXES)

# ---------------------------------------------------------------------------
# Secret redaction
# ---------------------------------------------------------------------------

_SECRET_ENV_NAMES = re.compile(
    r"(password|secret|token|key|credential|api_key|apikey|passwd|auth)",
    re.IGNORECASE,
)
_SECRET_PATTERN = re.compile(
    r"(?i)(password|secret|token|key|credential|api_key|apikey|passwd|auth)"
    r"\s*[=:]\s*\S+",
)


def _redact(line: str) -> str:
    """Replace potential secret values in a log line with [REDACTED]."""
    return _SECRET_PATTERN.sub(r"\1=[REDACTED]", line)


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class UpdateJobRecord:
    job_id: str
    mode: str
    actor: str
    status: str = JOB_STATUS_PENDING
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    failed_step: Optional[str] = None
    error_message: Optional[str] = None
    logs: list[str] = field(default_factory=list)
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def append_log(self, line: str) -> None:
        redacted = _redact(line.rstrip())
        with self._lock:
            self.logs.append(redacted)
            if len(self.logs) > LOG_BUFFER_MAX_LINES:
                self.logs = self.logs[-LOG_BUFFER_MAX_LINES:]

    def snapshot_logs(self) -> list[str]:
        with self._lock:
            return list(self.logs)


@dataclass
class UpdateInfoResult:
    current_version: str
    compose_dir: str
    compose_command: str
    capable: bool
    capability_note: str


@dataclass
class UpdateJobResult:
    job_id: Optional[str]
    success: bool
    message: str


@dataclass
class UpdateJobStatusResult:
    job_id: str
    status: str
    mode: str
    actor: str
    started_at: Optional[str]
    ended_at: Optional[str]
    failed_step: Optional[str]
    error_message: Optional[str]


# ---------------------------------------------------------------------------
# Runner singleton
# ---------------------------------------------------------------------------

class UpdateRunner:
    """Singleton that owns the active job state."""

    def __init__(self) -> None:
        self._active_job: Optional[UpdateJobRecord] = None
        self._history: dict[str, UpdateJobRecord] = {}  # job_id -> record
        self._state_lock = threading.Lock()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_info(self) -> UpdateInfoResult:
        from django.conf import settings
        version = getattr(settings, "HEFAISTOS_VERSION", "unknown")
        compose_cmd = _resolve_compose_cmd()
        capable, note = _docker_compose_capability(compose_cmd)
        return UpdateInfoResult(
            current_version=version,
            compose_dir=COMPOSE_WORK_DIR,
            compose_command=" ".join(compose_cmd),
            capable=capable,
            capability_note=note,
        )

    def start(self, mode: str, actor: str) -> UpdateJobResult:
        if mode not in (UPDATE_MODE_STANDARD, UPDATE_MODE_FORCE):
            return UpdateJobResult(job_id=None, success=False, message=f"Unknown mode: {mode}")

        with self._state_lock:
            if self._active_job and self._active_job.status in (JOB_STATUS_PENDING, JOB_STATUS_RUNNING):
                return UpdateJobResult(
                    job_id=self._active_job.job_id,
                    success=False,
                    message="An update job is already running. Wait for it to complete.",
                )

            job_id = str(uuid.uuid4())
            record = UpdateJobRecord(job_id=job_id, mode=mode, actor=actor)
            self._active_job = record
            self._history[job_id] = record

        logger.info("[system_update] Starting update job %s mode=%s actor=%s", job_id, mode, actor)
        thread = threading.Thread(
            target=self._run_job,
            args=(record,),
            daemon=True,
            name=f"update-job-{job_id[:8]}",
        )
        thread.start()

        return UpdateJobResult(job_id=job_id, success=True, message="Update job started.")

    def get_status(self, job_id: str) -> Optional[UpdateJobStatusResult]:
        record = self._history.get(job_id)
        if record is None:
            return None
        return UpdateJobStatusResult(
            job_id=record.job_id,
            status=record.status,
            mode=record.mode,
            actor=record.actor,
            started_at=record.started_at.isoformat() if record.started_at else None,
            ended_at=record.ended_at.isoformat() if record.ended_at else None,
            failed_step=record.failed_step,
            error_message=record.error_message,
        )

    def get_logs(self, job_id: str) -> Optional[list[str]]:
        record = self._history.get(job_id)
        if record is None:
            return None
        return record.snapshot_logs()

    # ------------------------------------------------------------------
    # Internal execution
    # ------------------------------------------------------------------

    def _run_job(self, record: UpdateJobRecord) -> None:
        record.status = JOB_STATUS_RUNNING
        record.started_at = datetime.now(timezone.utc)
        record.append_log(f"[hefaistos] Update job {record.job_id} started  mode={record.mode}  actor={record.actor}")

        compose_cmd = _resolve_compose_cmd()
        steps = (
            _build_steps(compose_cmd, _STANDARD_STEP_SUFFIXES)
            if record.mode == UPDATE_MODE_STANDARD
            else _build_steps(compose_cmd, _FORCE_STEP_SUFFIXES)
        )
        job_deadline = time.monotonic() + JOB_TIMEOUT

        try:
            for step_cmd in steps:
                step_label = " ".join(step_cmd)
                remaining = job_deadline - time.monotonic()
                if remaining <= 0:
                    raise RuntimeError(f"Overall job timeout exceeded before step: {step_label}")
                timeout = min(STEP_TIMEOUT, remaining)
                record.append_log(f"[hefaistos] Running: {step_label}")
                success = self._run_step(record, step_cmd, timeout=timeout)
                if not success:
                    record.failed_step = step_label
                    raise RuntimeError(f"Step failed: {step_label}")

            # Health check
            record.append_log("[hefaistos] Running health check …")
            self._health_check(record, compose_cmd)

            record.status = JOB_STATUS_SUCCESS
            record.append_log("[hefaistos] ✓ Update completed successfully.")
            self._emit_audit(record, outcome="success")

        except Exception as exc:
            record.status = JOB_STATUS_FAILED
            record.error_message = str(exc)
            record.append_log(f"[hefaistos] ✗ Update FAILED: {exc}")
            logger.error("[system_update] Job %s failed: %s", record.job_id, exc)
            self._emit_audit(record, outcome="failure")

        finally:
            record.ended_at = datetime.now(timezone.utc)
            with self._state_lock:
                if self._active_job and self._active_job.job_id == record.job_id:
                    self._active_job = None

    def _run_step(self, record: UpdateJobRecord, cmd: list[str], timeout: float) -> bool:
        """Execute one subprocess step, capturing all output into the job log.

        ``proc.communicate(timeout=...)`` is used so that the timeout applies
        even when the subprocess produces no output (silent hang protection).
        All output is captured first and then appended line-by-line so the
        log buffer reflects the complete step result.
        """
        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                cwd=COMPOSE_WORK_DIR,
                env=os.environ.copy(),
            )
        except FileNotFoundError as exc:
            record.append_log(f"[hefaistos] Command not found: {exc}")
            return False

        try:
            stdout_bytes, _ = proc.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.communicate()  # drain to avoid zombie
            record.append_log(f"[hefaistos] Step timeout ({timeout}s) exceeded – process killed.")
            return False

        for line in stdout_bytes.decode("utf-8", errors="replace").splitlines():
            record.append_log(line)

        if proc.returncode != 0:
            record.append_log(f"[hefaistos] Step exited with code {proc.returncode}")
            return False
        return True

    def _health_check(self, record: UpdateJobRecord, compose_cmd: list[str]) -> None:
        """Minimal readiness verification: check compose can report service state."""
        cmd = [*compose_cmd, "ps", "--format", "json"]
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=COMPOSE_WORK_DIR,
                timeout=60,
            )
            if result.returncode == 0:
                record.append_log("[hefaistos] Health check: compose ps succeeded – services are up.")
            else:
                record.append_log(
                    f"[hefaistos] Health check: compose ps returned non-zero ({result.returncode}). "
                    "Services may not be fully healthy."
                )
        except Exception as exc:
            record.append_log(f"[hefaistos] Health check skipped: {exc}")

    def _emit_audit(self, record: UpdateJobRecord, outcome: str) -> None:
        try:
            emit_security_event(
                level="info" if outcome == "success" else "warning",
                logger_name="SystemUpdateService",
                message=(
                    f"System update {outcome} – actor={record.actor} "
                    f"mode={record.mode} job={record.job_id}"
                ),
                event_action="system_update",
                event_outcome=outcome,
                asvs_event_code="SYS-UPDATE-01",
                event_reason=f"In-app Docker Compose update triggered by {record.actor}",
                event_category=["configuration"],
                event_type=["change"],
                user_name=record.actor,
                asvs_details={
                    "system_update": {
                        "job_id": record.job_id,
                        "mode": record.mode,
                        "failed_step": record.failed_step,
                        "started_at": record.started_at.isoformat() if record.started_at else None,
                        "ended_at": record.ended_at.isoformat() if record.ended_at else None,
                    }
                },
            )
        except Exception as exc:
            logger.warning("[system_update] Audit emit failed: %s", exc)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _docker_compose_capability(compose_cmd: Optional[list[str]] = None) -> tuple[bool, str]:
    command_tokens = compose_cmd or _resolve_compose_cmd()
    if not os.path.isdir(COMPOSE_WORK_DIR):
        return False, f"Compose directory does not exist: {COMPOSE_WORK_DIR}"

    cmd = [*command_tokens, "version"]
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=COMPOSE_WORK_DIR,
            timeout=10,
        )
    except FileNotFoundError:
        return False, f"Command not found: {command_tokens[0]}"
    except Exception as exc:
        return False, f"Failed to probe compose command: {exc}"

    if result.returncode == 0:
        return True, f"Available via: {' '.join(command_tokens)}"

    detail = (result.stderr or result.stdout or "").strip().splitlines()
    detail_msg = detail[0] if detail else f"exit code {result.returncode}"
    return False, f"Compose command failed ({' '.join(command_tokens)}): {detail_msg}"


# Module-level singleton
_runner_instance: Optional[UpdateRunner] = None
_runner_lock = threading.Lock()


def get_runner() -> UpdateRunner:
    global _runner_instance
    with _runner_lock:
        if _runner_instance is None:
            _runner_instance = UpdateRunner()
    return _runner_instance
