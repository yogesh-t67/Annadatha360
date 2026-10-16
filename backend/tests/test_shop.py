import hashlib
import hmac
import json
from datetime import timedelta

import httpx
import pytest

from app.core.security import utcnow
from app.jobs.load_products import load
from app.main import app
from app.models import Order, Product
from app.services.payments import FakeGateway, RazorpayGateway, get_payment_gateway
from app.services.shop import expire_unpaid_orders

ADDRESS = {
    "name": "Ramesh",
    "phone": "9876543210",
    "line1": "H.No 4-12, Main road",
    "village": "Kolakaluru",
    "mandal": "Tenali",
    "district": "Guntur",
    "state": "AP",
    "pincode": "522301",
}


def _product(sku, category="fertilizers", price=50000, mrp=50000, stock=10, **kw):
    return {
        "sku": sku,
        "category_code": category,
        "name": {"en": f"Product {sku}", "te": f"ఉత్పత్తి {sku}"},
        "pack_size": "1 unit",
        "price_paise": price,
        "mrp_paise": mrp,
        "stock": stock,
        **kw,
    }


@pytest.fixture
def catalogue(db_session):
    with db_session() as db:
        load(
            db,
            [
                _product("UREA", price=26650, mrp=26650, stock=5),
                _product("NEEM", category="pesticides", price=42000, mrp=52000, stock=3, brand="GreenLeaf"),
                _product("SEED", category="seeds", price=85000, mrp=95000, crop_codes=["paddy"]),
                _product("OLD", active=False),
            ],
        )
        return {p.sku: p.id for p in db.query(Product).all()}


@pytest.fixture
def gateway():
    g = FakeGateway()
    app.dependency_overrides[get_payment_gateway] = lambda: g
    return g


@pytest.fixture
def shopper(login, client):
    headers, _ = login()
    client.patch("/api/v1/farmers/me", headers=headers, json={"preferred_language": "te"})
    return headers


def _stock(db_session, pid):
    with db_session() as db:
        return db.get(Product, pid).stock


def test_catalogue_filters_and_localisation(client, shopper, catalogue):
    names = lambda res: sorted(p["sku"] for p in res.json())
    assert names(client.get("/api/v1/shop/products", headers=shopper)) == ["NEEM", "SEED", "UREA"]  # inactive hidden
    assert names(client.get("/api/v1/shop/products", headers=shopper, params={"category": "seeds"})) == ["SEED"]
    assert names(client.get("/api/v1/shop/products", headers=shopper, params={"crop": "cotton"})) == ["NEEM", "UREA"]
    assert names(client.get("/api/v1/shop/products", headers=shopper, params={"q": "greenleaf"})) == ["NEEM"]
    deals = client.get("/api/v1/shop/products", headers=shopper, params={"deals": True}).json()
    assert [(p["sku"], p["discount_pct"]) for p in deals] == [("NEEM", 19), ("SEED", 11)]

    neem = client.get(f"/api/v1/shop/products/{catalogue['NEEM']}", headers=shopper).json()
    assert (neem["name"], neem["price"], neem["mrp"], neem["category"]["name"]) == (
        "ఉత్పత్తి NEEM",
        420.0,
        520.0,
        "పురుగుమందులు",
    )
    assert client.get(f"/api/v1/shop/products/{catalogue['OLD']}", headers=shopper).status_code == 404
    cats = client.get("/api/v1/shop/categories", headers=shopper).json()
    assert [c["code"] for c in cats] == ["seeds", "fertilizers", "pesticides", "equipment"]


