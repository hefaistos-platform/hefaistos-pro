"""HEFAISTOS instance-to-instance sharing helpers (PULL-only)."""

from __future__ import annotations

import hashlib
import os
import secrets
import socket
import uuid
from typing import Any

import requests
from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.utils import timezone

from organizations.models import (
    HefaistosInboundShareKey,
    HefaistosInstanceIdentity,
    HefaistosPullJob,
    HefaistosRemotePeer,
    SHARING_SCOPE_VALUES,
)

ATOMIC_SCOPES = ('WORKBENCH', 'RULES', 'ACH')


def normalize_scope(scope: str | None) -> str:
    value = str(scope or 'ALL').strip().upper()
    if value not in SHARING_SCOPE_VALUES:
        raise ValueError(f"Unsupported sharing scope '{scope}'.")
    return value


def expand_scope(scope: str) -> set[str]:
    normalized = normalize_scope(scope)
    if normalized == 'ALL':
        return set(ATOMIC_SCOPES)
    return {normalized}


def key_allows_scope(allowed_scopes: list[str] | None, requested_scope: str) -> bool:
    requested = normalize_scope(requested_scope)
    allowed = {str(scope).strip().upper() for scope in (allowed_scopes or []) if str(scope).strip()}
    if not allowed:
        return False
    if 'ALL' in allowed:
        return True
    if requested == 'ALL':
        return set(ATOMIC_SCOPES).issubset(allowed)
    return requested in allowed


def hash_api_key(raw_key: str) -> str:
    return hashlib.sha256((raw_key or '').encode('utf-8')).hexdigest()


def build_key_hint(raw_key: str) -> str:
    if len(raw_key or '') < 8:
        return '****'
    return f"{raw_key[:4]}...{raw_key[-4:]}"


def generate_raw_share_key() -> str:
    return f"hefshare_{secrets.token_urlsafe(36)}"


def _normalized_fingerprint(value: str) -> str:
    return ''.join(ch for ch in (value or '') if ch.isalnum()).lower()


def _instance_seed() -> str:
    server_domain = os.environ.get('SERVER_DOMAIN', '').strip()
    host = server_domain or socket.gethostname() or 'localhost'
    secret = getattr(settings, 'SECRET_KEY', 'hefaistos')
    return f"hefaistos-instance:{host}:{secret[:32]}"


def get_or_create_instance_identity(create_if_missing: bool = True) -> HefaistosInstanceIdentity:
    default_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, _instance_seed())
    identity = HefaistosInstanceIdentity.objects.filter(singleton_key='default').first()
    if identity is None:
        if not create_if_missing:
            # Return deterministic UUID v5 identity without persisting DB state.
            return HefaistosInstanceIdentity(singleton_key='default', instance_id=default_uuid)
        identity = HefaistosInstanceIdentity.objects.create(
            singleton_key='default',
            instance_id=default_uuid,
        )
    elif identity.instance_id.version != 5 and create_if_missing:
        identity.instance_id = default_uuid
        identity.save(update_fields=['instance_id', 'updated_at'])
    return identity


def authenticate_inbound_key(
    raw_key: str,
    requested_scope: str | None = None,
    touch_last_used: bool = False,
) -> HefaistosInboundShareKey:
    if not raw_key:
        raise PermissionDenied('Missing sharing API key.')

    key_hash = hash_api_key(raw_key)
    share_key = HefaistosInboundShareKey.objects.select_related('organization').filter(
        key_hash=key_hash,
        is_active=True,
    ).first()
    if share_key is None:
        raise PermissionDenied('Invalid sharing API key.')

    now = timezone.now()
    if share_key.expires_at and share_key.expires_at <= now:
        raise PermissionDenied('Sharing API key has expired.')

    if requested_scope and not key_allows_scope(share_key.allowed_scopes, requested_scope):
        raise PermissionDenied('Sharing API key does not allow this pull scope.')

    if touch_last_used:
        share_key.last_used_at = now
        share_key.save(update_fields=['last_used_at'])
    return share_key


def _workbench_payload_for_org(organization) -> list[dict[str, Any]]:
    from playbooks.models import PlaybookGraph
    from playbooks.schema import serialize_playbook_graph_hex_v2

    graphs = PlaybookGraph.objects.filter(
        organization=organization,
    ).select_related(
        'author',
        'mitre_technique',
    ).prefetch_related(
        'tags',
        'edges',
        'nodes__mitre_attack_mappings',
    )
    return [serialize_playbook_graph_hex_v2(graph) for graph in graphs]


