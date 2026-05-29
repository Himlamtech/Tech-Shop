"""
Unit tests for product classification service.

Tests: valid product classified, empty title+description rejected,
confidence threshold (auto-assign vs review_needed), fallback mode.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

from app.application.classification_service import (
    AUTO_ASSIGN_THRESHOLD,
    ClassificationService,
)
from app.core.errors import ValidationError
from app.ml.product_classifier.model import (
    ClassificationResult,
    ProductClassifierModel,
)


@pytest.fixture
def classification_service():
    """Create a ClassificationService instance."""
    return ClassificationService()


@pytest_asyncio.fixture
async def mock_db():
    """Create a mock async database session."""
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    return db


class TestClassificationValidation:
    """Tests for input validation."""

    def test_empty_title_and_description_raises_error(self, classification_service):
        """Both title and description empty should raise ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            classification_service.validate_input(title="", description="")

        assert "title" in str(exc_info.value.details)

    def test_whitespace_title_and_description_raises_error(self, classification_service):
        """Both title and description whitespace-only should raise ValidationError."""
        with pytest.raises(ValidationError):
            classification_service.validate_input(title="   ", description="  \t ")

    def test_title_only_is_valid(self, classification_service):
        """Having only a title (no description) should pass validation."""
        # Should not raise
        classification_service.validate_input(title="iPhone 15 Pro", description="")

    def test_description_only_is_valid(self, classification_service):
        """Having only a description (no title) should pass validation."""
        # Should not raise
        classification_service.validate_input(
            title="", description="A powerful smartphone with A17 chip"
        )


class TestClassificationInference:
    """Tests for classification inference and confidence thresholds."""

    @pytest.mark.asyncio
    async def test_valid_product_classified(self, classification_service, mock_db):
        """A valid product should be classified with a category and confidence."""
        product_id = str(uuid.uuid4())
        mock_result = ClassificationResult(
            predicted_category_label="Smartphones",
            category_id=str(uuid.uuid4()),
            confidence_score=0.82,
            model_version="product-classifier-v1-fallback",
        )

        with patch(
            "app.application.classification_service.get_product_classifier_model"
        ) as mock_get_model:
            mock_model = MagicMock()
            mock_model.predict.return_value = mock_result
            mock_get_model.return_value = mock_model

            result = await classification_service.classify(
                product_id=product_id,
                title="iPhone 15 Pro Max",
                description="Latest Apple smartphone",
                brand="Apple",
                attributes=None,
                db=mock_db,
            )

        assert result.predicted_category_label == "Smartphones"
        assert result.confidence_score == 0.82
        assert result.product_id == product_id

    @pytest.mark.asyncio
    async def test_high_confidence_auto_assigned(self, classification_service, mock_db):
        """Confidence >= threshold should result in 'auto_assigned' status."""
        product_id = str(uuid.uuid4())
        mock_result = ClassificationResult(
            predicted_category_label="Laptops",
            category_id=str(uuid.uuid4()),
            confidence_score=0.75,  # Above AUTO_ASSIGN_THRESHOLD (0.5)
            model_version="product-classifier-v1",
        )

        with patch(
            "app.application.classification_service.get_product_classifier_model"
        ) as mock_get_model:
            mock_model = MagicMock()
            mock_model.predict.return_value = mock_result
            mock_get_model.return_value = mock_model

            result = await classification_service.classify(
                product_id=product_id,
                title="MacBook Pro 16",
                description="Professional laptop",
                brand="Apple",
                attributes=None,
                db=mock_db,
            )

        assert result.status == "auto_assigned"

    @pytest.mark.asyncio
    async def test_low_confidence_review_needed(self, classification_service, mock_db):
        """Confidence < threshold should result in 'review_needed' status."""
        product_id = str(uuid.uuid4())
        mock_result = ClassificationResult(
            predicted_category_label="Electronics",
            category_id=str(uuid.uuid4()),
            confidence_score=0.3,  # Below AUTO_ASSIGN_THRESHOLD (0.5)
            model_version="product-classifier-v1-fallback",
        )

        with patch(
            "app.application.classification_service.get_product_classifier_model"
        ) as mock_get_model:
            mock_model = MagicMock()
            mock_model.predict.return_value = mock_result
            mock_get_model.return_value = mock_model

            result = await classification_service.classify(
                product_id=product_id,
                title="Mystery gadget",
                description="",
                brand="",
                attributes=None,
                db=mock_db,
            )

        assert result.status == "review_needed"

    @pytest.mark.asyncio
    async def test_fallback_mode_classifies_product(self, classification_service, mock_db):
        """When ML model is unavailable, rule-based fallback should classify."""
        product_id = str(uuid.uuid4())

        # Use the actual rule-based fallback
        model = ProductClassifierModel()
        model._load_attempted = True
        model._model_loaded = False

        with patch(
            "app.application.classification_service.get_product_classifier_model"
        ) as mock_get_model:
            mock_get_model.return_value = model

            result = await classification_service.classify(
                product_id=product_id,
                title="Samsung Galaxy S24 Ultra",
                description="Flagship Android smartphone with AI features",
                brand="Samsung",
                attributes=None,
                db=mock_db,
            )

        assert result.predicted_category_label == "Smartphones"
        assert "fallback" in result.model_version
        assert result.confidence_score > 0
