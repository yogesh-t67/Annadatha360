import logging
from datetime import timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import utcnow
from app.models import CartItem, Farmer, Order, OrderItem, Product
from app.services.payments import PaymentGateway

log = logging.getLogger("annadata.shop")

MAX_QTY_PER_ITEM = 100
PENDING = "pending_payment"


def reserve_stock(db: Session, product_id: int, qty: int) -> bool:
    """Atomically take `qty` from stock if (and only if) enough is left. Safe under concurrent checkouts."""
    res = db.execute(
        update(Product)
        .where(Product.id == product_id, Product.active.is_(True), Product.stock >= qty)
        .values(stock=Product.stock - qty)
    )
    return res.rowcount == 1


def release_stock(db: Session, order: Order) -> None:
    for item in order.items:
        if item.product_id is not None:
            db.execute(update(Product).where(Product.id == item.product_id).values(stock=Product.stock + item.quantity))


def cart_items(db: Session, farmer_id: int) -> list[CartItem]:
    return list(db.scalars(select(CartItem).where(CartItem.farmer_id == farmer_id).order_by(CartItem.id)))


def set_cart_quantity(db: Session, farmer: Farmer, product_id: int, quantity: int) -> None:
    item = db.scalar(select(CartItem).where(CartItem.farmer_id == farmer.id, CartItem.product_id == product_id))
    if quantity == 0:
        if item is not None:
            db.delete(item)
        db.commit()
        return
    product = db.get(Product, product_id)
    if product is None or not product.active:
        raise AppError(404, "product_not_found", "Product not found")
    if quantity > product.stock:
        raise AppError(409, "insufficient_stock", f"Only {product.stock} left", {"available": product.stock})
    if item is None:
        db.add(CartItem(farmer_id=farmer.id, product_id=product_id, quantity=quantity))
    else:
        item.quantity = quantity
    db.commit()


def place_order(db: Session, farmer: Farmer, address: dict, gateway: PaymentGateway) -> Order:
    items = cart_items(db, farmer.id)
    if not items:
        raise AppError(422, "cart_empty", "Your cart is empty")

    short = []
    for item in items:
        if not reserve_stock(db, item.product_id, item.quantity):
            short.append({"product_id": item.product_id, "available": item.product.stock if item.product.active else 0})
    if short:
        db.rollback()  # undo the reservations that did succeed
        raise AppError(409, "insufficient_stock", "Some items are out of stock", short)

    order = Order(
        farmer_id=farmer.id,
        status=PENDING,
        total_paise=sum(i.product.price_paise * i.quantity for i in items),
        mrp_total_paise=sum(i.product.mrp_paise * i.quantity for i in items),
        delivery_address=address,
        payment_provider=gateway.name,
        items=[
            OrderItem(
                product_id=i.product_id,
                name=i.product.name,
                pack_size=i.product.pack_size,
                unit_price_paise=i.product.price_paise,
                unit_mrp_paise=i.product.mrp_paise,
                quantity=i.quantity,
            )
            for i in items
        ],
    )
    db.add(order)
    db.flush()
    try:
        order.provider_order_id = gateway.create_order(order.total_paise, receipt=f"annadata-{order.id}")
    except Exception:
        db.rollback()  # no gateway order → no order, and stock goes back
        raise
    for item in items:
        db.delete(item)
    db.commit()
    db.refresh(order)
    return order


def mark_paid(db: Session, order: Order, payment_id: str) -> Order:
    """Idempotent: called by both the app's verify call and the gateway webhook."""
    if order.status == PENDING:
        order.status = "paid"
    elif order.status == "cancelled":
        # Paid after the payment window expired and stock was released. Take it again if we can.
        ok = all(reserve_stock(db, i.product_id, i.quantity) for i in order.items if i.product_id is not None)
        order.status = "paid" if ok else "refund_pending"
        log.warning("Order %s paid after cancellation → %s", order.id, order.status)
    else:
        return order  # already paid / shipped / etc.
    order.provider_payment_id = payment_id
    order.paid_at = utcnow()
    db.commit()
    db.refresh(order)
    return order


def cancel_order(db: Session, order: Order) -> Order:
    if order.status != PENDING:
        raise AppError(409, "order_not_cancellable", "Only unpaid orders can be cancelled here")
    order.status = "cancelled"
    release_stock(db, order)
    db.commit()
    db.refresh(order)
    return order


def expire_unpaid_orders(db: Session) -> int:
    cutoff = utcnow() - timedelta(minutes=get_settings().order_payment_window_minutes)
    expired = list(db.scalars(select(Order).where(Order.status == PENDING, Order.created_at < cutoff)))
    for order in expired:
        order.status = "cancelled"
        release_stock(db, order)
    db.commit()
    return len(expired)
