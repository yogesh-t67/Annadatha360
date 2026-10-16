import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ANNADATA_ENV_FILE="" disables the .env file (the test suite does this so local keys don't leak into tests).
    model_config = SettingsConfigDict(env_file=os.getenv("ANNADATA_ENV_FILE", ".env") or None, extra="ignore")

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
    # Closed-beta testers: these numbers log in with OTP_TEST_CODE and no SMS is sent. Refused in production.
    otp_test_numbers: list[str] = []
    otp_test_code: str = ""

    # --- Weather (Open-Meteo) ---
    open_meteo_base_url: str = "https://api.open-meteo.com"
    open_meteo_api_key: str = ""  # only needed on the commercial plan
    weather_cache_ttl_seconds: int = 1800

    # --- Market prices (data.gov.in / Agmarknet) ---
    data_gov_in_api_key: str = ""
    market_states: list[str] = ["Andhra Pradesh", "Telangana"]

    # --- AI (Claude) ---
    # "anthropic" | "fake" (canned replies, no key) | "gemini" (free Google tier, TESTING ONLY).
    # fake and gemini are refused in production.
    ai_provider: str = "anthropic"
    anthropic_api_key: str = ""
    # Gemini free tier: Google may use what you send to improve its products. Test data only — never real farmers'.
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.6-flash"  # verified live 2026-10-16; 3.8-flash was overloaded at the time
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai/"
    ai_model: str = "claude-opus-5-5"
    ai_chat_effort: str = "low"
    ai_diagnosis_effort: str = "medium"
    ai_monthly_budget_usd: float = 50.0  # dev-sandbox placeholder; raise before launch
    # Headroom kept for the call about to be made, so the last call of the month can't overshoot much.
    ai_call_reserve_usd: float = 0.20
    ai_farmer_daily_request_limit: int = 30
    ai_chat_history_messages: int = 20

    # --- Payments ---
    payment_provider: str = "fake"  # "fake" (dev: no money moves) | "razorpay"
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""
    order_payment_window_minutes: int = 30  # unpaid orders are cancelled and stock released after this
    cod_enabled: bool = False  # cash on delivery
    cod_max_order_rupees: int = 5000  # COD orders above this must pay online

    cors_origins: list[str] = ["*"]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.is_production:
        if settings.jwt_secret == "change-me" or len(settings.jwt_secret) < 32:
            raise RuntimeError("JWT_SECRET must be set to at least 32 characters in production")
        if settings.otp_test_numbers:
            raise RuntimeError("OTP_TEST_NUMBERS must be empty in production")
        if settings.ai_provider in ("fake", "gemini"):
            raise RuntimeError(f"AI_PROVIDER={settings.ai_provider} is for testing only, not production")
    return settings
