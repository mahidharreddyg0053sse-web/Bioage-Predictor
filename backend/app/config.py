"""Application configuration loaded exclusively from environment variables."""

from functools import lru_cache
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "PhishGuard API"
    app_version: str = "1.0.0"
    app_env: str = "development"
    app_host: str = "127.0.0.1"
    app_port: int = 8000
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"

    # Security & limits
    rate_limit_requests_per_minute: int = 120
    external_api_timeout_seconds: float = 8.0

    # Supabase PostgreSQL (backend-only secrets)
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # Threat Intelligence API Keys (backend-only secrets)
    virustotal_api_key: str = ""
    urlhaus_api_key: str = ""
    abuseipdb_api_key: str = ""

    # Storage paths
    sqlite_db_path: str = str(BACKEND_DIR / "data" / "phishguard.db")
    ml_artifacts_dir: str = str(BACKEND_DIR / "app" / "ml" / "artifacts")
    reports_dir: str = str(BACKEND_DIR / "data" / "reports")

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url.strip() and self.supabase_service_role_key.strip())

    @property
    def virustotal_configured(self) -> bool:
        return bool(self.virustotal_api_key.strip())

    @property
    def urlhaus_configured(self) -> bool:
        return bool(self.urlhaus_api_key.strip())

    @property
    def abuseipdb_configured(self) -> bool:
        return bool(self.abuseipdb_api_key.strip())


@lru_cache()
def get_settings() -> Settings:
    return Settings()
