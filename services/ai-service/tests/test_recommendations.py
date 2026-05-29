"""
Unit tests for hybrid recommendation service.

Tests: full hybrid scoring (>=3 interactions), cold start fallback (<3),
budget filtering, cart item exclusion, inactive/out-of-stock exclusion.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

from app.application.recommendation_service import (
    COLD_START_THRESHOLD,
    RecommendationService,
)


def _make_product(
    product_id=None,
    name="Test Product",
    price=100.0,
    stock=50,
    status="active",
    brand="TestBrand",
    category_id=None,
    rating_avg=4.0,
    rating_count=100,
):
    """Helper to create a product dict for testing."""
    return {
        "id": product_id or str(uuid.uuid4()),
        "name": name,
        "price": price,
        "stock": stock,
        "status": status,
        "brand": brand,
        "category_id": category_id or str(uuid.uuid4()),
        "rating_avg": rating_avg,
        "rating_count": rating_count,
    }


@pytest_asyncio.fixture
async def mock_db():
    """Create a mock async database session."""
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    # Mock execute for interaction count query
    mock_result = MagicMock()
    mock_result.scalar.return_value = 5  # Default: 5 interactions (not cold start)
    db.execute = AsyncMock(return_value=mock_result)
    return db


@pytest_asyncio.fixture
async def recommendation_service(mock_db):
    """Create a RecommendationService with mocked dependencies."""
    with patch("app.application.recommendation_service.get_settings") as mock_settings:
        settings = MagicMock()
        settings.cart_service_url = "http://cart-service:8003"
        settings.catalog_service_url = "http://catalog-service:8002"
        mock_settings.return_value = settings

        service = RecommendationService(db=mock_db)
        return service


class TestFullHybridScoring:
    """Tests for full hybrid scoring (>=3 interactions)."""

    @pytest.mark.asyncio
    async def test_full_hybrid_scoring_with_sufficient_interactions(
        self, recommendation_service, mock_db
    ):
        """Users with >=3 interactions should get full hybrid scoring."""
        user_id = str(uuid.uuid4())
        products = [_make_product() for _ in range(5)]

        # Mock interaction count >= COLD_START_THRESHOLD
        mock_result = MagicMock()
        mock_result.scalar.return_value = 5
        mock_db.execute = AsyncMock(return_value=mock_result)

        with patch.object(
            recommendation_service, "_fetch_candidate_products", new_callable=AsyncMock
        ) as mock_fetch, patch.object(
            recommendation_service, "_get_cart_product_ids", new_callable=AsyncMock
        ) as mock_cart:
            mock_fetch.return_value = products
            mock_cart.return_value = set()

            result = await recommendation_service.get_recommendations(
                user_id=user_id
            )

        assert result["is_cold_start"] is False
        assert result["count"] > 0
        # Each recommendation should have a score
        for rec in result["recommendations"]:
            assert "score" in rec
            assert 0.0 <= rec["score"] <= 1.0
            assert "reasons" in rec


class TestColdStartFallback:
    """Tests for cold start fallback (<3 interactions)."""

    @pytest.mark.asyncio
    async def test_cold_start_fallback_with_few_interactions(
        self, recommendation_service, mock_db
    ):
        """Users with <3 interactions should get cold start (popularity + business rules)."""
        user_id = str(uuid.uuid4())
        products = [_make_product(rating_avg=4.5, rating_count=200) for _ in range(5)]

        # Mock interaction count < COLD_START_THRESHOLD
        mock_result = MagicMock()
        mock_result.scalar.return_value = 1
        mock_db.execute = AsyncMock(return_value=mock_result)

        with patch.object(
            recommendation_service, "_fetch_candidate_products", new_callable=AsyncMock
        ) as mock_fetch, patch.object(
            recommendation_service, "_get_cart_product_ids", new_callable=AsyncMock
        ) as mock_cart:
            mock_fetch.return_value = products
            mock_cart.return_value = set()

            result = await recommendation_service.get_recommendations(
                user_id=user_id
            )

        assert result["is_cold_start"] is True
        assert result["count"] > 0


class TestBudgetFiltering:
    """Tests for budget (price) filtering."""

    @pytest.mark.asyncio
    async def test_budget_filtering_excludes_expensive_products(
        self, recommendation_service, mock_db
    ):
        """Products above max_price should be excluded from recommendations."""
        user_id = str(uuid.uuid4())
        cheap_id = str(uuid.uuid4())
        expensive_id = str(uuid.uuid4())

        products = [
            _make_product(product_id=cheap_id, price=50.0),
            _make_product(product_id=expensive_id, price=500.0),
        ]

        mock_result = MagicMock()
        mock_result.scalar.return_value = 5
        mock_db.execute = AsyncMock(return_value=mock_result)

        with patch.object(
            recommendation_service, "_fetch_candidate_products", new_callable=AsyncMock
        ) as mock_fetch, patch.object(
            recommendation_service, "_get_cart_product_ids", new_callable=AsyncMock
        ) as mock_cart:
            mock_fetch.return_value = products
            mock_cart.return_value = set()

            result = await recommendation_service.get_recommendations(
                user_id=user_id,
                max_price=100.0,
            )

        recommended_ids = {r["product_id"] for r in result["recommendations"]}
        assert expensive_id not in recommended_ids
        if result["count"] > 0:
            assert cheap_id in recommended_ids


class TestCartItemExclusion:
    """Tests for cart item exclusion."""

    @pytest.mark.asyncio
    async def test_cart_items_excluded_from_recommendations(
        self, recommendation_service, mock_db
    ):
        """Products already in the user's cart should be excluded."""
        user_id = str(uuid.uuid4())
        cart_product_id = str(uuid.uuid4())
        other_product_id = str(uuid.uuid4())

        products = [
            _make_product(product_id=cart_product_id),
            _make_product(product_id=other_product_id),
        ]

        mock_result = MagicMock()
        mock_result.scalar.return_value = 5
        mock_db.execute = AsyncMock(return_value=mock_result)

        with patch.object(
            recommendation_service, "_fetch_candidate_products", new_callable=AsyncMock
        ) as mock_fetch, patch.object(
            recommendation_service, "_get_cart_product_ids", new_callable=AsyncMock
        ) as mock_cart:
            mock_fetch.return_value = products
            mock_cart.return_value = {cart_product_id}

            result = await recommendation_service.get_recommendations(
                user_id=user_id
            )

        recommended_ids = {r["product_id"] for r in result["recommendations"]}
        assert cart_product_id not in recommended_ids


