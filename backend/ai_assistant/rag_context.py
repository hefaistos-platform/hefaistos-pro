from __future__ import annotations

import json
import logging
import os

logger = logging.getLogger(__name__)


_RULE_FORMAT_TO_LANGUAGE = {
    'KQL': 'KQL',
    'EQL': 'EQL',
    'SPL': 'SPL',
    'WAZUH': 'WAZUH',
    'AQL': 'AQL',
    'SIGMA': 'SIGMA',
    'OTHER': None,
}


def _coerce_text(value) -> str:
    if value is None:
        return ''
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return str(value).strip()


def resolve_rule_language(rule_format: str | None) -> str | None:
    fmt = (rule_format or '').strip().upper()
    if not fmt:
        return 'KQL'
    return _RULE_FORMAT_TO_LANGUAGE.get(fmt, fmt if fmt in set(_RULE_FORMAT_TO_LANGUAGE.values()) else None)


def _looks_like_test_key(api_key: str | None) -> bool:
    key = (api_key or '').strip().lower()
    if not key:
        return True
    known_non_prod = {
        'test',
        'test-key',
        'sk-test',
        'sk-xxx',
        'dummy',
        'dummy-key',
        'changeme',
    }
    if key in known_non_prod:
        return True
    if key.startswith('sk-test-'):
        return True
    return False


def get_embedding_openai_key(settings_obj) -> str | None:
    key = None
    getter = getattr(settings_obj, 'get_openai_key', None)
    if callable(getter):
        try:
            key = getter()
        except Exception:
            key = None
    key = (key or '').strip()
    if key:
        return key
    env_key = (os.environ.get('OPENAI_API_KEY') or '').strip()
    return env_key or None


def build_rule_reference_query(
    *,
    playbook_context: dict | None = None,
    rule_content: str | None = None,
) -> str:
    parts: list[str] = []

    context = playbook_context if isinstance(playbook_context, dict) else {}
    labeled_keys = [
        ('TITLE', context.get('title')),
        ('MITRE TECHNIQUE', f"{_coerce_text(context.get('technique_id'))} {_coerce_text(context.get('technique_name'))}".strip()),
        ('STRATEGY', context.get('strategy_name')),
        ('GOAL', context.get('goal')),
        ('TECHNICAL CONTEXT', context.get('technical_context')),
        ('DATA SOURCES', context.get('data_sources')),
        ('EXISTING LOGIC', context.get('existing_logic')),
    ]
    for label, raw_value in labeled_keys:
        value = _coerce_text(raw_value)
        if value:
            parts.append(f"{label}:\n{value}")

    rule_text = _coerce_text(rule_content)
    if rule_text:
        parts.append(f"RULE CONTENT:\n{rule_text}")

    combined = "\n\n".join(parts).strip()
    if not combined:
        return ''

    # Keep retrieval query compact enough for embedding calls.
    return combined[:12000]


def retrieve_rule_reference_context(
    *,
    settings_obj,
    rule_format: str | None,
    playbook_context: dict | None = None,
    rule_content: str | None = None,
    top_k: int = 5,
) -> list[dict]:
    api_key = get_embedding_openai_key(settings_obj)
    if not api_key or _looks_like_test_key(api_key):
        return []

    query_text = build_rule_reference_query(
        playbook_context=playbook_context,
        rule_content=rule_content,
    )
    if not query_text:
        return []

    language = resolve_rule_language(rule_format)

    try:
        from rules.rag_store import retrieve_similar

        return retrieve_similar(
            openai_api_key=api_key,
            query_text=query_text,
            language=language,
            top_k=max(1, min(10, int(top_k))),
        )
    except Exception as exc:
        logger.warning("RAG retrieval failed (non-fatal): %s", exc)
        return []

