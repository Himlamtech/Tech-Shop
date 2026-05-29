"""
Sentiment analysis API endpoint.

POST /api/v1/sentiment — Accepts review text and returns sentiment label,
confidence score, and model version.
"""

import asyncio
import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.application.sentiment_service import get_sentiment_service
from app.core.responses import error_response, success_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["sentiment"])


class SentimentRequest(BaseModel):
    """Request body for sentiment analysis."""

    text: str


@router.post("/sentiment")
async def analyze_sentiment(
    body: SentimentRequest,
    request: Request,
) -> JSONResponse:
    """
    Analyze sentiment of review text.

    Accepts review text and returns:
    - label: positive, neutral, or negative
    - confidence: float between 0.0 and 1.0
    - model_version: identifier of the model used

    Validation:
    - Rejects empty text, whitespace-only text, or text > 5000 characters
      with VALIDATION_ERROR.

    Timeout:
    - Returns 503 if inference exceeds 3 seconds.
    """
    service = get_sentiment_service()

    try:
        result = await service.analyze(body.text)
    except asyncio.TimeoutError:
        body_content = error_response(
            code="SERVICE_UNAVAILABLE",
            message="Sentiment analysis timed out",
            details=[
                {
                    "reason": "Model inference exceeded the 3-second timeout"
                }
            ],
            request=request,
        )
        return JSONResponse(status_code=503, content=body_content)

    data = {
        "label": result.label,
        "confidence": result.confidence,
        "model_version": result.model_version,
    }

    return JSONResponse(
        status_code=200,
        content=success_response(data=data, request=request),
    )
