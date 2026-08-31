import re
from typing import Any, Callable

from django.core.cache import cache
from django.db.models.functions import Lower

from data_catalog.models import DataSource, DataSourceField
from platform_data.models import MitreAnalytic, PlatformDataVersion
from platform_data.scraper import scrape_mitre_log_sources_json


ATTACK_COMPONENT_CACHE_TTL = 60 * 60 * 24  # 24h
IMPORT_BATCH_SIZE = 500
FIELD_BATCH_SIZE = 1000
FIELD_DESCRIPTION = 'Imported from MITRE live data via Detection Strategy'


def _emit_progress(on_progress: Callable[[dict[str, Any]], None] | None, **payload) -> None:
    if not on_progress:
        return
    try:
        on_progress(payload)
    except Exception:
        # Progress callbacks must never break import flow.
        return


def _batched(values: list[Any], size: int):
    for index in range(0, len(values), size):
        yield values[index:index + size]


def _clean_text(value: Any) -> str:
    if value is None:
        return ''
    if isinstance(value, float) and value != value:
        return ''
    text = str(value)
    return re.sub(r'\s+', ' ', text).strip()


def _normalize_name(value: str) -> str:
    return _clean_text(value).lower()


def _truncate(value: str, limit: int = 255) -> str:
    text = _clean_text(value)
    if len(text) <= limit:
        return text
    return text[: limit - 1] + '…'


def _guess_platform(*fragments: str) -> str | None:
    corpus = ' '.join(_clean_text(x).lower() for x in fragments if x)
    if not corpus:
        return None

    windows_tokens = ('windows', 'wineventlog', 'sysmon', 'event id', 'powershell')
    linux_tokens = ('linux', 'syslog', 'journald', 'auditd', 'systemd')
    mac_tokens = ('macos', 'darwin', 'endpointsecurity', 'unified log')
    cloud_tokens = ('aws', 'cloudtrail', 'azure', 'gcp', 'google cloud')

    if any(token in corpus for token in windows_tokens):
        return 'Windows'
    if any(token in corpus for token in linux_tokens):
        return 'Linux'
    if any(token in corpus for token in mac_tokens):
        return 'macOS'
    if any(token in corpus for token in cloud_tokens):
        return 'Cloud'
    return None


def _build_catalog_name(data_component: str, log_provider: str, channel: str) -> str:
    provider = _clean_text(log_provider)
    chan = _clean_text(channel)
    if provider and chan:
        return f'{provider} - {chan}'

    if provider:
        return provider
    if chan:
        return chan

    return _clean_text(data_component)


def _resolve_attack_version(requested_version: str | None = None) -> str:
    if requested_version:
        return str(requested_version).lstrip('v').strip()

    db_version = (
        PlatformDataVersion.objects.filter(framework='enterprise-attack')
        .values_list('version', flat=True)
        .first()
    )
    if db_version:
        return str(db_version)

    return '19.1'


def _derive_analytic_code(name: str) -> str | None:
    clean = _clean_text(name)
    if not clean:
        return None

    direct_match = re.search(r'\bAN\d{3,6}\b', clean, re.IGNORECASE)
    if direct_match:
        return direct_match.group(0).upper()

    analytic_match = re.search(r'\bAnalytic\s*0*([0-9]{1,6})\b', clean, re.IGNORECASE)
    if analytic_match:
        digits = analytic_match.group(1)
        width = max(4, len(digits))
        return f"AN{digits.zfill(width)}"

    return None


def _normalize_scraped_row(row: dict[str, Any]) -> dict[str, str]:
    return {
        'data_component': _clean_text(row.get('data_component') or row.get('dataComponent')),
        'log_provider': _clean_text(row.get('log_provider') or row.get('logProvider')),
        'channel': _clean_text(row.get('channel')),
    }


