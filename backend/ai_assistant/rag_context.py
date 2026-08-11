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


def _read_secret_file(path: str | None) -> str:
    file_path = (path or '').strip()
    if not file_path:
        return ''
    try:
        with open(file_path, encoding='utf-8') as fh:
            return (fh.read() or '').strip()
    except Exception:
        return ''


def get_embedding_config(settings_obj) -> dict | None:
    get_openai_key = getattr(settings_obj, 'get_openai_key', None)
    if callable(get_openai_key):
        try:
            openai_key = (get_openai_key() or '').strip()
            if openai_key:
                return {
                    'openai_api_key': openai_key,
                    'azure_openai_api_key': None,
                    'azure_openai_endpoint': None,
                    'azure_openai_embedding_deployment': None,
                    'azure_openai_api_version': None,
                }
        except Exception:
            pass

    get_azure_key = getattr(settings_obj, 'get_azure_openai_key', None)
    get_azure_endpoint = getattr(settings_obj, 'get_azure_openai_endpoint', None)
    get_azure_embedding_deployment = getattr(settings_obj, 'get_azure_openai_embedding_deployment', None)
    get_azure_chat_deployment = getattr(settings_obj, 'get_azure_openai_deployment', None)
    azure_key = (get_azure_key() if callable(get_azure_key) else '') or ''
    azure_endpoint = (get_azure_endpoint() if callable(get_azure_endpoint) else '') or ''
    azure_deployment = (get_azure_embedding_deployment() if callable(get_azure_embedding_deployment) else '') or ''
    if not azure_deployment:
        azure_deployment = (get_azure_chat_deployment() if callable(get_azure_chat_deployment) else '') or ''
    azure_key = azure_key.strip()
    azure_endpoint = azure_endpoint.strip()
    azure_deployment = azure_deployment.strip()
    if azure_key and azure_endpoint and azure_deployment:
        return {
            'openai_api_key': None,
            'azure_openai_api_key': azure_key,
            'azure_openai_endpoint': azure_endpoint,
            'azure_openai_embedding_deployment': azure_deployment,
            'azure_openai_api_version': (os.environ.get('AZURE_OPENAI_API_VERSION') or '').strip() or None,
        }

    env_openai_key = (os.environ.get('OPENAI_API_KEY') or '').strip()
    if not env_openai_key:
        env_openai_key = _read_secret_file(os.environ.get('OPENAI_API_KEY_FILE'))
    if env_openai_key:
        return {
            'openai_api_key': env_openai_key,
            'azure_openai_api_key': None,
            'azure_openai_endpoint': None,
            'azure_openai_embedding_deployment': None,
            'azure_openai_api_version': None,
        }

    env_azure_key = (os.environ.get('AZURE_OPENAI_API_KEY') or '').strip()
    env_azure_endpoint = (os.environ.get('AZURE_OPENAI_ENDPOINT') or '').strip()
    env_azure_deployment = (
        os.environ.get('AZURE_OPENAI_EMBEDDING_DEPLOYMENT')
        or os.environ.get('AZURE_OPENAI_DEPLOYMENT')
        or ''
    ).strip()
    if env_azure_key and env_azure_endpoint and env_azure_deployment:
        return {
            'openai_api_key': None,
            'azure_openai_api_key': env_azure_key,
            'azure_openai_endpoint': env_azure_endpoint,
            'azure_openai_embedding_deployment': env_azure_deployment,
            'azure_openai_api_version': (os.environ.get('AZURE_OPENAI_API_VERSION') or '').strip() or None,
        }

    return None


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
    embedding_cfg = get_embedding_config(settings_obj)
    if not embedding_cfg:
        return []

    openai_key = embedding_cfg.get('openai_api_key')
    if openai_key and _looks_like_test_key(openai_key):
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
            openai_api_key=embedding_cfg.get('openai_api_key'),
            query_text=query_text,
            language=language,
            top_k=max(1, min(10, int(top_k))),
            azure_openai_api_key=embedding_cfg.get('azure_openai_api_key'),
            azure_openai_endpoint=embedding_cfg.get('azure_openai_endpoint'),
            azure_openai_embedding_deployment=embedding_cfg.get('azure_openai_embedding_deployment'),
            azure_openai_api_version=embedding_cfg.get('azure_openai_api_version'),
        )
    except Exception as exc:
        logger.warning("RAG retrieval failed (non-fatal): %s", exc)
        return []
