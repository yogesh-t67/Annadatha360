"""Payment gateway adapter. Razorpay covers UPI (PhonePe, GPay, Paytm, any UPI app via intent), cards and
netbanking from one integration. Shop logic only talks to `PaymentGateway`."""

import hashlib
import hmac
import logging
import secrets
from typing import Protocol

import httpx

from app.core.config import get_settings
from app.core.errors import AppError

log = logging.getLogger("annadata.payments")


def _hmac_sha256(secret: str, message: bytes) -> str:
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


class PaymentGateway(Protocol):
    name: str
    key_id: str

    def create_order(self, amount_paise: int, receipt: str) -> str: ...
    def verify_payment(self, provider_order_id: str, payment_id: str, signature: str) -> bool: ...
    def verify_webhook(self, body: bytes, signature: str) -> bool: ...


class RazorpayGateway:
    """Razorpay Orders API + signature checks. Exercised against mocks only until we have test-mode keys."""

    name = "razorpay"
    URL = "https://api.razorpay.com/v1/orders"

    def __init__(self, key_id: str, key_secret: str, webhook_secret: str, http: httpx.Client | None = None):
        self.key_id = key_id
        self.key_secret = key_secret
        self.webhook_secret = webhook_secret
        self._http = http

    @property
    def http(self) -> httpx.Client:
        if self._http is None:  # created on first use: signature checks need no network
            self._http = httpx.Client(timeout=15.0)
        return self._http

    def create_order(self, amount_paise: int, receipt: str) -> str:
        try:
            res = self.http.post(
                self.URL,
                auth=(self.key_id, self.key_secret),
                json={"amount": amount_paise, "currency": "INR", "receipt": receipt},
            )
            res.raise_for_status()
            return res.json()["id"]
        except (httpx.HTTPError, ValueError, KeyError) as exc:
            log.error("Razorpay create order failed: %s", exc)
            raise AppError(503, "payment_unavailable", "Payments are unavailable right now") from exc

    def verify_payment(self, provider_order_id: str, payment_id: str, signature: str) -> bool:
        expected = _hmac_sha256(self.key_secret, f"{provider_order_id}|{payment_id}".encode())
        return hmac.compare_digest(expected, signature)

    def verify_webhook(self, body: bytes, signature: str) -> bool:
        if not self.webhook_secret:
            return False
        return hmac.compare_digest(_hmac_sha256(self.webhook_secret, body), signature)


class FakeGateway(RazorpayGateway):
    """Dev only: no network. Signatures use the same HMAC scheme with a known secret, so the app can
    complete a checkout locally via POST /orders/{id}/payment/dev-complete."""

    name = "fake"
    KEY_ID = "rzp_test_fake"
    SECRET = "dev-payment-secret"

    def __init__(self):
        super().__init__(self.KEY_ID, self.SECRET, self.SECRET)

    def create_order(self, amount_paise: int, receipt: str) -> str:
        return f"order_fake_{secrets.token_hex(8)}"

    def sign(self, provider_order_id: str, payment_id: str) -> str:
        return _hmac_sha256(self.SECRET, f"{provider_order_id}|{payment_id}".encode())


def get_payment_gateway() -> PaymentGateway:
    s = get_settings()
    if s.payment_provider == "fake":
        if s.is_production:
            raise RuntimeError("Fake payment provider is not allowed in production")
        return FakeGateway()
    if s.payment_provider == "razorpay":
        if not (s.razorpay_key_id and s.razorpay_key_secret):
            raise AppError(503, "payment_not_configured", "Payments are not configured on this server")
        return RazorpayGateway(s.razorpay_key_id, s.razorpay_key_secret, s.razorpay_webhook_secret)
    raise RuntimeError(f"Unknown PAYMENT_PROVIDER: {s.payment_provider}")
