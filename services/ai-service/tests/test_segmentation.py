"""
Unit tests for customer segmentation service.

Tests: RFM computation correctness, cluster count optimization,
insufficient data rejection (<30 customers), result storage.
"""

import uuid
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

from app.application.segmentation_service import SegmentationService
from app.core.errors import ForbiddenError, ValidationError
from app.ml.segmentation.model import (
    RFMFeatures,
    SegmentationResult,
    compute_rfm_features,
    run_kmeans_segmentation,
)


@pytest.fixture
def segmentation_service():
    """Create a SegmentationService instance."""
    return SegmentationService()


class TestRFMComputation:
    """Tests for RFM feature computation."""

    def test_rfm_computation_correctness(self):
        """RFM features should be computed correctly from interaction data."""
        reference_date = datetime(2024, 6, 1)
        interactions = [
            {
                "user_id": "user-1",
                "timestamp": datetime(2024, 5, 25),
                "monetary_value": 100.0,
            },
            {
                "user_id": "user-1",
                "timestamp": datetime(2024, 5, 20),
                "monetary_value": 50.0,
            },
            {
                "user_id": "user-2",
                "timestamp": datetime(2024, 4, 1),
                "monetary_value": 200.0,
            },
        ]

        rfm_list = compute_rfm_features(interactions, reference_date=reference_date)

        assert len(rfm_list) == 2

        # Find user-1 and user-2
        user1 = next(r for r in rfm_list if r.user_id == "user-1")
        user2 = next(r for r in rfm_list if r.user_id == "user-2")

        # user-1: recency = 7 days (June 1 - May 25), frequency = 2, monetary = 150
        assert user1.recency_days == 7
        assert user1.frequency == 2
        assert user1.monetary == 150.0

        # user-2: recency = 61 days (June 1 - April 1), frequency = 1, monetary = 200
        assert user2.recency_days == 61
        assert user2.frequency == 1
        assert user2.monetary == 200.0

    def test_rfm_handles_single_customer(self):
        """RFM computation should work with a single customer."""
        reference_date = datetime(2024, 6, 1)
        interactions = [
            {
                "user_id": "user-solo",
                "timestamp": datetime(2024, 5, 30),
                "monetary_value": 75.0,
            },
        ]

        rfm_list = compute_rfm_features(interactions, reference_date=reference_date)

        assert len(rfm_list) == 1
        assert rfm_list[0].user_id == "user-solo"
        assert rfm_list[0].recency_days == 2
        assert rfm_list[0].frequency == 1
        assert rfm_list[0].monetary == 75.0


class TestClusterOptimization:
    """Tests for KMeans cluster count optimization."""

    def test_cluster_count_optimization(self):
        """KMeans should select optimal cluster count via silhouette score."""
        # Generate 50 customers with distinct RFM patterns
        rfm_features = []
        for i in range(50):
            if i < 15:
                # High-value cluster
                rfm_features.append(
                    RFMFeatures(user_id=f"user-{i}", recency_days=5, frequency=20, monetary=5000.0)
                )
            elif i < 30:
                # Medium-value cluster
                rfm_features.append(
                    RFMFeatures(user_id=f"user-{i}", recency_days=30, frequency=5, monetary=500.0)
                )
            else:
                # Low-value cluster
                rfm_features.append(
                    RFMFeatures(user_id=f"user-{i}", recency_days=90, frequency=1, monetary=50.0)
                )

        result = run_kmeans_segmentation(rfm_features)

        # Should find between 3 and 8 clusters
        assert 3 <= result.num_clusters <= 8
        # Silhouette score should be positive (meaningful clustering)
        assert result.silhouette_score_value > 0
        # All customers should be assigned
        assert result.num_customers == 50
        assert len(result.assignments) == 50


class TestSegmentationService:
    """Tests for the segmentation service layer."""

    @pytest.mark.asyncio
    async def test_insufficient_data_rejection(self, segmentation_service):
        """Segmentation should reject when fewer than 30 customers have data."""
        mock_db = AsyncMock()

        # Mock _fetch_purchase_interactions to return data for only 10 users
        interactions = [
            {
                "user_id": str(uuid.uuid4()),
                "timestamp": datetime.utcnow() - timedelta(days=i),
                "monetary_value": 1.0,
            }
            for i in range(10)
        ]

        with patch.object(
            segmentation_service,
            "_fetch_purchase_interactions",
            new_callable=AsyncMock,
        ) as mock_fetch:
            mock_fetch.return_value = interactions

            with pytest.raises(ValidationError) as exc_info:
                await segmentation_service.run_segmentation(
                    db=mock_db, user_role="admin"
                )

        assert "30" in exc_info.value.message

    @pytest.mark.asyncio
    async def test_non_admin_rejected(self, segmentation_service):
        """Non-admin users should be rejected with ForbiddenError."""
        mock_db = AsyncMock()

        with pytest.raises(ForbiddenError):
            await segmentation_service.run_segmentation(
                db=mock_db, user_role="customer"
            )

    @pytest.mark.asyncio
    async def test_result_storage(self, segmentation_service):
        """Segmentation results should be stored in the database."""
        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()

        # Generate 35 unique users with purchase interactions
        user_ids = [str(uuid.uuid4()) for _ in range(35)]
        interactions = [
            {
                "user_id": uid,
                "timestamp": datetime.utcnow() - timedelta(days=i * 3),
                "monetary_value": 1.0,
            }
            for i, uid in enumerate(user_ids)
        ]

        with patch.object(
            segmentation_service,
            "_fetch_purchase_interactions",
            new_callable=AsyncMock,
        ) as mock_fetch:
            mock_fetch.return_value = interactions

            result = await segmentation_service.run_segmentation(
                db=mock_db, user_role="admin"
            )

        # Verify db.add was called (SegmentationRun + CustomerSegment records)
        assert mock_db.add.call_count >= 36  # 1 run + 35 segments
        assert mock_db.flush.called
        assert result["total_customers"] == 35
        assert "run_id" in result
