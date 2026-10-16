import httpx
import pytest

from app.core.errors import AppError
from app.models import OtpChallenge
from app.services.sms import Msg91SmsSender, get_sms_sender


def _sender(handler) -> Msg91SmsSender:
    return Msg91SmsSender("key-123", "tmpl-1", 5, http=httpx.Client(transport=httpx.MockTransport(handler)))


def test_msg91_sends_expected_request():
    seen = {}

    def handler(request: httpx.Request):
        seen["url"] = request.url
        seen["authkey"] = request.headers["authkey"]
        return httpx.Response(200, json={"type": "success", "request_id": "abc"})

    _sender(handler).send_otp("+919876543210", "123456")
    assert seen["authkey"] == "key-123"
    assert seen["url"].params["mobile"] == "919876543210"
    assert seen["url"].params["otp"] == "123456"
    assert seen["url"].params["template_id"] == "tmpl-1"


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(200, json={"type": "error", "message": "Invalid authkey"}),  # failure reported as 200
        httpx.Response(500, json={"type": "error"}),
        httpx.Response(200, text="not json"),
    ],
)
def test_msg91_failures_raise_sms_unavailable(response):
    with pytest.raises(AppError) as exc:
        _sender(lambda _: response).send_otp("+919876543210", "123456")
    assert exc.value.code == "sms_unavailable"


def test_failed_send_does_not_trigger_cooldown(client, db_session):
    from app.main import app

    class Broken:
        def send_otp(self, phone, code):
            raise AppError(503, "sms_unavailable", "down")

    app.dependency_overrides[get_sms_sender] = lambda: Broken()
    res = client.post("/api/v1/auth/otp/request", json={"phone": "9333333333"})
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "sms_unavailable"
    with db_session() as s:
        assert s.query(OtpChallenge).count() == 0