def _rules_payload_for_org(organization) -> list[dict[str, Any]]:
    from rules.models import DetectionRule

    rules = DetectionRule.objects.filter(
        organization=organization,
    ).select_related('repository', 'playbook')

    payload = []
    for rule in rules:
        payload.append({
            'title': rule.title,
            'sigma_id': str(rule.sigma_id) if rule.sigma_id else '',
            'format': rule.format,
            'status': rule.status or '',
            'description': rule.description or '',
            'author': rule.author or '',
            'raw_content': rule.raw_content or '',
            'repository_name': getattr(rule.repository, 'name', '') or '',
            'repository_url': getattr(rule.repository, 'git_url', '') or '',
            'playbook_title': getattr(rule.playbook, 'title', '') or '',
            'created_at': rule.created_at.isoformat() if rule.created_at else '',
            'updated_at': rule.updated_at.isoformat() if rule.updated_at else '',
        })
    return payload


def _ach_payload_for_org(organization) -> list[dict[str, Any]]:
    from ach.models import ACHAnalysis, MatrixCell

    analyses = ACHAnalysis.objects.filter(
        owner__organization=organization,
    ).select_related('owner').prefetch_related(
        'hypotheses__mitre_technique',
        'evidence_items',
    )

    payload = []
    for analysis in analyses:
        hypotheses = list(analysis.hypotheses.all().order_by('sequence'))
        evidence_items = list(analysis.evidence_items.all().order_by('sequence'))
        hypothesis_index = {hyp.id: idx for idx, hyp in enumerate(hypotheses)}
        evidence_index = {ev.id: idx for idx, ev in enumerate(evidence_items)}

        matrix_entries = []
        matrix_cells = MatrixCell.objects.filter(
            hypothesis__analysis=analysis,
            evidence__analysis=analysis,
        ).select_related('hypothesis', 'evidence')
        for cell in matrix_cells:
            h_idx = hypothesis_index.get(cell.hypothesis_id)
            e_idx = evidence_index.get(cell.evidence_id)
            if h_idx is None or e_idx is None:
                continue
            matrix_entries.append({
                'hypothesis_index': h_idx,
                'evidence_index': e_idx,
                'score': cell.score,
                'notes': cell.notes or '',
            })

        payload.append({
            'title': analysis.title,
            'description': analysis.description or '',
            'status': analysis.status,
            'saved_as_template': bool(analysis.saved_as_template),
            'hypotheses': [{
                'content': hyp.content,
                'is_proven': bool(hyp.is_proven),
                'sequence': hyp.sequence,
                'mitre_technique_id': hyp.mitre_technique.technique_id if hyp.mitre_technique else '',
            } for hyp in hypotheses],
            'evidence': [{
                'content': ev.content,
                'credibility': ev.credibility,
                'relevance': ev.relevance or '',
                'sequence': ev.sequence,
                'log_reference': ev.log_reference or '',
            } for ev in evidence_items],
            'matrix': matrix_entries,
        })
    return payload


def export_org_payload(
    organization,
    requested_scope: str,
    create_identity_if_missing: bool = True,
) -> dict[str, Any]:
    scope = normalize_scope(requested_scope)
    include_scopes = expand_scope(scope)
    instance_identity = get_or_create_instance_identity(create_if_missing=create_identity_if_missing)

    payload: dict[str, Any] = {
        'schema_version': '1.0',
        'instance_id': str(instance_identity.instance_id),
        'generated_at': timezone.now().isoformat(),
        'scope': scope,
        'workbenches': [],
        'rules': [],
        'ach': [],
    }

    if 'WORKBENCH' in include_scopes:
        payload['workbenches'] = _workbench_payload_for_org(organization)
    if 'RULES' in include_scopes:
        payload['rules'] = _rules_payload_for_org(organization)
    if 'ACH' in include_scopes:
        payload['ach'] = _ach_payload_for_org(organization)

    return payload


