import httpx
import pytest

from app.core.errors import AppError
from app.main import app
from app.services.captcha import Turnstile, get_captcha
from tests.erp_helpers import API

SIGNUP = {
    "email": "shop@vendor.test",
    "full_name": "Ravi Kumar",
    "phone": "9876543210",
    "kind": "business",
    "trade_name": "Sri Lakshmi Agro",
}


def _turnstile(answer):
    def handler(request):
        if answer == "down":
            raise httpx.ConnectError("down")
        assert b"secret=s3cret" in request.content and b"remoteip=1.2.3.4" in request.content
        return httpx.Response(200, json={"success": answer})

    return Turnstile("s3cret", http=httpx.Client(transport=httpx.MockTransport(handler)))


def test_turnstile_answers():
    _turnstile(True).verify("token", "1.2.3.4")
    with pytest.raises(AppError) as failed:
        _turnstile(False).verify("token", "1.2.3.4")
    assert failed.value.code == "captcha_failed"
    with pytest.raises(AppError) as missing:
        _turnstile(True).verify(None, "1.2.3.4")
    assert missing.value.code == "captcha_required"
    _turnstile("down").verify("token", "1.2.3.4")  # Cloudflare unreachable: don't block sign-ups


def test_signup_needs_the_robot_check_when_switched_on(client, mail):
    app.dependency_overrides[get_captcha] = lambda: _turnstile(False)
    res = client.post(f"{API}/vendors/register", json=SIGNUP)
    assert res.status_code == 400 and res.json()["error"]["code"] == "captcha_required"
    assert mail.sent == []


def test_signup_without_keys_has_no_check(client, mail):
    assert client.post(f"{API}/vendors/register", json=SIGNUP).status_code == 202
