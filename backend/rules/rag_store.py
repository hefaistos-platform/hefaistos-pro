"""
RAG template store backed by Qdrant.

Provides helpers to:
- Obtain a Qdrant client configured from Django settings / env vars.
- Ensure the ``hefaistos_rule_templates`` collection exists with the correct schema.
- Upsert rule template payloads (embed via OpenAI or Azure OpenAI).
- Retrieve the top-k most similar templates filtered by ``language`` tag.

Embedding is performed via OpenAI *text-embedding-3-small* (public OpenAI) or an
Azure OpenAI embedding deployment with 1 536 dims. When no embedding credentials
are present, the helper returns an empty result rather than raising.
"""

from __future__ import annotations

import hashlib
import logging
import os
from typing import TYPE_CHECKING

logger = logging.getLogger(__name__)

COLLECTION_NAME = "hefaistos_rule_templates"
VECTOR_SIZE = 1536  # text-embedding-3-small output dimension

if TYPE_CHECKING:
    from qdrant_client import QdrantClient


def _get_qdrant_host() -> str:
    return os.environ.get("QDRANT_HOST", "qdrant")


def _get_qdrant_port() -> int:
    return int(os.environ.get("QDRANT_PORT", "6333"))


def _get_qdrant_api_key() -> str | None:
    return os.environ.get("QDRANT_API_KEY") or None


def get_qdrant_client() -> "QdrantClient":
    """Return a configured Qdrant client, or raise ImportError if the package is missing."""
    try:
        from qdrant_client import QdrantClient  # type: ignore
    except ImportError as exc:
        raise ImportError(
            "qdrant-client is required for the RAG store. "
            "Add qdrant-client==1.12.2 to requirements.txt and rebuild."
        ) from exc

    api_key = _get_qdrant_api_key()
    return QdrantClient(
        host=_get_qdrant_host(),
        port=_get_qdrant_port(),
        api_key=api_key,
        timeout=10,
    )


def ensure_collection(client: "QdrantClient") -> None:
    """Create ``hefaistos_rule_templates`` if it does not exist yet."""
    try:
        from qdrant_client.models import Distance, VectorParams  # type: ignore
    except ImportError:
        raise ImportError("qdrant-client is required.")

    existing = {c.name for c in client.get_collections().collections}
    if COLLECTION_NAME not in existing:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )
        logger.info("Created Qdrant collection '%s'.", COLLECTION_NAME)
    else:
        logger.debug("Qdrant collection '%s' already exists.", COLLECTION_NAME)


def _embed_text(
    text: str,
    openai_api_key: str | None = None,
    azure_openai_api_key: str | None = None,
    azure_openai_endpoint: str | None = None,
    azure_openai_embedding_deployment: str | None = None,
    azure_openai_api_version: str | None = None,
) -> list[float] | None:
    """Embed *text* using OpenAI or Azure OpenAI. Returns None on error."""
    try:
        import openai  # type: ignore
        if openai_api_key:
            client = openai.OpenAI(api_key=openai_api_key)
            response = client.embeddings.create(
                model="text-embedding-3-small",
                input=text[:8000],  # stay well within 8192-token limit
            )
            return response.data[0].embedding

        has_azure = bool(
            (azure_openai_api_key or "").strip()
            and (azure_openai_endpoint or "").strip()
            and (azure_openai_embedding_deployment or "").strip()
        )
        if has_azure:
            client = openai.AzureOpenAI(
                azure_endpoint=azure_openai_endpoint,
                api_key=azure_openai_api_key,
                api_version=(azure_openai_api_version or os.environ.get("AZURE_OPENAI_API_VERSION") or "2024-02-01"),
            )
            response = client.embeddings.create(
                model=azure_openai_embedding_deployment,
                input=text[:8000],
            )
            return response.data[0].embedding

        logger.warning("Embedding skipped: no OpenAI or Azure OpenAI embedding credentials configured.")
        return None
    except Exception as exc:
        logger.warning("Embedding failed: %s", exc)
        return None


def _make_point_id(source_id: str) -> str:
    """Derive a stable UUID-like string ID from a source identifier."""
    digest = hashlib.sha256(source_id.encode()).hexdigest()
    # Format as UUID v4-style string (Qdrant accepts string UUIDs)
    return f"{digest[:8]}-{digest[8:12]}-{digest[12:16]}-{digest[16:20]}-{digest[20:32]}"