def _import_workbenches(
    workbench_payload: list[dict[str, Any]],
    organization,
    actor,
    peer: HefaistosRemotePeer,
    summary: dict[str, dict[str, int]],
    errors: list[str],
) -> None:
    from playbooks.models import PlaybookGraph
    from playbooks.schema import deserialize_playbook_graph_hex_v2, update_playbook_graph_from_hex_v2

    for idx, hex_doc in enumerate(workbench_payload or []):
        try:
            if not isinstance(hex_doc, dict) or hex_doc.get('hex_format') != '2.0':
                raise ValueError('Invalid HEX payload')
            title = ((hex_doc.get('metadata') or {}).get('name') or '').strip()
            if not title:
                raise ValueError('HEX metadata.name is required')

            with transaction.atomic():
                existing = PlaybookGraph.objects.filter(organization=organization, title=title).first()
                if existing is not None:
                    graph = update_playbook_graph_from_hex_v2(hex_doc, existing, actor, title)
                    summary['workbenches']['updated'] += 1
                else:
                    graph = deserialize_playbook_graph_hex_v2(hex_doc, organization, actor)
                    summary['workbenches']['created'] += 1

                graph.imported_from_repo = peer.remote_url
                graph.imported_from_commit_sha = ''
                graph.imported_from_path = f"remote://{peer.remote_instance_id}/{title}"
                graph.imported_at = timezone.now()
                graph.imported_by = actor
                graph.save(update_fields=[
                    'imported_from_repo',
                    'imported_from_commit_sha',
                    'imported_from_path',
                    'imported_at',
                    'imported_by',
                    'updated_at',
                ])
        except Exception as exc:
            summary['workbenches']['failed'] += 1
            errors.append(f'Workbench #{idx + 1}: {exc}')


def _import_rules(
    rules_payload: list[dict[str, Any]],
    organization,
    actor,
    peer: HefaistosRemotePeer,
    summary: dict[str, dict[str, int]],
    errors: list[str],
) -> None:
    from rules.models import DetectionRule, RuleRepository

    repository_name = f"Remote Pull - {peer.name}"
    repository, _ = RuleRepository.objects.get_or_create(
        organization=organization,
        name=repository_name,
        defaults={
            'git_url': peer.remote_url,
            'provider': 'AUTO',
            'username': '',
            'auto_pull_enabled': False,
            'auto_pull_schedule': RuleRepository.PullSchedule.DISABLED,
        },
    )
    if not repository.git_url:
        repository.git_url = peer.remote_url
        repository.save(update_fields=['git_url'])

    valid_formats = {'KQL', 'WAZUH', 'SPL', 'AQL', 'OPENTIDE', 'OTHER'}
    for idx, rule_data in enumerate(rules_payload or []):
        try:
            if not isinstance(rule_data, dict):
                raise ValueError('Invalid rule payload')
            title = str(rule_data.get('title') or '').strip()
            if not title:
                raise ValueError('Rule title is required')
            format_value = str(rule_data.get('format') or 'OTHER').upper().strip()
            if format_value not in valid_formats:
                format_value = 'OTHER'

            defaults = {
                'status': str(rule_data.get('status') or '').strip() or None,
                'description': str(rule_data.get('description') or '').strip() or None,
                'author': str(rule_data.get('author') or '').strip() or None,
                'raw_content': str(rule_data.get('raw_content') or ''),
            }
            existing = DetectionRule.objects.filter(
                organization=organization,
                repository=repository,
                title=title,
                format=format_value,
            ).first()

            if existing:
                existing.status = defaults['status']
                existing.description = defaults['description']
                existing.author = defaults['author']
                existing.raw_content = defaults['raw_content']
                existing.save(update_fields=['status', 'description', 'author', 'raw_content', 'updated_at'])
                summary['rules']['updated'] += 1
            else:
                DetectionRule.objects.create(
                    organization=organization,
                    repository=repository,
                    title=title,
                    format=format_value,
                    status=defaults['status'],
                    description=defaults['description'],
                    author=defaults['author'],
                    raw_content=defaults['raw_content'],
                )
                summary['rules']['created'] += 1
        except Exception as exc:
            summary['rules']['failed'] += 1
            errors.append(f'Rule #{idx + 1}: {exc}')