def test_cart(client, shopper, catalogue):
    res = client.put(f"/api/v1/cart/items/{catalogue['NEEM']}", headers=shopper, json={"quantity": 2})
    assert res.status_code == 200
    client.put(f"/api/v1/cart/items/{catalogue['UREA']}", headers=shopper, json={"quantity": 1})
    cart = client.get("/api/v1/cart", headers=shopper).json()
    assert (cart["item_count"], cart["total"], cart["mrp_total"], cart["savings"]) == (3, 1106.5, 1306.5, 200.0)

    res = client.put(f"/api/v1/cart/items/{catalogue['NEEM']}", headers=shopper, json={"quantity": 4})
    assert res.status_code == 409 and res.json()["error"]["details"] == {"available": 3}
    assert (
        client.put(f"/api/v1/cart/items/{catalogue['OLD']}", headers=shopper, json={"quantity": 1}).status_code == 404
    )
    cart = client.delete(f"/api/v1/cart/items/{catalogue['UREA']}", headers=shopper).json()
    assert [i["product"]["sku"] for i in cart["items"]] == ["NEEM"]


def test_checkout_reserves_stock_and_payment_verifies(client, shopper, catalogue, gateway, db_session):
    client.put(f"/api/v1/cart/items/{catalogue['NEEM']}", headers=shopper, json={"quantity": 2})
    res = client.post("/api/v1/orders", headers=shopper, json={"address": ADDRESS})
    assert res.status_code == 201, res.text
    order = res.json()
    assert order["status"] == "pending_payment" and order["total"] == 840.0 and order["savings"] == 200.0
    assert order["payment"]["amount_paise"] == 84000 and order["payment"]["provider_order_id"].startswith("order_fake_")
    assert order["delivery_address"]["phone"] == "+919876543210"
    assert _stock(db_session, catalogue["NEEM"]) == 1
    assert client.get("/api/v1/cart", headers=shopper).json()["items"] == []

    oid, rzp = order["id"], order["payment"]["provider_order_id"]
    bad = {"razorpay_order_id": rzp, "razorpay_payment_id": "pay_1", "razorpay_signature": "nope"}
    assert (
        client.post(f"/api/v1/orders/{oid}/payment/verify", headers=shopper, json=bad).json()["error"]["code"]
        == "payment_verification_failed"
    )

    good = {**bad, "razorpay_signature": gateway.sign(rzp, "pay_1")}
    paid = client.post(f"/api/v1/orders/{oid}/payment/verify", headers=shopper, json=good).json()
    assert paid["status"] == "paid" and paid["payment"] is None and paid["paid_at"]
    # Idempotent, and paid orders can't be cancelled.
    assert client.post(f"/api/v1/orders/{oid}/payment/verify", headers=shopper, json=good).json()["status"] == "paid"
    assert (
        client.post(f"/api/v1/orders/{oid}/cancel", headers=shopper).json()["error"]["code"] == "order_not_cancellable"
    )
    assert _stock(db_session, catalogue["NEEM"]) == 1


def test_signature_from_another_order_is_rejected(client, shopper, catalogue, gateway):
    client.put(f"/api/v1/cart/items/{catalogue['UREA']}", headers=shopper, json={"quantity": 1})
    a = client.post("/api/v1/orders", headers=shopper, json={"address": ADDRESS}).json()
    client.put(f"/api/v1/cart/items/{catalogue['UREA']}", headers=shopper, json={"quantity": 1})
    b = client.post("/api/v1/orders", headers=shopper, json={"address": ADDRESS}).json()
    rzp_a = a["payment"]["provider_order_id"]
    body = {
        "razorpay_order_id": rzp_a,
        "razorpay_payment_id": "pay_1",
        "razorpay_signature": gateway.sign(rzp_a, "pay_1"),
    }
    res = client.post(f"/api/v1/orders/{b['id']}/payment/verify", headers=shopper, json=body)
    assert res.json()["error"]["code"] == "payment_verification_failed"


