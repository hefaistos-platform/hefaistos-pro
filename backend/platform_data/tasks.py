"""
Async runner for MITRE import jobs.

Uses a background thread so the GraphQL mutation can return immediately while
the long-running `import_mitre_universal` management command executes.
The job record (MitreImportJob) is updated with status, log and timestamps.
"""
import io
import logging
import threading
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def run_mitre_import_job(job_id: str) -> None:
    """
    Dispatch the import in a daemon thread.  Returns immediately; the thread
    updates the MitreImportJob row as it progresses.
    """
    t = threading.Thread(target=_execute_job, args=(job_id,), daemon=True)
    t.start()


def _execute_job(job_id: str) -> None:
    """Background thread: run the import command and persist results."""
    from django.core.management import call_command
    from platform_data.models import MitreImportJob

    try:
        job = MitreImportJob.objects.get(id=job_id)
    except MitreImportJob.DoesNotExist:
        logger.error("MitreImportJob %s not found", job_id)
        return

    job.status = MitreImportJob.Status.RUNNING
    job.started_at = datetime.now(tz=timezone.utc)
    job.save(update_fields=['status', 'started_at', 'updated_at'])

    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()

    try:
        call_command(
            'import_mitre_universal',
            mitre_version=job.version,
            mode=job.mode.lower(),
            stdout=stdout_buf,
            stderr=stderr_buf,
        )
        job.status = MitreImportJob.Status.SUCCESS
        job.error = stderr_buf.getvalue()
    except Exception as exc:
        logger.exception("MitreImportJob %s failed: %s", job_id, exc)
        job.status = MitreImportJob.Status.FAILED
        job.error = f"{exc}\n\n{stderr_buf.getvalue()}"

    job.log = stdout_buf.getvalue()
    job.finished_at = datetime.now(tz=timezone.utc)
    job.save(update_fields=['status', 'log', 'error', 'finished_at', 'updated_at'])
