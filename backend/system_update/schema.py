"""
system_update.schema
~~~~~~~~~~~~~~~~~~~~

GraphQL schema for the system update feature.
All resolvers and mutations are restricted to Django superusers only.
"""

import logging

import graphene
from django.core.exceptions import PermissionDenied

from core.mcs_logging import emit_security_event, extract_client_ip
from system_update.runner import (
    UPDATE_MODE_FORCE,
    UPDATE_MODE_STANDARD,
    get_runner,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Guards
# ---------------------------------------------------------------------------

def _require_superuser(info):
    """Raise PermissionDenied unless the requesting user is a Django superuser."""
    user = getattr(info.context, "user", None)
    if not user or user.is_anonymous:
        emit_security_event(
            level="warning",
            logger_name="SystemUpdateService",
            message="Unauthenticated request to system update endpoint.",
            event_action="system_update_access",
            event_outcome="failure",
            asvs_event_code="AUTHZ-DENY-02",
            event_reason="Authentication required.",
            event_category=["authorization"],
            event_type=["denied"],
            user_id="anonymous",
            source_ip=extract_client_ip(info.context),
            request=info.context,
        )
        raise PermissionDenied("Authentication required.")
    if not getattr(user, "is_superuser", False):
        emit_security_event(
            level="warning",
            logger_name="SystemUpdateService",
            message=f"Non-superuser '{user.username}' attempted system update access.",
            event_action="system_update_access",
            event_outcome="failure",
            asvs_event_code="AUTHZ-DENY-02",
            event_reason="Superuser access required for system updates.",
            event_category=["authorization"],
            event_type=["denied"],
            user_id=str(getattr(user, "id", "unknown")),
            user_name=getattr(user, "username", None),
            source_ip=extract_client_ip(info.context),
            request=info.context,
        )
        raise PermissionDenied("System updates require superuser privileges.")
    return user


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

class SystemUpdateInfoType(graphene.ObjectType):
    current_version = graphene.String(description="Current HEFAISTOS PRO version string.")
    compose_dir = graphene.String(description="Working directory used for Docker Compose commands.")
    capable = graphene.Boolean(description="True if docker compose is available on the host.")
    capability_note = graphene.String(description="Human-readable note about update capability.")


class SystemUpdateJobStatusType(graphene.ObjectType):
    job_id = graphene.String()
    status = graphene.String(description="pending | running | success | failed")
    mode = graphene.String(description="standard | force")
    actor = graphene.String(description="Username who triggered the update.")
    started_at = graphene.String()
    ended_at = graphene.String()
    failed_step = graphene.String()
    error_message = graphene.String()


class StartSystemUpdateResult(graphene.ObjectType):
    job_id = graphene.String()
    success = graphene.Boolean()
    message = graphene.String()


# ---------------------------------------------------------------------------
# Query
# ---------------------------------------------------------------------------

class Query(graphene.ObjectType):
    system_update_info = graphene.Field(
        SystemUpdateInfoType,
        description="Return current version and update capability status. Superuser only.",
    )

    system_update_job_status = graphene.Field(
        SystemUpdateJobStatusType,
        job_id=graphene.String(required=True),
        description="Get the status of an update job by ID. Superuser only.",
    )

    system_update_job_logs = graphene.List(
        graphene.String,
        job_id=graphene.String(required=True),
        description="Get log lines for an update job. Superuser only.",
    )

    def resolve_system_update_info(self, info):
        _require_superuser(info)
        runner = get_runner()
        result = runner.get_info()
        return SystemUpdateInfoType(
            current_version=result.current_version,
            compose_dir=result.compose_dir,
            capable=result.capable,
            capability_note=result.capability_note,
        )

    def resolve_system_update_job_status(self, info, job_id: str):
        _require_superuser(info)
        runner = get_runner()
        record = runner.get_status(job_id)
        if record is None:
            return None
        return SystemUpdateJobStatusType(
            job_id=record.job_id,
            status=record.status,
            mode=record.mode,
            actor=record.actor,
            started_at=record.started_at,
            ended_at=record.ended_at,
            failed_step=record.failed_step,
            error_message=record.error_message,
        )

    def resolve_system_update_job_logs(self, info, job_id: str):
        _require_superuser(info)
        runner = get_runner()
        return runner.get_logs(job_id)


# ---------------------------------------------------------------------------
# Mutation
# ---------------------------------------------------------------------------

class StartSystemUpdate(graphene.Mutation):
    class Arguments:
        mode = graphene.String(
            required=False,
            default_value=UPDATE_MODE_STANDARD,
            description="Update mode: 'standard' (default low-downtime) or 'force' (down/up recovery).",
        )

    Output = StartSystemUpdateResult

    @staticmethod
    def mutate(root, info, mode: str = UPDATE_MODE_STANDARD):
        user = _require_superuser(info)
        actor = getattr(user, "username", str(getattr(user, "id", "unknown")))

        if mode not in (UPDATE_MODE_STANDARD, UPDATE_MODE_FORCE):
            return StartSystemUpdateResult(
                job_id=None,
                success=False,
                message=f"Invalid mode '{mode}'. Use 'standard' or 'force'.",
            )

        runner = get_runner()
        result = runner.start(mode=mode, actor=actor)
        return StartSystemUpdateResult(
            job_id=result.job_id,
            success=result.success,
            message=result.message,
        )


class Mutation(graphene.ObjectType):
    start_system_update = StartSystemUpdate.Field(
        description="Start an asynchronous system update job. Superuser only.",
    )
