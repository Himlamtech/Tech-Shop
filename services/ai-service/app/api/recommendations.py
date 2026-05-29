"""
Hybrid Recommendation API endpoint.

GET /api/v1/recommendations — Generate personalized product recommendations
using a hybrid scoring pipeline that combines sequence model, content similarity,
collaborative filtering, popularity, and business rules.

Features:
- Hybrid scoring with 5 weighted signals
- Cold start fallback for new users (<3 interactions)
- Budget constraint filtering (min_price, max_price)
- Cart item exclusion
- 1-second response timeout
- Recommendation logging

Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8
"""

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.recommendation_service import RecommendationService
from app.core.errors import ServiceUnavailableError, ValidationError
from app.core.responses import error_response, success_response
from app.infrastructure.db.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["recommendations"])

RESPONSE_TIMEOUT_SECONDS = 1.0


@router.get("/recommendations")
async def get_recommendations(
    request: Request,
    user_id: str = Query(..., description="User ID for personalized recommendations"),
    context_product_id: Optional[str] = Query(
        None, description="Product ID the user is currently viewing"
    ),
    min_price: Optional[float] = Query(
        None, ge=0, description="Minimum price filter"
    ),
    max_price: Optional[float] = Query(
        None, ge=0, description="Maximum price filter"
    ),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """
    Generate hybrid product recommendations for a user.

    Combines multiple scoring signals (sequence model, content similarity,
    collaborative filtering, popularity, business rules) to produce
    personalized recommendations.

    - Users with >=3 interactions: full hybrid scoring
    - Users with <3 interactions: cold start fallback (popularity + business rules)
    - Filters: excludes inactive, out-of-stock, cart items, budget constraints
    - Returns top 10 recommendations with scores and reason labels
    - Response timeout: 1 second
    """
    # Extract request context
    request_id = getattr(request.state, "request_id", None)
    authorization = request.headers.get("authorization")

    # Validate user_id format
    if not user_id or not user_id.strip():
        raise ValidationError(
            message="user_id is required",
            details=[{"field": "user_id", "reason": "user_id cannot be empty"}],
        )

    # Validate budget constraint logic
    if min_price is not None and max_price is not None and min_price > max_price:
        raise ValidationError(
            message="Invalid budget constraint",
            details=[
                {
                    "field": "min_price/max_price",
                    "reason": "min_price cannot be greater than max_price",
                }
            ],
        )

    # Generate recommendations with timeout
    service = RecommendationService(db)

    try:
        result = await asyncio.wait_for(
            service.get_recommendations(
                user_id=user_id,
                context_product_id=context_product_id,
                min_price=min_price,
                max_price=max_price,
                authorization=authorization,
                request_id=request_id,
            ),
            timeout=RESPONSE_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        logger.error(
            "recommendations_timeout",
            extra={
                "request_id": request_id,
                "user_id": user_id,
            },
        )
        return JSONResponse(
            status_code=503,
            content=error_response(
                code="SERVICE_UNAVAILABLE",
                message="Recommendation generation timed out. Please try again.",
                request=request,
            ),
        )
    except ServiceUnavailableError as e:
        logger.error(
            "recommendations_service_unavailable",
            extra={
                "request_id": request_id,
                "user_id": user_id,
                "error": str(e),
            },
        )
        return JSONResponse(
            status_code=503,
            content=error_response(
                code="SERVICE_UNAVAILABLE",
                message=e.message,
                request=request,
            ),
        )

    return JSONResponse(
        status_code=200,
        content=success_response(data=result, request=request),
    )