def _load_rows_from_strategy_analytics(
    version: str,
    on_progress: Callable[[dict[str, Any]], None] | None = None,
) -> list[dict[str, str]]:
    cache_key = f'attack:log-sources:enterprise:v{version}'
    cached_rows = cache.get(cache_key)
    if cached_rows is not None:
        _emit_progress(
            on_progress,
            progress_percent=20,
            message='Loaded cached MITRE log source rows',
            log_line=f'Loaded {len(cached_rows)} log source rows from cache.',
        )
        return cached_rows

    analytics = list(
        MitreAnalytic.objects.select_related('detection_strategy')
        .filter(detection_strategy__isnull=False)
        .exclude(detection_strategy__url__isnull=True)
        .exclude(detection_strategy__url='')
        .order_by('detection_strategy__def_id', 'name')
    )

    total_analytics = len(analytics)
    if total_analytics == 0:
        return []

    out_rows: list[dict[str, str]] = []
    seen: set[tuple[str, str, str]] = set()

    for idx, analytic in enumerate(analytics, start=1):
        strategy = analytic.detection_strategy
        strategy_url = _clean_text(getattr(strategy, 'url', ''))
        analytic_code = _derive_analytic_code(analytic.name)
        if not strategy_url or not analytic_code:
            continue

        row_cache_key = f'mitre:json:{strategy_url}#{analytic_code}'
        scraped_rows = cache.get(row_cache_key)
        if scraped_rows is None:
            scraped_rows = scrape_mitre_log_sources_json(strategy_url, analytic_code)
            cache.set(row_cache_key, scraped_rows, timeout=ATTACK_COMPONENT_CACHE_TTL)

        for raw_row in scraped_rows or []:
            row = _normalize_scraped_row(raw_row)
            if not row['log_provider'] or not row['channel']:
                # Import only rows that are directly actionable as log source components.
                continue
            signature = (row['data_component'], row['log_provider'], row['channel'])
            if signature in seen:
                continue
            seen.add(signature)
            out_rows.append(row)

        if idx == 1 or idx % 25 == 0 or idx == total_analytics:
            progress = 20 + int((idx / total_analytics) * 25)
            _emit_progress(
                on_progress,
                progress_percent=progress,
                message=f'Collecting MITRE log source rows ({idx}/{total_analytics})',
            )

    cache.set(cache_key, out_rows, timeout=ATTACK_COMPONENT_CACHE_TTL)
    return out_rows


