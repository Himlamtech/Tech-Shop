"""
Embedding generation helpers for RAG ingestion.

Prefers OpenAI-compatible API embeddings when configured and falls back
to sentence-transformers for local/demo flows.
"""

import logging
from functools import lru_cache
from typing import Any

import numpy as np

from app.core.config import get_settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _get_model() -> Any:
    """Load and cache the sentence-transformer model when available."""
    settings = get_settings()
    model_name = settings.embedding_model
    try:
        from sentence_transformers import SentenceTransformer

        logger.info("Loading embedding model: %s", model_name)
        model = SentenceTransformer(model_name)
        logger.info("Embedding model loaded successfully (dim=%d)", model.get_sentence_embedding_dimension())
        return model
    except Exception as exc:
        logger.warning("Embedding model load failed: %s", exc)
        return None


@lru_cache(maxsize=1)
def _get_openai_client():
    """Create a cached OpenAI-compatible client when credentials exist."""
    settings = get_settings()
    if not settings.llm_api_key:
        return None

    from openai import OpenAI

    return OpenAI(
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
    )


def generate_embedding(text: str) -> list[float]:
    """
    Generate a single embedding vector for the given text.

    Args:
        text: Input text to embed.

    Returns:
        List of floats representing the embedding vector.
    """
    settings = get_settings()
    client = _get_openai_client()
    if client is not None:
        response = client.embeddings.create(
            model=settings.embedding_model,
            input=text,
        )
        return response.data[0].embedding

    model = _get_model()
    if model is not None:
        embedding = model.encode(text, normalize_embeddings=True)
        return embedding.tolist()

    rng = np.random.default_rng(hash(text) % (2**32))
    vec = rng.standard_normal(settings.embedding_dimension)
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    return vec.tolist()


def generate_embeddings_batch(texts: list[str], batch_size: int = 32) -> list[list[float]]:
    """
    Generate embeddings for a batch of texts.

    Args:
        texts: List of input texts to embed.
        batch_size: Number of texts to process at once.

    Returns:
        List of embedding vectors.
    """
    settings = get_settings()
    client = _get_openai_client()
    if client is not None:
        response = client.embeddings.create(
            model=settings.embedding_model,
            input=texts,
        )
        return [item.embedding for item in response.data]

    model = _get_model()
    if model is not None:
        embeddings = model.encode(texts, batch_size=batch_size, normalize_embeddings=True)
        return embeddings.tolist()

    return [generate_embedding(text) for text in texts]
