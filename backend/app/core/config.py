from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    database_url: str = "postgresql+psycopg://annadata:annadata@localhost:5432/annadata"

    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 60
    refresh_token_ttl_days: int = 60

    # --- SMS / OTP ---
    sms_provider: str = "console"  # "console" (dev: log only) | "msg91"
    msg91_auth_key: str = ""
    msg91_otp_template_id: str = ""  # DLT-approved template registered in MSG91
    otp_ttl_seconds: int = 300
    otp_max_attempts: int = 5
    otp_resend_cooldown_seconds: int = 30
    otp_max_sends_per_hour: int = 5

    # --- Weather (Open-Meteo) ---
    open_meteo_base_url: str = "https://api.open-meteo.com"
    open_meteo_api_key: str = ""  # only needed on the commercial plan
    weather_cache_ttl_seconds: int = 1800

    # --- Market prices (data.gov.in / Agmarknet) ---
    data_gov_in_api_key: str = ""
    market_states: list[str] = ["Andhra Pradesh", "Telangana"]

    # --- AI (Claude) ---
    anthropic_api_key: str = ""
    ai_model: str = "claude-opus-5-5"
    ai_chat_effort: str = "low"
    ai_diagnosis_effort: str = "medium"
    ai_monthly_budget_usd: float = 50.0  # dev-sandbox placeholder; raise before launch
    # Headroom kept for the call about to be made, so the last call of the month can't overshoot much.
    ai_call_reserve_usd: float = 0.20
    ai_farmer_daily_request_limit: int = 30
    ai_chat_history_messages: int = 20

    cors_origins: list[str] = ["*"]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.is_production and (settings.jwt_secret == "change-me" or len(settings.jwt_secret) < 32):
        raise RuntimeError("JWT_SECRET must be set to at least 32 characters in production")
    return settings
