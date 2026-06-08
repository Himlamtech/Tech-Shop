"""
Hybrid Recommendation Scoring Pipeline.

Implements a multi-signal recommendation engine that combines:
- Sequence model score (0.30 weight)
- Content similarity score (0.25 weight)
- Collaborative filtering score (0.20 weight)
- Popularity score (0.15 weight)
- Business rules score (0.10 weight)

Cold start fallback: users with <3 interactions get recommendations
based on popularity + business rules only.

For demo without trained models, uses simplified scoring:
- Popularity: rating_avg * log(rating_count + 1) normalized
- Content similarity: same category/brand as context product
- Other components: random noise to simulate model outputs

Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8
"""

import logging
import math
import random
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import ServiceUnavailableError
from app.infrastructure.catalog_client import CatalogClient, ServiceClient
from app.infrastructure.db.models import RecommendationLog, UserInteraction

logger = logging.getLogger(__name__)

# Scoring weights
WEIGHT_SEQUENCE = 0.30
WEIGHT_CONTENT = 0.25
WEIGHT_COLLABORATIVE = 0.20
WEIGHT_POPULARITY = 0.15
WEIGHT_BUSINESS = 0.10

# Cold start threshold
COLD_START_THRESHOLD = 3

# Maximum recommendations to return
MAX_RECOMMENDATIONS = 10


@dataclass
class ProductScore:
    """Holds individual component scores and the final hybrid score for a product."""

    product_id: str
    sequence_score: float = 0.0
    content_score: float = 0.0
    collaborative_score: float = 0.0
    popularity_score: float = 0.0
    business_score: float = 0.0
    final_score: float = 0.0
    reasons: list[str] = field(default_factory=list)


