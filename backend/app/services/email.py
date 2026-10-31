"""Email delivery behind a provider-agnostic interface (same idea as app.services.sms).

ERP code only calls `EmailSender.send`. A real provider (e.g. Amazon SES) is added before launch.
"""

import logging
from typing import Protocol

from app.core.config import get_settings

log = logging.getLogger("annadata.email")


class EmailSender(Protocol):
    def send(self, to: str, subject: str, body: str) -> None: ...


class ConsoleEmailSender:
    """Development only: prints the email to the server log instead of sending it."""

    def send(self, to: str, subject: str, body: str) -> None:
        log.warning("DEV EMAIL to %s — %s\n%s", to, subject, body)


def get_email_sender() -> EmailSender:
    provider = get_settings().email_provider
    if provider == "console":
        return ConsoleEmailSender()
    raise RuntimeError(f"Unknown EMAIL_PROVIDER: {provider}")
