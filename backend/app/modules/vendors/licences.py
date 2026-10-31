"""Licence expiry: which licences count today, renewals checked by Super Admin, and the daily reminder run.

Listings never get switched off by a job. Whether a listing is visible is worked out from the licences each time,
so a listing hides itself the day a licence expires and comes back the moment a renewal is approved.
"""

import logging
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.security import utcnow
from app.modules.iam.models import ErpUser, ErpUserRole
from app.modules.vendors import rules
from app.modules.vendors.models import Vendor, VendorLicence
from app.modules.vendors.review import owner_emails
from app.services.email import EmailSender

log = logging.getLogger("annadata.licences")

REMINDER_DAYS = (30, 15, 7, 1)


def required_licences(vendor: Vendor, category: str) -> tuple[str, ...]:
    """Licence types an offering needs. Labour needs one only for teams of 20 or more."""
    needed = rules.CAPABILITIES[category].licences if category in rules.CAPABILITIES else ()
    if category == "labour" and (vendor.labour_team_size or 0) >= rules.CONTRACT_LABOUR_THRESHOLD:
        needed = (*needed, "contract_labour_licence")
    return needed


def current_licence(vendor: Vendor, licence_type: str, on: date | None = None) -> VendorLicence | None:
    """The licence of this type that counts on that day (the one lasting longest, if several)."""
    on = on or rules.today()
    usable = [
        lic
        for lic in vendor.licences
        if lic.licence_type == licence_type and lic.status == "valid" and lic.valid_until > on
    ]
    return max(usable, key=lambda lic: lic.valid_until, default=None)


def expired_licences_for(vendor: Vendor, category: str, on: date | None = None) -> list[str]:
    """Licence types this offering needs that the vendor doesn't hold today."""
    return [t for t in required_licences(vendor, category) if current_licence(vendor, t, on) is None]


# ---------- Renewals (after approval) ----------


def renew(vendor: Vendor, licence_type: str, number: str, authority: str | None, valid_from, valid_until, doc_id: int):
    if vendor.status not in ("approved", "suspended"):
        raise AppError(409, "not_approved_yet", "Add licences to your application instead")
    if licence_type not in {lic.licence_type for lic in vendor.licences}:
        raise AppError(422, "unknown_licence", "You can only renew a licence you already have on file")
    if valid_until <= rules.today():
        raise AppError(422, "licence_expired", "This licence has already expired")
    if valid_from is not None and valid_from > valid_until:
        raise AppError(422, "invalid_dates", "'Valid from' is after 'valid until'")
    pending = [lic for lic in vendor.licences if lic.licence_type == licence_type and lic.status == "pending_review"]
    for old in pending:  # a newer upload replaces one still waiting
        old.status, old.review_reason = "rejected", "Replaced by a newer upload"
    previous = current_licence(vendor, licence_type) or max(
        (lic for lic in vendor.licences if lic.licence_type == licence_type and lic.status == "valid"),
        key=lambda lic: lic.valid_until,
        default=None,
    )
    renewal = VendorLicence(
        vendor_id=vendor.id,
        licence_type=licence_type,
        number=number.strip().upper(),
        issuing_authority=(authority or "").strip() or None,
        valid_from=valid_from,
        valid_until=valid_until,
        document_id=doc_id,
        status="pending_review",
        renews_id=previous.id if previous else None,
    )
    vendor.licences.append(renewal)
    return renewal


def approve_renewal(db: Session, licence: VendorLicence, actor_id: int, documents_checked: bool) -> None:
    if licence.status != "pending_review":
        raise AppError(409, "not_pending", "This licence isn't waiting for review")
    if not documents_checked:
        raise AppError(422, "checks_required", "Confirm that you checked the uploaded licence copy")
    licence.status = "valid"
    licence.reviewed_by_id, licence.reviewed_at = actor_id, utcnow()
    vendor = db.get(Vendor, licence.vendor_id)
    for old in vendor.licences:  # the renewal takes over from older licences of the same type
        if old is not licence and old.licence_type == licence.licence_type and old.status == "valid":
            old.status = "superseded"


