"""
Product classification business logic service.

Orchestrates input validation, model inference, confidence-based status
assignment, and persistence of classification results.
"""

import asyncio
import logging
import uuid
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ValidationError
from app.infrastructure.db.models import ClassificationStatus, ProductClassification
from app.ml.product_classifier.model import get_product_classifier_model

logger = logging.getLogger(__name__)

# Confidence threshold for auto-assignment
AUTO_ASSIGN_THRESHOLD = 0.5


@dataclass
class ClassificationResponse:
    """Structured response from product classification."""

    product_id: str
    predicted_category_label: str
    category_id: str
    confidence_score: float
    status: str
    model_version: str


class ClassificationService:
    """
    Service layer for product classification.

    Handles:
    - Input validation (title + description both empty)
    - Model inference (ML or rule-based fallback)
    - Confidence-based status assignment (auto_assigned vs review_needed)
    - Persistence to ProductClassification table
    """

    def validate_input(
        self,
        title: str | None,
        description: str | None,
    ) -> None:
        """
        Validate product classification input.

        Raises ValidationError if both title and description are empty
        or contain only whitespace.
        """
        title_empty = not title or title.strip() == ""
        description_empty = not description or description.strip() == ""

        if title_empty and description_empty:
            raise ValidationError(
                message="Product title and description must not both be empty",
                details=[
                    {
                        "field": "title",
                        "reason": "At least one of title or description is required",
                    },
                    {
                        "field": "description",
                        "reason": "At least one of title or description is required",
                    },
                ],
            )

    async def classify(
        self,
        product_id: str,
        title: str | None,
        description: str | None,
        brand: str | None,
        attributes: dict | None,
        db: AsyncSession,
    ) -> ClassificationResponse:
        """
        Classify a product into a category.

        Validates input, runs model inference, determines status based on
        confidence threshold, and stores the result.

        Args:
            product_id: UUID of the product being classified.
            title: Product title.
            description: Product description.
            brand: Product brand.
            attributes: Product attributes dict.
            db: Async database session for persistence.

        Returns:
            ClassificationResponse with predicted category and confidence.

        Raises:
            ValidationError: If title and description are both empty.
        """
        self.validate_input(title, description)

        # Run model inference in a thread pool to avoid blocking the event loop
        result = await asyncio.get_event_loop().run_in_executor(
            None,
            self._run_inference,
            title or "",
            description or "",
            brand or "",
            attributes,
        )

        # Determine status based on confidence threshold
        if result.confidence_score >= AUTO_ASSIGN_THRESHOLD:
            status = ClassificationStatus.auto_assigned
        else:
            status = ClassificationStatus.review_needed

        # Persist classification result
        classification_record = ProductClassification(
            id=uuid.uuid4(),
            product_id=uuid.UUID(product_id),
            predicted_category_id=uuid.UUID(result.category_id),
            predicted_category_label=result.predicted_category_label,
            confidence_score=Decimal(str(round(result.confidence_score, 3))),
            status=status,
        )
        db.add(classification_record)
        await db.flush()

        return ClassificationResponse(
            product_id=product_id,
            predicted_category_label=result.predicted_category_label,
            category_id=result.category_id,
            confidence_score=result.confidence_score,
            status=status.value,
            model_version=result.model_version,
        )

    def _run_inference(
        self,
        title: str,
        description: str,
        brand: str,
        attributes: dict | None,
    ):
        """
        Execute model inference synchronously.

        Called within a thread pool executor.
        """
        model = get_product_classifier_model()
        return model.predict(title, description, brand, attributes)


# Module-level singleton
_service_instance: ClassificationService | None = None


def get_classification_service() -> ClassificationService:
    """Get or create the cached classification service instance."""
    global _service_instance
    if _service_instance is None:
        _service_instance = ClassificationService()
    return _service_instance
