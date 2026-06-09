import uuid

from django.db import models


class User(models.Model):
    """Custom user model for the Identity Service.

    Does NOT extend Django's built-in User model. Uses UUID primary key
    and Django's make_password/check_password for password hashing.
    """

    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        STAFF = "staff", "Staff"
        CUSTOMER = "customer", "Customer"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(max_length=254, unique=True)
    password_hash = models.CharField(max_length=255)
    role = models.CharField(
        max_length=10,
        choices=Role.choices,
        default=Role.CUSTOMER,
    )
    is_active = models.BooleanField(default=True)
    failed_login_attempts = models.IntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "users"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.email} ({self.role})"


class FirebaseIdentity(models.Model):
    """Maps a Firebase provider subject to a local TechShop user."""

    class Provider(models.TextChoices):
        GOOGLE = "google.com", "Google"
        PHONE = "phone", "Phone"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="firebase_identities",
    )
    provider = models.CharField(max_length=32, choices=Provider.choices)
    subject = models.CharField(max_length=255)
    email = models.EmailField(max_length=254, null=True, blank=True)
    phone_number = models.CharField(max_length=32, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "firebase_identities"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["provider", "subject"],
                name="identity_provider_subject_unique",
            )
        ]

    def __str__(self):
        return f"FirebaseIdentity(provider={self.provider}, subject={self.subject})"


class RefreshToken(models.Model):
    """Stores hashed refresh tokens for token rotation and revocation."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="refresh_tokens",
    )
    token_hash = models.CharField(max_length=255, unique=True)
    expires_at = models.DateTimeField()
    is_revoked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "refresh_tokens"
        ordering = ["-created_at"]

    def __str__(self):
        return f"RefreshToken(user={self.user_id}, revoked={self.is_revoked})"
