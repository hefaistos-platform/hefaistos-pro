"""
Async runners for Data Catalog ATT&CK import jobs.
"""

import logging
import threading
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def run_attack_data_import_job(job_id: str) -> None:
    """
    Dispatch an ATT&CK import into a background daemon thread.
    """
    thread = threading.Thread(target=_execute_attack_data_import_job, args=(job_id,), daemon=True)
    thread.start()


def _execute_attack_data_import_job(job_id: str) -> None:
    from data_catalog.attack_import import import_attack_data_sources_for_organization
    from data_catalog.models import AttackDataImportJob

    try:
        job = AttackDataImportJob.objects.get(id=job_id)
    except AttackDataImportJob.DoesNotExist:
        logger.error("AttackDataImportJob %s not found", job_id)
        return

    job.status = AttackDataImportJob.Status.RUNNING
    job.progress_percent = 5
    job.progress_message = "Starting ATT&CK import"
    job.started_at = datetime.now(tz=timezone.utc)
    job.save(
        update_fields=[
            'status',
            'progress_percent',
            'progress_message',
            'started_at',
            'updated_at',
        ]
    )

    def _on_progress(payload: dict) -> None:
        changed = []

        progress = payload.get('progress_percent')
        if progress is not None:
            safe_progress = max(0, min(100, int(progress)))
            if job.progress_percent != safe_progress:
                job.progress_percent = safe_progress
                changed.append('progress_percent')

        message = payload.get('message')
        if message is not None:
            safe_message = str(message)[:255]
            if job.progress_message != safe_message:
                job.progress_message = safe_message
                changed.append('progress_message')

        for field_name in ('created_count', 'skipped_count', 'failed_count', 'total_candidates'):
            value = payload.get(field_name)
            if value is None:
                continue
            safe_value = max(0, int(value))
            if getattr(job, field_name) != safe_value:
                setattr(job, field_name, safe_value)
                changed.append(field_name)

        log_line = payload.get('log_line')
        if log_line:
            clipped = str(log_line).strip()
            if clipped:
                if job.log:
                    job.log = f"{job.log}\n{clipped}"[:10000]
                else:
                    job.log = clipped[:10000]
                changed.append('log')

        if changed:
            changed.append('updated_at')
            job.save(update_fields=changed)

    try:
        result = import_attack_data_sources_for_organization(
            organization=job.organization,
            version=job.version or None,
            on_progress=_on_progress,
        )
        job.status = AttackDataImportJob.Status.SUCCESS
        job.progress_percent = 100
        job.progress_message = "ATT&CK import completed"
        job.created_count = int(result.get('created_count', 0) or 0)
        job.skipped_count = int(result.get('skipped_count', 0) or 0)
        job.failed_count = int(result.get('failed_count', 0) or 0)
        job.total_candidates = int(result.get('total_candidates', 0) or 0)
        job.version = str(result.get('version') or job.version or '')[:20]
        summary = (
            f"Import completed: created={job.created_count}, skipped={job.skipped_count}, "
            f"failed={job.failed_count}, total={job.total_candidates}."
        )
        if job.log:
            job.log = f"{job.log}\n{summary}"[:10000]
        else:
            job.log = summary[:10000]
        job.error = ''
    except Exception as exc:
        logger.exception("AttackDataImportJob %s failed: %s", job_id, exc)
        job.status = AttackDataImportJob.Status.FAILED
        job.progress_message = "ATT&CK import failed"
        job.error = str(exc)[:5000]
        if job.log:
            job.log = f"{job.log}\nImport failed: {exc}"[:10000]
        else:
            job.log = f"Import failed: {exc}"[:10000]

    job.finished_at = datetime.now(tz=timezone.utc)
    job.save(
        update_fields=[
            'status',
            'progress_percent',
            'progress_message',
            'created_count',
            'skipped_count',
            'failed_count',
            'total_candidates',
            'version',
            'log',
            'error',
            'finished_at',
            'updated_at',
        ]
    )