def _build_embed_text(entry: dict) -> str:
    """Construct the text fed into the embedding model from a template entry."""
    parts = []
    if entry.get("title"):
        parts.append(f"Title: {entry['title']}")
    if entry.get("description"):
        parts.append(f"Description: {entry['description']}")
    if entry.get("query"):
        parts.append(f"Query:\n{entry['query']}")
    elif entry.get("raw_content"):
        parts.append(f"Content:\n{entry['raw_content']}")
    return "\n\n".join(parts)


def upsert_template(
    client: "QdrantClient",
    entry: dict,
    openai_api_key: str | None = None,
    azure_openai_api_key: str | None = None,
    azure_openai_endpoint: str | None = None,
    azure_openai_embedding_deployment: str | None = None,
    azure_openai_api_version: str | None = None,
) -> bool:
    """
    Upsert a single rule template into the Qdrant collection.

    *entry* is expected to contain:
      - ``source_id``   – unique identifier (repo + path + hash)
      - ``language``    – e.g. "KQL", "EQL", "SPL", "WAZUH"
      - ``title``       – human-readable name
      - ``description`` – optional description
      - ``query`` or ``raw_content`` – the detection logic text
      - ``author``      – optional
      - ``repo_name``   – source repository name
      - ``repo_path``   – path inside the repository

    Returns True on success, False on failure.
    """
    try:
        from qdrant_client.models import PointStruct  # type: ignore
    except ImportError:
        logger.warning("qdrant-client not installed; skipping upsert.")
        return False

    embed_text = _build_embed_text(entry)
    if not embed_text.strip():
        logger.warning("Skipping entry with no embeddable content: %s", entry.get("source_id"))
        return False

    vector = _embed_text(
        embed_text,
        openai_api_key=openai_api_key,
        azure_openai_api_key=azure_openai_api_key,
        azure_openai_endpoint=azure_openai_endpoint,
        azure_openai_embedding_deployment=azure_openai_embedding_deployment,
        azure_openai_api_version=azure_openai_api_version,
    )
    if vector is None:
        return False

    point_id = _make_point_id(entry["source_id"])
    payload = {
        "source_id": entry.get("source_id", ""),
        "language": (entry.get("language") or "KQL").upper(),
        "title": entry.get("title", ""),
        "description": entry.get("description", ""),
        "query": entry.get("query") or entry.get("raw_content", ""),
        "author": entry.get("author", ""),
        "repo_name": entry.get("repo_name", ""),
        "repo_path": entry.get("repo_path", ""),
        "tags": entry.get("tags") or [],
    }

    try:
        client.upsert(
            collection_name=COLLECTION_NAME,
            points=[PointStruct(id=point_id, vector=vector, payload=payload)],
        )
        return True
    except Exception as exc:
        logger.warning("Qdrant upsert failed for %s: %s", entry.get("source_id"), exc)
        return False


def retrieve_similar(
    openai_api_key: str | None,
    query_text: str,
    language: str | None = "KQL",
    top_k: int = 5,
    azure_openai_api_key: str | None = None,
    azure_openai_endpoint: str | None = None,
    azure_openai_embedding_deployment: str | None = None,
    azure_openai_api_version: str | None = None,
) -> list[dict]:
    """
    Retrieve the top-k most similar rule templates for *query_text*.

    When ``language`` is provided, results are filtered to same-format examples.
    Returns a list of payload dicts (empty list on any error).
    """
    has_openai = bool((openai_api_key or "").strip())
    has_azure = bool(
        (azure_openai_api_key or "").strip()
        and (azure_openai_endpoint or "").strip()
        and (azure_openai_embedding_deployment or "").strip()
    )
    if not query_text or not (has_openai or has_azure):
        return []

    try:
        client = get_qdrant_client()
        ensure_collection(client)
    except Exception as exc:
        logger.warning("Could not connect to Qdrant: %s", exc)
        return []

    vector = _embed_text(
        query_text,
        openai_api_key=openai_api_key,
        azure_openai_api_key=azure_openai_api_key,
        azure_openai_endpoint=azure_openai_endpoint,
        azure_openai_embedding_deployment=azure_openai_embedding_deployment,
        azure_openai_api_version=azure_openai_api_version,
    )
    if vector is None:
        return []

    try:
        from qdrant_client.models import Filter, FieldCondition, MatchValue  # type: ignore

        query_filter = None
        if language:
            query_filter = Filter(
                must=[FieldCondition(key="language", match=MatchValue(value=language.upper()))]
            )

        results = client.search(
            collection_name=COLLECTION_NAME,
            query_vector=vector,
            query_filter=query_filter,
            limit=top_k,
            with_payload=True,
        )
        return [hit.payload for hit in results]
    except Exception as exc:
        logger.warning("Qdrant retrieval failed: %s", exc)
        return []
