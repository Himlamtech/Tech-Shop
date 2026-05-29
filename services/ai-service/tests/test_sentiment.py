"""
Unit tests for sentiment analysis service.

Tests: valid text returns label+score, empty text rejected, whitespace-only
rejected, >5000 chars rejected, model_version included, fallback mode works.
"""

from unittest.mock import MagicMock, patch

import pytest
import pytest_asyncio

from app.application.sentiment_service import SentimentService
from app.core.errors import ValidationError
from app.ml.sentiment.model import SentimentLabel, SentimentModel, SentimentResult


@pytest.fixture
def sentiment_service():
    """Create a SentimentService instance."""
    return SentimentService()


class TestSentimentValidation:
    """Tests for input validation."""

    def test_empty_text_raises_validation_error(self, sentiment_service):
        """Empty text should raise a ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            sentiment_service.validate_input("")

        assert "empty" in exc_info.value.message.lower()

    def test_whitespace_only_raises_validation_error(self, sentiment_service):
        """Whitespace-only text should raise a ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            sentiment_service.validate_input("   \t\n  ")

        assert "whitespace" in exc_info.value.message.lower()

    def test_text_exceeding_5000_chars_raises_validation_error(self, sentiment_service):
        """Text exceeding 5000 characters should raise a ValidationError."""
        long_text = "a" * 5001

        with pytest.raises(ValidationError) as exc_info:
            sentiment_service.validate_input(long_text)

        assert "5000" in exc_info.value.message


class TestSentimentAnalysis:
    """Tests for sentiment analysis inference."""

    @pytest.mark.asyncio
    async def test_valid_text_returns_label_and_score(self, sentiment_service):
        """Valid text should return a sentiment label and confidence score."""
        mock_result = SentimentResult(
            label=SentimentLabel.POSITIVE,
            confidence=0.92,
            model_version="sentiment-bert-v1",
        )

        with patch(
            "app.application.sentiment_service.get_sentiment_model"
        ) as mock_get_model:
            mock_model = MagicMock()
            mock_model.predict.return_value = mock_result
            mock_get_model.return_value = mock_model

            result = await sentiment_service.analyze("This product is amazing!")

        assert result.label == "positive"
        assert result.confidence == 0.92

    @pytest.mark.asyncio
    async def test_model_version_included_in_response(self, sentiment_service):
        """Response should include the model_version field."""
        mock_result = SentimentResult(
            label=SentimentLabel.NEGATIVE,
            confidence=0.85,
            model_version="sentiment-bert-v1",
        )

        with patch(
            "app.application.sentiment_service.get_sentiment_model"
        ) as mock_get_model:
            mock_model = MagicMock()
            mock_model.predict.return_value = mock_result
            mock_get_model.return_value = mock_model

            result = await sentiment_service.analyze("Terrible quality!")

        assert result.model_version == "sentiment-bert-v1"

    @pytest.mark.asyncio
    async def test_fallback_mode_works(self, sentiment_service):
        """When transformer model is unavailable, fallback mode should work."""
        # Use the actual rule-based fallback by creating a model that
        # hasn't loaded the transformer
        model = SentimentModel()
        model._load_attempted = True
        model._model_loaded = False

        with patch(
            "app.application.sentiment_service.get_sentiment_model"
        ) as mock_get_model:
            mock_get_model.return_value = model

            result = await sentiment_service.analyze("This is a great product!")

        assert result.label == "positive"
        assert result.confidence == 0.7
        assert "fallback" in result.model_version