def test_cancel_and_expiry_release_stock(client, shopper, catalogue, gateway, db_session):
    client.put(f"/api/v1/cart/items/{catalogue['UREA']}", headers=shopper, json={"quantity": 2})
    oid = client.post("/api/v1/orders", headers=shopper, json={"address": ADDRESS}).json()["id"]
    assert _stock(db_session, catalogue["UREA"]) == 3
    assert client.post(f"/api/v1/orders/{oid}/cancel", headers=shopper).json()["status"] == "cancelled"
    assert _stock(db_session, catalogue["UREA"]) == 5

    client.put(f"/api/v1/cart/items/{catalogue['UREA']}", headers=shopper, json={"quantity": 2})
    oid = client.post("/api/v1/orders", headers=shopper, json={"address": ADDRESS}).json()["id"]
    with db_session() as db:
        db.get(Order, oid).created_at = utcnow() - timedelta(minutes=31)
        db.commit()
        assert expire_unpaid_orders(db) == 1
    assert _stock(db_session, catalogue["UREA"]) == 5
    assert client.get(f"/api/v1/orders/{oid}", headers=shopper).json()["status"] == "cancelled"


def test_stock_race_never_oversells(client, catalogue, gateway, login, db_session):
    a, _ = login("9100000001")
    b, _ = login("9100000002")
    for h in (a, b):  # both carts hold 2 of the last 3
        client.put(f"/api/v1/cart/items/{catalogue['NEEM']}", headers=h, json={"quantity": 2})
    assert client.post("/api/v1/orders", headers=a, json={"address": ADDRESS}).status_code == 201
    res = client.post("/api/v1/orders", headers=b, json={"address": ADDRESS})
    assert res.status_code == 409 and res.json()["error"]["details"] == [
        {"product_id": catalogue["NEEM"], "available": 1}
    ]
    assert _stock(db_session, catalogue["NEEM"]) == 1
    assert len(client.get("/api/v1/cart", headers=b).json()["items"]) == 1  # B's cart kept so they can adjust


def test_gateway_failure_leaves_no_order(client, shopper, catalogue, db_session):
    class Down(FakeGateway):
        def create_order(self, amount_paise, receipt):
            from app.core.errors import AppError

            raise AppError(503, "payment_unavailable", "down")

    app.dependency_overrides[get_payment_gateway] = lambda: Down()
    client.put(f"/api/v1/cart/items/{catalogue['UREA']}", headers=shopper, json={"quantity": 1})
    res = client.post("/api/v1/orders", headers=shopper, json={"address": ADDRESS})
    assert res.status_code == 503 and res.json()["error"]["code"] == "payment_unavailable"
    assert _stock(db_session, catalogue["UREA"]) == 5
    with db_session() as db:
        assert db.query(Order).count() == 0
    assert len(client.get("/api/v1/cart", headers=shopper).json()["items"]) == 1


def test_order_validation(client, shopper, catalogue, gateway, login):
    assert (
        client.post("/api/v1/orders", headers=shopper, json={"address": ADDRESS}).json()["error"]["code"]
        == "cart_empty"
    )
    res = client.post("/api/v1/orders", headers=shopper, json={"address": {**ADDRESS, "pincode": "012345"}})
    assert res.json()["error"]["code"] == "validation_error"
    other, _ = login("9666666666")
    client.put(f"/api/v1/cart/items/{catalogue['UREA']}", headers=shopper, json={"quantity": 1})
    oid = client.post("/api/v1/orders", headers=shopper, json={"address": ADDRESS}).json()["id"]
    assert client.get(f"/api/v1/orders/{oid}", headers=other).json()["error"]["code"] == "order_not_found"
    assert client.get("/api/v1/orders", headers=other).json() == []


def _webhook(client, gateway, payload, signature=None):
    body = json.dumps(payload).encode()
    sig = signature or hmac.new(gateway.webhook_secret.encode(), body, hashlib.sha256).hexdigest()
    return client.post("/api/v1/payments/razorpay/webhook", content=body, headers={"X-Razorpay-Signature": sig})


