"""
AI Service SQLAlchemy models with pgvector support.

Models:
- EmbeddingDocument: Stores document embeddings for RAG retrieval
- ChatLog: Logs chatbot conversations and metadata
- UserInteraction: Tracks user-product interaction events
- RecommendationLog: Logs recommendation results
- CustomerSegment: Stores customer segmentation assignments
- SegmentationRun: Stores segmentation run metadata
- ProductClassification: Stores product classification results
"""

import enum
import uuid
from datetime import datetime
from decimal import Decimal

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.config import get_settings
from app.infrastructure.db.database import Base

settings = get_settings()


# --- Enums ---


class SourceType(str, enum.Enum):
    """Source types for embedding documents."""

    product = "product"
    faq = "faq"
    policy = "policy"


class HallucinationRisk(str, enum.Enum):
    """Hallucination risk levels for chat responses."""

    low = "low"
    medium = "medium"
    high = "high"


class EventType(str, enum.Enum):
    """User interaction event types."""

    view = "view"
    add_to_cart = "add_to_cart"
    purchase = "purchase"


class ClassificationStatus(str, enum.Enum):
    """Product classification status."""

    auto_assigned = "auto_assigned"
    review_needed = "review_needed"


# --- Models ---


class EmbeddingDocument(Base):
    """
    Stores document embeddings for RAG vector search.

    Used by the RAG chatbot to retrieve relevant product info,
    FAQ content, and policy documents via cosine similarity.
    """

    __tablename__ = "embedding_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    source_type: Mapped[str] = mapped_column(
        Enum(SourceType, name="source_type_enum"), nullable=False
    )
    source_id: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding = mapped_column(Vector(settings.embedding_dimension), nullable=False)
    metadata_: Mapped[dict] = mapped_column("metadata", JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_embedding_documents_source_type", "source_type"),
        Index("ix_embedding_documents_source_id", "source_id"),
    )

    def __repr__(self) -> str:
        return f"<EmbeddingDocument(id={self.id}, source_type={self.source_type}, title={self.title!r})>"


class ChatLog(Base):
    """
    Logs chatbot conversations including grounding metadata.

    Tracks user messages, AI responses, referenced products,
    and hallucination risk assessment.
    """

    __tablename__ = "chat_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    session_id: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    response: Mapped[str] = mapped_column(Text, nullable=False)
    recommended_product_ids: Mapped[list] = mapped_column(JSON, nullable=True)
    grounded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    hallucination_risk: Mapped[str] = mapped_column(
        Enum(HallucinationRisk, name="hallucination_risk_enum"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_chat_logs_user_id", "user_id"),
        Index("ix_chat_logs_session_id", "session_id"),
    )

    def __repr__(self) -> str:
        return f"<ChatLog(id={self.id}, session_id={self.session_id!r})>"


class UserInteraction(Base):
    """
    Tracks user-product interaction events for recommendation scoring.

    Events include product views, add-to-cart actions, and purchases.
    Used by the sequence model and collaborative filtering.
    """

    __tablename__ = "user_interactions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    event_type: Mapped[str] = mapped_column(
        Enum(EventType, name="event_type_enum"), nullable=False
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_user_interactions_user_id", "user_id"),
        Index("ix_user_interactions_product_id", "product_id"),
        Index("ix_user_interactions_event_type", "event_type"),
        Index("ix_user_interactions_user_product", "user_id", "product_id"),
    )

    def __repr__(self) -> str:
        return f"<UserInteraction(id={self.id}, user_id={self.user_id}, event_type={self.event_type})>"


class RecommendationLog(Base):
    """
    Logs recommendation results for analysis and debugging.

    Stores the context, recommended products, and their scores
    for each recommendation request.
    """

    __tablename__ = "recommendation_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    context_product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    recommended_product_ids: Mapped[list] = mapped_column(JSON, nullable=False)
    scores: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_recommendation_logs_user_id", "user_id"),
    )

    def __repr__(self) -> str:
        return f"<RecommendationLog(id={self.id}, user_id={self.user_id})>"


class CustomerSegment(Base):
    """
    Stores customer segmentation assignments from RFM analysis.

    Each record links a customer to a segment with their
    RFM feature values from a specific segmentation run.
    """

    __tablename__ = "customer_segments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    segment_id: Mapped[int] = mapped_column(Integer, nullable=False)
    segment_name: Mapped[str] = mapped_column(String(100), nullable=False)
    recency_days: Mapped[int] = mapped_column(Integer, nullable=False)
    frequency: Mapped[int] = mapped_column(Integer, nullable=False)
    monetary: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_customer_segments_user_id", "user_id"),
        Index("ix_customer_segments_run_id", "run_id"),
        Index("ix_customer_segments_segment_id", "segment_id"),
    )

    def __repr__(self) -> str:
        return f"<CustomerSegment(id={self.id}, user_id={self.user_id}, segment_name={self.segment_name!r})>"


class SegmentationRun(Base):
    """
    Stores metadata for each customer segmentation run.

    Tracks the number of customers processed, clusters created,
    and the quality metric (silhouette score).
    """

    __tablename__ = "segmentation_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    num_customers: Mapped[int] = mapped_column(Integer, nullable=False)
    num_clusters: Mapped[int] = mapped_column(Integer, nullable=False)
    silhouette_score: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return (
            f"<SegmentationRun(id={self.id}, num_clusters={self.num_clusters}, "
            f"silhouette_score={self.silhouette_score})>"
        )


class ProductClassification(Base):
    """
    Stores product classification results from the ML classifier.

    Records the predicted category, confidence score, and whether
    the classification was auto-assigned or needs manual review.
    """

    __tablename__ = "product_classifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    predicted_category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    predicted_category_label: Mapped[str] = mapped_column(String(255), nullable=False)
    confidence_score: Mapped[Decimal] = mapped_column(Numeric(4, 3), nullable=False)
    status: Mapped[str] = mapped_column(
        Enum(ClassificationStatus, name="classification_status_enum"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_product_classifications_product_id", "product_id"),
        Index("ix_product_classifications_status", "status"),
    )

    def __repr__(self) -> str:
        return (
            f"<ProductClassification(id={self.id}, product_id={self.product_id}, "
            f"predicted_category_label={self.predicted_category_label!r})>"
        )
