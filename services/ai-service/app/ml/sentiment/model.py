"""
Sentiment analysis model loading and inference.

Supports two modes:
1. Transformer-based (BERT-family): Uses a pre-trained model for accurate
   sentiment classification. Loaded lazily on first request.
2. Rule-based fallback: Simple keyword matching when the transformer model
   is unavailable (e.g., not downloaded). Suitable for demo/development.
"""

import logging
import re
from enum import Enum

logger = logging.getLogger(__name__)

MODEL_VERSION = "sentiment-bert-v1"


class SentimentLabel(str, Enum):
    """Sentiment classification labels."""

    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"


class SentimentResult:
    """Result of sentiment analysis inference."""

    def __init__(
        self, label: SentimentLabel, confidence: float, model_version: str
    ):
        self.label = label
        self.confidence = confidence
        self.model_version = model_version


class SentimentModel:
    """
    Sentiment analysis model with lazy loading and rule-based fallback.

    Attempts to load a BERT-family transformer model on first inference.
    Falls back to keyword-based classification if the model is unavailable.
    """

    def __init__(self) -> None:
        self._pipeline = None
        self._model_loaded = False
        self._load_attempted = False

    def _try_load_transformer(self) -> bool:
        """
        Attempt to load the transformer sentiment pipeline.

        Returns True if successful, False otherwise.
        """
        if self._load_attempted:
            return self._model_loaded

        self._load_attempted = True

        try:
            from transformers import pipeline as hf_pipeline

            self._pipeline = hf_pipeline(
                "sentiment-analysis",
                model="cardiffnlp/twitter-roberta-base-sentiment-latest",
                tokenizer="cardiffnlp/twitter-roberta-base-sentiment-latest",
                top_k=None,
            )
            self._model_loaded = True
            logger.info(
                "transformer_model_loaded",
                extra={"model": "cardiffnlp/twitter-roberta-base-sentiment-latest"},
            )
            return True
        except Exception as e:
            logger.warning(
                "transformer_model_unavailable_using_fallback",
                extra={"error": str(e)},
            )
            self._model_loaded = False
            return False

    def predict(self, text: str) -> SentimentResult:
        """
        Run sentiment inference on the given text.

        Tries the transformer model first; falls back to rule-based
        classification if the model is not available.
        """
        if self._try_load_transformer() and self._pipeline is not None:
            return self._predict_transformer(text)
        return self._predict_rule_based(text)

    def _predict_transformer(self, text: str) -> SentimentResult:
        """Run inference using the loaded transformer pipeline."""
        # Truncate to model max length (512 tokens approx)
        truncated_text = text[:512]

        results = self._pipeline(truncated_text)

        # results is a list of lists: [[{label, score}, ...]]
        if isinstance(results[0], list):
            scores = results[0]
        else:
            scores = results

        # Map model labels to our standard labels
        label_map = {
            "positive": SentimentLabel.POSITIVE,
            "neutral": SentimentLabel.NEUTRAL,
            "negative": SentimentLabel.NEGATIVE,
        }

        # Find the highest scoring label
        best = max(scores, key=lambda x: x["score"])
        mapped_label = label_map.get(
            best["label"].lower(), SentimentLabel.NEUTRAL
        )
        confidence = round(float(best["score"]), 4)

        return SentimentResult(
            label=mapped_label,
            confidence=confidence,
            model_version=MODEL_VERSION,
        )

    def _predict_rule_based(self, text: str) -> SentimentResult:
        """
        Rule-based fallback sentiment classification using keyword matching.

        Returns confidence of 0.7 for rule-based predictions.
        """
        text_lower = text.lower()

        positive_keywords = [
            "great", "excellent", "love", "amazing", "good", "perfect",
            "wonderful", "fantastic", "awesome", "best", "happy",
            "satisfied", "recommend", "outstanding",
        ]
        negative_keywords = [
            "bad", "terrible", "awful", "worst", "hate", "broken",
            "horrible", "poor", "disappointing", "useless", "waste",
            "defective", "rubbish", "trash",
        ]

        # Count keyword matches using word boundaries
        positive_count = sum(
            1 for kw in positive_keywords
            if re.search(rf"\b{kw}\b", text_lower)
        )
        negative_count = sum(
            1 for kw in negative_keywords
            if re.search(rf"\b{kw}\b", text_lower)
        )

        if positive_count > negative_count:
            label = SentimentLabel.POSITIVE
        elif negative_count > positive_count:
            label = SentimentLabel.NEGATIVE
        else:
            label = SentimentLabel.NEUTRAL

        return SentimentResult(
            label=label,
            confidence=0.7,
            model_version=f"{MODEL_VERSION}-fallback",
        )


# Module-level singleton for lazy loading and caching
_model_instance: SentimentModel | None = None


def get_sentiment_model() -> SentimentModel:
    """Get or create the cached sentiment model instance."""
    global _model_instance
    if _model_instance is None:
        _model_instance = SentimentModel()
    return _model_instance