def test_webhook_marks_paid_and_checks_amount(client, shopper, catalogue, gateway):
    client.put(f"/api/v1/cart/items/{catalogue['UREA']}", headers=shopper, json={"quantity": 1})
    order = client.post("/api/v1/orders", headers=shopper, json={"address": ADDRESS}).json()
    rzp = order["payment"]["provider_order_id"]
    event = lambda amount: {
        "event": "payment.captured",
        "payload": {"payment": {"entity": {"id": "pay_9", "order_id": rzp, "amount": amount}}},
    }

    assert _webhook(client, gateway, event(26650), signature="forged").status_code == 400
    assert _webhook(client, gateway, event(100)).status_code == 200  # wrong amount: ignored
    assert client.get(f"/api/v1/orders/{order['id']}", headers=shopper).json()["status"] == "pending_payment"
    assert _webhook(client, gateway, event(26650)).status_code == 200
    assert client.get(f"/api/v1/orders/{order['id']}", headers=shopper).json()["status"] == "paid"
    assert _webhook(client, gateway, {"event": "refund.created", "payload": {}}).status_code == 200


def test_payment_after_expiry_retakes_stock_or_flags_refund(client, shopper, catalogue, gateway, db_session):
    client.put(f"/api/v1/cart/items/{catalogue['NEEM']}", headers=shopper, json={"quantity": 3})
    order = client.post("/api/v1/orders", headers=shopper, json={"address": ADDRESS}).json()
    client.post(f"/api/v1/orders/{order['id']}/cancel", headers=shopper)
    with db_session() as db:  # someone else bought the stock meanwhile
        db.get(Product, catalogue["NEEM"]).stock = 1
        db.commit()
    rzp = order["payment"]["provider_order_id"]
    body = {
        "razorpay_order_id": rzp,
        "razorpay_payment_id": "pay_late",
        "razorpay_signature": gateway.sign(rzp, "pay_late"),
    }
    res = client.post(f"/api/v1/orders/{order['id']}/payment/verify", headers=shopper, json=body)
    assert res.json()["status"] == "refund_pending"


def test_dev_complete_only_with_fake_gateway(client, shopper, catalogue, gateway, monkeypatch):
    from app.core.config import get_settings

    client.put(f"/api/v1/cart/items/{catalogue['UREA']}", headers=shopper, json={"quantity": 1})
    oid = client.post("/api/v1/orders", headers=shopper, json={"address": ADDRESS}).json()["id"]
    monkeypatch.setattr(get_settings(), "payment_provider", "razorpay")
    assert client.post(f"/api/v1/orders/{oid}/payment/dev-complete", headers=shopper).status_code == 404
    monkeypatch.setattr(get_settings(), "payment_provider", "fake")
    assert client.post(f"/api/v1/orders/{oid}/payment/dev-complete", headers=shopper).json()["status"] == "paid"


def test_razorpay_adapter_request_and_signatures():
    seen = {}

    def handler(request):
        seen["auth"] = request.headers["authorization"]
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"id": "order_ABC", "amount": 84000})

    g = RazorpayGateway("rzp_test_k", "secret", "whsec", http=httpx.Client(transport=httpx.MockTransport(handler)))
    assert g.create_order(84000, "annadata-1") == "order_ABC"
    assert seen["body"] == {"amount": 84000, "currency": "INR", "receipt": "annadata-1"}
    assert seen["auth"].startswith("Basic ")
    sig = hmac.new(b"secret", b"order_ABC|pay_1", hashlib.sha256).hexdigest()
    assert g.verify_payment("order_ABC", "pay_1", sig) and not g.verify_payment("order_ABC", "pay_2", sig)


def test_loader_validates(db_session):
    with db_session() as db:
        with pytest.raises(ValueError, match="price above MRP"):
            load(db, [_product("X", price=2, mrp=1)])
        with pytest.raises(ValueError, match="unknown category"):
            load(db, [_product("X", category="toys")])
        assert load(db, [_product("X")]) == (1, 0)
        assert load(db, [_product("X", stock=99)]) == (0, 1)
