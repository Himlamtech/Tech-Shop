"""
Unit tests for Review Service API endpoints.

Tests: create review (success, duplicate, unpurchased), list reviews,
average rating.
"""

import uuid
from unittest.mock import patch

from django.db import IntegrityError
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.review.models import Review


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    },
    ORDER_SERVICE_URL="http://order-service:8004",
    AI_SERVICE_URL="http://ai-service:8010",
    CATALOG_SERVICE_URL="http://catalog-service:8002",
)
class ReviewCreateAPITests(TestCase):
    """Tests for POST /api/v1/reviews endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.url = "/api/v1/reviews/"
        self.user_id = str(uuid.uuid4())
        self.product_id = str(uuid.uuid4())
        self.order_id = str(uuid.uuid4())

    def _mock_auth(self, mock_jwt):
        """Helper to set authenticated user."""

        def set_user(request):
            request.user_id = self.user_id
            request.user_role = "customer"

        mock_jwt.side_effect = set_user

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    @patch("apps.core.http_client.ServiceClient.patch")
    @patch("apps.core.http_client.ServiceClient.post")
    @patch("apps.core.http_client.ServiceClient.get")
    def test_create_review_success(
        self, mock_get, mock_post, mock_patch, mock_jwt
    ):
        """Creating a review with valid data should succeed."""
        self._mock_auth(mock_jwt)

        # Mock order service - verify purchase
        mock_get.side_effect = [
            # First call: list orders
            {
                "data": [
                    {"id": self.order_id, "status": "completed"}
                ]
            },
            # Second call: order detail
            {
                "data": {
                    "id": self.order_id,
                    "items": [
                        {"product_id": self.product_id}
                    ],
                }
            },
        ]

        # Mock AI service - sentiment analysis
        mock_post.return_value = {
            "data": {"label": "positive", "confidence": 0.95}
        }

        # Mock catalog service - update rating
        mock_patch.return_value = {"data": {}}

        payload = {
            "product_id": self.product_id,
            "rating": 5,
            "comment": "Excellent product, highly recommend!",
        }
        response = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["data"]["rating"], 5)
        self.assertEqual(data["data"]["product_id"], self.product_id)

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    @patch("apps.core.http_client.ServiceClient.patch")
    @patch("apps.core.http_client.ServiceClient.post")
    @patch("apps.core.http_client.ServiceClient.get")
    def test_create_review_duplicate(
        self, mock_get, mock_post, mock_patch, mock_jwt
    ):
        """Creating a duplicate review for same product should return 409."""
        self._mock_auth(mock_jwt)

        # Create existing review
        Review.objects.create(
            user_id=self.user_id,
            product_id=self.product_id,
            rating=4,
            comment="Already reviewed",
        )

        # Mock order service - verify purchase
        mock_get.side_effect = [
            {"data": [{"id": self.order_id, "status": "completed"}]},
            {"data": {"id": self.order_id, "items": [{"product_id": self.product_id}]}},
        ]

        # Mock AI service
        mock_post.return_value = {
            "data": {"label": "positive", "confidence": 0.9}
        }

        payload = {
            "product_id": self.product_id,
            "rating": 3,
            "comment": "Trying to review again",
        }
        response = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response.status_code, 409)

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    @patch("apps.core.http_client.ServiceClient.get")
    def test_create_review_unpurchased_product(self, mock_get, mock_jwt):
        """Reviewing a product not purchased should return 403."""
        self._mock_auth(mock_jwt)

        # Mock order service - no completed orders with this product
        mock_get.side_effect = [
            {"data": [{"id": self.order_id, "status": "completed"}]},
            {"data": {"id": self.order_id, "items": [{"product_id": str(uuid.uuid4())}]}},
        ]

        payload = {
            "product_id": self.product_id,
            "rating": 4,
            "comment": "Never bought this",
        }
        response = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response.status_code, 403)

    def test_create_review_unauthenticated(self):
        """Creating a review without auth should return 401."""
        payload = {
            "product_id": self.product_id,
            "rating": 5,
            "comment": "Great product",
        }
        response = self.client.post(self.url, data=payload, format="json")
        self.assertIn(response.status_code, [401, 403])

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    def test_create_review_invalid_rating(self, mock_jwt):
        """Rating outside 1-5 should return 422."""
        self._mock_auth(mock_jwt)

        payload = {
            "product_id": self.product_id,
            "rating": 6,
            "comment": "Invalid rating",
        }
        response = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response.status_code, 422)


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    },
    ORDER_SERVICE_URL="http://order-service:8004",
    AI_SERVICE_URL="http://ai-service:8010",
    CATALOG_SERVICE_URL="http://catalog-service:8002",
)
class ReviewListAPITests(TestCase):
    """Tests for GET /api/v1/reviews/product/{product_id} endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.product_id = str(uuid.uuid4())

        # Create test reviews
        for i in range(5):
            Review.objects.create(
                user_id=str(uuid.uuid4()),
                product_id=self.product_id,
                rating=i + 1,
                comment=f"Review comment {i}",
            )

    def test_list_reviews_success(self):
        """GET /api/v1/reviews/product/{id} should return reviews."""
        url = f"/api/v1/reviews/product/{self.product_id}"
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(len(data["data"]["reviews"]), 5)

    def test_list_reviews_pagination(self):
        """Reviews should be paginated."""
        url = f"/api/v1/reviews/product/{self.product_id}?page_size=2&page=1"
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["data"]["reviews"]), 2)
        self.assertIn("pagination", data["meta"])
        self.assertEqual(data["meta"]["pagination"]["total"], 5)

    def test_list_reviews_empty_product(self):
        """Product with no reviews should return empty list."""
        empty_product_id = str(uuid.uuid4())
        url = f"/api/v1/reviews/product/{empty_product_id}"
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["data"]["reviews"]), 0)
        self.assertEqual(data["data"]["total_reviews"], 0)

    def test_list_reviews_no_auth_required(self):
        """Listing reviews should not require authentication."""
        url = f"/api/v1/reviews/product/{self.product_id}"
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    },
    ORDER_SERVICE_URL="http://order-service:8004",
    AI_SERVICE_URL="http://ai-service:8010",
    CATALOG_SERVICE_URL="http://catalog-service:8002",
)
class ReviewAverageRatingTests(TestCase):
    """Tests for average rating calculation."""

    def setUp(self):
        self.client = APIClient()
        self.product_id = str(uuid.uuid4())

    def test_average_rating_calculation(self):
        """Average rating should be correctly calculated."""
        ratings = [5, 4, 3, 4, 4]
        for i, rating in enumerate(ratings):
            Review.objects.create(
                user_id=str(uuid.uuid4()),
                product_id=self.product_id,
                rating=rating,
                comment=f"Review {i}",
            )

        url = f"/api/v1/reviews/product/{self.product_id}"
        response = self.client.get(url)
        data = response.json()
        # Average of [5, 4, 3, 4, 4] = 4.0
        self.assertEqual(data["data"]["average_rating"], 4.0)
        self.assertEqual(data["data"]["total_reviews"], 5)

    def test_average_rating_no_reviews(self):
        """Product with no reviews should have 0.0 average."""
        empty_product_id = str(uuid.uuid4())
        url = f"/api/v1/reviews/product/{empty_product_id}"
        response = self.client.get(url)
        data = response.json()
        self.assertEqual(data["data"]["average_rating"], 0.0)
        self.assertEqual(data["data"]["total_reviews"], 0)

    def test_average_rating_single_review(self):
        """Single review should have that rating as average."""
        Review.objects.create(
            user_id=str(uuid.uuid4()),
            product_id=self.product_id,
            rating=3,
            comment="Only review",
        )

        url = f"/api/v1/reviews/product/{self.product_id}"
        response = self.client.get(url)
        data = response.json()
        self.assertEqual(data["data"]["average_rating"], 3.0)
        self.assertEqual(data["data"]["total_reviews"], 1)


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    },
)
class ReviewModelConstraintTests(TestCase):
    """Tests for Review model constraints."""

    def test_unique_user_product_review(self):
        """Same user cannot review the same product twice."""
        user_id = str(uuid.uuid4())
        product_id = str(uuid.uuid4())

        Review.objects.create(
            user_id=user_id,
            product_id=product_id,
            rating=4,
            comment="First review",
        )
        with self.assertRaises(IntegrityError):
            Review.objects.create(
                user_id=user_id,
                product_id=product_id,
                rating=5,
                comment="Second review",
            )

    def test_same_user_different_products(self):
        """Same user can review different products."""
        user_id = str(uuid.uuid4())

        Review.objects.create(
            user_id=user_id,
            product_id=str(uuid.uuid4()),
            rating=4,
            comment="Review 1",
        )
        Review.objects.create(
            user_id=user_id,
            product_id=str(uuid.uuid4()),
            rating=5,
            comment="Review 2",
        )
        self.assertEqual(Review.objects.filter(user_id=user_id).count(), 2)
