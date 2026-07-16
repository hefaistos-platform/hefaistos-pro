import re
from typing import Any

import requests

from organizations.models import MISPInstance


def _extract_ttps(event_obj: dict[str, Any]) -> list[str]:
    combined = []
    tags = event_obj.get('Tag') or []
    for tag in tags:
        if isinstance(tag, dict):
            combined.append(str(tag.get('name') or ''))

    galaxy = event_obj.get('Galaxy') or []
    for gal in galaxy:
        clusters = (gal or {}).get('GalaxyCluster') or []
        for cluster in clusters:
            if isinstance(cluster, dict):
                combined.append(str(cluster.get('value') or ''))
                combined.extend(str(t.get('name') or '') for t in (cluster.get('Tag') or []) if isinstance(t, dict))

    text = ' '.join(combined).upper()
    ttps = re.findall(r'T\d{4}(?:\.\d{3})?', text)
    seen = set()
    result = []
    for item in ttps:
        if item in seen:
            continue
        seen.add(item)
        result.append(item)
    return result


def normalize_misp_event(event_obj: dict[str, Any]) -> dict[str, Any]:
    event_id = str(event_obj.get('id') or '').strip()
    title = str(event_obj.get('info') or '').strip() or f'MISP Event {event_id or "unknown"}'

    attrs = event_obj.get('Attribute') or []
    ioc_values = []
    for attr in attrs[:15]:
        if not isinstance(attr, dict):
            continue
        value = str(attr.get('value') or '').strip()
        if value:
            ioc_values.append(value)

    short_description = (
        f"MISP event {event_id}: " + ', '.join(ioc_values[:8])
    ).strip()
    if not short_description or short_description == f'MISP event {event_id}:':
        short_description = str(event_obj.get('info') or '').strip()

    detection_objective = (
        f"Detect indicators and behaviours related to MISP event {event_id}."
    )

    return {
        'event_id': event_id,
        'title': title,
        'short_description': short_description,
        'detection_objective': detection_objective,
        'mapped_ttps': _extract_ttps(event_obj),
        'estimated_detection_complexity': 'MEDIUM',
        'raw_payload': event_obj,
    }


def event_has_tag(event_obj: dict[str, Any], required_tag: str) -> bool:
    target = str(required_tag or '').strip().lower()
    if not target:
        return True

    candidates = []
    for key in ('Tag', 'EventTag'):
        for tag in event_obj.get(key) or []:
            if isinstance(tag, dict):
                candidates.append(str(tag.get('name') or '').strip().lower())
            else:
                candidates.append(str(tag).strip().lower())
    return target in {candidate for candidate in candidates if candidate}


def _filter_events_by_tag(events: list[dict[str, Any]], required_tag: str) -> list[dict[str, Any]]:
    return [event for event in events if event_has_tag(event, required_tag)]


def fetch_misp_events(
    instance: MISPInstance,
    limit: int = 25,
    event_id: str | None = None,
    tag: str | None = None,
) -> list[dict[str, Any]]:
    body: dict[str, Any] = {
        'returnFormat': 'json',
        'limit': max(1, min(int(limit or 25), 100)),
    }
    if event_id:
        body['eventid'] = str(event_id)
    normalized_tag = str(tag or '').strip()
    if normalized_tag:
        body['tags'] = [normalized_tag]

    response = requests.post(
        f"{instance.url.rstrip('/')}/events/restSearch",
        headers={
            'Authorization': instance.auth_key,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        json=body,
        timeout=30,
        verify=instance.verify_ssl,
    )
    response.raise_for_status()

    data = response.json()
    events_container = data.get('response', data)
    events: list[dict[str, Any]] = []

    if isinstance(events_container, list):
        for item in events_container:
            if isinstance(item, dict) and isinstance(item.get('Event'), dict):
                events.append(item['Event'])
            elif isinstance(item, dict):
                events.append(item)
    elif isinstance(events_container, dict):
        if isinstance(events_container.get('Event'), list):
            for item in events_container.get('Event') or []:
                if isinstance(item, dict):
                    events.append(item)
        elif isinstance(events_container.get('Event'), dict):
            events.append(events_container['Event'])

    if normalized_tag:
        return _filter_events_by_tag(events, normalized_tag)
    return events
