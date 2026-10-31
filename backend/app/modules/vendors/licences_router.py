"""Licence renewals (vendor) and the licence watch list (Annadata)."""

from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.api.deps import DbSession
from app.core.errors import not_found
from app.modules.audit.service import record
from app.modules.documents.models import ErpDocument
from app.modules.iam.deps import Principal, require
from app.modules.iam.permissions import P
from app.modules.iam.router import Email
from app.modules.vendors import licences, rules
from app.modules.vendors.models import Vendor, VendorLicence
from app.modules.vendors.review import owner_emails
from app.modules.vendors.router import Editor, saved
from app.modules.vendors.schemas import RenewalIn, VendorOut
from app.modules.vendors.service import attach_document, my_vendor

router = APIRouter(tags=["erp-licences"])

Viewer = Annotated[Principal, Depends(require(P.VENDORS_VIEW))]
Reviewer = Annotated[Principal, Depends(require(P.VENDORS_REVIEW))]


# ---------- Vendor ----------


@router.post("/erp/vendor/licences/renewals", response_model=VendorOut, status_code=status.HTTP_201_CREATED)
def upload_renewal(body: RenewalIn, principal: Editor, db: DbSession, request: Request, mail: Email):
    """For approved vendors: a renewed licence. It counts once a Super Admin has checked the copy."""
    vendor = my_vendor(db, principal)
    doc_id = attach_document(db, principal, vendor, body.document_id, body.licence_type)
    renewal = licences.renew(
        vendor, body.licence_type, body.number, body.issuing_authority, body.valid_from, body.valid_until, doc_id
    )
    out = saved(db, principal, vendor, request, "erp.vendor.licence.renewal", licence_type=renewal.licence_type)
    for email in licences.super_admin_emails(db):
        mail.send(
            email,
            f"Licence renewal to check: {vendor.trade_name}",
            f"{vendor.trade_name} uploaded a renewed {rules.LICENCE_TYPES[renewal.licence_type]} "
            f"(valid until {renewal.valid_until:%d %b %Y}). Check it in the ERP under Licences.",
        )
    return out


# ---------- Annadata ----------


class LicenceRow(BaseModel):
    id: str
    vendor_id: str
    vendor_name: str
    vendor_status: str
    licence_type: str
    licence_name: str
    number: str
    valid_until: date
    days_left: int
    status: str
    document_id: str | None


class RenewalApproveIn(BaseModel):
    documents_checked: bool = False


class RenewalRejectIn(BaseModel):
    reason: str = Field(min_length=10, max_length=2000)


def _rows(db, query) -> list[LicenceRow]:
    today = rules.today()
    found = db.execute(query).all()
    doc_ids = [lic.document_id for lic, _ in found if lic.document_id]
    docs = {d.id: d for d in db.scalars(select(ErpDocument).where(ErpDocument.id.in_(doc_ids)))} if doc_ids else {}
    out = []
    for lic, vendor in found:
        doc = docs.get(lic.document_id)
        out.append(
            LicenceRow(
                id=lic.public_id,
                vendor_id=vendor.public_id,
                vendor_name=vendor.trade_name,
                vendor_status=vendor.status,
                licence_type=lic.licence_type,
                licence_name=rules.LICENCE_TYPES.get(lic.licence_type, lic.licence_type),
                number=lic.number,
                valid_until=lic.valid_until,
                days_left=(lic.valid_until - today).days,
                status=lic.status,
                document_id=doc.public_id if doc else None,
            )
        )
    return out


def _base():
    return (
        select(VendorLicence, Vendor)
        .join(Vendor, Vendor.id == VendorLicence.vendor_id)
        .where(Vendor.deleted_at.is_(None), Vendor.status.in_(("approved", "suspended")))
    )


