"""
Tests for system_update feature.

Covers:
- Superuser authorization enforcement (queries + mutation).
- Single-flight lock (only one job at a time).
- Command sequence selection by mode.
- Status and log endpoint behavior.
"""

import threading
import time
import tempfile
from unittest.mock import MagicMock, patch

from django.core.exceptions import PermissionDenied
from django.test import TestCase

from system_update.runner import (
    JOB_STATUS_FAILED,
    JOB_STATUS_RUNNING,
    JOB_STATUS_SUCCESS,
    UPDATE_MODE_FORCE,
    UPDATE_MODE_STANDARD,
    UpdateRunner,
    _FORCE_STEPS,
    _STANDARD_STEPS,
    _docker_compose_capability,
    _redact,
    _resolve_compose_cmd,
)
from system_update.schema import Query, StartSystemUpdate, _require_superuser


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_info(is_superuser: bool, is_anonymous: bool = False):
    """Create a minimal GraphQL info mock."""
    user = MagicMock()
    user.is_anonymous = is_anonymous
    user.is_superuser = is_superuser
    user.username = "testuser"
    user.id = 1
    context = MagicMock()
    context.user = user
    info = MagicMock()
    info.context = context
    return info


# ---------------------------------------------------------------------------
# Authorization tests
# ---------------------------------------------------------------------------


class TestSuperuserGuard(TestCase):
    """_require_superuser must raise PermissionDenied for non-superusers."""

    def test_anonymous_raises(self):
        info = _make_info(is_superuser=False, is_anonymous=True)
        with self.assertRaises(PermissionDenied):
            _require_superuser(info)

    def test_authenticated_non_superuser_raises(self):
        info = _make_info(is_superuser=False)
        with self.assertRaises(PermissionDenied):
            _require_superuser(info)

    def test_superuser_passes(self):
        info = _make_info(is_superuser=True)
        user = _require_superuser(info)
        self.assertEqual(user.username, "testuser")


class TestQueryAuthEnforcement(TestCase):
    """GraphQL query resolvers must enforce superuser access."""

    def test_system_update_info_requires_superuser(self):
        info = _make_info(is_superuser=False)
        with self.assertRaises(PermissionDenied):
            Query().resolve_system_update_info(info)

    def test_system_update_job_status_requires_superuser(self):
        info = _make_info(is_superuser=False)
        with self.assertRaises(PermissionDenied):
            Query().resolve_system_update_job_status(info, job_id="any")

    def test_system_update_job_logs_requires_superuser(self):
        info = _make_info(is_superuser=False)
        with self.assertRaises(PermissionDenied):
            Query().resolve_system_update_job_logs(info, job_id="any")

    def test_system_update_info_allowed_for_superuser(self):
        info = _make_info(is_superuser=True)
        result = Query().resolve_system_update_info(info)
        self.assertIsNotNone(result)
        self.assertIsNotNone(result.current_version)

    def test_system_update_job_status_returns_none_for_unknown(self):
        info = _make_info(is_superuser=True)
        result = Query().resolve_system_update_job_status(info, job_id="nonexistent-id")
        self.assertIsNone(result)

    def test_system_update_job_logs_returns_none_for_unknown(self):
        info = _make_info(is_superuser=True)
        result = Query().resolve_system_update_job_logs(info, job_id="nonexistent-id")
        self.assertIsNone(result)


class TestMutationAuthEnforcement(TestCase):
    """StartSystemUpdate mutation must enforce superuser access."""

    def test_non_superuser_raises(self):
        info = _make_info(is_superuser=False)
        with self.assertRaises(PermissionDenied):
            StartSystemUpdate.mutate(None, info, mode=UPDATE_MODE_STANDARD)

    def test_invalid_mode_returns_error(self):
        info = _make_info(is_superuser=True)
        with patch("system_update.schema.get_runner") as mock_get_runner:
            result = StartSystemUpdate.mutate(None, info, mode="invalid")
        self.assertFalse(result.success)
        self.assertIsNone(result.job_id)


# ---------------------------------------------------------------------------
# Command sequence selection
# ---------------------------------------------------------------------------


class TestCommandSequences(TestCase):
    """Verify the correct command lists are used per mode."""

    def test_standard_sequence_length(self):
        self.assertEqual(len(_STANDARD_STEPS), 3)

    def test_force_sequence_length(self):
        self.assertEqual(len(_FORCE_STEPS), 4)

    def test_standard_starts_with_pull(self):
        self.assertEqual(_STANDARD_STEPS[0], ["docker", "compose", "pull"])

    def test_force_starts_with_down(self):
        self.assertEqual(_FORCE_STEPS[0][-2:], ["down", "--remove-orphans"])

    def test_force_includes_pull_second(self):
        self.assertEqual(_FORCE_STEPS[1][-1], "pull")

    def test_standard_migrate_before_up(self):
        """Migrate step comes before the up step in standard mode."""
        cmds = [" ".join(s) for s in _STANDARD_STEPS]
        migrate_idx = next(i for i, c in enumerate(cmds) if "migrate" in c)
        up_idx = next(i for i, c in enumerate(cmds) if "up" in c)
        self.assertLess(migrate_idx, up_idx)

    def test_compose_command_can_be_overridden(self):
        with patch.dict("os.environ", {"HEFAISTOS_COMPOSE_CMD": "/usr/bin/docker compose"}, clear=False):
            self.assertEqual(_resolve_compose_cmd(), ["/usr/bin/docker", "compose"])

    def test_no_shell_true_in_sequences(self):
        """All command elements must be strings (no shell=True constructs)."""
        for step in _STANDARD_STEPS + _FORCE_STEPS:
            for token in step:
                self.assertIsInstance(token, str)


