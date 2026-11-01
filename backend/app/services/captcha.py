"""Bot check for public forms (vendor sign-up) with Cloudflare Turnstile.

TURNSTILE_SECRET_KEY empty = no check (laptop). Cloudflare's test keys let you try the widget locally:
site key 1x00000000000000000000AA / secret 1x0000000000000000000000000000000AA always pass.
"""

import logging
from functools import lru_cache
from typing import Protocol

import httpx

from app.core.config import get_settings
from app.core.errors import AppError

log = logging.getLogger("annadata.captcha")

VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


class Captcha(Protocol):
    def verify(self, token: str | None, ip: str | None) -> None: ...


class NoCaptcha:
    def verify(self, token: str | None, ip: str | None) -> None:
        return None


class Turnstile:
    def __init__(self, secret: str, http: httpx.Client | None = None):
        self.secret = secret
        self.http = http or httpx.Client(timeout=8.0)

    def verify(self, token: str | None, ip: str | None) -> None:
        if not token:
            raise AppError(400, "captcha_required", "Please complete the check that you're not a robot")
        data = {"secret": self.secret, "response": token}
        if ip:
            data["remoteip"] = ip
        try:
            res = self.http.post(VERIFY_URL, data=data)
            res.raise_for_status()
            ok = bool(res.json().get("success"))
        except (httpx.HTTPError, ValueError) as exc:
            # Cloudflare unreachable: let the person through rather than block every sign-up. The other limits
            # (per-address attempts, email verification, Super Admin review) still apply.
            log.warning("Turnstile check failed, allowing: %s", exc)
            return
        if not ok:
            raise AppError(400, "captcha_failed", "The robot check didn't pass. Please try again.")


@lru_cache
def get_captcha() -> Captcha:
    secret = get_settings().turnstile_secret_key
    return Turnstile(secret) if secret else NoCaptcha()
