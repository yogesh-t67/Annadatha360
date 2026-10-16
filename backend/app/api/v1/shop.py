import json
import logging
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query, Request
from sqlalchemy import select

from app.api.deps import CurrentFarmer, DbSession
from app.core.config import get_settings
from app.core.errors import AppError, not_found
from app.core.i18n import resolve
from app.models import Order, Product, ProductCategory
from app.schemas.shop import (
    CartLineOut,
    CartOut,
    CartQuantityIn,
    CategoryOut,
    OrderLineOut,
    OrderOut,
    PaymentInfo,
    PlaceOrderIn,
    ProductOut,
    VerifyPaymentIn,
)
from app.services import shop
from app.services.payments import FakeGateway, PaymentGateway, get_payment_gateway

log = logging.getLogger("annadata.shop")
router = APIRouter(tags=["agri-mart"])

Gateway = Annotated[PaymentGateway, Depends(get_payment_gateway)]


def _rupees(paise: int) -> float:
    return paise / 100


def _category_out(db, code: str, lang: str) -> CategoryOut:
    cat = db.get(ProductCategory, code)
    return CategoryOut(code=code, name=resolve(cat.name, lang) if cat else code)


def _product_out(db, p: Product, lang: str) -> ProductOut:
    discount = round((p.mrp_paise - p.price_paise) * 100 / p.mrp_paise) if p.mrp_paise > p.price_paise else 0
    return ProductOut(
        id=p.id,
        sku=p.sku,
        category=_category_out(db, p.category_code, lang),
        name=resolve(p.name, lang),
        description=resolve(p.description, lang),
        brand=p.brand,
        pack_size=p.pack_size,
        price=_rupees(p.price_paise),
        mrp=_rupees(p.mrp_paise),
        discount_pct=discount,
        in_stock=p.stock > 0,
        stock=p.stock,
        image_urls=p.image_urls or [],
        crop_codes=p.crop_codes or [],
    )


def order_out(o: Order, lang: str) -> OrderOut:
    pending = o.status == shop.PENDING
    gateway_key = get_settings().razorpay_key_id if o.payment_provider == "razorpay" else FakeGateway.KEY_ID
    return OrderOut(
        id=o.id,
        status=o.status,
        payment_method="cod" if o.payment_provider == "cod" else "online",
        items=[
            OrderLineOut(
                product_id=i.product_id,
                name=resolve(i.name, lang),
                pack_size=i.pack_size,
                unit_price=_rupees(i.unit_price_paise),
                quantity=i.quantity,
                line_total=_rupees(i.unit_price_paise * i.quantity),
            )
            for i in o.items
        ],
        total=_rupees(o.total_paise),
        mrp_total=_rupees(o.mrp_total_paise),
        savings=_rupees(o.mrp_total_paise - o.total_paise),
        delivery_address=o.delivery_address,
        payment=PaymentInfo(
            provider=o.payment_provider,
            key_id=gateway_key,
            provider_order_id=o.provider_order_id,
            amount_paise=o.total_paise,
        )
        if pending
        else None,
        pay_by=o.created_at + timedelta(minutes=get_settings().order_payment_window_minutes) if pending else None,
        paid_at=o.paid_at,
        created_at=o.created_at,
    )


def _owned_order(db, farmer, order_id: int) -> Order:
    order = db.get(Order, order_id)
    if order is None or order.farmer_id != farmer.id:
        raise not_found("order")
    return order


# ---------- Catalogue ----------


@router.get("/shop/categories", response_model=list[CategoryOut])
def categories(farmer: CurrentFarmer, db: DbSession):
    cats = db.scalars(select(ProductCategory).order_by(ProductCategory.sort_order))
    return [CategoryOut(code=c.code, name=resolve(c.name, farmer.preferred_language)) for c in cats]


