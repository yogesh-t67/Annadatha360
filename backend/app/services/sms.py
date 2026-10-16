"""SMS delivery behind a provider-agnostic interface.

Auth logic only ever calls `SmsSender.send_otp`. To add or swap a provider, write one class
with that method and register it in `get_sms_sender`.
"""

import logging
from typing import Protocol

import httpx

from app.core.config import get_settings
from app.core.errors import AppError

log = logging.getLogger("annadata.sms")


class SmsSender(Protocol):
    def send_otp(self, phone: str, code: str) -> None: ...


class ConsoleSmsSender:
    """Development only: prints the OTP to the server log instead of sending an SMS."""

    def send_otp(self, phone: str, code: str) -> None:
        log.warning("DEV OTP for %s: %s", phone, code)


class Msg91SmsSender:
    """MSG91 OTP API (v5). We generate and verify the OTP ourselves; MSG91 only delivers it.

    NOTE: written against MSG91's documented v5 shape but not yet exercised against a live
    account (needs DLT registration — see docs/development/external-dependencies.md).
    """

    URL = "https://control.msg91.com/api/v5/otp"

    def __init__(self, auth_key: str, template_id: str, otp_expiry_minutes: int, http: httpx.Client | None = None):
        self.auth_key = auth_key
        self.template_id = template_id
        self.otp_expiry_minutes = otp_expiry_minutes
        self.http = http or httpx.Client(timeout=10.0)

    def send_otp(self, phone: str, code: str) -> None:
        params = {
            "template_id": self.template_id,
            "mobile": phone.lstrip("+"),  # MSG91 wants country code without '+', e.g. 919876543210
            "otp": code,
            "otp_expiry": self.otp_expiry_minutes,
        }
        try:
            res = self.http.post(self.URL, params=params, headers={"authkey": self.auth_key})
            body = res.json()
        except (httpx.HTTPError, ValueError) as exc:
            log.error("MSG91 request failed: %s", exc)
            raise AppError(503, "sms_unavailable", "Could not send OTP right now. Try again shortly.") from exc
        # MSG91 can report failures with HTTP 200, so check the body too.
        if res.status_code != 200 or body.get("type") != "success":
            log.error("MSG91 rejected OTP send: status=%s body=%s", res.status_code, body)
            raise AppError(503, "sms_unavailable", "Could not send OTP right now. Try again shortly.")


def get_sms_sender() -> SmsSender:
    settings = get_settings()
    if settings.sms_provider == "console":
        if settings.is_production:
            raise RuntimeError("Console SMS provider is not allowed in production")
        return ConsoleSmsSender()
    if settings.sms_provider == "msg91":
        if not (settings.msg91_auth_key and settings.msg91_otp_template_id):
            raise RuntimeError("MSG91_AUTH_KEY and MSG91_OTP_TEMPLATE_ID are required when SMS_PROVIDER=msg91")
        return Msg91SmsSender(
            settings.msg91_auth_key, settings.msg91_otp_template_id, max(1, settings.otp_ttl_seconds // 60)
        )
    raise RuntimeError(f"Unknown SMS_PROVIDER: {settings.sms_provider}")
