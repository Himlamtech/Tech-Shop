"""
Customer segmentation API endpoint.

POST /api/v1/segmentation/run — Admin triggers customer segmentation
using KMeans clustering on RFM features.
"""

import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.segmentation_service import get_segmentation_service
from app.core.errors import ForbiddenError, ValidationError
from app.core.responses import error_response, success_response
from app.infrastructure.db.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["segmentation"])


@router.post("/segmentation/run")
async def run_segmentation(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """
    Trigger customer segmentation.

    Admin-only endpoint that:
    1. Computes RFM features from purchase interaction data
    2. Runs KMeans clustering with silhouette score optimization (3-8 clusters)
    3. Assigns descriptive segment names based on RFM characteristics
    4. Stores results in CustomerSegment and SegmentationRun tables

    Returns:
    - run_id: UUID of the segmentation run
    - total_customers: Number of customers segmented
    - num_clusters: Optimal number of clusters found
    - silhouette_score: Quality metric of the clustering
    - segments: List of segment assignments with RFM values

    Errors:
    - 403 FORBIDDEN: If user is not admin
    - 422 VALIDATION_ERROR: If fewer than 30 customers have purchase data
    """
    service = get_segmentation_service()
    user_role = getattr(request.state, "user_role", None)

    try:
        result = await service.run_segmentation(db, user_role)
    except ForbiddenError as exc:
        body = error_response(
            code=exc.error_code,
            message=exc.message,
            details=exc.details,
            request=request,
        )
        return JSONResponse(status_code=exc.http_status, content=body)
    except ValidationError as exc:
        body = error_response(
            code=exc.error_code,
            message=exc.message,
            details=exc.details,
            request=request,
        )
        return JSONResponse(status_code=exc.http_status, content=body)

    return JSONResponse(
        status_code=200,
        content=success_response(data=result, request=request),
    )
