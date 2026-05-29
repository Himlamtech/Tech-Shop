"""
Unit tests for JWTAuthenticationMiddleware.

Tests cover:
- Valid JWT extraction with HS256 (development fallback)
- Expired token handling
- Malformed token handling
- Invalid signature handling
- Missing Authorization header
- Public path skipping (healthz, readyz, admin)
- Public read paths (GET /api/v1/products, GET /api/v1/categories)
- Protected paths require JWT for user_id/role extraction
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import jwt
from django.test import RequestFactory, TestCase, override_settings

from apps.core.middleware import JWTAuthenticationMiddleware


TEST_SECRET_KEY = "test-secret-key-for-jwt"
TEST_ISSUER = "techshop.identity"


def _make_token(payload, key=TEST_SECRET_KEY, algorithm="HS256"):
    """Helper to create a JWT token for testing."""
    return jwt.encode(payload, key, algorithm=algorithm)


def _get_response(request):
    """Dummy get_response callable for middleware."""
    response = MagicMock()
    response.status_code = 200
    return response


@override_settings(
    SECRET_KEY=TEST_SECRET_KEY,
    JWT_PUBLIC_KEY_PATH="/nonexistent/path/jwt_public.pem",
    JWT_ISSUER=TEST_ISSUER,
    JWT_ALGORITHM="RS256",
)
class TestJWTAuthenticationMiddleware(TestCase):
    """Test JWT middleware with HS256 fallback (no public key file)."""

    def setUp(self):
        self.factory = RequestFactory()
        self.middleware = JWTAuthenticationMiddleware(_get_response)

    def _valid_payload(self, **overrides):
        """Create a valid JWT payload."""
        payload = {
            "user_id": "user-123",
            "role": "customer",
            "iss": TEST_ISSUER,
            "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
            "iat": datetime.now(timezone.utc),
        }
        payload.update(overrides)
        return payload

    def test_valid_token_extracts_user_id_and_role(self):
        """Valid JWT sets request.user_id and request.user_role."""
        token = _make_token(self._valid_payload())
        request = self.factory.get(
            "/api/v1/cart/current",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.middleware(request)
        self.assertEqual(request.user_id, "user-123")
        self.assertEqual(request.user_role, "customer")

    def test_admin_role_extracted(self):
        """Admin role is correctly extracted from token."""
        token = _make_token(self._valid_payload(
            user_id="admin-1", role="admin"
        ))
        request = self.factory.get(
            "/api/v1/orders",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.middleware(request)
        self.assertEqual(request.user_id, "admin-1")
        self.assertEqual(request.user_role, "admin")

    def test_expired_token_sets_none(self):
        """Expired JWT results in user_id=None, user_role=None."""
        token = _make_token(self._valid_payload(
            exp=datetime.now(timezone.utc) - timedelta(minutes=1)
        ))
        request = self.factory.get(
            "/api/v1/cart/current",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.middleware(request)
        self.assertIsNone(request.user_id)
        self.assertIsNone(request.user_role)

    def test_malformed_token_sets_none(self):
        """Malformed JWT results in user_id=None, user_role=None."""
        request = self.factory.get(
            "/api/v1/cart/current",
            HTTP_AUTHORIZATION="Bearer not.a.valid.jwt.token",
        )
        self.middleware(request)
        self.assertIsNone(request.user_id)
        self.assertIsNone(request.user_role)

    def test_invalid_signature_sets_none(self):
        """Token signed with wrong key results in user_id=None."""
        token = _make_token(
            self._valid_payload(), key="wrong-secret-key"
        )
        request = self.factory.get(
            "/api/v1/cart/current",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.middleware(request)
        self.assertIsNone(request.user_id)
        self.assertIsNone(request.user_role)

    def test_missing_auth_header_sets_none(self):
        """No Authorization header results in user_id=None."""
        request = self.factory.get("/api/v1/cart/current")
        self.middleware(request)
        self.assertIsNone(request.user_id)
        self.assertIsNone(request.user_role)

    def test_non_bearer_auth_header_sets_none(self):
        """Non-Bearer Authorization header is ignored."""
        request = self.factory.get(
            "/api/v1/cart/current",
            HTTP_AUTHORIZATION="Basic dXNlcjpwYXNz",
        )
        self.middleware(request)
        self.assertIsNone(request.user_id)
        self.assertIsNone(request.user_role)

    def test_healthz_skips_jwt_entirely(self):
        """Healthcheck path skips JWT extraction entirely."""
        request = self.factory.get("/healthz")
        self.middleware(request)
        self.assertIsNone(request.user_id)
        self.assertIsNone(request.user_role)

    def test_readyz_skips_jwt_entirely(self):
        """Readiness path skips JWT extraction entirely."""
        request = self.factory.get("/readyz")
        self.middleware(request)
        self.assertIsNone(request.user_id)
        self.assertIsNone(request.user_role)

    def test_admin_path_skips_jwt_entirely(self):
        """Django admin path skips JWT extraction entirely."""
        request = self.factory.get("/admin/")
        self.middleware(request)
        self.assertIsNone(request.user_id)
        self.assertIsNone(request.user_role)

    def test_get_products_allows_unauthenticated(self):
        """GET /api/v1/products allows unauthenticated access."""
        request = self.factory.get("/api/v1/products")
        self.middleware(request)
        # No token, no error - user_id stays None
        self.assertIsNone(request.user_id)
        self.assertIsNone(request.user_role)

    def test_get_products_detail_allows_unauthenticated(self):
        """GET /api/v1/products/<id> allows unauthenticated access."""
        request = self.factory.get("/api/v1/products/some-uuid")
        self.middleware(request)
        self.assertIsNone(request.user_id)
        self.assertIsNone(request.user_role)

    def test_get_categories_allows_unauthenticated(self):
        """GET /api/v1/categories allows unauthenticated access."""
        request = self.factory.get("/api/v1/categories")
        self.middleware(request)
        self.assertIsNone(request.user_id)
        self.assertIsNone(request.user_role)

    def test_get_products_with_token_extracts_user(self):
        """GET /api/v1/products with valid token still extracts user info."""
        token = _make_token(self._valid_payload())
        request = self.factory.get(
            "/api/v1/products",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.middleware(request)
        self.assertEqual(request.user_id, "user-123")
        self.assertEqual(request.user_role, "customer")

    def test_wrong_issuer_sets_none(self):
        """Token with wrong issuer is rejected."""
        token = _make_token(self._valid_payload(iss="wrong-issuer"))
        request = self.factory.get(
            "/api/v1/cart/current",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.middleware(request)
        self.assertIsNone(request.user_id)
        self.assertIsNone(request.user_role)
