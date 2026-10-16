from datetime import date, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Query, status
from sqlalchemy import func, select

from app.api.deps import CurrentFarmer, DbSession
from app.core.errors import AppError, not_found
from app.core.i18n import resolve
from app.models import Field, LabourRequirement, ServiceBooking, ServiceOffering, ServiceProvider
from app.models.services import SERVICE_TYPES
from app.schemas.services import (
    AvailabilityOut,
    BookingIn,
    BookingOut,
    DayAvailability,
    OfferingOut,
    ProviderOut,
    RequirementCloseIn,
    RequirementIn,
    RequirementOut,
    ServiceTypeOut,
)

router = APIRouter(tags=["services"])

ACTIVE_BOOKING = ("requested", "confirmed")
MAX_DAYS_AHEAD = 60


def _provider_out(p: ServiceProvider, lang: str, service_type: str | None = None) -> ProviderOut:
    offerings = [o for o in p.offerings if o.active and (service_type is None or o.service_type == service_type)]
    return ProviderOut(
        id=p.id,
        kind=p.kind,
        name=p.name,
        phone=p.phone,
        description=resolve(p.description, lang),
        state=p.state,
        district=p.district,
        mandal=p.mandal,
        rating=float(p.rating) if p.rating is not None else None,
        rating_count=p.rating_count,
        verified=p.verified,
        offerings=[
            OfferingOut(
                id=o.id,
                service_type=o.service_type,
                rate=o.rate_paise / 100,
                unit=o.unit,
                daily_capacity=o.daily_capacity,
            )
            for o in offerings
        ],
    )


def _booked(db, offering_id: int, day: date) -> int:
    return db.scalar(
        select(func.coalesce(func.sum(ServiceBooking.quantity), 0)).where(
            ServiceBooking.offering_id == offering_id,
            ServiceBooking.date == day,
            ServiceBooking.status.in_(ACTIVE_BOOKING),
        )
    )


def _active_offering(db, offering_id: int, lock: bool = False) -> ServiceOffering:
    q = select(ServiceOffering).where(ServiceOffering.id == offering_id)
    if lock:
        q = q.with_for_update()  # serialises concurrent bookings of this offering (Postgres)
    o = db.scalar(q)
    if o is None or not o.active or not o.provider.active:
        raise not_found("offering")
    return o


# ---------- Providers & availability ----------


@router.get("/services/types", response_model=list[ServiceTypeOut])
def service_types(farmer: CurrentFarmer):
    return [ServiceTypeOut(code=code, kind=kind, unit=unit) for code, (kind, unit) in SERVICE_TYPES.items()]


@router.get("/services/providers", response_model=list[ProviderOut])
def providers(
    farmer: CurrentFarmer,
    db: DbSession,
    kind: Literal["labour", "farm_service"] | None = None,
    type: str | None = None,
    district: Annotated[str | None, Query(max_length=80)] = None,
):
    if type is not None and type not in SERVICE_TYPES:
        raise AppError(422, "unknown_service_type", f"Unknown service type: {type}")
    q = select(ServiceProvider).where(ServiceProvider.active.is_(True))
    if kind:
        q = q.where(ServiceProvider.kind == kind)
    if district:
        q = q.where(func.lower(ServiceProvider.district) == district.strip().lower())
    lang = farmer.preferred_language
    out = [_provider_out(p, lang, type) for p in db.scalars(q)]
    out = [p for p in out if p.offerings]
    home = (farmer.district or "").lower()
    out.sort(key=lambda p: (p.district.lower() != home, not p.verified, -(p.rating or 0), p.name))
    return out


@router.get("/services/providers/{provider_id}", response_model=ProviderOut)
def provider(provider_id: int, farmer: CurrentFarmer, db: DbSession):
    p = db.get(ServiceProvider, provider_id)
    if p is None or not p.active:
        raise not_found("provider")
    return _provider_out(p, farmer.preferred_language)


@router.get("/services/offerings/{offering_id}/availability", response_model=AvailabilityOut)
def availability(
    offering_id: int,
    farmer: CurrentFarmer,
    db: DbSession,
    start: Annotated[date | None, Query(alias="from")] = None,
    days: Annotated[int, Query(ge=1, le=31)] = 14,
):
    o = _active_offering(db, offering_id)
    start = max(start or date.today(), date.today())
    return AvailabilityOut(
        offering_id=o.id,
        unit=o.unit,
        days=[
            DayAvailability(date=d, remaining=max(0, o.daily_capacity - _booked(db, o.id, d)))
            for d in (start + timedelta(days=i) for i in range(days))
        ],
    )


# ---------- Bookings ----------


def _booking_out(b: ServiceBooking, lang: str) -> BookingOut:
    o = b.offering
    return BookingOut(
        id=b.id,
        status=b.status,
        date=b.date,
        quantity=b.quantity,
        unit=o.unit,
        rate=b.rate_paise / 100,
        estimated_total=b.rate_paise * b.quantity / 100,
        service_type=o.service_type,
        provider=_provider_out(o.provider, lang),
        field_id=b.field_id,
        notes=b.notes,
        created_at=b.created_at,
    )


def _owned_booking(db, farmer, booking_id: int) -> ServiceBooking:
    b = db.get(ServiceBooking, booking_id)
    if b is None or b.farmer_id != farmer.id:
        raise not_found("booking")
    return b


