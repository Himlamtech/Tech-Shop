"""
Authentication views for the Identity Service.

All endpoints are public (no authentication required).
Business logic is delegated to AuthService.
"""

import logging

from rest_framework.views import APIView

from apps.core.exceptions import NotFoundError, UnauthorizedError, ValidationError
from apps.core.pagination import StandardPagination
from apps.core.permissions import IsAdmin, IsAuthenticated
from apps.core.responses import error_response, success_response
from apps.identity.models import User
from apps.identity.serializers import (
    AdminUserUpdateSerializer,
    LoginSerializer,
    LogoutSerializer,
    RefreshSerializer,
    RegisterSerializer,
)
from apps.identity.services import AccountLockedError, AuthService

logger = logging.getLogger(__name__)


class RegisterView(APIView):
    """
    POST /api/v1/auth/register

    Create a new user account with the customer role.
    Returns access and refresh tokens on success.
    """

    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Invalid registration data.",
                details=_format_serializer_errors(serializer.errors),
                status=422,
            )

        result = AuthService.register(
            email=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
        )

        return success_response(data=result, status=201)


class LoginView(APIView):
    """
    POST /api/v1/auth/login

    Authenticate a user with email and password.
    Returns access and refresh tokens on success.
    """

    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Invalid login data.",
                details=_format_serializer_errors(serializer.errors),
                status=422,
            )

        try:
            result = AuthService.login(
                email=serializer.validated_data["email"],
                password=serializer.validated_data["password"],
            )
        except AccountLockedError as e:
            return error_response(
                code="ACCOUNT_LOCKED",
                message=e.message,
                status=423,
            )
        except UnauthorizedError as e:
            return error_response(
                code="UNAUTHORIZED",
                message=e.message,
                status=401,
            )

        return success_response(data=result)


class RefreshView(APIView):
    """
    POST /api/v1/auth/refresh

    Validate a refresh token and issue a new token pair.
    The old refresh token is invalidated (token rotation).
    """

    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = RefreshSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Invalid refresh token data.",
                details=_format_serializer_errors(serializer.errors),
                status=422,
            )

        try:
            result = AuthService.refresh(
                refresh_token_value=serializer.validated_data["refresh_token"],
            )
        except UnauthorizedError as e:
            return error_response(
                code="UNAUTHORIZED",
                message=e.message,
                status=401,
            )

        return success_response(data=result)


class LogoutView(APIView):
    """
    POST /api/v1/auth/logout

    Revoke a refresh token to terminate the current session.
    """

    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                code="VALIDATION_ERROR",
                message="Invalid logout data.",
                details=_format_serializer_errors(serializer.errors),
                status=422,
            )

        try:
            AuthService.logout(
                refresh_token_value=serializer.validated_data["refresh_token"],
            )
        except UnauthorizedError as e:
            return error_response(
                code="UNAUTHORIZED",
                message=e.message,
                status=401,
            )

        return success_response(data={"message": "Logged out successfully."})


class MeView(APIView):
    """
    GET /api/v1/auth/me

    Return the currently authenticated user's profile from the JWT context.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            user = User.objects.get(id=request.user_id, is_active=True)
        except User.DoesNotExist:
            return error_response(
                code="UNAUTHORIZED",
                message="Authentication credentials were not provided or are invalid",
                status=401,
            )

        return success_response(
            data={
                "id": str(user.id),
                "email": user.email,
                "role": user.role,
                "is_active": user.is_active,
            }
        )


def _format_serializer_errors(errors):
    """Convert DRF serializer errors to standard details format."""
    details = []
    for field, messages in errors.items():
        for message in messages:
            details.append({"field": field, "reason": str(message)})
    return details


# =============================================================================
# Admin Views
# =============================================================================


class AdminUsersView(APIView):
    """
    GET /api/v1/admin/users — Paginated list of all users for admin.

    Returns id, email, role, is_active, and created_at for each user.
    """

    permission_classes = [IsAdmin]

    def get(self, request):
        queryset = User.objects.all().order_by("-created_at")

        role = request.query_params.get("role")
        is_active = request.query_params.get("is_active")
        search = request.query_params.get("search")

        if role in {choice for choice, _ in User.Role.choices}:
            queryset = queryset.filter(role=role)

        if is_active in {"true", "false"}:
            queryset = queryset.filter(is_active=(is_active == "true"))

        if search:
            queryset = queryset.filter(email__icontains=search.strip())

        paginator = StandardPagination()
        page = paginator.paginate_queryset(queryset, request)

        users_data = [
            {
                "id": str(user.id),
                "email": user.email,
                "role": user.role,
                "is_active": user.is_active,
                "created_at": user.created_at.isoformat(),
            }
            for user in page
        ]

        return paginator.get_paginated_response(users_data)


class AdminUserDetailView(APIView):
    """Retrieve or update a single user as admin."""

    permission_classes = [IsAdmin]

    def get(self, request, user_id):
        user = _get_user_or_404(user_id)
        return success_response(data=_serialize_admin_user(user))

    def patch(self, request, user_id):
        user = _get_user_or_404(user_id)
        serializer = AdminUserUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            raise ValidationError(
                message="Invalid admin user update data",
                details=_format_serializer_errors(serializer.errors),
            )

        data = serializer.validated_data

        if "role" in data:
            user.role = data["role"]

        if "is_active" in data:
            user.is_active = data["is_active"]

        if data.get("clear_lockout"):
            user.failed_login_attempts = 0
            user.locked_until = None

        user.save()
        return success_response(data=_serialize_admin_user(user))


def _get_user_or_404(user_id):
    try:
        return User.objects.get(id=user_id)
    except User.DoesNotExist as exc:
        raise NotFoundError("User not found") from exc


def _serialize_admin_user(user):
    return {
        "id": str(user.id),
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "failed_login_attempts": user.failed_login_attempts,
        "locked_until": user.locked_until.isoformat() if user.locked_until else None,
        "created_at": user.created_at.isoformat(),
        "updated_at": user.updated_at.isoformat(),
    }