class RecommendationService:
    """
    Hybrid recommendation scoring service.

    Combines multiple scoring signals with configurable weights
    and applies filtering/ranking to produce top-N recommendations.
    """

    def __init__(self, db: AsyncSession):
        self._db = db
        self._settings = get_settings()
        self._catalog_client = CatalogClient()
        self._cart_client = ServiceClient(
            base_url=self._settings.cart_service_url,
            timeout_seconds=3.0,
        )

    async def get_recommendations(
        self,
        user_id: str,
        context_product_id: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        authorization: Optional[str] = None,
        request_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Generate hybrid recommendations for a user.

        Args:
            user_id: The user requesting recommendations.
            context_product_id: Optional product the user is currently viewing.
            min_price: Optional minimum price filter.
            max_price: Optional maximum price filter.
            authorization: Bearer token for downstream calls.
            request_id: Request ID for tracing.

        Returns:
            Dict with recommendations list and metadata.

        Raises:
            ServiceUnavailableError: If catalog service is unavailable.
        """
        # 1. Count user interactions to determine cold start
        interaction_count = await self._get_interaction_count(user_id)
        is_cold_start = interaction_count < COLD_START_THRESHOLD

        # 2. Fetch candidate products from catalog
        candidates = await self._fetch_candidate_products(
            authorization=authorization,
            request_id=request_id,
        )

        if not candidates:
            logger.warning(
                "no_candidate_products",
                extra={"user_id": user_id, "request_id": request_id},
            )
            return self._build_empty_response(is_cold_start)

        # 3. Get context product details if provided
        context_product = None
        if context_product_id:
            context_product = self._find_product_in_candidates(
                context_product_id, candidates
            )

        # 4. Get user's cart items for exclusion
        cart_product_ids = await self._get_cart_product_ids(
            user_id=user_id,
            authorization=authorization,
            request_id=request_id,
        )

        # 5. Apply pre-filters
        filtered_candidates = self._apply_filters(
            candidates=candidates,
            cart_product_ids=cart_product_ids,
            min_price=min_price,
            max_price=max_price,
            context_product_id=context_product_id,
        )

        if not filtered_candidates:
            return self._build_empty_response(is_cold_start)

        # 6. Score candidates
        if is_cold_start:
            scored = self._score_cold_start(filtered_candidates, context_product)
        else:
            scored = self._score_full_hybrid(
                filtered_candidates, context_product, user_id
            )

        # 7. Rank and take top 10
        scored.sort(key=lambda s: s.final_score, reverse=True)
        top_recommendations = scored[:MAX_RECOMMENDATIONS]

        # 8. Log to RecommendationLog
        await self._log_recommendations(
            user_id=user_id,
            context_product_id=context_product_id,
            recommendations=top_recommendations,
        )

        # 9. Build response
        return self._build_response(top_recommendations, is_cold_start)

    # -------------------------------------------------------------------------
    # Interaction Count
    # -------------------------------------------------------------------------

    async def _get_interaction_count(self, user_id: str) -> int:
        """Count the number of interactions for a user."""
        try:
            user_uuid = uuid.UUID(user_id)
        except (ValueError, AttributeError):
            return 0

        stmt = select(func.count()).where(
            UserInteraction.user_id == user_uuid
        )
        result = await self._db.execute(stmt)
        count = result.scalar() or 0
        return count

    # -------------------------------------------------------------------------
    # Candidate Fetching
    # -------------------------------------------------------------------------

    async def _fetch_candidate_products(
        self,
        authorization: Optional[str] = None,
        request_id: Optional[str] = None,
    ) -> list[dict]:
        """
        Fetch active, in-stock products from the catalog service.

        Returns a list of product dicts with at least:
        id, name, price, stock, brand, category, rating_avg, rating_count, status
        """
        try:
            response = await self._catalog_client.get_products(
                params={"page_size": 50, "status": "active"},
                authorization=authorization,
                request_id=request_id,
            )
            # The catalog service returns paginated results
            if isinstance(response, dict):
                products = response.get("data", response.get("results", []))
                if isinstance(products, list):
                    return products
                # If data is nested further
                if isinstance(products, dict) and "results" in products:
                    return products["results"]
            return []
        except ServiceUnavailableError:
            raise ServiceUnavailableError(
                message="Catalog service unavailable — cannot generate recommendations"
            )
        except Exception as e:
            logger.error(
                "catalog_fetch_failed",
                extra={"error": str(e)},
            )
            raise ServiceUnavailableError(
                message="Failed to fetch products for recommendations"
            )

    def _find_product_in_candidates(
        self, product_id: str, candidates: list[dict]
    ) -> Optional[dict]:
        """Find a specific product in the candidate list."""
        for product in candidates:
            pid = str(product.get("id", ""))
            if pid == product_id:
                return product
        return None

    # -------------------------------------------------------------------------
    # Cart Items
    # -------------------------------------------------------------------------

    async def _get_cart_product_ids(
        self,
        user_id: str,
        authorization: Optional[str] = None,
        request_id: Optional[str] = None,
    ) -> set[str]:
        """
        Fetch the user's current cart product IDs for exclusion.

        Returns an empty set if the cart service is unavailable (graceful degradation).
        """
        try:
            headers: dict[str, str] = {}
            if authorization:
                headers["Authorization"] = authorization
            if request_id:
                headers["X-Request-ID"] = request_id

            response = await self._cart_client.get(
                "/api/v1/cart/current",
                headers=headers,
            )

            # Extract product IDs from cart items
            cart_data = response.get("data", response)
            items = []
            if isinstance(cart_data, dict):
                items = cart_data.get("items", [])
            elif isinstance(cart_data, list):
                items = cart_data

            return {str(item.get("product_id", "")) for item in items if item.get("product_id")}

        except Exception as e:
            # Graceful degradation: if cart is unavailable, skip exclusion
            logger.warning(
                "cart_fetch_failed",
                extra={"user_id": user_id, "error": str(e)},
            )
            return set()

    # -------------------------------------------------------------------------
    # Filtering
    # -------------------------------------------------------------------------

    def _apply_filters(
        self,
        candidates: list[dict],
        cart_product_ids: set[str],
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        context_product_id: Optional[str] = None,
    ) -> list[dict]:
        """
        Apply recommendation filters:
        - Exclude inactive products
        - Exclude out-of-stock products
        - Exclude cart items (unless complementary)
        - Apply budget constraint
        - Exclude the context product itself
        """
        filtered = []

        for product in candidates:
            product_id = str(product.get("id", ""))

            # Exclude context product itself
            if context_product_id and product_id == context_product_id:
                continue

            # Exclude inactive products
            status = product.get("status", "active")
            if status != "active":
                continue

            # Exclude out-of-stock products
            stock = product.get("stock", 0)
            if isinstance(stock, (int, float)) and stock <= 0:
                continue

            # Exclude cart items (simple exclusion — complementary logic
            # would require category analysis which we simplify here)
            if product_id in cart_product_ids:
                continue

            # Apply budget constraint
            price = self._get_price(product)
            if min_price is not None and price < min_price:
                continue
            if max_price is not None and price > max_price:
                continue

            filtered.append(product)

        return filtered

    # -------------------------------------------------------------------------
    # Scoring — Cold Start
    # -------------------------------------------------------------------------

    def _score_cold_start(
        self,
        candidates: list[dict],
        context_product: Optional[dict] = None,
    ) -> list[ProductScore]:
        """
        Cold start scoring: uses only popularity + business rules.

        For users with <3 interactions, we cannot use sequence model
        or collaborative filtering.
        """
        scored = []

        for product in candidates:
            ps = ProductScore(product_id=str(product.get("id", "")))

            # Popularity score: rating_avg * log(rating_count + 1) normalized
            ps.popularity_score = self._compute_popularity_score(product)

            # Business rules score
            ps.business_score = self._compute_business_score(
                product, context_product
            )

            # Cold start final score: only popularity and business rules
            # Normalize weights to sum to 1.0 for the two active components
            # popularity weight: 0.15 / (0.15 + 0.10) = 0.60
            # business weight: 0.10 / (0.15 + 0.10) = 0.40
            ps.final_score = 0.60 * ps.popularity_score + 0.40 * ps.business_score

            # Clamp to [0.0, 1.0]
            ps.final_score = max(0.0, min(1.0, ps.final_score))

            # Reason labels
            ps.reasons.append("popular")
            if ps.business_score > 0.5:
                ps.reasons.append("trending")

            scored.append(ps)

        return scored

    # -------------------------------------------------------------------------
    # Scoring — Full Hybrid
    # -------------------------------------------------------------------------

    def _score_full_hybrid(
        self,
        candidates: list[dict],
        context_product: Optional[dict],
        user_id: str,
    ) -> list[ProductScore]:
        """
        Full hybrid scoring for users with >=3 interactions.

        Combines all five scoring signals with their respective weights.
        For demo purposes, sequence and collaborative scores use random noise
        since we don't have trained models.
        """
        scored = []

        for product in candidates:
            ps = ProductScore(product_id=str(product.get("id", "")))

            # Sequence model score (demo: random noise)
            ps.sequence_score = self._compute_sequence_score(product, user_id)

            # Content similarity score
            ps.content_score = self._compute_content_score(
                product, context_product
            )

            # Collaborative filtering score (demo: random noise)
            ps.collaborative_score = self._compute_collaborative_score(
                product, user_id
            )

            # Popularity score
            ps.popularity_score = self._compute_popularity_score(product)

            # Business rules score
            ps.business_score = self._compute_business_score(
                product, context_product
            )

            # Compute weighted hybrid score
            ps.final_score = (
                WEIGHT_SEQUENCE * ps.sequence_score
                + WEIGHT_CONTENT * ps.content_score
                + WEIGHT_COLLABORATIVE * ps.collaborative_score
                + WEIGHT_POPULARITY * ps.popularity_score
                + WEIGHT_BUSINESS * ps.business_score
            )

            # Clamp to [0.0, 1.0]
            ps.final_score = max(0.0, min(1.0, ps.final_score))

            # Reason labels based on top contributing signals
            ps.reasons = self._generate_reason_labels(ps)

            scored.append(ps)

        return scored

    # -------------------------------------------------------------------------
    # Individual Score Computations
    # -------------------------------------------------------------------------

    def _compute_sequence_score(self, product: dict, user_id: str) -> float:
        """
        Compute sequence model score.

        Demo: returns random noise in [0.1, 0.7] since no trained model is available.
        In production, this would use an LSTM/GRU model to predict next-item probability.
        """
        # Deterministic seed based on product + user for consistency
        seed = hash(f"{product.get('id', '')}:{user_id}") % (2**32)
        rng = random.Random(seed)
        return rng.uniform(0.1, 0.7)

    def _compute_content_score(
        self, product: dict, context_product: Optional[dict]
    ) -> float:
        """
        Compute content similarity score.

        Demo: based on category and brand matching with the context product.
        - Same category: +0.5
        - Same brand: +0.3
        - Base score: 0.1
        """
        if not context_product:
            return 0.3  # Default moderate score when no context

        score = 0.1

        # Category match
        product_category = self._get_category_id(product)
        context_category = self._get_category_id(context_product)
        if product_category and context_category and product_category == context_category:
            score += 0.5

        # Brand match
        product_brand = (product.get("brand") or "").lower().strip()
        context_brand = (context_product.get("brand") or "").lower().strip()
        if product_brand and context_brand and product_brand == context_brand:
            score += 0.3

        return min(1.0, score)

    def _compute_collaborative_score(self, product: dict, user_id: str) -> float:
        """
        Compute collaborative filtering score.

        Demo: returns random noise in [0.1, 0.6] since no trained model is available.
        In production, this would use user-item matrix factorization.
        """
        seed = hash(f"collab:{product.get('id', '')}:{user_id}") % (2**32)
        rng = random.Random(seed)
        return rng.uniform(0.1, 0.6)

    def _compute_popularity_score(self, product: dict) -> float:
        """
        Compute popularity score based on rating metrics.

        Formula: rating_avg * log(rating_count + 1) / max_possible
        Normalized to [0.0, 1.0].
        """
        rating_avg = float(product.get("rating_avg", 0) or 0)
        rating_count = int(product.get("rating_count", 0) or 0)

        if rating_avg <= 0 or rating_count <= 0:
            return 0.1  # Minimum score for unrated products

        # rating_avg is 0-5, log(rating_count + 1) grows slowly
        # Normalize: max possible is 5 * log(10001) ≈ 5 * 9.21 = 46.05
        raw_score = rating_avg * math.log(rating_count + 1)
        max_score = 5.0 * math.log(10001)  # Theoretical max

        normalized = raw_score / max_score
        return max(0.0, min(1.0, normalized))

    def _compute_business_score(
        self, product: dict, context_product: Optional[dict]
    ) -> float:
        """
        Compute business rules score.

        Factors:
        - New arrivals get a boost (higher score)
        - Products with high stock get a slight boost (clearance potential)
        - Price proximity to context product
        """
        score = 0.3  # Base score

        # Stock-based boost (products with more stock get slight preference)
        stock = product.get("stock", 0) or 0
        if isinstance(stock, (int, float)) and stock > 50:
            score += 0.2

        # Price proximity to context product
        if context_product:
            product_price = self._get_price(product)
            context_price = self._get_price(context_product)
            if context_price > 0 and product_price > 0:
                ratio = min(product_price, context_price) / max(
                    product_price, context_price
                )
                # Products in similar price range get a boost
                score += 0.3 * ratio

        # Rating boost
        rating_avg = float(product.get("rating_avg", 0) or 0)
        if rating_avg >= 4.0:
            score += 0.2

        return max(0.0, min(1.0, score))

    # -------------------------------------------------------------------------
    # Reason Labels
    # -------------------------------------------------------------------------

    def _generate_reason_labels(self, ps: ProductScore) -> list[str]:
        """Generate human-readable reason labels based on top scoring signals."""
        reasons = []

        # Find the top contributing signals
        signals = [
            ("similar_to_viewed", ps.content_score, WEIGHT_CONTENT),
            ("popular", ps.popularity_score, WEIGHT_POPULARITY),
            ("frequently_bought_together", ps.collaborative_score, WEIGHT_COLLABORATIVE),
            ("recommended_for_you", ps.sequence_score, WEIGHT_SEQUENCE),
            ("trending", ps.business_score, WEIGHT_BUSINESS),
        ]

        # Sort by weighted contribution
        signals.sort(key=lambda s: s[1] * s[2], reverse=True)

        # Take top 2 reasons
        for label, score, _ in signals[:2]:
            if score > 0.2:
                reasons.append(label)

        if not reasons:
            reasons.append("recommended_for_you")

        return reasons

    # -------------------------------------------------------------------------
    # Logging
    # -------------------------------------------------------------------------

    async def _log_recommendations(
        self,
        user_id: str,
        context_product_id: Optional[str],
        recommendations: list[ProductScore],
    ) -> None:
        """Log recommendation results to the RecommendationLog table."""
        try:
            user_uuid = uuid.UUID(user_id)
        except (ValueError, AttributeError):
            logger.warning("invalid_user_id_for_logging", extra={"user_id": user_id})
            return

        context_uuid = None
        if context_product_id:
            try:
                context_uuid = uuid.UUID(context_product_id)
            except (ValueError, AttributeError):
                pass

        recommended_ids = [ps.product_id for ps in recommendations]
        scores = {
            ps.product_id: {
                "sequence": round(ps.sequence_score, 4),
                "content": round(ps.content_score, 4),
                "collaborative": round(ps.collaborative_score, 4),
                "popularity": round(ps.popularity_score, 4),
                "business": round(ps.business_score, 4),
                "final": round(ps.final_score, 4),
            }
            for ps in recommendations
        }

        log_entry = RecommendationLog(
            user_id=user_uuid,
            context_product_id=context_uuid,
            recommended_product_ids=recommended_ids,
            scores=scores,
        )

        try:
            self._db.add(log_entry)
            await self._db.flush()
        except Exception as e:
            logger.error(
                "recommendation_log_failed",
                extra={"user_id": user_id, "error": str(e)},
            )

    # -------------------------------------------------------------------------
    # Response Building
    # -------------------------------------------------------------------------

    def _build_response(
        self, recommendations: list[ProductScore], is_cold_start: bool
    ) -> dict[str, Any]:
        """Build the recommendation response payload."""
        items = []
        for ps in recommendations:
            items.append(
                {
                    "product_id": ps.product_id,
                    "score": round(ps.final_score, 4),
                    "reasons": ps.reasons,
                    "scores": {
                        "sequence": round(ps.sequence_score, 4),
                        "content": round(ps.content_score, 4),
                        "collaborative": round(ps.collaborative_score, 4),
                        "popularity": round(ps.popularity_score, 4),
                        "business": round(ps.business_score, 4),
                    },
                }
            )

        return {
            "recommendations": items,
            "count": len(items),
            "is_cold_start": is_cold_start,
        }

    def _build_empty_response(self, is_cold_start: bool) -> dict[str, Any]:
        """Build an empty recommendation response."""
        return {
            "recommendations": [],
            "count": 0,
            "is_cold_start": is_cold_start,
        }

    # -------------------------------------------------------------------------
    # Utility Helpers
    # -------------------------------------------------------------------------

    def _get_price(self, product: dict) -> float:
        """Safely extract price from a product dict."""
        price = product.get("price", 0)
        try:
            return float(price) if price else 0.0
        except (TypeError, ValueError):
            return 0.0

    def _get_category_id(self, product: dict) -> Optional[str]:
        """Extract category ID from a product dict (handles nested structures)."""
        category = product.get("category_id") or product.get("category")
        if isinstance(category, dict):
            return str(category.get("id", ""))
        return str(category) if category else None
