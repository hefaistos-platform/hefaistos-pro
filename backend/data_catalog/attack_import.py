import io
import re
from typing import Any, Callable

from django.core.cache import cache
from django.db.models import Q
from django.db.models.functions import Lower

from data_catalog.models import DataSource, DataSourceField
from platform_data.models import MitreDataComponent, PlatformDataVersion


ATTACK_EXCEL_BASE_URL = "https://attack.mitre.org/docs/attack-excel-files"
ATTACK_COMPONENT_CACHE_TTL = 60 * 60 * 24  # 24h
IMPORT_BATCH_SIZE = 500


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
        return ""
    if isinstance(value, float) and value != value:
        return ""
    text = str(value)
    return re.sub(r"\s+", " ", text).strip()


def _normalize_name(value: str) -> str:
    return _clean_text(value).lower()


def _truncate(value: str, limit: int = 255) -> str:
    text = _clean_text(value)
    if len(text) <= limit:
        return text
    return text[: limit - 1] + "…"


def _guess_platform(*fragments: str) -> str | None:
    corpus = " ".join(_clean_text(x).lower() for x in fragments if x)
    if not corpus:
        return None

    windows_tokens = ("windows", "wineventlog", "sysmon", "event id", "powershell")
    linux_tokens = ("linux", "syslog", "journald", "auditd", "systemd")
    mac_tokens = ("macos", "darwin", "endpointsecurity", "unified log")
    cloud_tokens = ("aws", "cloudtrail", "azure", "gcp", "google cloud")

    if any(token in corpus for token in windows_tokens):
        return "Windows"
    if any(token in corpus for token in linux_tokens):
        return "Linux"
    if any(token in corpus for token in mac_tokens):
        return "macOS"
    if any(token in corpus for token in cloud_tokens):
        return "Cloud"
    return None


def _build_catalog_name(data_component: str, log_provider: str, channel: str) -> str:
    component = _clean_text(data_component)
    if component:
        return component

    provider = _clean_text(log_provider)
    chan = _clean_text(channel)
    if provider and chan:
        return f"{provider} - {chan}"
    return provider or chan


