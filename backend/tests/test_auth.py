from datetime import timedelta

import pytest

from app.models import OtpChallenge
from app.schemas.common import normalize_indian_mobile


@pytest.mark.parametrize(
    "raw", ["9876543210", "+91 98765 43210", "919876543210", "09876543210", "98765-43210"]
)
def test_phone_normalisation(raw):
    assert normalize_indian_mobile(raw) == "+919876543210"


@pytest.mark.parametrize("raw", ["12345", "5876543210", "+1 415 555 0100", ""])
def test_phone_rejects_invalid(raw):
    with pytest.raises(ValueError):
        normalize_indian_mobile(raw)


def test_new_then_returning_user(login, client, sms):
    _, first = login()
    assert first["is_new_user"] is True
    assert first["farmer"]["phone"] == "+919876543210"
    assert first["farmer"]["profile_complete"] is False


def test_returning_user_not_new(login, db_session):
    login("9876543210")
    # Skip the resend cooldown by backdating the first challenge.
    with db_session() as s:
        for c in s.query(OtpChallenge).all():
            c.created_at = c.created_at - timedelta(minutes=5)
        s.commit()
    _, second = login("9876543210")
    assert second["is_new_user"] is False


def test_invalid_phone_uses_error_envelope(client):
    res = client.post("/api/v1/auth/otp/request", json={"phone": "123"})
    assert res.status_code == 422
    err = res.json()["error"]
    assert err["code"] == "validation_error"
    assert err["details"][0]["field"] == "phone"


def test_resend_cooldown(client):
    client.post("/api/v1/auth/otp/request", json={"phone": "9000000001"})
    res = client.post("/api/v1/auth/otp/request", json={"phone": "9000000001"})
    assert res.status_code == 429
    assert res.json()["error"]["code"] == "otp_cooldown"


def test_wrong_code_then_lockout(client, sms):
    client.post("/api/v1/auth/otp/request", json={"phone": "9000000002"})
    wrong = "000000" if sms.sent["+919000000002"] != "000000" else "111111"
    for _ in range(5):
        res = client.post("/api/v1/auth/otp/verify", json={"phone": "9000000002", "code": wrong})
        assert res.json()["error"]["code"] == "otp_invalid"
    # Even the right code is refused once attempts are exhausted.
    res = client.post("/api/v1/auth/otp/verify", json={"phone": "9000000002", "code": sms.sent["+919000000002"]})
    assert res.json()["error"]["code"] == "otp_attempts_exceeded"


def test_otp_single_use(client, sms):
    client.post("/api/v1/auth/otp/request", json={"phone": "9000000003"})
    body = {"phone": "9000000003", "code": sms.sent["+919000000003"]}
    assert client.post("/api/v1/auth/otp/verify", json=body).status_code == 200
    res = client.post("/api/v1/auth/otp/verify", json=body)
    assert res.json()["error"]["code"] == "otp_expired"


def test_expired_otp(client, sms, db_session):
    client.post("/api/v1/auth/otp/request", json={"phone": "9000000004"})
    with db_session() as s:
        c = s.query(OtpChallenge).one()
        c.expires_at = c.expires_at - timedelta(minutes=10)
        s.commit()
    res = client.post("/api/v1/auth/otp/verify", json={"phone": "9000000004", "code": sms.sent["+919000000004"]})
    assert res.json()["error"]["code"] == "otp_expired"


def test_otp_not_stored_in_plaintext(client, sms, db_session):
    client.post("/api/v1/auth/otp/request", json={"phone": "9000000005"})
    with db_session() as s:
        assert s.query(OtpChallenge).one().code_hash != sms.sent["+919000000005"]


def test_refresh_rotates_and_logout_revokes(login, client):
    _, body = login()
    res = client.post("/api/v1/auth/refresh", json={"refresh_token": body["refresh_token"]})
    assert res.status_code == 200
    new_refresh = res.json()["refresh_token"]

    # Old refresh token is now dead.
    res = client.post("/api/v1/auth/refresh", json={"refresh_token": body["refresh_token"]})
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "invalid_refresh_token"

    assert client.post("/api/v1/auth/logout", json={"refresh_token": new_refresh}).status_code == 204
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": new_refresh}).status_code == 401


def test_protected_route_requires_token(client):
    res = client.get("/api/v1/farmers/me")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "unauthorized"

    res = client.get("/api/v1/farmers/me", headers={"Authorization": "Bearer garbage"})
    assert res.json()["error"]["code"] == "invalid_token"