@router.get("/shop/products", response_model=list[ProductOut])
def products(
    farmer: CurrentFarmer,
    db: DbSession,
    category: str | None = None,
    crop: str | None = None,
    q: Annotated[str | None, Query(max_length=80)] = None,
    deals: bool = False,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    query = select(Product).where(Product.active.is_(True))
    if category:
        query = query.where(Product.category_code == category)
    if deals:
        query = query.where(Product.mrp_paise > Product.price_paise)
    rows = list(db.scalars(query.order_by(Product.id)))

    # Filters on JSON columns are done in Python: portable across DBs, and the catalogue is small.
    if crop:
        rows = [p for p in rows if not p.crop_codes or crop in p.crop_codes]
    if q:
        needle = q.strip().lower()
        rows = [
            p
            for p in rows
            if any(needle in v.lower() for v in (p.name or {}).values()) or needle in (p.brand or "").lower()
        ]
    lang = farmer.preferred_language
    out = [_product_out(db, p, lang) for p in rows]
    if deals:
        out.sort(key=lambda p: -p.discount_pct)
    return out[offset : offset + limit]


@router.get("/shop/products/{product_id}", response_model=ProductOut)
def product(product_id: int, farmer: CurrentFarmer, db: DbSession):
    p = db.get(Product, product_id)
    if p is None or not p.active:
        raise not_found("product")
    return _product_out(db, p, farmer.preferred_language)


# ---------- Cart ----------


def _cart_out(db, farmer) -> CartOut:
    lang = farmer.preferred_language
    lines = []
    for item in shop.cart_items(db, farmer.id):
        p = item.product
        lines.append(
            CartLineOut(
                product=_product_out(db, p, lang),
                quantity=item.quantity,
                line_total=_rupees(p.price_paise * item.quantity),
                available=p.active and p.stock >= item.quantity,
            )
        )
    total = sum(i.product.price * i.quantity for i in lines)
    mrp_total = sum(i.product.mrp * i.quantity for i in lines)
    return CartOut(
        items=lines,
        item_count=sum(i.quantity for i in lines),
        total=round(total, 2),
        mrp_total=round(mrp_total, 2),
        savings=round(mrp_total - total, 2),
    )


@router.get("/cart", response_model=CartOut)
def get_cart(farmer: CurrentFarmer, db: DbSession):
    return _cart_out(db, farmer)


@router.put("/cart/items/{product_id}", response_model=CartOut)
def set_cart_item(product_id: int, body: CartQuantityIn, farmer: CurrentFarmer, db: DbSession):
    shop.set_cart_quantity(db, farmer, product_id, body.quantity)
    return _cart_out(db, farmer)


@router.delete("/cart/items/{product_id}", response_model=CartOut)
def remove_cart_item(product_id: int, farmer: CurrentFarmer, db: DbSession):
    shop.set_cart_quantity(db, farmer, product_id, 0)
    return _cart_out(db, farmer)


# ---------- Orders & payment ----------


@router.post("/orders", response_model=OrderOut, status_code=201)
def place_order(body: PlaceOrderIn, farmer: CurrentFarmer, db: DbSession, gateway: Gateway):
    order = shop.place_order(db, farmer, body.address.model_dump(), gateway, body.payment_method)
    return order_out(order, farmer.preferred_language)


@router.get("/orders", response_model=list[OrderOut])
def list_orders(farmer: CurrentFarmer, db: DbSession):
    orders = db.scalars(select(Order).where(Order.farmer_id == farmer.id).order_by(Order.id.desc()))
    return [order_out(o, farmer.preferred_language) for o in orders]


@router.get("/orders/{order_id}", response_model=OrderOut)
def get_order(order_id: int, farmer: CurrentFarmer, db: DbSession):
    return order_out(_owned_order(db, farmer, order_id), farmer.preferred_language)


@router.post("/orders/{order_id}/cancel", response_model=OrderOut)
def cancel_order(order_id: int, farmer: CurrentFarmer, db: DbSession):
    return order_out(shop.cancel_order(db, _owned_order(db, farmer, order_id)), farmer.preferred_language)


@router.post("/orders/{order_id}/payment/verify", response_model=OrderOut)
def verify_payment(order_id: int, body: VerifyPaymentIn, farmer: CurrentFarmer, db: DbSession, gateway: Gateway):
    """Called by the app right after Razorpay Checkout succeeds. The webhook is the backstop if the app dies."""
    order = _owned_order(db, farmer, order_id)
    if body.razorpay_order_id != order.provider_order_id or not gateway.verify_payment(
        order.provider_order_id, body.razorpay_payment_id, body.razorpay_signature
    ):
        raise AppError(400, "payment_verification_failed", "Payment could not be verified")
    return order_out(shop.mark_paid(db, order, body.razorpay_payment_id), farmer.preferred_language)


@router.post("/orders/{order_id}/payment/dev-complete", response_model=OrderOut, include_in_schema=False)
def dev_complete_payment(order_id: int, farmer: CurrentFarmer, db: DbSession):
    """Dev only (PAYMENT_PROVIDER=fake): pretend the farmer paid, so the app can test the full flow."""
    if get_settings().payment_provider != "fake":
        raise not_found("route")
    return order_out(shop.mark_paid(db, _owned_order(db, farmer, order_id), "pay_fake_dev"), farmer.preferred_language)


@router.post("/payments/razorpay/webhook", include_in_schema=False)
async def razorpay_webhook(
    request: Request,
    db: DbSession,
    gateway: Gateway,
    x_razorpay_signature: Annotated[str, Header()] = "",
):
    body = await request.body()
    if not gateway.verify_webhook(body, x_razorpay_signature):
        raise AppError(400, "invalid_signature", "Invalid webhook signature")
    event = json.loads(body)
    if event.get("event") in ("payment.captured", "order.paid"):
        payment = (event.get("payload", {}).get("payment") or {}).get("entity") or {}
        order = db.scalar(select(Order).where(Order.provider_order_id == payment.get("order_id")))
        if order is None:
            log.warning("Webhook for unknown order %s", payment.get("order_id"))
        elif payment.get("amount") != order.total_paise:
            log.error("Webhook amount %s != order %s total %s", payment.get("amount"), order.id, order.total_paise)
        else:
            shop.mark_paid(db, order, payment.get("id", ""))
    return {"ok": True}
