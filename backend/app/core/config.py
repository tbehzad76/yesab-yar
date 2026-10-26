from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    project_name: str = "Hesabyar API"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"
    default_currency: str = "IRT"

    postgres_user: str = "hesabyar"
    postgres_password: str = "hesabyar"
    postgres_db: str = "hesabyar"
    postgres_host: str = "db"
    postgres_port: int = 5432
    database_url: str = ""

    secret_key: str = "change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def sqlalchemy_database_uri(self) -> str:
        if self.database_url:
            return self.database_url
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def cors_origins_list(self) -> list[str]:
        raw = self.cors_origins.strip()
        if raw == "*":
            return ["*"]
        return [origin.strip() for origin in raw.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