class TestInactiveOutOfStockExclusion:
    """Tests for inactive and out-of-stock product exclusion."""

    @pytest.mark.asyncio
    async def test_inactive_products_excluded(
        self, recommendation_service, mock_db
    ):
        """Inactive products should be excluded from recommendations."""
        user_id = str(uuid.uuid4())
        active_id = str(uuid.uuid4())
        inactive_id = str(uuid.uuid4())

        products = [
            _make_product(product_id=active_id, status="active"),
            _make_product(product_id=inactive_id, status="inactive"),
        ]

        mock_result = MagicMock()
        mock_result.scalar.return_value = 5
        mock_db.execute = AsyncMock(return_value=mock_result)

        with patch.object(
            recommendation_service, "_fetch_candidate_products", new_callable=AsyncMock
        ) as mock_fetch, patch.object(
            recommendation_service, "_get_cart_product_ids", new_callable=AsyncMock
        ) as mock_cart:
            mock_fetch.return_value = products
            mock_cart.return_value = set()

            result = await recommendation_service.get_recommendations(
                user_id=user_id
            )

        recommended_ids = {r["product_id"] for r in result["recommendations"]}
        assert inactive_id not in recommended_ids

    @pytest.mark.asyncio
    async def test_out_of_stock_products_excluded(
        self, recommendation_service, mock_db
    ):
        """Out-of-stock products (stock <= 0) should be excluded."""
        user_id = str(uuid.uuid4())
        in_stock_id = str(uuid.uuid4())
        out_of_stock_id = str(uuid.uuid4())

        products = [
            _make_product(product_id=in_stock_id, stock=10),
            _make_product(product_id=out_of_stock_id, stock=0),
        ]

        mock_result = MagicMock()
        mock_result.scalar.return_value = 5
        mock_db.execute = AsyncMock(return_value=mock_result)

        with patch.object(
            recommendation_service, "_fetch_candidate_products", new_callable=AsyncMock
        ) as mock_fetch, patch.object(
            recommendation_service, "_get_cart_product_ids", new_callable=AsyncMock
        ) as mock_cart:
            mock_fetch.return_value = products
            mock_cart.return_value = set()

            result = await recommendation_service.get_recommendations(
                user_id=user_id
            )

        recommended_ids = {r["product_id"] for r in result["recommendations"]}
        assert out_of_stock_id not in recommended_ids
