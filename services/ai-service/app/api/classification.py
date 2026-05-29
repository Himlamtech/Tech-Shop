"""
Product classification API endpoint.

POST /api/v1/classification — Accepts product data and returns predicted
category label, category ID, and confidence score.
"""

import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.classification_service import get_classification_service
from app.core.errors import ValidationError
from app.core.responses import error_response, success_response
from app.infrastructure.db.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["classification"])


class ClassificationRequest(BaseModel):
    """Request body for product classification."""

    product_id: str = Field(
        ...,
        description="UUID of the product to classify",
    )
    title: str | None = Field(
        default=None,
        description="Product title",
    )
    description: str | None = Field(
        default=None,
        description="Product description",
    )
    brand: str | None = Field(
        default=None,
        description="Product brand",
    )
    attributes: dict | None = Field(
        default=None,
        description="Product attributes as key-value pairs",
    )


@router.post("/classification")
async def classify_product(
    body: ClassificationRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """
    Classify a product into a category.

    Accepts product data (title, description, brand, attributes) and returns:
    - predicted_category_label: The predicted category name
    - category_id: UUID of the predicted category
    - confidence_score: Float between 0.0 and 1.0
    - status: "auto_assigned" if confidence >= 0.5, "review_needed" if < 0.5
    - model_version: Identifier of the model used

    Validation:
    - Returns VALIDATION_ERROR if both title and description are empty.

    The classification result is stored in the ProductClassification table.
    """
    service = get_classification_service()

    try:
        result = await service.classify(
            product_id=body.product_id,
            title=body.title,
            description=body.description,
            brand=body.brand,
            attributes=body.attributes,
            db=db,
        )
    except ValidationError as exc:
        body_content = error_response(
            code=exc.error_code,
            message=exc.message,
            details=exc.details,
            request=request,
        )
        return JSONResponse(status_code=exc.http_status, content=body_content)

    data = {
        "product_id": result.product_id,
        "predicted_category_label": result.predicted_category_label,
        "category_id": result.category_id,
        "confidence_score": result.confidence_score,
        "status": result.status,
        "model_version": result.model_version,
    }

    return JSONResponse(
        status_code=200,
        content=success_response(data=data, request=request),
    )