@router.post("/services/bookings", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(body: BookingIn, farmer: CurrentFarmer, db: DbSession):
    today = date.today()
    if not today <= body.date <= today + timedelta(days=MAX_DAYS_AHEAD):
        raise AppError(422, "invalid_date", f"Pick a date between today and {MAX_DAYS_AHEAD} days ahead")
    if body.field_id is not None:
        field = db.get(Field, body.field_id)
        if field is None or field.farmer_id != farmer.id:
            raise not_found("field")
    o = _active_offering(db, body.offering_id, lock=True)
    remaining = o.daily_capacity - _booked(db, o.id, body.date)
    if body.quantity > remaining:
        db.rollback()
        raise AppError(
            409, "slot_unavailable", "Not enough availability on that date", {"remaining": max(0, remaining)}
        )
    booking = ServiceBooking(
        farmer_id=farmer.id,
        offering_id=o.id,
        field_id=body.field_id,
        date=body.date,
        quantity=body.quantity,
        rate_paise=o.rate_paise,
        status="requested",
        notes=body.notes,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return _booking_out(booking, farmer.preferred_language)


@router.get("/services/bookings", response_model=list[BookingOut])
def list_bookings(farmer: CurrentFarmer, db: DbSession):
    rows = db.scalars(
        select(ServiceBooking)
        .where(ServiceBooking.farmer_id == farmer.id)
        .order_by(ServiceBooking.date.desc(), ServiceBooking.id.desc())
    )
    return [_booking_out(b, farmer.preferred_language) for b in rows]


@router.get("/services/bookings/{booking_id}", response_model=BookingOut)
def get_booking(booking_id: int, farmer: CurrentFarmer, db: DbSession):
    return _booking_out(_owned_booking(db, farmer, booking_id), farmer.preferred_language)


@router.post("/services/bookings/{booking_id}/cancel", response_model=BookingOut)
def cancel_booking(booking_id: int, farmer: CurrentFarmer, db: DbSession):
    b = _owned_booking(db, farmer, booking_id)
    if b.status not in ACTIVE_BOOKING or b.date < date.today():
        raise AppError(409, "booking_not_cancellable", "This booking can't be cancelled")
    b.status = "cancelled"
    db.commit()
    db.refresh(b)
    return _booking_out(b, farmer.preferred_language)


# ---------- Labour requirements ----------


def _req_out(r: LabourRequirement, farmer_id: int) -> RequirementOut:
    return RequirementOut(
        id=r.id,
        work_type=r.work_type,
        workers_needed=r.workers_needed,
        start_date=r.start_date,
        days=r.days,
        wage_per_day=r.wage_per_day_paise / 100 if r.wage_per_day_paise is not None else None,
        state=r.state,
        district=r.district,
        mandal=r.mandal,
        village=r.village,
        contact_phone=r.contact_phone,
        description=r.description,
        status=r.status,
        is_mine=r.farmer_id == farmer_id,
        created_at=r.created_at,
    )


@router.post("/labour/requirements", response_model=RequirementOut, status_code=status.HTTP_201_CREATED)
def post_requirement(body: RequirementIn, farmer: CurrentFarmer, db: DbSession):
    if not (farmer.state and farmer.district):
        raise AppError(422, "location_required", "Set your state and district first")
    if body.start_date < date.today():
        raise AppError(422, "invalid_date", "Start date can't be in the past")
    r = LabourRequirement(
        farmer_id=farmer.id,
        work_type=body.work_type,
        workers_needed=body.workers_needed,
        start_date=body.start_date,
        days=body.days,
        wage_per_day_paise=round(body.wage_per_day * 100) if body.wage_per_day is not None else None,
        state=farmer.state,
        district=farmer.district,
        mandal=farmer.mandal,
        village=body.village or farmer.village,
        contact_phone=body.contact_phone or farmer.phone,
        description=body.description,
        status="open",
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return _req_out(r, farmer.id)


@router.get("/labour/requirements", response_model=list[RequirementOut])
def list_requirements(
    farmer: CurrentFarmer,
    db: DbSession,
    mine: bool = False,
    district: Annotated[str | None, Query(max_length=80)] = None,
):
    if mine:
        q = select(LabourRequirement).where(LabourRequirement.farmer_id == farmer.id)
    else:
        district = district or farmer.district
        if not district:
            raise AppError(422, "location_required", "Pass district or set your location")
        q = select(LabourRequirement).where(
            LabourRequirement.status == "open",
            func.lower(LabourRequirement.district) == district.strip().lower(),
        )
    rows = list(db.scalars(q.order_by(LabourRequirement.start_date, LabourRequirement.id)))
    if not mine:  # hide open posts whose work period is already over
        today = date.today()
        rows = [r for r in rows if r.start_date + timedelta(days=r.days - 1) >= today]
    return [_req_out(r, farmer.id) for r in rows]


@router.post("/labour/requirements/{requirement_id}/close", response_model=RequirementOut)
def close_requirement(requirement_id: int, body: RequirementCloseIn, farmer: CurrentFarmer, db: DbSession):
    r = db.get(LabourRequirement, requirement_id)
    if r is None or r.farmer_id != farmer.id:
        raise not_found("requirement")
    if r.status != "open":
        raise AppError(409, "requirement_closed", "Already closed")
    r.status = body.status
    db.commit()
    db.refresh(r)
    return _req_out(r, farmer.id)
