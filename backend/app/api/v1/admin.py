from datetime import date
from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy import func, select

from app.api.deps import CurrentFarmer, DbSession
from app.api.v1.services import booking_out
from app.api.v1.shop import order_out
from app.core.config import get_settings
from app.core.errors import AppError, not_found
from app.core.security import utcnow
from app.models import AiUsage, AuditLog, Farmer, Order, ServiceBooking, Staff
from app.schemas.admin import (
    AdminBookingOut,
    AdminOrderOut,
    AiUsageOut,
    AuditEntryOut,
    BookingStatusIn,
    ContentLoadOut,
    FarmerRef,
    FeatureUsage,
    OrderStatusIn,
)
from app.services.ai.claude import month_spend, month_start
from app.services.shop import release_stock

router = APIRouter(prefix="/admin", tags=["admin"])

# Allowed status changes by staff. Payment-driven changes (pending → paid) happen in the payment flow.
ORDER_TRANSITIONS = {
    "paid": {"shipped", "refund_pending"},
    "shipped": {"delivered"},
    "refund_pending": {"refunded"},
}
BOOKING_TRANSITIONS = {
    "requested": {"confirmed", "rejected"},
    "confirmed": {"completed", "rejected"},
}


def require_staff(*roles: str):
    def dependency(farmer: CurrentFarmer, db: DbSession) -> Farmer:
        staff = db.scalar(select(Staff).where(Staff.farmer_id == farmer.id, Staff.active.is_(True)))
        if staff is None or staff.role not in roles:
            raise AppError(403, "forbidden", "Staff access required")
        return farmer

    return dependency


AnyStaff = Annotated[Farmer, Depends(require_staff("ops", "admin"))]
AdminOnly = Annotated[Farmer, Depends(require_staff("admin"))]


def _audit(db, staff: Farmer, action: str, target_type: str, target_id: int | None, **detail) -> None:
    db.add(
        AuditLog(staff_farmer_id=staff.id, action=action, target_type=target_type, target_id=target_id, detail=detail)
    )


def _farmer_ref(db, farmer_id: int) -> FarmerRef:
    f = db.get(Farmer, farmer_id)
    return FarmerRef(id=f.id, name=f.name, phone=f.phone)


# ---------- Orders ----------


@router.get("/orders", response_model=list[AdminOrderOut])
def list_orders(
    staff: AnyStaff,
    db: DbSession,
    status: str | None = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
):
    q = select(Order)
    if status:
        q = q.where(Order.status == status)
    rows = db.scalars(q.order_by(Order.id.desc()).limit(limit))
    return [AdminOrderOut(**order_out(o, "en").model_dump(), farmer=_farmer_ref(db, o.farmer_id)) for o in rows]


@router.post("/orders/{order_id}/status", response_model=AdminOrderOut)
def set_order_status(order_id: int, body: OrderStatusIn, staff: AnyStaff, db: DbSession):
    order = db.get(Order, order_id)
    if order is None:
        raise not_found("order")
    if body.status not in ORDER_TRANSITIONS.get(order.status, set()):
        raise AppError(409, "invalid_transition", f"Can't move an order from {order.status} to {body.status}")
    if order.status == "paid" and body.status == "refund_pending":
        release_stock(db, order)  # goods won't ship; make them sellable again
    _audit(db, staff, "order.status", "order", order.id, old=order.status, new=body.status, note=body.note)
    order.status = body.status
    db.commit()
    db.refresh(order)
    return AdminOrderOut(**order_out(order, "en").model_dump(), farmer=_farmer_ref(db, order.farmer_id))


# ---------- Service bookings ----------


