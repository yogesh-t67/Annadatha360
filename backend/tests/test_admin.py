from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.core.security import utcnow
from app.jobs.grant_staff import grant
from app.jobs.load_products import load as load_products
from app.jobs.load_providers import load as load_providers
from app.main import app
from app.models import AiUsage, AuditLog, Product
from app.services.payments import FakeGateway, get_payment_gateway
from tests.test_services import SAMPLE as PROVIDERS
from tests.test_shop import ADDRESS, _product


@pytest.fixture
def people(login, client, db_session):
    farmer, _ = login("9100000010")
    ops, _ = login("9100000011")
    admin, _ = login("9100000012")
    with db_session() as db:
        grant(db, "9100000011", "ops")
        grant(db, "9100000012", "admin")
    return farmer, ops, admin


@pytest.fixture
def paid_order(client, people, db_session):
    farmer, _, _ = people
    app.dependency_overrides[get_payment_gateway] = lambda: FakeGateway()
    with db_session() as db:
        load_products(db, [_product("UREA", stock=5)])
        pid = db.query(Product).one().id
    client.put(f"/api/v1/cart/items/{pid}", headers=farmer, json={"quantity": 2})
    oid = client.post("/api/v1/orders", headers=farmer, json={"address": ADDRESS}).json()["id"]
    client.post(f"/api/v1/orders/{oid}/payment/dev-complete", headers=farmer)
    return oid, pid


def test_roles(client, people):
    farmer, ops, admin = people
    assert client.get("/api/v1/admin/orders", headers=farmer).json()["error"]["code"] == "forbidden"
    assert client.get("/api/v1/admin/orders", headers=ops).status_code == 200
    assert client.get("/api/v1/admin/ai/usage", headers=ops).status_code == 403  # admin only
    assert client.get("/api/v1/admin/ai/usage", headers=admin).status_code == 200


def test_revoked_staff_lose_access(client, people, db_session):
    _, ops, _ = people
    with db_session() as db:
        grant(db, "9100000011", "revoke")
    assert client.get("/api/v1/admin/orders", headers=ops).status_code == 403


def test_order_lifecycle_and_audit(client, people, paid_order, db_session):
    farmer, ops, admin = people
    oid, _ = paid_order
    orders = client.get("/api/v1/admin/orders", headers=ops, params={"status": "paid"}).json()
    assert [(o["id"], o["farmer"]["phone"]) for o in orders] == [(oid, "+919100000010")]

    move = lambda s: client.post(f"/api/v1/admin/orders/{oid}/status", headers=ops, json={"status": s, "note": "x"})
    assert move("delivered").json()["error"]["code"] == "invalid_transition"  # must ship first
    assert move("shipped").json()["status"] == "shipped"
    assert move("delivered").json()["status"] == "delivered"
    assert client.get(f"/api/v1/orders/{oid}", headers=farmer).json()["status"] == "delivered"

    log = client.get("/api/v1/admin/audit", headers=admin).json()
    assert [(e["action"], e["detail"]["old"], e["detail"]["new"]) for e in log] == [
        ("order.status", "shipped", "delivered"),
        ("order.status", "paid", "shipped"),
    ]


def test_refund_releases_stock(client, people, paid_order, db_session):
    _, ops, _ = people
    oid, pid = paid_order
    assert (
        client.post(f"/api/v1/admin/orders/{oid}/status", headers=ops, json={"status": "refund_pending"}).status_code
        == 200
    )
    with db_session() as db:
        assert db.get(Product, pid).stock == 5
    res = client.post(f"/api/v1/admin/orders/{oid}/status", headers=ops, json={"status": "refunded"})
    assert res.json()["status"] == "refunded"


def test_booking_lifecycle(client, people, db_session):
    farmer, ops, _ = people
    with db_session() as db:
        load_providers(db, PROVIDERS)
    provider = client.get("/api/v1/services/providers", headers=farmer, params={"type": "tractor_rental"}).json()[0]
    oid = provider["offerings"][0]["id"]
    day = (date.today() + timedelta(days=2)).isoformat()
    bid = client.post(
        "/api/v1/services/bookings", headers=farmer, json={"offering_id": oid, "date": day, "quantity": 3}
    ).json()["id"]

    assert [b["id"] for b in client.get("/api/v1/admin/bookings", headers=ops, params={"date": day}).json()] == [bid]
    move = lambda s: client.post(f"/api/v1/admin/bookings/{bid}/status", headers=ops, json={"status": s})
    assert move("completed").json()["error"]["code"] == "invalid_transition"
    assert move("confirmed").json()["status"] == "confirmed"
    assert move("completed").json()["status"] == "completed"
    assert client.get(f"/api/v1/services/bookings/{bid}", headers=farmer).json()["status"] == "completed"
    assert client.post(f"/api/v1/services/bookings/{bid}/cancel", headers=farmer).status_code == 409


def test_ai_usage_report(client, people, db_session, monkeypatch):
    _, _, admin = people
    with db_session() as db:
        now = utcnow()
        for feature, model, cost in (("chat", "claude-opus-5-5", "1.50"), ("diagnosis", "claude-opus-5-5", "2.25")):
            db.add(AiUsage(farmer_id=1, feature=feature, model=model, cost_usd=Decimal(cost), created_at=now))
        db.add(
            AiUsage(farmer_id=1, feature="chat", model="x", cost_usd=Decimal("99"), created_at=now - timedelta(days=40))
        )
        db.commit()
    r = client.get("/api/v1/admin/ai/usage", headers=admin).json()
    assert (r["budget_usd"], r["spent_usd"], r["remaining_usd"]) == (50.0, 3.75, 46.25)
    assert r["by_feature"] == {"chat": {"requests": 1, "cost_usd": 1.5}, "diagnosis": {"requests": 1, "cost_usd": 2.25}}
    assert r["top_farmers"] == [{"farmer_id": 1, "requests": 2, "cost_usd": 3.75}]


def test_content_upload(client, people, db_session):
    _, ops, admin = people
    items = [_product("NEW-1"), _product("NEW-2")]
    assert client.post("/api/v1/admin/content/products", headers=ops, json=items).status_code == 403
    res = client.post("/api/v1/admin/content/products", headers=admin, json=items)
    assert res.json() == {"kind": "products", "inserted": 2, "updated": 0}
    bad = client.post("/api/v1/admin/content/products", headers=admin, json=[_product("BAD", price=2, mrp=1)])
    assert bad.status_code == 422 and "price above MRP" in bad.json()["error"]["message"]
    assert client.post("/api/v1/admin/content/rockets", headers=admin, json=[]).status_code == 422
    with db_session() as db:
        assert db.query(AuditLog).filter_by(action="content.load").count() == 1


def test_grant_requires_existing_account(db_session):
    with db_session() as db, pytest.raises(ValueError, match="log in"):
        grant(db, "9555500000", "admin")
