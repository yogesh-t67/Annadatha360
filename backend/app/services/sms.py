"""SMS delivery. Provider choice (MSG91 / Twilio / Gupshup etc.) is still open — see docs/api/README.md."""

import logging
from typing import Protocol

from app.core.config import get_settings

log = logging.getLogger("annadata.sms")


class SmsSender(Protocol):
    def send_otp(self, phone: str, code: str) -> None: ...


class ConsoleSmsSender:
    """Development only: prints the OTP to the server log instead of sending an SMS."""

    def send_otp(self, phone: str, code: str) -> None:
        log.warning("DEV OTP for %s: %s", phone, code)


def get_sms_sender() -> SmsSender:
    settings = get_settings()
    if settings.sms_provider == "console":
        if settings.is_production:
            raise RuntimeError("Console SMS provider is not allowed in production")
        return ConsoleSmsSender()
    raise RuntimeError(f"Unknown SMS_PROVIDER: {settings.sms_provider}")
