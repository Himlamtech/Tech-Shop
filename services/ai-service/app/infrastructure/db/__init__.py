"""
AI Service database infrastructure.

Exports database models, session management, and migration utilities.
"""

from app.infrastructure.db.database import Base, async_session_factory, get_db, init_db
from app.infrastructure.db.models import (
    ChatLog,
    ClassificationStatus,
    CustomerSegment,
    EmbeddingDocument,
    EventType,
    HallucinationRisk,
    ProductClassification,
    RecommendationLog,
    SegmentationRun,
    SourceType,
    UserInteraction,
)

__all__ = [
    # Base and session
    "Base",
    "async_session_factory",
    "get_db",
    "init_db",
    # Models
    "EmbeddingDocument",
    "ChatLog",
    "UserInteraction",
    "RecommendationLog",
    "CustomerSegment",
    "SegmentationRun",
    "ProductClassification",
    # Enums
    "SourceType",
    "HallucinationRisk",
    "EventType",
    "ClassificationStatus",
]