@router.get("/erp/admin/licences/summary")
def summary(_: Viewer, db: DbSession):
    """For the dashboard: renewals waiting, licences ending within 30 days, licences already expired."""
    today = rules.today()
    rows = db.execute(_base().where(VendorLicence.status.in_(("valid", "pending_review")))).all()
    newest: dict[tuple[int, str], VendorLicence] = {}
    pending = 0
    for lic, vendor in rows:
        if lic.status == "pending_review":
            pending += 1
            continue
        key = (vendor.id, lic.licence_type)
        if key not in newest or lic.valid_until > newest[key].valid_until:
            newest[key] = lic
    days = [(lic.valid_until - today).days for lic in newest.values()]
    return {
        "renewals_to_check": pending,
        "expiring_30_days": sum(1 for d in days if 0 < d <= 30),
        "expired": sum(1 for d in days if d <= 0),
    }


@router.get("/erp/admin/licences", response_model=list[LicenceRow])
def watch_list(
    _: Viewer,
    db: DbSession,
    show: Annotated[str, Query(pattern="^(pending|expiring|expired)$")] = "pending",
    within_days: Annotated[int, Query(ge=1, le=365)] = 30,
):
    """pending: renewals to check · expiring: valid licences ending within N days · expired: ended, not renewed."""
    today = rules.today()
    if show == "pending":
        query = _base().where(VendorLicence.status == "pending_review").order_by(VendorLicence.created_at)
        return _rows(db, query)
    query = _base().where(VendorLicence.status == "valid").order_by(VendorLicence.valid_until)
    rows = _rows(db, query)
    # Only the newest licence of each type per vendor matters (an older one is replaced by its renewal).
    newest: dict[tuple[str, str], LicenceRow] = {}
    for row in rows:
        key = (row.vendor_id, row.licence_type)
        if key not in newest or row.valid_until > newest[key].valid_until:
            newest[key] = row
    if show == "expiring":
        horizon = today + timedelta(days=within_days)
        return [r for r in newest.values() if today < r.valid_until <= horizon]
    return [r for r in newest.values() if r.valid_until <= today]


def _licence(db, public_id: str) -> VendorLicence:
    lic = db.scalar(select(VendorLicence).where(VendorLicence.public_id == public_id))
    if lic is None:
        raise not_found("licence")
    return lic


@router.post("/erp/admin/licences/{licence_id}/approve", response_model=list[LicenceRow])
def approve_renewal(
    licence_id: str, body: RenewalApproveIn, principal: Reviewer, db: DbSession, request: Request, mail: Email
):
    lic = _licence(db, licence_id)
    licences.approve_renewal(db, lic, principal.user.id, body.documents_checked)
    record(db, "erp.licence.approve", "vendor_licence", lic.id, actor_id=principal.user.id, request=request)
    db.commit()
    vendor = db.get(Vendor, lic.vendor_id)
    for email in owner_emails(db, vendor):
        mail.send(
            email,
            "Annadata 360: renewed licence approved",
            f"Your renewed {rules.LICENCE_TYPES[lic.licence_type]} is approved (valid until "
            f"{lic.valid_until:%d %b %Y}). Listings that needed it are visible to farmers again.",
        )
    return _rows(db, _base().where(VendorLicence.id == lic.id))


@router.post("/erp/admin/licences/{licence_id}/reject", response_model=list[LicenceRow])
def reject_renewal(
    licence_id: str, body: RenewalRejectIn, principal: Reviewer, db: DbSession, request: Request, mail: Email
):
    lic = _licence(db, licence_id)
    licences.reject_renewal(lic, principal.user.id, body.reason.strip())
    record(db, "erp.licence.reject", "vendor_licence", lic.id, actor_id=principal.user.id, request=request)
    db.commit()
    vendor = db.get(Vendor, lic.vendor_id)
    for email in owner_emails(db, vendor):
        mail.send(
            email,
            "Annadata 360: renewed licence needs changes",
            f"The renewed {rules.LICENCE_TYPES[lic.licence_type]} you uploaded wasn't accepted:\n\n{lic.review_reason}"
            "\n\nUpload a correct copy in Annadata 360.",
        )
    return _rows(db, _base().where(VendorLicence.id == lic.id))
