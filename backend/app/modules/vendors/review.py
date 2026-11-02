"""Annadata staff reviewing vendor applications: start review, approve, reject, suspend, reinstate."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError, not_found
from app.core.security import utcnow
from app.modules.iam.models import ErpUser, ErpVendorMember
from app.modules.vendors import rules
from app.modules.vendors.models import Vendor
from app.modules.vendors.service import missing_items, set_status

# action → (statuses it can start from, status it ends in)
TRANSITIONS: dict[str, tuple[tuple[str, ...], str]] = {
    "start_review": (("submitted",), "under_review"),
    "approve": (("submitted", "under_review"), "approved"),
    "reject": (("submitted", "under_review"), "rejected"),
    "suspend": (("approved",), "suspended"),
    "reinstate": (("suspended",), "approved"),
}


def get_vendor(db: Session, public_id: str, for_update: bool = False) -> Vendor:
    q = select(Vendor).where(Vendor.public_id == public_id, Vendor.deleted_at.is_(None))
    if for_update:  # two reviewers clicking at once: the second waits, then sees the new status
        q = q.with_for_update()
    vendor = db.scalar(q)
    if vendor is None:
        raise not_found("vendor")
    return vendor


def _check(vendor: Vendor, action: str) -> None:
    if vendor.status not in TRANSITIONS[action][0]:
        raise AppError(
            409,
            "invalid_status_change",
            f"Can't {action.replace('_', ' ')} an application that is {vendor.status.replace('_', ' ')}",
        )


def _move(db: Session, vendor: Vendor, action: str, actor: ErpUser, reason: str | None = None) -> None:
    _check(vendor, action)
    set_status(db, vendor, TRANSITIONS[action][1], actor.id, reason)


def start_review(db: Session, vendor: Vendor, actor: ErpUser) -> None:
    _move(db, vendor, "start_review", actor)


def approve(
    db: Session,
    vendor: Vendor,
    actor: ErpUser,
    capability_codes: list[str] | None,
    gstin_checked: bool,
    documents_checked: bool,
    note: str | None,
) -> None:
    """Approves the vendor for the chosen offerings (default: all asked for); the rest are marked rejected."""
    _check(vendor, "approve")
    if not documents_checked:
        raise AppError(422, "checks_required", "Confirm that you checked the uploaded documents")
    if vendor.kind == "business" and not gstin_checked:
        raise AppError(422, "checks_required", "Confirm that you checked the GSTIN on the GST portal")
    asked = {c.code for c in vendor.capabilities}
    chosen = set(capability_codes) if capability_codes is not None else asked
    if not chosen or not chosen <= asked:
        raise AppError(422, "invalid_capabilities", "Approve at least one of the offerings the vendor asked for")
    # Things may have changed since submission (a licence expired). Check again, for the approved offerings only.
    for cap in vendor.capabilities:
        cap.status = "approved" if cap.code in chosen else "rejected"
    still_missing = [m for m in missing_items(vendor) if _relevant(m.code, chosen)]
    if still_missing:
        raise AppError(
            409,
            "application_incomplete",
            "The application is missing something",
            [m.model_dump() for m in still_missing],
        )
    _move(db, vendor, "approve", actor, note)
    now = utcnow()
    vendor.decided_at, vendor.decided_by_id = now, actor.id
    if vendor.kind == "business":
        vendor.gstin_verified_at = now


def _relevant(missing_code: str, approved: set[str]) -> bool:
    """A missing licence only blocks approval if an approved offering needs it."""
    if missing_code == "labour_team_size":
        return "labour" in approved
    if not missing_code.startswith(("licence:", "licence_document:")):
        return missing_code != "capabilities"
    licence_type = missing_code.split(":", 1)[1]
    if licence_type == "contract_labour_licence":
        return "labour" in approved
    return any(licence_type in rules.CAPABILITIES[c].licences for c in approved)


def reject(db: Session, vendor: Vendor, actor: ErpUser, reason: str) -> None:
    _move(db, vendor, "reject", actor, reason)
    vendor.rejection_reason = reason
    vendor.decided_at, vendor.decided_by_id = utcnow(), actor.id
    for cap in vendor.capabilities:
        cap.status = "pending"


def suspend(db: Session, vendor: Vendor, actor: ErpUser, reason: str) -> None:
    _move(db, vendor, "suspend", actor, reason)
    vendor.suspended_reason = reason


def reinstate(db: Session, vendor: Vendor, actor: ErpUser, note: str | None) -> None:
    _move(db, vendor, "reinstate", actor, note)
    vendor.suspended_reason = None


def owner_emails(db: Session, vendor: Vendor) -> list[str]:
    return list(
        db.scalars(
            select(ErpUser.email)
            .join(ErpVendorMember, ErpVendorMember.user_id == ErpUser.id)
            .where(
                ErpVendorMember.vendor_id == vendor.id,
                ErpVendorMember.role_code == "vendor_owner",
                ErpUser.status == "active",
            )
        )
    )


def auto_approve(db: Session, vendor: Vendor) -> None:
    """VENDOR_AUTO_APPROVE: a complete, just-submitted application is approved for everything it asked for, with no
    one reviewing it. The GSTIN is not marked as checked, because nobody checked it."""
    _check(vendor, "approve")
    for cap in vendor.capabilities:
        cap.status = "approved"
    set_status(db, vendor, "approved", None, "Approved automatically (review is switched off)")
    vendor.decided_at, vendor.decided_by_id = utcnow(), None
