"""Admin side of vendors: the review queue and decisions. Ops can look; only Super Admin decides."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select

from app.api.deps import DbSession
from app.modules.audit.service import record
from app.modules.iam.deps import Principal, require
from app.modules.iam.models import ErpUser, ErpVendorMember
from app.modules.iam.permissions import P
from app.modules.iam.router import Email
from app.modules.vendors import review, rules
from app.modules.vendors.models import VENDOR_STATUSES, Vendor, VendorCapability, VendorNote, VendorServiceArea
from app.modules.vendors.models import VendorStatusHistory as History
from app.modules.vendors.router import vendor_out
from app.modules.vendors.schemas import VendorOut

router = APIRouter(prefix="/erp/admin/vendors", tags=["erp-admin-vendors"])

Viewer = Annotated[Principal, Depends(require(P.VENDORS_VIEW))]
Reviewer = Annotated[Principal, Depends(require(P.VENDORS_REVIEW))]


class VendorSummary(BaseModel):
    id: str
    trade_name: str
    legal_name: str | None
    kind: str
    status: str
    state: str | None
    district: str | None
    capabilities: list[str]
    submitted_at: datetime | None
    created_at: datetime


class MemberOut(BaseModel):
    full_name: str
    email: str
    phone: str | None
    role: str
    status: str


class HistoryOut(BaseModel):
    from_status: str | None
    to_status: str
    reason: str | None
    by: str | None  # email of who did it
    at: datetime


class NoteOut(BaseModel):
    text: str
    by: str | None
    at: datetime


class AdminVendorOut(VendorOut):
    members: list[MemberOut]
    history: list[HistoryOut]
    notes: list[NoteOut]


class ApproveIn(BaseModel):
    capabilities: list[str] | None = None  # default: everything the vendor asked for
    gstin_checked: bool = False  # reviewer looked the GSTIN up on the GST portal (businesses)
    documents_checked: bool = False  # reviewer opened and checked every uploaded document
    note: str | None = Field(default=None, max_length=1000)


class ReasonIn(BaseModel):
    reason: str = Field(min_length=10, max_length=2000)  # shown to the vendor


class NoteIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


def _district_name(code: str | None) -> str | None:
    return rules.DISTRICT_CODES[code][0] if code in rules.DISTRICT_CODES else None


def _admin_out(db, vendor: Vendor) -> AdminVendorOut:
    members = db.execute(
        select(ErpUser, ErpVendorMember.role_code)
        .join(ErpVendorMember, ErpVendorMember.user_id == ErpUser.id)
        .where(ErpVendorMember.vendor_id == vendor.id)
        .order_by(ErpVendorMember.id)
    ).all()
    history = db.scalars(select(History).where(History.vendor_id == vendor.id).order_by(History.id)).all()
    notes = db.scalars(select(VendorNote).where(VendorNote.vendor_id == vendor.id).order_by(VendorNote.id)).all()
    people = {h.actor_id for h in history} | {n.author_id for n in notes}
    people.discard(None)
    emails = dict(db.execute(select(ErpUser.id, ErpUser.email).where(ErpUser.id.in_(people))).all()) if people else {}
    return AdminVendorOut(
        **vendor_out(db, vendor).model_dump(),
        members=[
            MemberOut(full_name=u.full_name, email=u.email, phone=u.phone, role=role, status=u.status)
            for u, role in members
        ],
        history=[
            HistoryOut(
                from_status=h.from_status,
                to_status=h.to_status,
                reason=h.reason,
                by=emails.get(h.actor_id),
                at=h.created_at,
            )
            for h in history
        ],
        notes=[NoteOut(text=n.text, by=emails.get(n.author_id), at=n.created_at) for n in notes],
    )


@router.get("/counts")
def counts(_: Viewer, db: DbSession):
    """How many vendors are in each status (the dashboard pipeline)."""
    rows = dict(
        db.execute(select(Vendor.status, func.count()).where(Vendor.deleted_at.is_(None)).group_by(Vendor.status)).all()
    )
    return {s: rows.get(s, 0) for s in VENDOR_STATUSES}


@router.get("", response_model=list[VendorSummary])
def list_vendors(
    _: Viewer,
    db: DbSession,
    status_: Annotated[str | None, Query(alias="status", description="One or more, comma-separated")] = None,
    q: Annotated[str | None, Query(max_length=100, description="Name, GSTIN or PAN")] = None,
    district: Annotated[str | None, Query(max_length=60)] = None,
    capability: Annotated[str | None, Query(max_length=30)] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
):
    """Default: the review queue (submitted and under review), oldest first."""
    statuses = [s.strip() for s in status_.split(",")] if status_ else ["submitted", "under_review"]
    query = select(Vendor).where(Vendor.deleted_at.is_(None), Vendor.status.in_(statuses))
    if q:
        term = q.strip()
        like = f"%{term}%"
        query = query.where(
            or_(
                Vendor.trade_name.ilike(like),
                Vendor.legal_name.ilike(like),
                Vendor.gstin == term.upper(),
                Vendor.pan == term.upper(),
            )
        )
    if district:
        query = query.where(
            or_(
                Vendor.district_code == district,
                Vendor.id.in_(select(VendorServiceArea.vendor_id).where(VendorServiceArea.district_code == district)),
            )
        )
    if capability:
        query = query.where(
            Vendor.id.in_(select(VendorCapability.vendor_id).where(VendorCapability.code == capability))
        )
    query = query.order_by(Vendor.submitted_at.asc().nulls_last(), Vendor.id).offset(offset).limit(limit)
    return [
        VendorSummary(
            id=v.public_id,
            trade_name=v.trade_name,
            legal_name=v.legal_name,
            kind=v.kind,
            status=v.status,
            state=v.state,
            district=_district_name(v.district_code),
            capabilities=[c.code for c in v.capabilities],
            submitted_at=v.submitted_at,
            created_at=v.created_at,
        )
        for v in db.scalars(query)
    ]


@router.get("/{vendor_id}", response_model=AdminVendorOut)
def get_vendor(vendor_id: str, _: Viewer, db: DbSession):
    return _admin_out(db, review.get_vendor(db, vendor_id))


@router.post("/{vendor_id}/notes", response_model=AdminVendorOut, status_code=status.HTTP_201_CREATED)
def add_note(vendor_id: str, body: NoteIn, principal: Viewer, db: DbSession, request: Request):
    vendor = review.get_vendor(db, vendor_id)
    db.add(VendorNote(vendor_id=vendor.id, author_id=principal.user.id, text=body.text.strip()))
    record(db, "erp.vendor.note", "vendor", vendor.id, actor_id=principal.user.id, request=request)
    db.commit()
    return _admin_out(db, vendor)


def _decided(db, principal, vendor, request, action, mail, subject: str, body: str | None, **detail) -> AdminVendorOut:
    record(db, f"erp.vendor.{action}", "vendor", vendor.id, actor_id=principal.user.id, request=request, **detail)
    db.commit()
    db.refresh(vendor)
    if body is not None:
        for email in review.owner_emails(db, vendor):
            mail.send(email, subject, body)
    return _admin_out(db, vendor)


@router.post("/{vendor_id}/start-review", response_model=AdminVendorOut)
def start_review(vendor_id: str, principal: Reviewer, db: DbSession, request: Request, mail: Email):
    vendor = review.get_vendor(db, vendor_id, for_update=True)
    review.start_review(db, vendor, principal.user)
    return _decided(db, principal, vendor, request, "start_review", mail, "", None)


@router.post("/{vendor_id}/approve", response_model=AdminVendorOut)
def approve(vendor_id: str, body: ApproveIn, principal: Reviewer, db: DbSession, request: Request, mail: Email):
    vendor = review.get_vendor(db, vendor_id, for_update=True)
    review.approve(db, vendor, principal.user, body.capabilities, body.gstin_checked, body.documents_checked, body.note)
    approved = [rules.CAPABILITIES[c.code].name for c in vendor.capabilities if c.status == "approved"]
    rejected = [rules.CAPABILITIES[c.code].name for c in vendor.capabilities if c.status == "rejected"]
    text = f"Good news! {vendor.trade_name} is approved on Annadata 360 for: {', '.join(approved)}."
    if rejected:
        text += f"\nNot approved for now: {', '.join(rejected)}. Contact Annadata support to know why."
    text += "\nYou can now add your products and services."
    return _decided(
        db,
        principal,
        vendor,
        request,
        "approve",
        mail,
        "Annadata 360: application approved",
        text,
        capabilities=sorted(c.code for c in vendor.capabilities if c.status == "approved"),
    )


@router.post("/{vendor_id}/reject", response_model=AdminVendorOut)
def reject(vendor_id: str, body: ReasonIn, principal: Reviewer, db: DbSession, request: Request, mail: Email):
    vendor = review.get_vendor(db, vendor_id, for_update=True)
    review.reject(db, vendor, principal.user, body.reason.strip())
    text = (
        f"The application for {vendor.trade_name} needs changes before it can be approved:\n\n{vendor.rejection_reason}"
        "\n\nLog in, fix these and submit again."
    )
    return _decided(db, principal, vendor, request, "reject", mail, "Annadata 360: application needs changes", text)


@router.post("/{vendor_id}/suspend", response_model=AdminVendorOut)
def suspend(vendor_id: str, body: ReasonIn, principal: Reviewer, db: DbSession, request: Request, mail: Email):
    vendor = review.get_vendor(db, vendor_id, for_update=True)
    review.suspend(db, vendor, principal.user, body.reason.strip())
    text = (
        f"{vendor.trade_name} has been suspended on Annadata 360 and is hidden from farmers.\n\n"
        f"Reason: {vendor.suspended_reason}\n\nContact Annadata support to resolve this."
    )
    return _decided(db, principal, vendor, request, "suspend", mail, "Annadata 360: account suspended", text)


@router.post("/{vendor_id}/reinstate", response_model=AdminVendorOut)
def reinstate(vendor_id: str, body: NoteIn, principal: Reviewer, db: DbSession, request: Request, mail: Email):
    vendor = review.get_vendor(db, vendor_id, for_update=True)
    review.reinstate(db, vendor, principal.user, body.text.strip())
    text = f"{vendor.trade_name} is active again on Annadata 360 and visible to farmers."
    return _decided(db, principal, vendor, request, "reinstate", mail, "Annadata 360: account active again", text)