# ---------------------------------------------------------------------------
# Single-flight lock
# ---------------------------------------------------------------------------


class TestSingleFlightLock(TestCase):
    """Only one update job should run at a time."""

    def test_second_start_returns_conflict(self):
        runner = UpdateRunner()

        # Patch _run_job so the background thread does nothing
        start_barrier = threading.Barrier(2)
        finish_event = threading.Event()

        def _blocking_job(record):
            record.status = JOB_STATUS_RUNNING
            start_barrier.wait()   # signal we're running
            finish_event.wait()    # wait for test to allow finish
            record.status = JOB_STATUS_SUCCESS

        with patch.object(runner, "_run_job", side_effect=_blocking_job):
            r1 = runner.start(mode=UPDATE_MODE_STANDARD, actor="admin")
            self.assertTrue(r1.success)
            start_barrier.wait()  # wait until job is running

            r2 = runner.start(mode=UPDATE_MODE_STANDARD, actor="admin")
            self.assertFalse(r2.success)
            self.assertIn("already running", r2.message.lower())

        finish_event.set()

    def test_new_job_allowed_after_completion(self):
        runner = UpdateRunner()

        def _instant_success(record):
            record.status = JOB_STATUS_SUCCESS

        with patch.object(runner, "_run_job", side_effect=_instant_success):
            r1 = runner.start(mode=UPDATE_MODE_STANDARD, actor="admin")
            self.assertTrue(r1.success)
            # Allow thread to complete
            time.sleep(0.05)
            r2 = runner.start(mode=UPDATE_MODE_STANDARD, actor="admin")
            self.assertTrue(r2.success)


# ---------------------------------------------------------------------------
# Status and log endpoint behavior
# ---------------------------------------------------------------------------


class TestStatusAndLogs(TestCase):
    """Verify job status and log retrieval."""

    def test_get_status_returns_none_for_unknown_job(self):
        runner = UpdateRunner()
        self.assertIsNone(runner.get_status("does-not-exist"))

    def test_get_logs_returns_none_for_unknown_job(self):
        runner = UpdateRunner()
        self.assertIsNone(runner.get_logs("does-not-exist"))

    def test_job_status_populated_after_start(self):
        runner = UpdateRunner()
        finish_event = threading.Event()

        def _hold(record):
            record.status = JOB_STATUS_RUNNING
            finish_event.wait()
            record.status = JOB_STATUS_SUCCESS

        with patch.object(runner, "_run_job", side_effect=_hold):
            result = runner.start(mode=UPDATE_MODE_STANDARD, actor="admin")
            self.assertTrue(result.success)
            status = runner.get_status(result.job_id)
            self.assertIsNotNone(status)
            self.assertEqual(status.job_id, result.job_id)
        finish_event.set()

    def test_logs_are_returned_after_append(self):
        runner = UpdateRunner()
        finish_event = threading.Event()

        def _log_and_hold(record):
            record.status = JOB_STATUS_RUNNING
            record.append_log("hello world")
            finish_event.wait()
            record.status = JOB_STATUS_SUCCESS

        with patch.object(runner, "_run_job", side_effect=_log_and_hold):
            result = runner.start(mode=UPDATE_MODE_STANDARD, actor="admin")
            # Give thread a moment to log
            time.sleep(0.05)
            logs = runner.get_logs(result.job_id)
            self.assertIsNotNone(logs)
            self.assertTrue(any("hello world" in l for l in logs))
        finish_event.set()


# ---------------------------------------------------------------------------
# Secret redaction
# ---------------------------------------------------------------------------


class TestSecretRedaction(TestCase):
    def test_password_redacted(self):
        line = "export DB_PASSWORD=supersecret123"
        redacted = _redact(line)
        self.assertNotIn("supersecret123", redacted)
        self.assertIn("[REDACTED]", redacted)

    def test_token_redacted(self):
        line = "TOKEN=abc123xyz"
        redacted = _redact(line)
        self.assertNotIn("abc123xyz", redacted)

    def test_plain_line_unchanged(self):
        line = "docker compose pull"
        self.assertEqual(_redact(line), line)


class TestCapabilityDetection(TestCase):
    def test_compose_dir_missing_returns_unavailable(self):
        with patch("system_update.runner.COMPOSE_WORK_DIR", "/nonexistent/hefaistos-compose-dir"):
            capable, note = _docker_compose_capability()
        self.assertFalse(capable)
        self.assertIn("does not exist", note)

    def test_compose_probe_success(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            mock_result = MagicMock(returncode=0, stderr="", stdout="Docker Compose version v2")
            with patch("system_update.runner.COMPOSE_WORK_DIR", tmpdir), patch(
                "system_update.runner.subprocess.run", return_value=mock_result
            ):
                capable, note = _docker_compose_capability()
        self.assertTrue(capable)
        self.assertIn("Available via", note)
