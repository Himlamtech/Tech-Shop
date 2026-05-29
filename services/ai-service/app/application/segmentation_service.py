"""
Customer segmentation business logic service.

Orchestrates RFM feature computation from UserInteraction data,
KMeans clustering, result storage, and validation.
"""

import asyncio
import logging
import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenError, ValidationError
from app.infrastructure.db.models import (
    CustomerSegment,
    EventType,
    SegmentationRun,
    UserInteraction,
)
from app.ml.segmentation.model import (
    SegmentAssignment,
    SegmentationResult,
    compute_rfm_features,
    run_kmeans_segmentation,
)

logger = logging.getLogger(__name__)

# Minimum number of customers required for meaningful segmentation
MIN_CUSTOMERS = 30


class SegmentationService:
    """
    Service layer for customer segmentation.

    Handles:
    - Admin role verification
    - Fetching purchase interaction data from the database
    - RFM feature computation
    - KMeans clustering with silhouette optimization
    - Storing results in CustomerSegment and SegmentationRun tables
    """

    async def run_segmentation(
        self, db: AsyncSession, user_role: str | None
    ) -> dict:
        """
        Execute a full customer segmentation run.

        Steps:
        1. Verify admin role
        2. Fetch purchase interactions from UserInteraction table
        3. Compute RFM features
        4. Validate minimum customer count (>=30)
        5. Run KMeans with silhouette optimization
        6. Store results in database
        7. Return summary

        Args:
            db: Async database session.
            user_role: Role of the requesting user.

        Returns:
            Dict with total_customers, num_clusters, silhouette_score,
            and segment assignments.

        Raises:
            ForbiddenError: If user is not admin.
            ValidationError: If fewer than 30 customers have purchase data.
        """
        # 1. Verify admin role
        if user_role != "admin":
            raise ForbiddenError(
                message="Only admin users can trigger customer segmentation"
            )

        # 2. Fetch purchase interactions
        interactions = await self._fetch_purchase_interactions(db)

        # 3. Compute RFM features
        rfm_features = compute_rfm_features(interactions)

        # 4. Validate minimum customer count
        if len(rfm_features) < MIN_CUSTOMERS:
            raise ValidationError(
                message=(
                    f"Insufficient data for meaningful segmentation. "
                    f"Found {len(rfm_features)} customers with completed orders, "
                    f"minimum required is {MIN_CUSTOMERS}."
                ),
                details=[
                    {
                        "field": "customers",
                        "reason": (
                            f"At least {MIN_CUSTOMERS} customers with completed "
                            f"orders are required for segmentation"
                        ),
                    }
                ],
            )

        # 5. Run KMeans clustering (CPU-bound, run in thread pool)
        result: SegmentationResult = await asyncio.get_event_loop().run_in_executor(
            None, run_kmeans_segmentation, rfm_features
        )

        # 6. Store results in database
        run_id = await self._store_results(db, result)

        # 7. Return summary
        return {
            "run_id": str(run_id),
            "total_customers": result.num_customers,
            "num_clusters": result.num_clusters,
            "silhouette_score": result.silhouette_score_value,
            "segments": [
                {
                    "user_id": a.user_id,
                    "segment_id": a.segment_id,
                    "segment_name": a.segment_name,
                    "recency_days": a.recency_days,
                    "frequency": a.frequency,
                    "monetary": a.monetary,
                }
                for a in result.assignments
            ],
        }

    async def _fetch_purchase_interactions(
        self, db: AsyncSession
    ) -> list[dict]:
        """
        Fetch purchase events from UserInteraction table.

        Returns a list of dicts with user_id, timestamp, and monetary_value.
        Since UserInteraction doesn't store monetary value directly,
        we count each purchase as a unit transaction (monetary_value = 1.0
        per purchase event). For real-world usage, this would join with
        order data to get actual spend amounts.
        """
        stmt = (
            select(
                UserInteraction.user_id,
                UserInteraction.timestamp,
            )
            .where(UserInteraction.event_type == EventType.purchase)
            .order_by(UserInteraction.timestamp)
        )

        result = await db.execute(stmt)
        rows = result.all()

        interactions = []
        for row in rows:
            interactions.append(
                {
                    "user_id": str(row.user_id),
                    "timestamp": row.timestamp,
                    "monetary_value": 1.0,  # Each purchase counts as 1 unit
                }
            )

        return interactions

    async def _store_results(
        self, db: AsyncSession, result: SegmentationResult
    ) -> uuid.UUID:
        """
        Store segmentation results in the database.

        Creates a SegmentationRun record and CustomerSegment records
        for each customer assignment.

        Returns:
            The UUID of the created SegmentationRun.
        """
        run_id = uuid.uuid4()

        # Create SegmentationRun record
        segmentation_run = SegmentationRun(
            id=run_id,
            num_customers=result.num_customers,
            num_clusters=result.num_clusters,
            silhouette_score=result.silhouette_score_value,
        )
        db.add(segmentation_run)

        # Create CustomerSegment records
        for assignment in result.assignments:
            segment = CustomerSegment(
                id=uuid.uuid4(),
                user_id=uuid.UUID(assignment.user_id),
                segment_id=assignment.segment_id,
                segment_name=assignment.segment_name,
                recency_days=assignment.recency_days,
                frequency=assignment.frequency,
                monetary=assignment.monetary,
                run_id=run_id,
            )
            db.add(segment)

        await db.flush()

        logger.info(
            "segmentation_results_stored",
            extra={
                "run_id": str(run_id),
                "num_customers": result.num_customers,
                "num_clusters": result.num_clusters,
                "silhouette_score": result.silhouette_score_value,
            },
        )

        return run_id


# Module-level singleton
_service_instance: SegmentationService | None = None


def get_segmentation_service() -> SegmentationService:
    """Get or create the cached segmentation service instance."""
    global _service_instance
    if _service_instance is None:
        _service_instance = SegmentationService()
    return _service_instance
