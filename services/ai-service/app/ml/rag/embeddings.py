"""
Embedding generation using sentence-transformers.

Uses the all-MiniLM-L6-v2 model (384 dimensions) for fast,
lightweight embedding generation suitable for RAG retrieval.
"""

import logging
from functools import lru_cache

import numpy as np
from sentence_transformers import SentenceTransformer

from app.core.config import get_settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    """Load and cache the sentence-transformer model."""
    settings = get_settings()
    model_name = settings.embedding_model
    logger.info("Loading embedding model: %s", model_name)
    model = SentenceTransformer(model_name)
    logger.info("Embedding model loaded successfully (dim=%d)", model.get_sentence_embedding_dimension())
    return model


def generate_embedding(text: str) -> list[float]:
    """
    Generate a single embedding vector for the given text.

    Args:
        text: Input text to embed.

    Returns:
        List of floats representing the embedding vector (384 dimensions).
    """
    model = _get_model()
    embedding = model.encode(text, normalize_embeddings=True)
    return embedding.tolist()


def generate_embeddings_batch(texts: list[str], batch_size: int = 32) -> list[list[float]]:
    """
    Generate embeddings for a batch of texts.

    Args:
        texts: List of input texts to embed.
        batch_size: Number of texts to process at once.

    Returns:
        List of embedding vectors.
    """
    model = _get_model()
    embeddings = model.encode(texts, batch_size=batch_size, normalize_embeddings=True)
    return embeddings.tolist()