def reject_renewal(licence: VendorLicence, actor_id: int, reason: str) -> None:
    if licence.status != "pending_review":
        raise AppError(409, "not_pending", "This licence isn't waiting for review")
    licence.status, licence.review_reason = "rejected", reason
    licence.reviewed_by_id, licence.reviewed_at = actor_id, utcnow()


# ---------- Daily reminders ----------


def super_admin_emails(db: Session) -> list[str]:
    return list(
        db.scalars(
            select(ErpUser.email)
            .join(ErpUserRole, ErpUserRole.user_id == ErpUser.id)
            .where(ErpUserRole.role_code == "super_admin", ErpUser.status == "active", ErpUser.deleted_at.is_(None))
        )
    )


def _due_reminder(days_left: int, last_sent: int | None) -> int | None:
    """The reminder to send now, if any. Catches up after a missed day (14 days left, nothing sent → the 15-day one)."""
    due = [d for d in REMINDER_DAYS if days_left <= d]
    if not due:
        return None
    step = min(due)
    return step if last_sent is None or step < last_sent else None


def send_reminders(db: Session, mail: EmailSender) -> dict[str, int]:
    """Run daily. Emails vendors 30/15/7/1 days before a licence ends, and vendor + Super Admins when it has ended.
    Safe to run twice: what was sent is remembered on the licence."""
    on = rules.today()
    sent = {"reminders": 0, "expired": 0}
    vendors = db.scalars(
        select(Vendor).where(Vendor.status.in_(("approved", "suspended")), Vendor.deleted_at.is_(None))
    )
    admins = None
    for vendor in vendors:
        offered = {c.code for c in vendor.capabilities if c.status == "approved"}
        for licence_type in sorted({t for code in offered for t in required_licences(vendor, code)}):
            valid = [lic for lic in vendor.licences if lic.licence_type == licence_type and lic.status == "valid"]
            if not valid:
                continue
            licence = max(valid, key=lambda lic: lic.valid_until)  # the newest; older ones don't matter
            name = rules.LICENCE_TYPES[licence_type]
            renewal_waiting = any(
                lic.licence_type == licence_type and lic.status == "pending_review" for lic in vendor.licences
            )
            days_left = (licence.valid_until - on).days
            emails = owner_emails(db, vendor)
            if days_left > 0:
                step = _due_reminder(days_left, licence.last_reminder_days)
                if step is None:
                    continue
                note = (
                    "We have your renewal and are checking it."
                    if renewal_waiting
                    else "Renew it and upload the new copy in Annadata 360 → Licences, so your listings stay visible."
                )
                for email in emails:
                    mail.send(
                        email,
                        f"Annadata 360: {name} expires in {days_left} day{'s' if days_left != 1 else ''}",
                        f"{vendor.trade_name}: your {name} (no. {licence.number}) expires on "
                        f"{licence.valid_until:%d %b %Y}.\n{note}",
                    )
                licence.last_reminder_days = step
                sent["reminders"] += 1
            elif licence.expired_notified_at is None:
                hidden = [
                    rules.CAPABILITIES[c].name for c in sorted(offered) if licence_type in required_licences(vendor, c)
                ]
                for email in emails:
                    mail.send(
                        email,
                        f"Annadata 360: {name} has expired",
                        f"{vendor.trade_name}: your {name} (no. {licence.number}) expired on "
                        f"{licence.valid_until:%d %b %Y}.\nThese listings are hidden from farmers until a renewed "
                        f"licence is approved: {', '.join(hidden)}.\nUpload the renewed licence in Annadata 360.",
                    )
                admins = admins if admins is not None else super_admin_emails(db)
                for email in admins:
                    mail.send(
                        email,
                        f"Licence expired: {vendor.trade_name}",
                        f"{vendor.trade_name}'s {name} (no. {licence.number}) expired on "
                        f"{licence.valid_until:%d %b %Y}. Hidden automatically: {', '.join(hidden)}.",
                    )
                licence.expired_notified_at = utcnow()
                sent["expired"] += 1
    db.commit()
    log.info("Licence reminders: %s", sent)
    return sent
