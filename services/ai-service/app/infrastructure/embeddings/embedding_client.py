"""
Embedding generation client for the AI Service.

Prefers OpenAI-compatible API embeddings when configured.
Falls back to a local sentence-transformers model or a deterministic
random vector in demo mode.
"""

import logging

import numpy as np

from app.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

_model = None
_model_loaded = False


def _load_model():
    """Lazy-load the sentence-transformers model."""
    global _model, _model_loaded
    if _model_loaded:
        return _model
    try:
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer(settings.embedding_model)
        _model_loaded = True
        logger.info(
            "embedding_model_loaded",
            extra={"model": settings.embedding_model},
        )
    except Exception as e:
        logger.warning(
            "embedding_model_load_failed",
            extra={"model": settings.embedding_model, "error": str(e)},
        )
        _model = None
        _model_loaded = True
    return _model


class EmbeddingClient:
    """
    Client for generating text embeddings.

    Uses sentence-transformers when available, falls back to
    a deterministic random vector for demo/development mode.
    """

    def __init__(self):
        self.api_key = settings.llm_api_key
        self.base_url = settings.llm_base_url
        self.model = settings.embedding_model
        self.dimension = settings.embedding_dimension

    async def generate_embedding(self, text: str) -> list[float]:
        """
        Generate an embedding vector for the given text.

        Args:
            text: Input text to embed.

        Returns:
            List of floats representing the embedding vector.
        """
        if self.api_key:
            try:
                import openai

                client = openai.AsyncOpenAI(
                    api_key=self.api_key,
                    base_url=self.base_url,
                )
                response = await client.embeddings.create(
                    model=self.model,
                    input=text,
                )
                embedding = response.data[0].embedding
                if len(embedding) != self.dimension:
                    logger.warning(
                        "embedding_dimension_mismatch",
                        extra={
                            "expected": self.dimension,
                            "actual": len(embedding),
                            "model": self.model,
                        },
                    )
                return embedding
            except Exception as e:
                logger.warning(
                    "embedding_api_generation_failed",
                    extra={"model": self.model, "error": str(e)},
                )

        model = _load_model()
        if model is not None:
            try:
                embedding = model.encode(text, normalize_embeddings=True)
                return embedding.tolist()
            except Exception as e:
                logger.warning(
                    "embedding_generation_failed",
                    extra={"error": str(e)},
                )

        # Fallback: generate a deterministic pseudo-random vector for demo
        logger.debug("using_fallback_embedding")
        seed = hash(text) % (2**32)
        rng = np.random.default_rng(seed)
        vec = rng.standard_normal(self.dimension)
        # Normalize to unit vector
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec.tolist()