@router.get("/bookings", response_model=list[AdminBookingOut])
def list_bookings(
    staff: AnyStaff,
    db: DbSession,
    status: str | None = None,
    on: Annotated[date | None, Query(alias="date")] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
):
    q = select(ServiceBooking)
    if status:
        q = q.where(ServiceBooking.status == status)
    if on:
        q = q.where(ServiceBooking.date == on)
    rows = db.scalars(q.order_by(ServiceBooking.date, ServiceBooking.id).limit(limit))
    return [AdminBookingOut(**booking_out(b, "en").model_dump(), farmer=_farmer_ref(db, b.farmer_id)) for b in rows]


@router.post("/bookings/{booking_id}/status", response_model=AdminBookingOut)
def set_booking_status(booking_id: int, body: BookingStatusIn, staff: AnyStaff, db: DbSession):
    b = db.get(ServiceBooking, booking_id)
    if b is None:
        raise not_found("booking")
    if body.status not in BOOKING_TRANSITIONS.get(b.status, set()):
        raise AppError(409, "invalid_transition", f"Can't move a booking from {b.status} to {body.status}")
    _audit(db, staff, "booking.status", "booking", b.id, old=b.status, new=body.status, note=body.note)
    b.status = body.status
    db.commit()
    db.refresh(b)
    return AdminBookingOut(**booking_out(b, "en").model_dump(), farmer=_farmer_ref(db, b.farmer_id))


# ---------- AI spend ----------


@router.get("/ai/usage", response_model=AiUsageOut)
def ai_usage(staff: AdminOnly, db: DbSession):
    now = utcnow()
    start = month_start(now)
    spent = month_spend(db, now)
    budget = Decimal(str(get_settings().ai_monthly_budget_usd))

    def grouped(column) -> dict[str, FeatureUsage]:
        rows = db.execute(
            select(column, func.count(), func.coalesce(func.sum(AiUsage.cost_usd), 0))
            .where(AiUsage.created_at >= start)
            .group_by(column)
        )
        return {key: FeatureUsage(requests=n, cost_usd=float(cost)) for key, n, cost in rows}

    top = db.execute(
        select(AiUsage.farmer_id, func.count(), func.sum(AiUsage.cost_usd))
        .where(AiUsage.created_at >= start, AiUsage.farmer_id.is_not(None))
        .group_by(AiUsage.farmer_id)
        .order_by(func.sum(AiUsage.cost_usd).desc())
        .limit(10)
    )
    return AiUsageOut(
        month_start=start,
        budget_usd=float(budget),
        spent_usd=float(spent),
        remaining_usd=float(max(budget - spent, Decimal(0))),
        by_feature=grouped(AiUsage.feature),
        by_model=grouped(AiUsage.model),
        top_farmers=[{"farmer_id": fid, "requests": n, "cost_usd": float(cost)} for fid, n, cost in top],
    )


# ---------- Content ----------


ContentKind = Literal["products", "schemes", "providers", "advisories"]


@router.post("/content/{kind}", response_model=ContentLoadOut)
def load_content(kind: ContentKind, staff: AdminOnly, db: DbSession, items: list[dict] = Body(...)):
    """Same as the `python -m app.jobs.load_*` commands: upsert a JSON array of items."""
    from app.jobs import load_advisories, load_products, load_providers, load_schemes

    loader = {
        "products": load_products.load,
        "schemes": load_schemes.load,
        "providers": load_providers.load,
        "advisories": load_advisories.load,
    }[kind]
    try:
        inserted, updated = loader(db, items)
    except (ValueError, TypeError, KeyError) as exc:
        db.rollback()
        raise AppError(422, "invalid_content", str(exc)) from exc
    _audit(db, staff, "content.load", kind, None, inserted=inserted, updated=updated)
    db.commit()
    return ContentLoadOut(kind=kind, inserted=inserted, updated=updated)


@router.get("/audit", response_model=list[AuditEntryOut])
def audit_log(staff: AdminOnly, db: DbSession, limit: Annotated[int, Query(ge=1, le=500)] = 100):
    return db.scalars(select(AuditLog).order_by(AuditLog.id.desc()).limit(limit)).all()
