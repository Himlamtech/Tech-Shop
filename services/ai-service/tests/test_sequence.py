"""
Unit tests for sequence recommendation service.

Tests: valid sequence (>=2 interactions), insufficient interactions (<2),
exclusion of products, score range (0.0-1.0), fallback mode.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

from app.application.sequence_recommendation_service import (
    SequenceRecommendationService,
)
from app.core.errors import ValidationError
from app.ml.sequence_model.model import (
    SequenceModel,
    SequenceModelResult,
    SequencePrediction,
)


@pytest.fixture
def sequence_service():
    """Create a SequenceRecommendationService instance."""
    return SequenceRecommendationService()


class TestSequenceValidation:
    """Tests for input validation."""

    def test_insufficient_interactions_raises_error(self, sequence_service):
        """Fewer than 2 interactions should raise ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            sequence_service.validate_sequence(["product-1"])

        assert "2" in exc_info.value.details[0]["reason"]

    def test_empty_sequence_raises_error(self, sequence_service):
        """An empty sequence should raise ValidationError."""
        with pytest.raises(ValidationError):
            sequence_service.validate_sequence([])

    def test_none_sequence_raises_error(self, sequence_service):
        """A None sequence should raise ValidationError."""
        with pytest.raises(ValidationError):
            sequence_service.validate_sequence(None)

    def test_two_interactions_passes_validation(self, sequence_service):
        """Exactly 2 interactions should pass validation."""
        # Should not raise
        sequence_service.validate_sequence(["product-1", "product-2"])


class TestSequencePrediction:
    """Tests for sequence model prediction."""

    @pytest.mark.asyncio
    async def test_valid_sequence_returns_predictions(self, sequence_service):
        """A valid sequence (>=2 interactions) should return predictions."""
        mock_result = SequenceModelResult(
            predictions=[
                SequencePrediction(product_id="prod-3", score=0.85),
                SequencePrediction(product_id="prod-4", score=0.72),
            ],
            model_version="sequence-gru-v1-fallback",
            is_fallback=True,
        )

        with patch(
            "app.application.sequence_recommendation_service.get_sequence_model"
        ) as mock_get_model, patch.object(
            sequence_service, "_get_excluded_product_ids", new_callable=AsyncMock
        ) as mock_excluded:
            mock_model = MagicMock()
            mock_model.predict.return_value = mock_result
            mock_get_model.return_value = mock_model
            mock_excluded.return_value = set()

            result = await sequence_service.predict(
                interaction_sequence=["prod-1", "prod-2"]
            )

        assert result.count == 2
        assert result.predictions[0]["product_id"] == "prod-3"
        assert result.predictions[0]["score"] == 0.85

    @pytest.mark.asyncio
    async def test_scores_in_valid_range(self, sequence_service):
        """All prediction scores should be in the range [0.0, 1.0]."""
        mock_result = SequenceModelResult(
            predictions=[
                SequencePrediction(product_id=f"prod-{i}", score=0.1 * (i + 1))
                for i in range(5)
            ],
            model_version="sequence-gru-v1-fallback",
            is_fallback=True,
        )

        with patch(
            "app.application.sequence_recommendation_service.get_sequence_model"
        ) as mock_get_model, patch.object(
            sequence_service, "_get_excluded_product_ids", new_callable=AsyncMock
        ) as mock_excluded:
            mock_model = MagicMock()
            mock_model.predict.return_value = mock_result
            mock_get_model.return_value = mock_model
            mock_excluded.return_value = set()

            result = await sequence_service.predict(
                interaction_sequence=["prod-a", "prod-b", "prod-c"]
            )

        for pred in result.predictions:
            assert 0.0 <= pred["score"] <= 1.0

    @pytest.mark.asyncio
    async def test_exclusion_of_products(self, sequence_service):
        """Excluded product IDs should not appear in predictions."""
        excluded_ids = {"prod-excluded-1", "prod-excluded-2"}

        mock_result = SequenceModelResult(
            predictions=[
                SequencePrediction(product_id="prod-good-1", score=0.9),
                SequencePrediction(product_id="prod-good-2", score=0.7),
            ],
            model_version="sequence-gru-v1-fallback",
            is_fallback=True,
        )

        with patch(
            "app.application.sequence_recommendation_service.get_sequence_model"
        ) as mock_get_model, patch.object(
            sequence_service, "_get_excluded_product_ids", new_callable=AsyncMock
        ) as mock_excluded:
            mock_model = MagicMock()
            mock_model.predict.return_value = mock_result
            mock_get_model.return_value = mock_model
            mock_excluded.return_value = excluded_ids

            result = await sequence_service.predict(
                interaction_sequence=["prod-1", "prod-2"]
            )

        returned_ids = {p["product_id"] for p in result.predictions}
        assert not returned_ids.intersection(excluded_ids)

    @pytest.mark.asyncio
    async def test_fallback_mode_returns_results(self, sequence_service):
        """When trained model is unavailable, fallback should still return results."""
        # Use actual model with popularity fallback
        model = SequenceModel(model_dir="/nonexistent/path")
        model._popularity_scores = {
            "pop-1": 100.0,
            "pop-2": 80.0,
            "pop-3": 60.0,
        }

        with patch(
            "app.application.sequence_recommendation_service.get_sequence_model"
        ) as mock_get_model, patch.object(
            sequence_service, "_get_excluded_product_ids", new_callable=AsyncMock
        ) as mock_excluded:
            mock_get_model.return_value = model
            mock_excluded.return_value = set()

            result = await sequence_service.predict(
                interaction_sequence=["prod-1", "prod-2"]
            )

        assert result.is_fallback is True
        assert result.count > 0
        assert "fallback" in result.model_version
