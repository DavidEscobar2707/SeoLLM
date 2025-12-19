"""
Application settings using pydantic-settings for environment variable management.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )
    
    # API Keys
    gemini_api_key: str
    perplexity_api_key: str
    
    # Supabase Configuration
    supabase_url: str
    supabase_key: str
    
    # Application Settings
    environment: str = "development"
    
    # Optional settings with defaults
    max_queries_default: int = 25
    max_queries_limit: int = 50
    validation_limit: int = 10
    poll_interval_seconds: int = 2
    
    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    """
    Get cached settings instance.
    Uses lru_cache to avoid reloading env vars on every call.
    """
    return Settings()

