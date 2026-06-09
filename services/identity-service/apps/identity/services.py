"""
Authentication service layer for the Identity Service.

Contains business logic for local authentication, Firebase auth exchange,
account lockout, and JWT token generation.
"""

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone

import firebase_admin
import jwt
from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials

from apps.core.exceptions import UnauthorizedError, ValidationError
from apps.identity.models import FirebaseIdentity, RefreshToken, User

logger = logging.getLogger(__name__)


class AccountLockedError(Exception):
    """Raised when an account is temporarily locked due to failed login attempts."""

    error_code = "ACCOUNT_LOCKED"
    http_status = 423
    message = "Account is temporarily locked due to too many failed login attempts"

    def __init__(self, message=None):
        self.message = message or self.__class__.message
        super().__init__(self.message)


class FirebaseAuthenticationError(Exception):
    """Raised when the Firebase ID token cannot be verified or used."""


class AuthService:
    """Handles authentication business logic."""

    MAX_FAILED_ATTEMPTS = 5
    LOCKOUT_DURATION_MINUTES = 15
    FAILED_ATTEMPT_WINDOW_MINUTES = 15
    SUPPORTED_FIREBASE_PROVIDERS = {
        FirebaseIdentity.Provider.GOOGLE,
        FirebaseIdentity.Provider.PHONE,
    }

    @classmethod
    def register(cls, email, password):
        if User.objects.filter(email=email).exists():
            raise ValidationError(
                message="A user with this email already exists.",
                details=[{"field": "email", "reason": "Email already registered."}],
            )

        user = User.objects.create(
            email=email,
            password_hash=make_password(password),
            role=User.Role.CUSTOMER,
        )

        return cls._build_auth_response(user)

    @classmethod
    def login(cls, email, password):
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise UnauthorizedError(message="Invalid email or password.")

        cls._check_lockout(user)

        if not check_password(password, user.password_hash):
            cls._record_failed_attempt(user)
            raise UnauthorizedError(message="Invalid email or password.")

        if not user.is_active:
            raise UnauthorizedError(message="This account is inactive.")

        cls._reset_failed_attempts(user)
        return cls._build_auth_response(user)

    @classmethod
    def login_with_firebase(cls, id_token):
        decoded_token = cls._verify_firebase_id_token(id_token)

        provider = decoded_token.get("firebase", {}).get("sign_in_provider")
        subject = decoded_token.get("uid")
        email = (decoded_token.get("email") or "").strip().lower() or None
        phone_number = decoded_token.get("phone_number") or None
        email_verified = bool(decoded_token.get("email_verified"))

        if provider not in cls.SUPPORTED_FIREBASE_PROVIDERS or not subject:
            raise ValidationError(message="Unsupported Firebase sign-in provider.")

        if provider == FirebaseIdentity.Provider.GOOGLE and (not email or not email_verified):
            raise ValidationError(message="Google account must provide a verified email address.")

        if provider == FirebaseIdentity.Provider.PHONE and not phone_number:
            raise ValidationError(message="Phone sign-in did not include a verified phone number.")

        identity = FirebaseIdentity.objects.select_related("user").filter(
            provider=provider,
            subject=subject,
        ).first()

        user = identity.user if identity else cls._resolve_firebase_user(provider, subject, email, phone_number)

        if not user.is_active:
            raise UnauthorizedError(message="This account is inactive.")

        cls._reset_failed_attempts(user)

        FirebaseIdentity.objects.update_or_create(
            provider=provider,
            subject=subject,
            defaults={
                "user": user,
                "email": email,
                "phone_number": phone_number,
            },
        )

        return cls._build_auth_response(user)

    @classmethod
    def refresh(cls, refresh_token_value):
        token_hash = cls._hash_token(refresh_token_value)

        try:
            refresh_token = RefreshToken.objects.select_related("user").get(
                token_hash=token_hash
            )
        except RefreshToken.DoesNotExist:
            raise UnauthorizedError(message="Invalid refresh token.")

        if refresh_token.is_revoked:
            raise UnauthorizedError(message="Refresh token has been revoked.")

        now = datetime.now(timezone.utc)
        if refresh_token.expires_at < now:
            raise UnauthorizedError(message="Refresh token has expired.")

        refresh_token.is_revoked = True
        refresh_token.save(update_fields=["is_revoked"])

        return cls._build_auth_response(refresh_token.user)

    @classmethod
    def logout(cls, refresh_token_value):
        token_hash = cls._hash_token(refresh_token_value)

        try:
            refresh_token = RefreshToken.objects.get(token_hash=token_hash)
        except RefreshToken.DoesNotExist:
            raise UnauthorizedError(message="Invalid refresh token.")

        if not refresh_token.is_revoked:
            refresh_token.is_revoked = True
            refresh_token.save(update_fields=["is_revoked"])

        return None

    @classmethod
    def _build_auth_response(cls, user):
        tokens = cls._generate_tokens(user)
        return {
            "access_token": tokens["access_token"],
            "refresh_token": tokens["refresh_token"],
            "user": {
                "id": user.id,
                "email": user.email,
                "role": user.role,
            },
        }

    @classmethod
    def _resolve_firebase_user(cls, provider, subject, email, phone_number):
        if provider == FirebaseIdentity.Provider.GOOGLE and email:
            existing_user = User.objects.filter(email=email).first()
            if existing_user:
                return existing_user

        if provider == FirebaseIdentity.Provider.PHONE and phone_number:
            placeholder_email = cls._build_phone_placeholder_email(phone_number, subject)
            existing_user = User.objects.filter(email=placeholder_email).first()
            if existing_user:
                return existing_user

            return User.objects.create(
                email=placeholder_email,
                password_hash=make_password(None),
                role=User.Role.CUSTOMER,
            )

        if email:
            return User.objects.create(
                email=email,
                password_hash=make_password(None),
                role=User.Role.CUSTOMER,
            )

        raise ValidationError(message="Firebase sign-in did not include a usable identity.")

    @classmethod
    def _build_phone_placeholder_email(cls, phone_number, subject):
        digits_only = "".join(char for char in phone_number if char.isdigit()) or subject
        return f"phone-{digits_only}@phone.techshop.local"

    @classmethod
    def _verify_firebase_id_token(cls, id_token):
        project_id = getattr(settings, "FIREBASE_PROJECT_ID", "")
        client_email = getattr(settings, "FIREBASE_CLIENT_EMAIL", "")
        private_key = getattr(settings, "FIREBASE_PRIVATE_KEY", "")

        if not project_id or not client_email or not private_key:
            raise FirebaseAuthenticationError(
                "Firebase Admin credentials are not configured on the identity service."
            )

        try:
            cls._get_firebase_app(project_id, client_email, private_key)
            return firebase_auth.verify_id_token(id_token, check_revoked=False, clock_skew_seconds=60)
        except Exception as exc:
            logger.warning("Firebase token verification failed", exc_info=exc)
            raise FirebaseAuthenticationError("Firebase token is invalid or expired.") from exc

    @classmethod
    def _get_firebase_app(cls, project_id, client_email, private_key):
        app_name = "techshop-identity"
        try:
            return firebase_admin.get_app(app_name)
        except ValueError:
            credential = credentials.Certificate(
                {
                    "type": "service_account",
                    "project_id": project_id,
                    "client_email": client_email,
                    "private_key": private_key,
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
            )
            return firebase_admin.initialize_app(
                credential,
                {"projectId": project_id},
                name=app_name,
            )

    @classmethod
    def _generate_tokens(cls, user):
        now = datetime.now(timezone.utc)
        access_payload = {
            "user_id": str(user.id),
            "role": user.role,
            "iss": settings.JWT_ISSUER,
            "exp": now + timedelta(minutes=settings.JWT_ACCESS_TOKEN_LIFETIME_MINUTES),
            "iat": now,
        }

        private_key = cls._get_private_key()
        if private_key:
            algorithm = settings.JWT_ALGORITHM
            signing_key = private_key
        else:
            algorithm = "HS256"
            signing_key = settings.SECRET_KEY

        access_token = jwt.encode(access_payload, signing_key, algorithm=algorithm)

        raw_refresh_token = secrets.token_urlsafe(64)
        token_hash = cls._hash_token(raw_refresh_token)

        RefreshToken.objects.create(
            user=user,
            token_hash=token_hash,
            expires_at=now + timedelta(days=settings.JWT_REFRESH_TOKEN_LIFETIME_DAYS),
        )

        return {
            "access_token": access_token,
            "refresh_token": raw_refresh_token,
        }

    @classmethod
    def _check_lockout(cls, user):
        if user.locked_until and user.locked_until > datetime.now(timezone.utc):
            raise AccountLockedError()

    @classmethod
    def _record_failed_attempt(cls, user):
        now = datetime.now(timezone.utc)

        if user.locked_until and user.locked_until <= now:
            user.failed_login_attempts = 0
            user.locked_until = None

        user.failed_login_attempts += 1

        if user.failed_login_attempts >= cls.MAX_FAILED_ATTEMPTS:
            user.locked_until = now + timedelta(minutes=cls.LOCKOUT_DURATION_MINUTES)
            logger.warning(
                "Account locked due to failed attempts",
                extra={"user_id": str(user.id), "email": user.email},
            )

        user.save(update_fields=["failed_login_attempts", "locked_until"])

    @classmethod
    def _reset_failed_attempts(cls, user):
        if user.failed_login_attempts > 0 or user.locked_until:
            user.failed_login_attempts = 0
            user.locked_until = None
            user.save(update_fields=["failed_login_attempts", "locked_until"])

    @classmethod
    def _hash_token(cls, token):
        return hashlib.sha256(token.encode()).hexdigest()

    @classmethod
    def _get_private_key(cls):
        key_path = getattr(settings, "JWT_PRIVATE_KEY_PATH", None)
        if not key_path:
            return None
        try:
            with open(key_path, "r", encoding="utf-8") as file_handle:
                return file_handle.read()
        except (FileNotFoundError, IOError):
            logger.debug("JWT private key file not found: %s", key_path)
            return None
