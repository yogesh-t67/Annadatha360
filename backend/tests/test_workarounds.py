"""Fake AI mode, closed-beta test numbers, and cash on delivery."""

import io
from datetime import timedelta

import pytest

from app.core.config import get_settings
from app.core.security import utcnow
from app.jobs.grant_staff import grant
from app.jobs.load_products import load as load_products
from app.models import AiUsage, Order, Product
from app.services.shop import expire_unpaid_orders
from tests.test_diagnosis import JPEG
from tests.test_shop import ADDRESS, _product

# ---------- Fixed test numbers ----------


@pytest.fixture
def testers(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "otp_test_numbers", ["+91 90000 00077", "garbage"])
    monkeypatch.setattr(s, "otp_test_code", "111111")
    return s


def test_test_number_logs_in_with_fixed_code_and_no_sms(client, sms, testers):
    assert client.post("/api/v1/auth/otp/request", json={"phone": "9000000077"}).status_code == 200
    assert sms.sent == {}  # no SMS for testers
    res = client.post("/api/v1/auth/otp/verify", json={"phone": "9000000077", "code": "111111"})
    assert res.status_code == 200 and res.json()["is_new_user"] is True


def test_other_numbers_unaffected(client, sms, testers):
    client.post("/api/v1/auth/otp/request", json={"phone": "9000000078"})
    assert "+919000000078" in sms.sent
    res = client.post("/api/v1/auth/otp/verify", json={"phone": "9000000078", "code": "111111"})
    if sms.sent["+919000000078"] != "111111":
        assert res.json()["error"]["code"] == "otp_invalid"


def test_test_numbers_still_rate_limited(client, testers):
    client.post("/api/v1/auth/otp/request", json={"phone": "9000000077"})
    res = client.post("/api/v1/auth/otp/request", json={"phone": "9000000077"})
    assert res.json()["error"]["code"] == "otp_cooldown"


def test_test_numbers_ignored_in_production(client, sms, testers, monkeypatch):
    monkeypatch.setattr(testers, "app_env", "production")
    client.post("/api/v1/auth/otp/request", json={"phone": "9000000077"})
    assert "+919000000077" in sms.sent  # real SMS path, fixed code not used


@pytest.mark.parametrize(
    "env", [{"OTP_TEST_NUMBERS": '["9000000077"]'}, {"AI_PROVIDER": "fake"}, {"AI_PROVIDER": "gemini"}]
)
def test_production_refuses_test_settings(monkeypatch, env):
    get_settings.cache_clear()
    try:
        monkeypatch.setenv("APP_ENV", "production")
        monkeypatch.setenv("JWT_SECRET", "x" * 40)
        for k, v in env.items():
            monkeypatch.setenv(k, v)
        with pytest.raises(RuntimeError):
            get_settings()
    finally:
        monkeypatch.undo()
        get_settings.cache_clear()


# ---------- Fake AI ----------


@pytest.fixture
def fake_ai(monkeypatch):
    monkeypatch.setattr(get_settings(), "ai_provider", "fake")


def test_fake_ai_chat_in_farmers_language(login, client, fake_ai, db_session):
    headers, _ = login()
    client.patch("/api/v1/farmers/me", headers=headers, json={"preferred_language": "te"})
    res = client.post("/api/v1/assistant/messages", headers=headers, json={"message": "హలో"})
    assert res.status_code == 200, res.text
    assert res.json()["reply"]["content"].startswith("[పరీక్ష సమాధానం")
    with db_session() as db:
        row = db.query(AiUsage).one()
        assert row.cost_usd == 0  # still goes through the budget ledger, at zero cost


def test_fake_ai_diagnosis_matches_real_schema(login, client, fake_ai):
    headers, _ = login()
    res = client.post("/api/v1/diagnoses", headers=headers, files={"image": ("l.jpg", io.BytesIO(JPEG), "image/jpeg")})
    assert res.status_code == 201, res.text
    result = res.json()["result"]
    assert result["summary"].startswith("[పరీక్ష]")  # new accounts default to Telugu
    assert result["consult_expert"] is True


