"""
Application settings loaded from environment variables.

Uses pydantic-settings for type-safe configuration with validation.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """AI Service configuration from environment variables."""

    # Application
    app_env: str = "development"
    debug: bool = False
    secret_key: str = "change-me-to-a-random-secret-key"
    allowed_hosts: str = "*"
    log_level: str = "INFO"
    service_name: str = "ai-service"

    # Database (PostgreSQL + pgvector)
    database_url: str = "postgresql+asyncpg://techshop:techshop@ai-postgres:5432/ai_db"

    # JWT
    jwt_public_key: str = "/app/keys/jwt_public.pem"
    jwt_issuer: str = "techshop.identity"
    jwt_algorithm: str = "RS256"

    # Service URLs
    identity_service_url: str = "http://identity-service:8001"
    catalog_service_url: str = "http://catalog-service:8002"
    cart_service_url: str = "http://cart-service:8003"
    order_service_url: str = "http://order-service:8004"
    payment_service_url: str = "http://payment-service:8005"
    shipping_service_url: str = "http://shipping-service:8006"
    review_service_url: str = "http://review-service:8007"

    # LLM
    llm_provider: str = "openai"
    llm_api_key: str = ""
    llm_model: str = "gpt-4o-mini"
    llm_max_tokens: int = 1024
    llm_temperature: float = 0.3

    # Embedding
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    embedding_dimension: int = 384
    rag_similarity_threshold: float = 0.5

    # ML Model Paths
    sentiment_model_path: str = "/app/ml/sentiment"
    sequence_model_path: str = "/app/ml/sequence_model"
    segmentation_model_path: str = "/app/ml/segmentation"
    classification_model_path: str = "/app/ml/product_classifier"

    # Dataset Paths
    amazon_reviews_path: str = "/app/data/amazon_reviews"
    retailrocket_path: str = "/app/data/retailrocket"
    uci_retail_path: str = "/app/data/uci_retail"
    faq_knowledge_base_path: str = "/app/data/faq"

    # CORS
    cors_allowed_origins: str = "http://localhost:3000,http://localhost"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
