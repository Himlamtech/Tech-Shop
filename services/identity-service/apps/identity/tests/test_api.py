"""
Unit tests for Identity Service API endpoints.

Tests: registration (success, duplicate email, invalid email, short/long password),
login (success, wrong password, locked account), refresh token (success, expired, revoked),
JWT validation, RBAC.
"""

import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from django.contrib.auth.hashers import make_password
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.core.exceptions import ServiceUnavailableError
from apps.identity.models import RefreshToken, User


def _extract_access_token(response):
    return response.json()["data"]["access_token"]


def _extract_refresh_token(response):
    return response.json()["data"]["refresh_token"]


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    },
    JWT_ACCESS_TOKEN_LIFETIME_MINUTES=15,
    JWT_REFRESH_TOKEN_LIFETIME_DAYS=7,
    JWT_ISSUER="techshop.identity",
    JWT_ALGORITHM="HS256",
)
class RegisterAPITests(TestCase):
    """Tests for POST /api/v1/auth/register endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.url = "/api/v1/auth/register"

    def test_register_success(self):
        """Registration with valid data should return tokens and user info."""
        payload = {
            "email": "newuser@example.com",
            "password": "securepass123",
        }
        response = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertIn("access_token", data["data"])
        self.assertIn("refresh_token", data["data"])
        self.assertEqual(data["data"]["user"]["email"], "newuser@example.com")
        self.assertEqual(data["data"]["user"]["role"], "customer")

    def test_register_duplicate_email(self):
        """Registration with existing email should return error."""
        User.objects.create(
            email="existing@example.com",
            password_hash=make_password("password123"),
            role="customer",
        )
        payload = {
            "email": "existing@example.com",
            "password": "anotherpass123",
        }
        response = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response.status_code, 422)

    def test_register_invalid_email(self):
        """Registration with invalid email format should return 422."""
        payload = {
            "email": "not-an-email",
            "password": "securepass123",
        }
        response = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response.status_code, 422)

    def test_register_short_password(self):
        """Registration with password < 8 chars should return 422."""
        payload = {
            "email": "short@example.com",
            "password": "short",
        }
        response = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response.status_code, 422)

    def test_register_long_password(self):
        """Registration with password > 128 chars should return 422."""
        payload = {
            "email": "long@example.com",
            "password": "x" * 129,
        }
        response = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response.status_code, 422)

    def test_register_email_normalized_to_lowercase(self):
        """Email should be normalized to lowercase."""
        payload = {
            "email": "User@Example.COM",
            "password": "securepass123",
        }
        response = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["data"]["user"]["email"], "user@example.com")


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    },
    JWT_ACCESS_TOKEN_LIFETIME_MINUTES=15,
    JWT_REFRESH_TOKEN_LIFETIME_DAYS=7,
    JWT_ISSUER="techshop.identity",
    JWT_ALGORITHM="HS256",
)
class LoginAPITests(TestCase):
    """Tests for POST /api/v1/auth/login endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.url = "/api/v1/auth/login"
        self.user = User.objects.create(
            email="testuser@example.com",
            password_hash=make_password("correctpassword"),
            role="customer",
        )

    def test_login_success(self):
        """Login with correct credentials should return tokens."""
        payload = {
            "email": "testuser@example.com",
            "password": "correctpassword",
        }
        response = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertIn("access_token", data["data"])
        self.assertIn("refresh_token", data["data"])
        self.assertEqual(data["data"]["user"]["email"], "testuser@example.com")

    def test_login_wrong_password(self):
        """Login with wrong password should return 401."""
        payload = {
            "email": "testuser@example.com",
            "password": "wrongpassword",
        }
        response = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response.status_code, 401)

    def test_login_nonexistent_email(self):
        """Login with non-existent email should return 401."""
        payload = {
            "email": "nobody@example.com",
            "password": "somepassword",
        }
        response = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response.status_code, 401)

    def test_login_locked_account(self):
        """Login to a locked account should return 423."""
        self.user.failed_login_attempts = 5
        self.user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
        self.user.save()

        payload = {
            "email": "testuser@example.com",
            "password": "correctpassword",
        }
        response = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response.status_code, 423)

    def test_login_increments_failed_attempts(self):
        """Failed login should increment failed_login_attempts."""
        payload = {
            "email": "testuser@example.com",
            "password": "wrongpassword",
        }
        self.client.post(self.url, data=payload, format="json")
        self.user.refresh_from_db()
        self.assertEqual(self.user.failed_login_attempts, 1)

    def test_login_locks_after_max_attempts(self):
        """Account should lock after 5 failed attempts."""
        self.user.failed_login_attempts = 4
        self.user.save()

        payload = {
            "email": "testuser@example.com",
            "password": "wrongpassword",
        }
        self.client.post(self.url, data=payload, format="json")
        self.user.refresh_from_db()
        self.assertEqual(self.user.failed_login_attempts, 5)
        self.assertIsNotNone(self.user.locked_until)

    def test_login_resets_failed_attempts_on_success(self):
        """Successful login should reset failed_login_attempts."""
        self.user.failed_login_attempts = 3
        self.user.save()

        payload = {
            "email": "testuser@example.com",
            "password": "correctpassword",
        }
        self.client.post(self.url, data=payload, format="json")
        self.user.refresh_from_db()
        self.assertEqual(self.user.failed_login_attempts, 0)


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    },
    JWT_ACCESS_TOKEN_LIFETIME_MINUTES=15,
    JWT_REFRESH_TOKEN_LIFETIME_DAYS=7,
    JWT_ISSUER="techshop.identity",
    JWT_ALGORITHM="HS256",
)
class RefreshTokenAPITests(TestCase):
    """Tests for POST /api/v1/auth/refresh endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.url = "/api/v1/auth/refresh"
        self.user = User.objects.create(
            email="refreshuser@example.com",
            password_hash=make_password("password123"),
            role="customer",
        )

    def _create_refresh_token(self, raw_token, expired=False, revoked=False):
        """Helper to create a refresh token in the DB."""
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        if expired:
            expires_at = datetime.now(timezone.utc) - timedelta(days=1)

        return RefreshToken.objects.create(
            user=self.user,
            token_hash=token_hash,
            expires_at=expires_at,
            is_revoked=revoked,
        )

    def test_refresh_success(self):
        """Valid refresh token should return new token pair."""
        raw_token = "valid-refresh-token-string"
        self._create_refresh_token(raw_token)

        payload = {"refresh_token": raw_token}
        response = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response.status_code, 200)


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    },
    JWT_ACCESS_TOKEN_LIFETIME_MINUTES=15,
    JWT_REFRESH_TOKEN_LIFETIME_DAYS=7,
    JWT_ISSUER="techshop.identity",
    JWT_ALGORITHM="HS256",
)
class SessionAPITests(TestCase):
    """Tests for current-session and logout endpoints."""

    def setUp(self):
        self.client = APIClient()
        self.url = "/api/v1/auth/refresh"
        self.user = User.objects.create(
            email="admin@example.com",
            password_hash=make_password("password123"),
            role="admin",
        )

    def _create_refresh_token(self, raw_token, expired=False, revoked=False):
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        if expired:
            expires_at = datetime.now(timezone.utc) - timedelta(days=1)

        return RefreshToken.objects.create(
            user=self.user,
            token_hash=token_hash,
            expires_at=expires_at,
            is_revoked=revoked,
        )

    def _login(self):
        response = self.client.post(
            "/api/v1/auth/login",
            data={"email": "admin@example.com", "password": "password123"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        return response

    def test_me_returns_current_user(self):
        login_response = self._login()
        access_token = _extract_access_token(login_response)

        response = self.client.get(
            "/api/v1/auth/me",
            HTTP_AUTHORIZATION=f"Bearer {access_token}",
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(data["email"], "admin@example.com")
        self.assertEqual(data["role"], "admin")
        self.assertTrue(data["is_active"])

    def test_me_requires_authentication(self):
        response = self.client.get("/api/v1/auth/me")
        self.assertEqual(response.status_code, 401)

    def test_logout_revokes_refresh_token(self):
        login_response = self._login()
        refresh_token = _extract_refresh_token(login_response)

        logout_response = self.client.post(
            "/api/v1/auth/logout",
            data={"refresh_token": refresh_token},
            format="json",
        )
        self.assertEqual(logout_response.status_code, 200)

        refresh_response = self.client.post(
            "/api/v1/auth/refresh",
            data={"refresh_token": refresh_token},
            format="json",
        )
        self.assertEqual(refresh_response.status_code, 401)

    def test_logout_rejects_unknown_refresh_token(self):
        response = self.client.post(
            "/api/v1/auth/logout",
            data={"refresh_token": "unknown-token"},
            format="json",
        )
        self.assertEqual(response.status_code, 401)
        data = response.json()
        self.assertFalse(data["success"])
        self.assertEqual(data["error"]["code"], "UNAUTHORIZED")

    def test_refresh_expired_token(self):
        """Expired refresh token should return 401."""
        raw_token = "expired-refresh-token"
        self._create_refresh_token(raw_token, expired=True)

        payload = {"refresh_token": raw_token}
        response = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response.status_code, 401)

    def test_refresh_revoked_token(self):
        """Revoked refresh token should return 401."""
        raw_token = "revoked-refresh-token"
        self._create_refresh_token(raw_token, revoked=True)

        payload = {"refresh_token": raw_token}
        response = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response.status_code, 401)

    def test_refresh_invalid_token(self):
        """Non-existent refresh token should return 401."""
        payload = {"refresh_token": "nonexistent-token"}
        response = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response.status_code, 401)

    def test_refresh_rotates_token(self):
        """After refresh, old token should be revoked."""
        raw_token = "rotate-me-token"
        token_obj = self._create_refresh_token(raw_token)

        payload = {"refresh_token": raw_token}
        self.client.post(self.url, data=payload, format="json")

        token_obj.refresh_from_db()
        self.assertTrue(token_obj.is_revoked)


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    },
    JWT_ACCESS_TOKEN_LIFETIME_MINUTES=15,
    JWT_REFRESH_TOKEN_LIFETIME_DAYS=7,
    JWT_ISSUER="techshop.identity",
    JWT_ALGORITHM="HS256",
)
class RBACTests(TestCase):
    """Tests for role-based access control."""

    def setUp(self):
        self.client = APIClient()

    def test_register_creates_customer_role(self):
        """Newly registered user should have customer role."""
        payload = {
            "email": "rbac@example.com",
            "password": "securepass123",
        }
        response = self.client.post(
            "/api/v1/auth/register", data=payload, format="json"
        )
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email="rbac@example.com")
        self.assertEqual(user.role, "customer")

    def test_admin_users_endpoint_requires_admin(self):
        """GET /api/v1/admin/users without admin role should fail."""
        response = self.client.get("/api/v1/admin/users")
        self.assertIn(response.status_code, [401, 403])

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    def test_admin_users_endpoint_as_admin(self, mock_jwt):
        """GET /api/v1/admin/users as admin should return user list."""

        def set_admin(request):
            request.user_id = str(uuid.uuid4())
            request.user_role = "admin"

        mock_jwt.side_effect = set_admin

        User.objects.create(
            email="admin@example.com",
            password_hash=make_password("adminpass"),
            role="admin",
        )

        response = self.client.get("/api/v1/admin/users")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    def test_admin_can_update_user_role_and_activation(self, mock_jwt):
        def set_admin(request):
            request.user_id = str(uuid.uuid4())
            request.user_role = "admin"

        mock_jwt.side_effect = set_admin

        user = User.objects.create(
            email="customer@example.com",
            password_hash=make_password("customerpass"),
            role="customer",
            is_active=True,
        )

        response = self.client.patch(
            f"/api/v1/admin/users/{user.id}",
            data={"role": "staff", "is_active": False},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        user.refresh_from_db()
        self.assertEqual(user.role, "staff")
        self.assertFalse(user.is_active)

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    def test_admin_can_clear_user_lockout(self, mock_jwt):
        def set_admin(request):
            request.user_id = str(uuid.uuid4())
            request.user_role = "admin"

        mock_jwt.side_effect = set_admin

        user = User.objects.create(
            email="locked@example.com",
            password_hash=make_password("lockedpass"),
            role="customer",
            failed_login_attempts=5,
            locked_until=datetime.now(timezone.utc) + timedelta(minutes=10),
        )

        response = self.client.patch(
            f"/api/v1/admin/users/{user.id}",
            data={"clear_lockout": True},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        user.refresh_from_db()
        self.assertEqual(user.failed_login_attempts, 0)
        self.assertIsNone(user.locked_until)

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    def test_admin_cannot_remove_own_admin_role(self, mock_jwt):
        admin_id = str(uuid.uuid4())

        def set_admin(request):
            request.user_id = admin_id
            request.user_role = "admin"

        mock_jwt.side_effect = set_admin

        user = User.objects.create(
            id=admin_id,
            email="self-admin@example.com",
            password_hash=make_password("adminpass"),
            role="admin",
            is_active=True,
        )

        response = self.client.patch(
            f"/api/v1/admin/users/{user.id}",
            data={"role": "staff"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    def test_admin_cannot_deactivate_self(self, mock_jwt):
        admin_id = str(uuid.uuid4())

        def set_admin(request):
            request.user_id = admin_id
            request.user_role = "admin"

        mock_jwt.side_effect = set_admin

        user = User.objects.create(
            id=admin_id,
            email="self-disable@example.com",
            password_hash=make_password("adminpass"),
            role="admin",
            is_active=True,
        )

        response = self.client.patch(
            f"/api/v1/admin/users/{user.id}",
            data={"is_active": False},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    @patch("apps.identity.views.ServiceClient.get")
    def test_admin_dashboard_aggregates_service_stats(self, mock_get, mock_jwt):
        def set_admin(request):
            request.user_id = str(uuid.uuid4())
            request.user_role = "admin"

        mock_jwt.side_effect = set_admin
        User.objects.create(
            email="admin@example.com",
            password_hash=make_password("adminpass"),
            role="admin",
            is_active=True,
        )

        mock_get.side_effect = [
            {"data": {"total_products": 10, "active_products": 9, "total_categories": 3, "products_by_category": []}},
            {"data": {"total_orders": 12, "orders_by_status": {"completed": 7}, "total_revenue": "199.50"}},
            {"data": {"total_transactions": 8, "total_amount": "220.00", "successful_amount": "180.00", "transactions_by_status": {"success": 6}}},
            {"data": {"total_reviews": 5, "average_rating": 4.2, "reviews_by_sentiment": {"positive": 4}}},
        ]

        response = self.client.get("/api/v1/admin/dashboard")
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(data["identity"]["total_users"], 1)
        self.assertEqual(data["catalog"]["total_products"], 10)
        self.assertEqual(data["orders"]["total_orders"], 12)
        self.assertEqual(data["payments"]["total_transactions"], 8)
        self.assertEqual(data["reviews"]["total_reviews"], 5)

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    @patch("apps.identity.views.ServiceClient.get")
    def test_admin_dashboard_degrades_when_service_unavailable(self, mock_get, mock_jwt):
        def set_admin(request):
            request.user_id = str(uuid.uuid4())
            request.user_role = "admin"

        mock_jwt.side_effect = set_admin
        User.objects.create(
            email="admin@example.com",
            password_hash=make_password("adminpass"),
            role="admin",
            is_active=True,
        )

        mock_get.side_effect = [
            ServiceUnavailableError("catalog down"),
            {"data": {"total_orders": 12}},
            {"data": {"total_transactions": 8}},
            {"data": {"total_reviews": 5}},
        ]

        response = self.client.get("/api/v1/admin/dashboard")
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(data["catalog"]["status"], "unavailable")
        self.assertEqual(data["orders"]["total_orders"], 12)