def test_fake_ai_still_respects_daily_limit(login, client, fake_ai, monkeypatch):
    headers, _ = login()
    monkeypatch.setattr(get_settings(), "ai_farmer_daily_request_limit", 1)
    assert client.post("/api/v1/assistant/messages", headers=headers, json={"message": "a"}).status_code == 200
    assert client.post("/api/v1/assistant/messages", headers=headers, json={"message": "b"}).status_code == 429


# ---------- Cash on delivery ----------


@pytest.fixture
def cod_shop(login, client, db_session, monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "cod_enabled", True)
    monkeypatch.setattr(s, "cod_max_order_rupees", 1000)
    # Razorpay selected but not configured: COD must still work.
    monkeypatch.setattr(s, "payment_provider", "razorpay")
    monkeypatch.setattr(s, "razorpay_key_id", "")
    headers, _ = login("9100000020")
    with db_session() as db:
        load_products(db, [_product("UREA", price=30000, mrp=30000, stock=5)])  # ₹300
        pid = db.query(Product).one().id
    return headers, pid


def _stock(db_session, pid):
    with db_session() as db:
        return db.get(Product, pid).stock


def _cod_order(client, headers, pid, qty=2):
    client.put(f"/api/v1/cart/items/{pid}", headers=headers, json={"quantity": qty})
    return client.post("/api/v1/orders", headers=headers, json={"address": ADDRESS, "payment_method": "cod"})


def test_cod_order(client, cod_shop, db_session):
    headers, pid = cod_shop
    res = _cod_order(client, headers, pid)
    assert res.status_code == 201, res.text
    o = res.json()
    assert (o["status"], o["payment_method"], o["payment"], o["pay_by"], o["total"]) == (
        "confirmed", "cod", None, None, 600.0,
    )  # fmt: skip
    assert _stock(db_session, pid) == 3
    assert client.get("/api/v1/cart", headers=headers).json()["items"] == []

    # Online payment fails cleanly on this server; COD didn't depend on it.
    client.put(f"/api/v1/cart/items/{pid}", headers=headers, json={"quantity": 1})
    res = client.post("/api/v1/orders", headers=headers, json={"address": ADDRESS})
    assert res.status_code == 503 and res.json()["error"]["code"] == "payment_not_configured"


def test_cod_rules(client, cod_shop, monkeypatch):
    headers, pid = cod_shop
    res = _cod_order(client, headers, pid, qty=4)  # ₹1200 > ₹1000 limit
    assert res.json()["error"]["code"] == "cod_limit_exceeded" and res.json()["error"]["details"] == {"max_order": 1000}
    monkeypatch.setattr(get_settings(), "cod_enabled", False)
    assert _cod_order(client, headers, pid).json()["error"]["code"] == "cod_not_available"


def test_cod_cancel_by_farmer_releases_stock(client, cod_shop, db_session):
    headers, pid = cod_shop
    oid = _cod_order(client, headers, pid).json()["id"]
    assert client.post(f"/api/v1/orders/{oid}/cancel", headers=headers).json()["status"] == "cancelled"
    assert _stock(db_session, pid) == 5


def test_cod_not_expired_by_payment_window(client, cod_shop, db_session):
    headers, pid = cod_shop
    oid = _cod_order(client, headers, pid).json()["id"]
    with db_session() as db:
        db.get(Order, oid).created_at = utcnow() - timedelta(days=1)
        db.commit()
        assert expire_unpaid_orders(db) == 0


def test_cod_ops_flow(client, cod_shop, login, db_session):
    headers, pid = cod_shop
    ops, _ = login("9100000021")
    with db_session() as db:
        grant(db, "9100000021", "ops")
    oid = _cod_order(client, headers, pid).json()["id"]
    move = lambda s: client.post(f"/api/v1/admin/orders/{oid}/status", headers=ops, json={"status": s})
    assert move("shipped").json()["status"] == "shipped"
    assert client.post(f"/api/v1/orders/{oid}/cancel", headers=headers).status_code == 409  # shipped: too late
    delivered = move("delivered").json()
    assert delivered["status"] == "delivered" and delivered["paid_at"]  # cash collected

    oid2 = _cod_order(client, headers, pid, qty=1).json()["id"]
    assert (
        client.post(f"/api/v1/admin/orders/{oid2}/status", headers=ops, json={"status": "cancelled"}).status_code == 200
    )
    assert _stock(db_session, pid) == 3  # 5 - 2 delivered; the cancelled 1 came back