def _normalize_header(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", _clean_text(value).lower())


def _pick_from_row(row: Any, aliases: set[str]) -> str:
    alias_norms = {_normalize_header(x) for x in aliases}
    for key, raw in row.items():
        if _normalize_header(key) in alias_norms:
            cleaned = _clean_text(raw)
            if cleaned:
                return cleaned
    return ""


def _find_sheet_name(sheet_names: list[str], candidates: tuple[str, ...], contains: tuple[str, ...]) -> str | None:
    target = {_normalize_header(name): name for name in sheet_names}

    for cand in candidates:
        normalized = _normalize_header(cand)
        if normalized in target:
            return target[normalized]

    for normalized, original in target.items():
        if any(token in normalized for token in contains):
            return original

    return None


def _resolve_attack_version(requested_version: str | None = None) -> str:
    if requested_version:
        return str(requested_version).lstrip("v").strip()

    db_version = (
        PlatformDataVersion.objects.filter(framework="enterprise-attack")
        .values_list("version", flat=True)
        .first()
    )
    if db_version:
        return str(db_version)

    return "19.1"


def _load_rows_from_local_models() -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    qs = (
        MitreDataComponent.objects.select_related("data_source")
        .filter(~Q(name__isnull=True), ~Q(name=""))
        .order_by("name")
    )
    for component in qs:
        rows.append(
            {
                "data_component": _clean_text(component.name),
                "log_provider": _clean_text(getattr(component.data_source, "name", "")),
                "channel": "",
                "description": _clean_text(component.description),
            }
        )
    return rows


def _fetch_rows_from_attack_excel(version: str) -> list[dict[str, str]]:
    import pandas as pd
    import requests

    filename = f"enterprise-attack-v{version}.xlsx"
    url = f"{ATTACK_EXCEL_BASE_URL}/v{version}/enterprise-attack/{filename}"

    response = requests.get(url, timeout=120)
    response.raise_for_status()

    xls = pd.ExcelFile(io.BytesIO(response.content))

    datasource_sheet = _find_sheet_name(
        xls.sheet_names,
        candidates=("datasources", "data sources"),
        contains=("datasource",),
    )
    datacomponent_sheet = _find_sheet_name(
        xls.sheet_names,
        candidates=("datacomponents", "data components"),
        contains=("datacomponent",),
    )

    if not datacomponent_sheet:
        return []

    data_sources_by_stix: dict[str, str] = {}
    if datasource_sheet:
        ds_df = pd.read_excel(xls, datasource_sheet)
        for _, row in ds_df.iterrows():
            source_stix = _pick_from_row(row, {
                "STIX ID",
                "stix id",
                "stix_id",
                "id",
            })
            source_name = _pick_from_row(row, {
                "name",
                "data source",
                "datasource",
            })
            if source_stix and source_name:
                data_sources_by_stix[source_stix] = source_name

    component_df = pd.read_excel(xls, datacomponent_sheet)
    rows: list[dict[str, str]] = []

    for _, row in component_df.iterrows():
        component_name = _pick_from_row(row, {
            "name",
            "data component",
            "datacomponent",
            "component",
        })
        if not component_name:
            continue

        provider_name = _pick_from_row(row, {
            "data source",
            "datasource",
            "source",
            "attack data source",
            "x_mitre_data_source",
        })

        if not provider_name:
            source_ref = _pick_from_row(row, {
                "x_mitre_data_source_ref",
                "x mitre data source ref",
                "data source ref",
                "datasource ref",
                "source ref",
                "x_mitre_data_source_refs",
            })
            if source_ref:
                for candidate_ref in [x.strip() for x in source_ref.split(",") if x.strip()]:
                    mapped_name = data_sources_by_stix.get(candidate_ref)
                    if mapped_name:
                        provider_name = mapped_name
                        break

        rows.append(
            {
                "data_component": component_name,
                "log_provider": provider_name,
                "channel": "",
                "description": _pick_from_row(row, {"description"}),
            }
        )

    return rows


def load_attack_component_rows(version: str | None = None) -> tuple[list[dict[str, str]], str]:
    """
    Returns ATT&CK data-component rows in a format compatible with Workbench
    log-source rows: {data_component, log_provider, channel, description}.
    """
    local_rows = _load_rows_from_local_models()
    resolved_version = _resolve_attack_version(version)
    if local_rows:
        return local_rows, resolved_version

    cache_key = f"attack:datacomponents:enterprise:v{resolved_version}"
    cached_rows = cache.get(cache_key)
    if cached_rows is not None:
        return cached_rows, resolved_version

    rows = _fetch_rows_from_attack_excel(resolved_version)
    cache.set(cache_key, rows, timeout=ATTACK_COMPONENT_CACHE_TTL)
    return rows, resolved_version


def import_attack_data_sources_for_organization(
    organization,
    version: str | None = None,
    on_progress: Callable[[dict[str, Any]], None] | None = None,
) -> dict[str, Any]:
    rows, resolved_version = load_attack_component_rows(version)
    _emit_progress(
        on_progress,
        progress_percent=10,
        message="Loaded ATT&CK data components",
        log_line=f"Loaded {len(rows)} ATT&CK source rows.",
    )

    candidate_map: dict[str, dict[str, str]] = {}
    for row in rows:
        data_component = _clean_text(row.get("data_component"))
        log_provider = _clean_text(row.get("log_provider"))
        channel = _clean_text(row.get("channel"))
        description = _clean_text(row.get("description"))

        name = _build_catalog_name(data_component, log_provider, channel)
        if not name:
            continue

        key = _normalize_name(name)
        if key in candidate_map:
            continue

        candidate_map[key] = {
            "name": name,
            "data_component": data_component,
            "log_provider": log_provider,
            "channel": channel,
            "description": description,
        }

    _emit_progress(
        on_progress,
        progress_percent=25,
        message="Prepared import candidates",
        total_candidates=len(candidate_map),
        log_line=f"Prepared {len(candidate_map)} unique Data Catalog candidates.",
    )

    if not candidate_map:
        _emit_progress(
            on_progress,
            progress_percent=100,
            message="Nothing to import",
            created_count=0,
            skipped_count=0,
            failed_count=0,
            total_candidates=0,
            log_line="No ATT&CK candidates available to import.",
        )
        return {
            "created_count": 0,
            "skipped_count": 0,
            "failed_count": 0,
            "total_candidates": 0,
            "version": resolved_version,
        }

    keys = set(candidate_map.keys())

    existing_before = set(
        DataSource.objects.filter(organization=organization)
        .annotate(name_lc=Lower("name"))
        .filter(name_lc__in=keys)
        .values_list("name_lc", flat=True)
    )

    _emit_progress(
        on_progress,
        progress_percent=35,
        message="Checked existing Data Catalog entries",
        skipped_count=len(existing_before),
    )

    to_create_objects = []
    for key in (keys - existing_before):
        item = candidate_map[key]
        description = (
            f"Imported from MITRE ATT&CK v{resolved_version}. "
            f"Component: {item['data_component'] or item['name']}"
        )
        if item["log_provider"]:
            description += f" | Source: {item['log_provider']}"

        to_create_objects.append(
            DataSource(
                name=item["name"],
                platform=_guess_platform(item["name"], item["log_provider"], item["channel"]),
                description=description,
                organization=organization,
            )
        )

    if to_create_objects:
        total_batches = max(1, (len(to_create_objects) + IMPORT_BATCH_SIZE - 1) // IMPORT_BATCH_SIZE)
        for batch_index, batch in enumerate(_batched(to_create_objects, IMPORT_BATCH_SIZE), start=1):
            DataSource.objects.bulk_create(batch, batch_size=IMPORT_BATCH_SIZE, ignore_conflicts=True)
            progress = 35 + int((batch_index / total_batches) * 30)
            _emit_progress(
                on_progress,
                progress_percent=progress,
                message="Importing Data Catalog entries",
                log_line=f"Created batch {batch_index}/{total_batches} ({len(batch)} rows attempted).",
            )
    else:
        _emit_progress(
            on_progress,
            progress_percent=65,
            message="No new Data Catalog entries required",
        )

    existing_after = set(
        DataSource.objects.filter(organization=organization)
        .annotate(name_lc=Lower("name"))
        .filter(name_lc__in=keys)
        .values_list("name_lc", flat=True)
    )

    created_count = len(existing_after - existing_before)
    failed_count = len(keys - existing_after)
    skipped_count = len(keys) - created_count - failed_count

    _emit_progress(
        on_progress,
        progress_percent=75,
        message="Import counts computed",
        created_count=created_count,
        skipped_count=skipped_count,
        failed_count=failed_count,
        total_candidates=len(keys),
    )

    name_to_ds_id = {
        row[1]: row[0]
        for row in (
            DataSource.objects.filter(organization=organization)
            .annotate(name_lc=Lower("name"))
            .filter(name_lc__in=existing_after)
            .values_list("id", "name_lc")
        )
    }

    field_description = f"Imported from MITRE ATT&CK v{resolved_version}"
    field_rows: list[DataSourceField] = []
    for key in existing_after:
        ds_id = name_to_ds_id.get(key)
        if not ds_id:
            continue
        item = candidate_map.get(key)
        if not item:
            continue

        if item["data_component"]:
            field_rows.append(
                DataSourceField(
                    data_source_id=ds_id,
                    field_name="data_component",
                    data_type="string",
                    description=field_description,
                    example_value=_truncate(item["data_component"]),
                )
            )

        if item["log_provider"]:
            field_rows.append(
                DataSourceField(
                    data_source_id=ds_id,
                    field_name="provider",
                    data_type="string",
                    description=field_description,
                    example_value=_truncate(item["log_provider"]),
                )
            )

        if item["channel"]:
            field_rows.append(
                DataSourceField(
                    data_source_id=ds_id,
                    field_name="channel",
                    data_type="string",
                    description=field_description,
                    example_value=_truncate(item["channel"]),
                )
            )

        field_rows.append(
            DataSourceField(
                data_source_id=ds_id,
                field_name="mitre_attack_version",
                data_type="string",
                description=field_description,
                example_value=_truncate(resolved_version),
            )
        )

    if field_rows:
        total_field_batches = max(1, (len(field_rows) + 1000 - 1) // 1000)
        for field_batch_index, batch in enumerate(_batched(field_rows, 1000), start=1):
            DataSourceField.objects.bulk_create(batch, batch_size=1000, ignore_conflicts=True)
            progress = 75 + int((field_batch_index / total_field_batches) * 20)
            _emit_progress(
                on_progress,
                progress_percent=progress,
                message="Importing metadata fields",
            )

    _emit_progress(
        on_progress,
        progress_percent=100,
        message="Import completed",
        created_count=created_count,
        skipped_count=skipped_count,
        failed_count=failed_count,
        total_candidates=len(keys),
    )

    return {
        "created_count": created_count,
        "skipped_count": skipped_count,
        "failed_count": failed_count,
        "total_candidates": len(keys),
        "version": resolved_version,
    }