def _import_ach(
    ach_payload: list[dict[str, Any]],
    actor,
    summary: dict[str, dict[str, int]],
    errors: list[str],
) -> None:
    from ach.models import ACHAnalysis, Evidence, Hypothesis, MatrixCell
    from platform_data.models import MitreAttackTechnique

    valid_statuses = {'RESEARCH', 'FINISHED', 'APPROVED'}
    valid_credibility = {'HIGH', 'MEDIUM', 'LOW'}
    valid_scores = {'CC', 'C', 'N', 'I', 'II'}

    for idx, analysis_data in enumerate(ach_payload or []):
        try:
            if not isinstance(analysis_data, dict):
                raise ValueError('Invalid ACH payload')
            title = str(analysis_data.get('title') or '').strip()
            if not title:
                raise ValueError('ACH analysis title is required')

            description = str(analysis_data.get('description') or '').strip()
            status = str(analysis_data.get('status') or 'RESEARCH').upper().strip()
            if status not in valid_statuses:
                status = 'RESEARCH'

            with transaction.atomic():
                analysis = ACHAnalysis.objects.filter(owner=actor, title=title).first()
                created = analysis is None
                if analysis is None:
                    analysis = ACHAnalysis.objects.create(
                        title=title,
                        description=description,
                        owner=actor,
                        status=status,
                        saved_as_template=bool(analysis_data.get('saved_as_template')),
                    )
                else:
                    analysis.description = description
                    analysis.status = status
                    analysis.saved_as_template = bool(analysis_data.get('saved_as_template'))
                    analysis.save(update_fields=['description', 'status', 'saved_as_template', 'updated_at'])
                    analysis.hypotheses.all().delete()
                    analysis.evidence_items.all().delete()

                hypotheses_created = []
                for hyp_entry in (analysis_data.get('hypotheses') or []):
                    hyp_content = str((hyp_entry or {}).get('content') or '').strip()
                    if not hyp_content:
                        continue
                    technique_id = str((hyp_entry or {}).get('mitre_technique_id') or '').strip()
                    technique = None
                    if technique_id:
                        technique = MitreAttackTechnique.objects.filter(technique_id=technique_id).first()
                    hypotheses_created.append(Hypothesis.objects.create(
                        analysis=analysis,
                        content=hyp_content,
                        is_proven=bool((hyp_entry or {}).get('is_proven')),
                        sequence=int((hyp_entry or {}).get('sequence') or 0),
                        mitre_technique=technique,
                    ))

                evidence_created = []
                for ev_entry in (analysis_data.get('evidence') or []):
                    ev_content = str((ev_entry or {}).get('content') or '').strip()
                    if not ev_content:
                        continue
                    credibility = str((ev_entry or {}).get('credibility') or 'MEDIUM').upper().strip()
                    if credibility not in valid_credibility:
                        credibility = 'MEDIUM'
                    evidence_created.append(Evidence.objects.create(
                        analysis=analysis,
                        content=ev_content,
                        credibility=credibility,
                        relevance=str((ev_entry or {}).get('relevance') or ''),
                        sequence=int((ev_entry or {}).get('sequence') or 0),
                        log_reference=str((ev_entry or {}).get('log_reference') or ''),
                    ))

                for matrix_entry in (analysis_data.get('matrix') or []):
                    h_idx = int((matrix_entry or {}).get('hypothesis_index', -1))
                    e_idx = int((matrix_entry or {}).get('evidence_index', -1))
                    if h_idx < 0 or e_idx < 0 or h_idx >= len(hypotheses_created) or e_idx >= len(evidence_created):
                        continue
                    score = str((matrix_entry or {}).get('score') or 'N').upper()
                    if score not in valid_scores:
                        score = 'N'
                    MatrixCell.objects.update_or_create(
                        hypothesis=hypotheses_created[h_idx],
                        evidence=evidence_created[e_idx],
                        defaults={
                            'score': score,
                            'notes': str((matrix_entry or {}).get('notes') or ''),
                        },
                    )

                if created:
                    summary['ach']['created'] += 1
                else:
                    summary['ach']['updated'] += 1

        except Exception as exc:
            summary['ach']['failed'] += 1
            errors.append(f'ACH #{idx + 1}: {exc}')


def import_payload_into_org(
    payload: dict[str, Any],
    organization,
    actor,
    peer: HefaistosRemotePeer,
    requested_scope: str,
) -> tuple[dict[str, dict[str, int]], list[str]]:
    scope = normalize_scope(requested_scope)
    include_scopes = expand_scope(scope)

    summary: dict[str, dict[str, int]] = {
        'workbenches': {'created': 0, 'updated': 0, 'failed': 0},
        'rules': {'created': 0, 'updated': 0, 'failed': 0},
        'ach': {'created': 0, 'updated': 0, 'failed': 0},
    }
    errors: list[str] = []

    if 'WORKBENCH' in include_scopes:
        _import_workbenches(
            payload.get('workbenches') or [],
            organization=organization,
            actor=actor,
            peer=peer,
            summary=summary,
            errors=errors,
        )
    if 'RULES' in include_scopes:
        _import_rules(
            payload.get('rules') or [],
            organization=organization,
            actor=actor,
            peer=peer,
            summary=summary,
            errors=errors,
        )
    if 'ACH' in include_scopes:
        _import_ach(
            payload.get('ach') or [],
            actor=actor,
            summary=summary,
            errors=errors,
        )

    return summary, errors


