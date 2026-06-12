"""Shared helpers for L1 portal snapshot and share URL generation."""

from __future__ import annotations

from django.conf import settings

from playbooks.models import DetectionPlaybook, L1PortalEntry, PlaybookGraph


def build_l1_portal_title(graph: PlaybookGraph) -> str:
    base = (getattr(graph, 'title', '') or 'Workbench').strip()
    return f"{base} + PB"


def build_l1_portal_share_url(token, request=None) -> str:
    token_value = str(token)
    relative_path = f"/l1-portal/{token_value}"

    public_base = (getattr(settings, 'PUBLIC_BASE_URL', '') or '').rstrip('/')
    if public_base:
        return f"{public_base}{relative_path}"

    if request is not None:
        try:
            return request.build_absolute_uri(relative_path)
        except Exception:
            pass

    frontend_base = (getattr(settings, 'FRONTEND_URL', '') or '').rstrip('/')
    if frontend_base:
        return f"{frontend_base}{relative_path}"

    return relative_path


def upsert_l1_portal_snapshot(graph: PlaybookGraph | None) -> L1PortalEntry | None:
    if graph is None:
        return None

    if (getattr(graph, 'status', '') or '').upper() != str(DetectionPlaybook.PlaybookStatus.DEPLOYED):
        return None

    defaults = {
        'organization': graph.organization,
        'title': build_l1_portal_title(graph),
        'response_playbook': graph.response_playbook or '',
        'known_false_positives': graph.false_positives or '',
        'blind_spots_coverage_gaps': graph.blind_spots or '',
    }

    entry, created = L1PortalEntry.objects.get_or_create(
        graph=graph,
        defaults=defaults,
    )
    if created:
        return entry

    changed = False
    for field, value in defaults.items():
        if getattr(entry, field) != value:
            setattr(entry, field, value)
            changed = True

    if changed:
        entry.save(
            update_fields=[
                'organization',
                'title',
                'response_playbook',
                'known_false_positives',
                'blind_spots_coverage_gaps',
                'updated_at',
            ]
        )

    return entry
