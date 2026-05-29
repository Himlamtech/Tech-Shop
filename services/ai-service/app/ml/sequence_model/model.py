"""
Sequence recommendation model using GRU for next-product prediction.

Supports two modes:
1. Trained GRU model: Uses a trained GRU neural network to predict the next
   product in a user's interaction sequence. Loaded from saved model artifacts.
2. Popularity-based fallback: Returns products ranked by interaction frequency
   when the trained model is unavailable (not yet trained or artifacts missing).

The model maps product IDs to integer indices for embedding, processes
sequences through a GRU layer, and outputs probability scores over all
known products.
"""

import logging
import os
import pickle
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

logger = logging.getLogger(__name__)

MODEL_VERSION = "sequence-gru-v1"

# Default paths for model artifacts
_DEFAULT_MODEL_DIR = Path("/app/ml/sequence_model")


@dataclass
class SequencePrediction:
    """A single product prediction with its probability score."""

    product_id: str
    score: float


@dataclass
class SequenceModelResult:
    """Result of sequence model inference."""

    predictions: list[SequencePrediction] = field(default_factory=list)
    model_version: str = MODEL_VERSION
    is_fallback: bool = False


class SequenceModel:
    """
    GRU-based sequence model for next-product prediction.

    Architecture:
    - Embedding layer: maps product indices to dense vectors
    - GRU layer: captures sequential patterns in interaction history
    - Dense output layer: produces probability distribution over products

    Falls back to popularity-based ranking when the trained model
    is unavailable.
    """

    def __init__(self, model_dir: Path | str | None = None) -> None:
        self._model_dir = Path(model_dir) if model_dir else _DEFAULT_MODEL_DIR
        self._model = None
        self._model_loaded = False
        self._load_attempted = False

        # Mappings between product IDs and integer indices
        self._product_to_idx: dict[str, int] = {}
        self._idx_to_product: dict[int, str] = {}

        # Popularity scores for fallback (product_id -> interaction_count)
        self._popularity_scores: dict[str, float] = {}

        # Model hyperparameters (set during training or loaded from config)
        self._embedding_dim: int = 64
        self._hidden_dim: int = 128
        self._max_sequence_length: int = 50
        self._vocab_size: int = 0

    @property
    def is_trained(self) -> bool:
        """Check if the model has been successfully loaded."""
        return self._model_loaded

    def _try_load_model(self) -> bool:
        """
        Attempt to load the trained GRU model and mappings from disk.

        Returns True if successful, False otherwise.
        """
        if self._load_attempted:
            return self._model_loaded

        self._load_attempted = True

        try:
            mappings_path = self._model_dir / "mappings.pkl"
            model_path = self._model_dir / "model_weights.pkl"
            config_path = self._model_dir / "config.pkl"

            if not mappings_path.exists():
                logger.info(
                    "sequence_model_mappings_not_found",
                    extra={"path": str(mappings_path)},
                )
                self._try_load_popularity()
                return False

            # Load product-index mappings
            with open(mappings_path, "rb") as f:
                mappings = pickle.load(f)
                self._product_to_idx = mappings.get("product_to_idx", {})
                self._idx_to_product = mappings.get("idx_to_product", {})
                self._popularity_scores = mappings.get("popularity_scores", {})

            self._vocab_size = len(self._product_to_idx)

            if not model_path.exists():
                logger.info(
                    "sequence_model_weights_not_found_using_fallback",
                    extra={"path": str(model_path)},
                )
                return False

            # Load model configuration
            if config_path.exists():
                with open(config_path, "rb") as f:
                    config = pickle.load(f)
                    self._embedding_dim = config.get(
                        "embedding_dim", self._embedding_dim
                    )
                    self._hidden_dim = config.get("hidden_dim", self._hidden_dim)
                    self._max_sequence_length = config.get(
                        "max_sequence_length", self._max_sequence_length
                    )

            # Load model weights (numpy-based GRU implementation)
            with open(model_path, "rb") as f:
                self._model = pickle.load(f)

            self._model_loaded = True
            logger.info(
                "sequence_model_loaded",
                extra={
                    "vocab_size": self._vocab_size,
                    "embedding_dim": self._embedding_dim,
                    "hidden_dim": self._hidden_dim,
                },
            )
            return True

        except Exception as e:
            logger.warning(
                "sequence_model_load_failed_using_fallback",
                extra={"error": str(e)},
            )
            self._model_loaded = False
            self._try_load_popularity()
            return False

    def _try_load_popularity(self) -> None:
        """
        Attempt to load popularity scores for fallback recommendations.

        Looks for a popularity data file in the model directory.
        If not found, the fallback will return an empty result.
        """
        popularity_path = self._model_dir / "popularity.pkl"
        if popularity_path.exists():
            try:
                with open(popularity_path, "rb") as f:
                    self._popularity_scores = pickle.load(f)
                logger.info(
                    "popularity_scores_loaded",
                    extra={"num_products": len(self._popularity_scores)},
                )
            except Exception as e:
                logger.warning(
                    "popularity_scores_load_failed",
                    extra={"error": str(e)},
                )

    def predict(
        self,
        interaction_sequence: list[str],
        top_k: int = 10,
        exclude_product_ids: set[str] | None = None,
    ) -> SequenceModelResult:
        """
        Predict the next products given a user's interaction sequence.

        Args:
            interaction_sequence: List of product IDs representing the user's
                interaction history (ordered chronologically).
            top_k: Maximum number of predictions to return (default 10).
            exclude_product_ids: Set of product IDs to exclude from results
                (e.g., inactive or out-of-stock products).

        Returns:
            SequenceModelResult with ranked predictions and metadata.
        """
        if exclude_product_ids is None:
            exclude_product_ids = set()

        # Try loading the trained model
        if self._try_load_model() and self._model is not None:
            return self._predict_with_model(
                interaction_sequence, top_k, exclude_product_ids
            )

        # Fallback to popularity-based recommendations
        return self._predict_popularity_fallback(
            interaction_sequence, top_k, exclude_product_ids
        )

    def _predict_with_model(
        self,
        interaction_sequence: list[str],
        top_k: int,
        exclude_product_ids: set[str],
    ) -> SequenceModelResult:
        """
        Run inference using the trained GRU model.

        Converts product IDs to indices, pads/truncates the sequence,
        runs through the model, and returns top-k predictions.
        """
        # Convert product IDs to indices, skipping unknown products
        indices = []
        for product_id in interaction_sequence:
            idx = self._product_to_idx.get(product_id)
            if idx is not None:
                indices.append(idx)

        # If no known products in sequence, fall back to popularity
        if not indices:
            return self._predict_popularity_fallback(
                interaction_sequence, top_k, exclude_product_ids
            )

        # Truncate to max sequence length (keep most recent interactions)
        if len(indices) > self._max_sequence_length:
            indices = indices[-self._max_sequence_length:]

        # Run model inference
        try:
            scores = self._forward(indices)
        except Exception as e:
            logger.error(
                "sequence_model_inference_error",
                extra={"error": str(e)},
            )
            return self._predict_popularity_fallback(
                interaction_sequence, top_k, exclude_product_ids
            )

        # Build exclusion set (already seen + explicitly excluded)
        seen_products = set(interaction_sequence)
        all_excluded = exclude_product_ids | seen_products

        # Rank products by score, excluding filtered ones
        predictions = []
        sorted_indices = np.argsort(scores)[::-1]

        for idx in sorted_indices:
            if len(predictions) >= top_k:
                break

            product_id = self._idx_to_product.get(int(idx))
            if product_id is None:
                continue
            if product_id in all_excluded:
                continue

            score = float(scores[idx])
            # Clamp score to [0.0, 1.0]
            score = max(0.0, min(1.0, score))

            predictions.append(
                SequencePrediction(product_id=product_id, score=score)
            )

        return SequenceModelResult(
            predictions=predictions,
            model_version=MODEL_VERSION,
            is_fallback=False,
        )

    def _forward(self, indices: list[int]) -> np.ndarray:
        """
        Forward pass through the GRU model.

        The model dict contains:
        - embedding_weights: (vocab_size, embedding_dim)
        - gru_weights: GRU weight matrices
        - output_weights: (hidden_dim, vocab_size)
        - output_bias: (vocab_size,)

        Args:
            indices: List of product indices in the sequence.

        Returns:
            Probability scores for each product in the vocabulary.
        """
        model = self._model

        # Embedding lookup
        embedding_weights = model["embedding_weights"]
        embedded = embedding_weights[indices]  # (seq_len, embedding_dim)

        # GRU forward pass
        hidden = np.zeros(self._hidden_dim)
        gru_w_z = model["gru_w_z"]  # (embedding_dim + hidden_dim, hidden_dim)
        gru_w_r = model["gru_w_r"]
        gru_w_h = model["gru_w_h"]

        for t in range(len(indices)):
            x_t = embedded[t]
            combined = np.concatenate([x_t, hidden])

            # Update gate
            z_t = _sigmoid(combined @ gru_w_z)
            # Reset gate
            r_t = _sigmoid(combined @ gru_w_r)
            # Candidate hidden state
            combined_r = np.concatenate([x_t, r_t * hidden])
            h_tilde = np.tanh(combined_r @ gru_w_h)
            # Final hidden state
            hidden = (1 - z_t) * hidden + z_t * h_tilde

        # Output layer: project hidden state to vocabulary scores
        output_weights = model["output_weights"]
        output_bias = model["output_bias"]
        logits = hidden @ output_weights + output_bias

        # Apply softmax to get probabilities
        scores = _softmax(logits)

        return scores

    def _predict_popularity_fallback(
        self,
        interaction_sequence: list[str],
        top_k: int,
        exclude_product_ids: set[str],
    ) -> SequenceModelResult:
        """
        Fallback: rank products by popularity (interaction frequency).

        Used when the trained model is unavailable. Returns products
        sorted by their historical interaction count, normalized to [0, 1].
        """
        if not self._popularity_scores:
            return SequenceModelResult(
                predictions=[],
                model_version=f"{MODEL_VERSION}-fallback",
                is_fallback=True,
            )

        # Build exclusion set
        seen_products = set(interaction_sequence)
        all_excluded = exclude_product_ids | seen_products

        # Sort by popularity score descending
        sorted_products = sorted(
            self._popularity_scores.items(),
            key=lambda x: x[1],
            reverse=True,
        )

        # Normalize scores to [0, 1]
        max_score = sorted_products[0][1] if sorted_products else 1.0
        if max_score == 0:
            max_score = 1.0

        predictions = []
        for product_id, raw_score in sorted_products:
            if len(predictions) >= top_k:
                break
            if product_id in all_excluded:
                continue

            normalized_score = round(raw_score / max_score, 4)
            predictions.append(
                SequencePrediction(
                    product_id=product_id,
                    score=normalized_score,
                )
            )

        return SequenceModelResult(
            predictions=predictions,
            model_version=f"{MODEL_VERSION}-fallback",
            is_fallback=True,
        )


def _sigmoid(x: np.ndarray) -> np.ndarray:
    """Numerically stable sigmoid activation."""
    return np.where(
        x >= 0,
        1 / (1 + np.exp(-x)),
        np.exp(x) / (1 + np.exp(x)),
    )


def _softmax(x: np.ndarray) -> np.ndarray:
    """Numerically stable softmax."""
    x_shifted = x - np.max(x)
    exp_x = np.exp(x_shifted)
    return exp_x / exp_x.sum()


# Module-level singleton for lazy loading and caching
_model_instance: SequenceModel | None = None


def get_sequence_model(model_dir: Path | str | None = None) -> SequenceModel:
    """Get or create the cached sequence model instance."""
    global _model_instance
    if _model_instance is None:
        _model_instance = SequenceModel(model_dir=model_dir)
    return _model_instance
