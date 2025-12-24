"""Application configuration using Pydantic Settings."""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Environment
    environment: Literal["development", "production"] = "development"

    # Database
    database_url: str = "postgresql+asyncpg://quiz:quiz@localhost:5432/quiz"

    # JWT Authentication
    jwt_secret: str = "dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiry_hours: int = 24

    # Encryption (for storing API keys)
    encryption_key: str = "dev-encryption-key-change-in-prod"

    # CORS
    cors_allowed_origins: str = "*"

    # AI Providers
    default_ai_provider: Literal["claude", "openai", "ollama"] = "openai"
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None
    openai_model: str = "gpt-5.2-thinking"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama2"

    # OpenAI handles both transcription (Whisper) and question generation
    # openai_api_key is defined in AI Providers section above

    # MinIO/S3 Storage
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "quiz-avatars"
    minio_use_ssl: bool = False

    # Server
    host: str = "0.0.0.0"
    port: int = 8080

    # Logging
    log_level: str = "INFO"

    # Quiz timing
    answer_timeout_grace_ms: int = 500  # 500ms grace period for answer submission timing

    # Mega quiz configuration
    mega_quiz_single_segment_mode: Literal["remix", "skip"] = "remix"

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins from comma-separated string."""
        if self.cors_allowed_origins == "*":
            return ["*"]
        return [origin.strip() for origin in self.cors_allowed_origins.split(",")]

    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.environment == "production"

    def validate_production_settings(self) -> None:
        """Validate that production has proper secrets configured."""
        if self.is_production:
            if self.jwt_secret == "dev-secret-change-in-production":
                raise ValueError("JWT_SECRET must be set in production")
            if self.encryption_key == "dev-encryption-key-change-in-prod":
                raise ValueError("ENCRYPTION_KEY must be set in production")
            if self.cors_allowed_origins == "*":
                raise ValueError("CORS_ALLOWED_ORIGINS must be set in production")


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
