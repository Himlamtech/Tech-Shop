"""
Serializers for Identity Service authentication endpoints.

Handles input validation for registration, login, and token refresh.
"""

import re

from rest_framework import serializers


class RegisterSerializer(serializers.Serializer):
    """Validates registration input: email and password."""

    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(min_length=8, max_length=128, write_only=True)

    def validate_email(self, value):
        """Normalize email to lowercase."""
        return value.lower().strip()

    def validate_password(self, value):
        """Ensure password meets length requirements."""
        if len(value) < 8:
            raise serializers.ValidationError(
                "Password must be between 8 and 128 characters."
            )
        if len(value) > 128:
            raise serializers.ValidationError(
                "Password must be between 8 and 128 characters."
            )
        return value


class LoginSerializer(serializers.Serializer):
    """Validates login input: email and password."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate_email(self, value):
        """Normalize email to lowercase."""
        return value.lower().strip()


class RefreshSerializer(serializers.Serializer):
    """Validates refresh token input."""

    refresh_token = serializers.CharField()


class LogoutSerializer(serializers.Serializer):
    """Validates logout input."""

    refresh_token = serializers.CharField()


class FirebaseAuthSerializer(serializers.Serializer):
    """Validates Firebase authentication exchange input."""

    id_token = serializers.CharField(write_only=True)


class UserResponseSerializer(serializers.Serializer):
    """Serializes user data for token responses."""

    id = serializers.UUIDField()
    email = serializers.EmailField()
    role = serializers.CharField()


class TokenResponseSerializer(serializers.Serializer):
    """Serializes token response data."""

    access_token = serializers.CharField()
    refresh_token = serializers.CharField()
    user = UserResponseSerializer()


class AdminUserListItemSerializer(serializers.Serializer):
    """Serializes a user item for admin list/detail endpoints."""

    id = serializers.UUIDField()
    email = serializers.EmailField()
    role = serializers.CharField()
    is_active = serializers.BooleanField()
    failed_login_attempts = serializers.IntegerField()
    locked_until = serializers.DateTimeField(allow_null=True)
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class AdminUserUpdateSerializer(serializers.Serializer):
    """Validates admin updates to user role and activation status."""

    role = serializers.ChoiceField(
        choices=["admin", "staff", "customer"],
        required=False,
    )
    is_active = serializers.BooleanField(required=False)
    clear_lockout = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError(
                "At least one of role, is_active, or clear_lockout is required."
            )
        return attrs
