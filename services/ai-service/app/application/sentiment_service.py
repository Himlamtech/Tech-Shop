"""
Sentiment analysis business logic service.

Orchestrates input validation, model inference, and timeout enforcement
for the sentiment analysis endpoint.
"""

import asyncio
import logging
from dataclasses import dataclass

from app.core.errors import ValidationError
from app.ml.sentiment.model import SentimentLabel, get_sentiment_model

logger = logging.getLogger(__name__)

# Maximum allowed response time for sentiment analysis (seconds)
SENTIMENT_TIMEOUT_SECONDS = 3.0


@dataclass
class SentimentResponse:
    """Structured response from sentiment analysis."""

    label: str
    confidence: float
    model_version: str


class SentimentService:
    """
    Service layer for sentiment analysis.

    Handles:
    - Input validation (empty, whitespace-only, length > 5000)
    - Model inference with timeout enforcement
    - Response formatting
    """

    def validate_input(self, text: str) -> None:
        """
        Validate review text input.

        Raises ValidationError if:
        - Text is empty
        - Text contains only whitespace
        - Text exceeds 5000 characters
        """
        if not text:
            raise ValidationError(
                message="Review text must not be empty",
                details=[{"field": "text", "reason": "Text is required"}],
            )

        if text.strip() == "":
            raise ValidationError(
                message="Review text must not contain only whitespace",
                details=[
                    {
                        "field": "text",
                        "reason": "Text must contain non-whitespace characters",
                    }
                ],
            )

        if len(text) > 5000:
            raise ValidationError(
                message="Review text must not exceed 5000 characters",
                details=[
                    {
                        "field": "text",
                        "reason": f"Text length {len(text)} exceeds maximum of 5000 characters",
                    }
                ],
            )

    async def analyze(self, text: str) -> SentimentResponse:
        """
        Analyze sentiment of the given review text.

        Validates input, runs model inference within a 3-second timeout,
        and returns the structured result.

        Raises:
            ValidationError: If input fails validation.
            asyncio.TimeoutError: If inference exceeds 3 seconds.
        """
        self.validate_input(text)

        # Run model inference in a thread pool to avoid blocking the event loop,
        # with a timeout of 3 seconds.
        try:
            result = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(
                    None, self._run_inference, text
                ),
                timeout=SENTIMENT_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            logger.error(
                "sentiment_inference_timeout",
                extra={"text_length": len(text)},
            )
            raise

        return result

    def _run_inference(self, text: str) -> SentimentResponse:
        """
        Execute model inference synchronously.

        Called within a thread pool executor.
        """
        model = get_sentiment_model()
        result = model.predict(text)

        return SentimentResponse(
            label=result.label.value,
            confidence=result.confidence,
            model_version=result.model_version,
        )


# Module-level singleton
_service_instance: SentimentService | None = None


def get_sentiment_service() -> SentimentService:
    """Get or create the cached sentiment service instance."""
    global _service_instance
    if _service_instance is None:
        _service_instance = SentimentService()
    return _service_instance