def _extract_response_cert_sha256(response: requests.Response) -> str:
    connection = getattr(response.raw, 'connection', None)
    sock = getattr(connection, 'sock', None) if connection is not None else None
    if sock is None:
        raise ValueError('Unable to read TLS peer certificate from response socket.')
    cert_bytes = sock.getpeercert(binary_form=True)
    if not cert_bytes:
        raise ValueError('TLS certificate is not available for fingerprint verification.')
    return hashlib.sha256(cert_bytes).hexdigest()


def verify_tls_fingerprint(response: requests.Response, expected_fingerprint: str) -> None:
    expected = _normalized_fingerprint(expected_fingerprint)
    if not expected:
        return
    actual = _extract_response_cert_sha256(response)
    if actual != expected:
        raise ValueError('TLS certificate fingerprint mismatch for remote HEFAISTOS.')


def _requests_verify_value(peer: HefaistosRemotePeer) -> bool:
    if peer.allow_self_signed:
        return False
    return bool(peer.verify_ssl)


def pull_from_remote_peer(
    peer: HefaistosRemotePeer,
    actor,
    requested_scope: str | None = None,
) -> HefaistosPullJob:
    scope = normalize_scope(requested_scope or peer.default_scope)
    identity = get_or_create_instance_identity()
    now = timezone.now()
    job = HefaistosPullJob.objects.create(
        organization=peer.organization,
        peer=peer,
        requested_scope=scope,
        status=HefaistosPullJob.Status.PROCESSING,
        triggered_by=actor,
        started_at=now,
    )

    try:
        api_key = peer.api_key
        if not api_key:
            raise ValueError('Remote API key is not configured for this peer.')
        base_url = (peer.remote_url or '').strip().rstrip('/')
        if not base_url:
            raise ValueError('Remote URL is empty.')

        headers = {
            'X-HEFAISTOS-SHARE-KEY': api_key,
            'X-HEFAISTOS-CLIENT-INSTANCE-ID': str(identity.instance_id),
        }
        verify = _requests_verify_value(peer)
        check_fp = bool((peer.tls_cert_fingerprint or '').strip())

        info_response = requests.get(
            f'{base_url}/api/sharing/info',
            headers=headers,
            timeout=30,
            verify=verify,
            stream=check_fp,
        )
        verify_tls_fingerprint(info_response, peer.tls_cert_fingerprint)
        info_response.raise_for_status()
        info_payload = info_response.json()
        remote_instance_id = str(info_payload.get('instance_id') or '').strip()
        if not remote_instance_id:
            raise ValueError('Remote instance did not return an instance_id.')
        if str(peer.remote_instance_id) != remote_instance_id:
            raise ValueError(
                'Remote instance_id mismatch: configured peer does not match responding server.'
            )

        export_response = requests.get(
            f'{base_url}/api/sharing/export',
            params={'scope': scope},
            headers=headers,
            timeout=180,
            verify=verify,
            stream=check_fp,
        )
        verify_tls_fingerprint(export_response, peer.tls_cert_fingerprint)
        export_response.raise_for_status()
        payload = export_response.json()
        summary, import_errors = import_payload_into_org(
            payload=payload,
            organization=peer.organization,
            actor=actor,
            peer=peer,
            requested_scope=scope,
        )

        status = HefaistosPullJob.Status.COMPLETED
        message = 'Pull completed successfully.'
        if import_errors:
            message = f'Pull completed with {len(import_errors)} warning(s).'
            summary['errors'] = import_errors

        job.status = status
        job.summary = summary
        job.message = message
        job.completed_at = timezone.now()
        job.save(update_fields=['status', 'summary', 'message', 'completed_at'])

        peer.last_sync_at = timezone.now()
        peer.last_sync_status = status
        peer.last_sync_message = message
        peer.save(update_fields=['last_sync_at', 'last_sync_status', 'last_sync_message', 'updated_at'])
        return job

    except Exception as exc:
        job.status = HefaistosPullJob.Status.FAILED
        job.message = str(exc)
        job.summary = {'errors': [str(exc)]}
        job.completed_at = timezone.now()
        job.save(update_fields=['status', 'message', 'summary', 'completed_at'])

        peer.last_sync_at = timezone.now()
        peer.last_sync_status = HefaistosPullJob.Status.FAILED
        peer.last_sync_message = str(exc)
        peer.save(update_fields=['last_sync_at', 'last_sync_status', 'last_sync_message', 'updated_at'])
        raise