def import_attack_data_sources_for_organization(
    organization,
    version: str | None = None,
    on_progress: Callable[[dict[str, Any]], None] | None = None,
) -> dict[str, Any]:
    resolved_version = _resolve_attack_version(version)

    _emit_progress(
        on_progress,
        progress_percent=10,
        message='Preparing ATT&CK log source import',
        log_line=f'Starting ATT&CK import for version {resolved_version}.',
    )

    rows = _load_rows_from_strategy_analytics(resolved_version, on_progress=on_progress)

    _emit_progress(
        on_progress,
        progress_percent=45,
        message='Loaded ATT&CK log source rows',
        log_line=f'Loaded {len(rows)} ATT&CK log source rows.',
    )

    candidate_map: dict[str, dict[str, str]] = {}
    for row in rows:
        data_component = _clean_text(row.get('data_component'))
        log_provider = _clean_text(row.get('log_provider'))
        channel = _clean_text(row.get('channel'))

        name = _build_catalog_name(data_component, log_provider, channel)
        if not name:
            continue

        key = _normalize_name(name)
        existing = candidate_map.get(key)
        if not existing:
            candidate_map[key] = {
                'name': name,
                'data_component': data_component,
                'log_provider': log_provider,
                'channel': channel,
            }
            continue

        # Preserve richest values when same catalog key appears repeatedly.
        if not existing.get('data_component') and data_component:
            existing['data_component'] = data_component
        if not existing.get('log_provider') and log_provider:
            existing['log_provider'] = log_provider
        if not existing.get('channel') and channel:
            existing['channel'] = channel

    _emit_progress(
        on_progress,
        progress_percent=55,
        message='Prepared import candidates',
        total_candidates=len(candidate_map),
        log_line=f'Prepared {len(candidate_map)} unique Data Catalog candidates.',
    )

    if not candidate_map:
        _emit_progress(
            on_progress,
            progress_percent=100,
            message='Nothing to import',
            created_count=0,
            skipped_count=0,
            failed_count=0,
            total_candidates=0,
            log_line='No ATT&CK log-source candidates available to import.',
        )
        return {
            'created_count': 0,
            'skipped_count': 0,
            'failed_count': 0,
            'total_candidates': 0,
            'version': resolved_version,
        }

    keys = set(candidate_map.keys())

    existing_before = set(
        DataSource.objects.filter(organization=organization)
        .annotate(name_lc=Lower('name'))
        .filter(name_lc__in=keys)
        .values_list('name_lc', flat=True)
    )

    _emit_progress(
        on_progress,
        progress_percent=60,
        message='Checked existing Data Catalog entries',
        skipped_count=len(existing_before),
    )

    to_create_objects: list[DataSource] = []
    for key in (keys - existing_before):
        item = candidate_map[key]
        description = (
            f"Auto-added from MITRE strategy: {item['data_component']}"
            f" | {item['log_provider']} | {item['channel']}"
        )

        to_create_objects.append(
            DataSource(
                name=item['name'],
                platform=_guess_platform(item['name'], item['log_provider'], item['channel']),
                description=description,
                organization=organization,
            )
        )

    if to_create_objects:
        total_batches = max(1, (len(to_create_objects) + IMPORT_BATCH_SIZE - 1) // IMPORT_BATCH_SIZE)
        for batch_index, batch in enumerate(_batched(to_create_objects, IMPORT_BATCH_SIZE), start=1):
            DataSource.objects.bulk_create(batch, batch_size=IMPORT_BATCH_SIZE, ignore_conflicts=True)
            progress = 60 + int((batch_index / total_batches) * 15)
            _emit_progress(
                on_progress,
                progress_percent=progress,
                message='Importing Data Catalog entries',
                log_line=f'Created batch {batch_index}/{total_batches} ({len(batch)} rows attempted).',
            )
    else:
        _emit_progress(
            on_progress,
            progress_percent=75,
            message='No new Data Catalog entries required',
        )

    existing_after = set(
        DataSource.objects.filter(organization=organization)
        .annotate(name_lc=Lower('name'))
        .filter(name_lc__in=keys)
        .values_list('name_lc', flat=True)
    )

    created_count = len(existing_after - existing_before)
    failed_count = len(keys - existing_after)
    skipped_count = len(keys) - created_count - failed_count

    _emit_progress(
        on_progress,
        progress_percent=78,
        message='Import counts computed',
        created_count=created_count,
        skipped_count=skipped_count,
        failed_count=failed_count,
        total_candidates=len(keys),
    )

    name_to_ds_id = {
        row[1]: row[0]
        for row in (
            DataSource.objects.filter(organization=organization)
            .annotate(name_lc=Lower('name'))
            .filter(name_lc__in=existing_after)
            .values_list('id', 'name_lc')
        )
    }

    field_rows: list[DataSourceField] = []
    for key in existing_after:
        ds_id = name_to_ds_id.get(key)
        if not ds_id:
            continue

        item = candidate_map.get(key)
        if not item:
            continue

        if item['channel']:
            field_rows.append(
                DataSourceField(
                    data_source_id=ds_id,
                    field_name='channel',
                    data_type='string',
                    description=FIELD_DESCRIPTION,
                    example_value=_truncate(item['channel']),
                )
            )

        if item['log_provider']:
            field_rows.append(
                DataSourceField(
                    data_source_id=ds_id,
                    field_name='provider',
                    data_type='string',
                    description=FIELD_DESCRIPTION,
                    example_value=_truncate(item['log_provider']),
                )
            )

        if item['data_component']:
            field_rows.append(
                DataSourceField(
                    data_source_id=ds_id,
                    field_name='data_component',
                    data_type='string',
                    description=FIELD_DESCRIPTION,
                    example_value=_truncate(item['data_component']),
                )
            )

    if field_rows:
        total_field_batches = max(1, (len(field_rows) + FIELD_BATCH_SIZE - 1) // FIELD_BATCH_SIZE)
        for field_batch_index, batch in enumerate(_batched(field_rows, FIELD_BATCH_SIZE), start=1):
            DataSourceField.objects.bulk_create(batch, batch_size=FIELD_BATCH_SIZE, ignore_conflicts=True)
            progress = 78 + int((field_batch_index / total_field_batches) * 20)
            _emit_progress(
                on_progress,
                progress_percent=progress,
                message='Importing metadata fields',
            )

    _emit_progress(
        on_progress,
        progress_percent=100,
        message='Import completed',
        created_count=created_count,
        skipped_count=skipped_count,
        failed_count=failed_count,
        total_candidates=len(keys),
    )

    return {
        'created_count': created_count,
        'skipped_count': skipped_count,
        'failed_count': failed_count,
        'total_candidates': len(keys),
        'version': resolved_version,
    }
