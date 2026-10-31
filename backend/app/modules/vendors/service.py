"""Vendor sign-up and the KYC application (draft → submitted). Review (approve / reject) is in the admin module."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.crypto import decrypt, encrypt
from app.core.errors import AppError
from app.core.security import utcnow
from app.modules.documents.models import ErpDocument
from app.modules.documents.service import attach_to_vendor
from app.modules.iam import service as iam
from app.modules.iam.deps import Principal
from app.modules.iam.models import ErpUser, ErpVendorMember
from app.modules.vendors import rules
from app.modules.vendors.models import (
    EDITABLE_STATUSES,
    Vendor,
    VendorBankAccount,
    VendorCapability,
    VendorLicence,
    VendorServiceArea,
    VendorStatusHistory,
    VendorVerification,
)
from app.modules.vendors.schemas import BankIn, CapabilitiesIn, LicenceIn, MissingItem, ProfileIn, RegisterIn
from app.modules.vendors.verification import CheckResult, IfscInfo, KycVerifier, Lookups


def set_status(db: Session, vendor: Vendor, to: str, actor_id: int | None, reason: str | None = None) -> None:
    db.add(
        VendorStatusHistory(
            vendor_id=vendor.id, from_status=vendor.status, to_status=to, reason=reason, actor_id=actor_id
        )
    )
    vendor.status = to


# ---------- Sign-up ----------


def register(db: Session, body: RegisterIn, ip: str | None) -> tuple[ErpUser, str] | None:
    """Creates the owner account (password not set yet) and a draft application. Returns (user, verify link), or
    None when the email already has an account — the caller answers the same either way."""
    iam.count_public_request(db, body.email, ip, "register")
    if db.scalar(select(ErpUser.id).where(ErpUser.email == body.email)) is not None:
        return None
    user = ErpUser(email=body.email, full_name=body.full_name, phone=body.phone, user_type="vendor", status="invited")
    db.add(user)
    db.flush()
    vendor = Vendor(
        kind=body.kind,
        status="draft",
        trade_name=body.trade_name.strip(),
        contact_phone=body.phone,
        contact_email=body.email,
        created_by_id=user.id,
        updated_by_id=user.id,
    )
    db.add(vendor)
    db.flush()
    db.add(VendorStatusHistory(vendor_id=vendor.id, from_status=None, to_status="draft", actor_id=user.id))
    db.add(ErpVendorMember(vendor_id=vendor.id, user_id=user.id, role_code="vendor_owner"))
    token = iam.create_invite(db, user)
    return user, iam.invite_link(token)


# ---------- The application ----------


def my_vendor(db: Session, principal: Principal) -> Vendor:
    vendor = db.get(Vendor, principal.vendor_id) if principal.vendor_id is not None else None
    if vendor is None or vendor.deleted_at is not None:
        raise AppError(403, "not_a_vendor", "This account doesn't belong to a vendor")
    return vendor


def editable_vendor(db: Session, principal: Principal) -> Vendor:
    vendor = my_vendor(db, principal)
    if vendor.status not in EDITABLE_STATUSES:
        raise AppError(409, "application_locked", "The application is with Annadata for review and can't be changed")
    return vendor


def attach_document(db, principal, vendor, public_id: str | None, kind: str) -> int | None:
    if public_id is None:
        return None
    return attach_to_vendor(db, principal, public_id, kind, vendor.id).id


def _check_pincode(lookups: Lookups, pincode: str, state: str | None, errors: dict[str, str]) -> str | None:
    """Looks the pincode up in India Post data. Returns its postal district(s) for the reviewer, or None if the
    service couldn't answer (the vendor is never blocked by an outage)."""
    found = lookups.pincode(pincode)
    if found is False:
        return None
    if found is None:
        errors["pincode"] = "This pincode doesn't exist. Check for typing mistakes."
    elif found.state is None:
        errors["pincode"] = f"This pincode is in {found.state_name}, not Andhra Pradesh or Telangana"
    elif state is not None and found.state != state:
        place = "Telangana" if found.state == "TG" else "Andhra Pradesh"
        errors["pincode"] = f"This pincode is in {place}, but the district you chose isn't"
    else:
        return ", ".join(found.districts)[:200] or None
    return None


def update_profile(db: Session, principal: Principal, vendor: Vendor, body: ProfileIn, lookups: Lookups) -> None:
    errors: dict[str, str] = {}
    state = None
    if body.district_code is not None:
        if body.district_code not in rules.DISTRICT_CODES:
            errors["district_code"] = "Unknown district"
        else:
            state = rules.DISTRICT_CODES[body.district_code][1]
    if body.pan is not None:
        if not rules.valid_pan(body.pan):
            errors["pan"] = "PAN should look like ABCDE1234F"
        elif body.kind == "individual" and not rules.pan_is_individual(body.pan):
            errors["pan"] = "For an individual, use a personal PAN (4th letter P)"
    if body.gstin is not None:
        if body.kind == "individual":
            errors["gstin"] = "Individuals register without GSTIN. Choose 'business' if you have one."
        elif not rules.valid_gstin(body.gstin):
            errors["gstin"] = "This GSTIN is not valid. Check for typing mistakes."
        elif body.gstin[:2] not in rules.GST_STATE_CODES:
            errors["gstin"] = "Only businesses registered in Andhra Pradesh or Telangana can join for now"
        elif body.pan is not None and body.gstin[2:12] != body.pan:
            errors["pan"] = "PAN doesn't match the PAN inside the GSTIN"
    if body.business_type is not None and body.business_type not in rules.BUSINESS_TYPES:
        errors["business_type"] = "Unknown business type"
    postal_district = vendor.postal_district if body.pincode == vendor.pincode else None
    if body.pincode is not None:
        if not rules.valid_pincode(body.pincode):
            errors["pincode"] = "Enter a 6-digit Andhra Pradesh or Telangana pincode"
        elif body.pincode != vendor.pincode or vendor.postal_district is None:  # look up only when it changes
            postal_district = _check_pincode(lookups, body.pincode, state, errors)
    if errors:
        raise AppError(422, "invalid_vendor_details", "Some details need fixing", errors)
    if body.gstin is not None:
        taken = db.scalar(select(Vendor.id).where(Vendor.gstin == body.gstin, Vendor.id != vendor.id))
        if taken is not None:
            raise AppError(
                409, "gstin_taken", "Another vendor already registered this GSTIN. Contact Annadata support."
            )

    if body.gstin != vendor.gstin:
        vendor.gstin_verified_at = None
    vendor.kind = body.kind
    vendor.trade_name = body.trade_name.strip()
    vendor.legal_name = (body.legal_name or "").strip() or None
    vendor.business_type = "individual" if body.kind == "individual" else body.business_type
    vendor.gstin = body.gstin if body.kind == "business" else None
    vendor.pan = body.pan
    vendor.address_line = (body.address_line or "").strip() or None
    vendor.district_code = body.district_code
    vendor.state = state
    vendor.pincode = body.pincode
    vendor.postal_district = postal_district
    vendor.contact_phone = body.contact_phone
    vendor.contact_email = body.contact_email
    # A document left out keeps the one already attached: documents can be replaced, never dropped by accident.
    if body.kind != "business":
        vendor.gst_certificate_doc_id = None
    elif body.gst_certificate_document_id is not None:
        vendor.gst_certificate_doc_id = attach_document(
            db, principal, vendor, body.gst_certificate_document_id, "gst_certificate"
        )
    if body.pan_card_document_id is not None:
        vendor.pan_card_doc_id = attach_document(db, principal, vendor, body.pan_card_document_id, "pan_card")
    vendor.updated_by_id = principal.user.id


def update_capabilities(db: Session, principal: Principal, vendor: Vendor, body: CapabilitiesIn) -> None:
    unknown = [c for c in body.codes if c not in rules.CAPABILITIES]
    if unknown:
        raise AppError(422, "unknown_capability", f"Unknown offering: {', '.join(unknown)}")
    wanted = set(body.codes)
    vendor.capabilities = [c for c in vendor.capabilities if c.code in wanted]
    have = {c.code for c in vendor.capabilities}
    vendor.capabilities.extend(VendorCapability(code=c) for c in sorted(wanted - have))
    vendor.labour_team_size = body.labour_team_size if "labour" in wanted else None
    vendor.updated_by_id = principal.user.id


def update_service_areas(db: Session, principal: Principal, vendor: Vendor, codes: list[str]) -> None:
    unknown = [c for c in codes if c not in rules.DISTRICT_CODES]
    if unknown:
        raise AppError(422, "unknown_district", f"Unknown district: {', '.join(unknown)}")
    wanted = set(codes)
    vendor.service_areas = [a for a in vendor.service_areas if a.district_code in wanted]
    have = {a.district_code for a in vendor.service_areas}
    vendor.service_areas.extend(VendorServiceArea(district_code=c) for c in sorted(wanted - have))
    vendor.updated_by_id = principal.user.id


def update_bank(db: Session, principal: Principal, vendor: Vendor, body: BankIn, lookups: Lookups) -> None:
    number = body.account_number.strip()
    errors = {}
    branch = None
    if not rules.valid_ifsc(body.ifsc):
        errors["ifsc"] = "IFSC should look like SBIN0001234"
    else:
        branch = lookups.ifsc(body.ifsc)
        if branch is None:
            errors["ifsc"] = "No bank branch has this IFSC. Check it on your cheque book or passbook."
    if not rules.valid_account_number(number):
        errors["account_number"] = "Account number should be 9 to 18 digits"
    if errors:
        raise AppError(422, "invalid_bank_details", "Some details need fixing", errors)
    cheque = attach_document(db, principal, vendor, body.cheque_document_id, "cancelled_cheque")  # None: keep current
    bank = vendor.bank_account or VendorBankAccount()
    bank.holder_name = body.holder_name.strip()
    bank.ifsc = body.ifsc
    found = branch if isinstance(branch, IfscInfo) else None  # False: directory was down, keep it unknown
    bank.bank_name = found.bank[:120] if found else None
    bank.branch = found.branch[:120] if found else None
    bank.account_number_enc = encrypt(number)
    bank.account_last4 = number[-4:]
    if cheque is not None:
        bank.cheque_doc_id = cheque
    bank.verified_at = None  # changed details must be verified again
    vendor.bank_account = bank
    vendor.updated_by_id = principal.user.id


def save_licence(
    db: Session, principal: Principal, vendor: Vendor, body: LicenceIn, licence: VendorLicence | None = None
) -> VendorLicence:
    if body.licence_type not in rules.LICENCE_TYPES:
        raise AppError(422, "unknown_licence_type", f"Unknown licence type: {body.licence_type}")
    if body.valid_until <= rules.today():
        raise AppError(422, "licence_expired", "This licence has already expired. Renew it first.")
    if body.valid_from is not None and body.valid_from > body.valid_until:
        raise AppError(422, "invalid_dates", "'Valid from' is after 'valid until'")
    licence = licence or VendorLicence(vendor_id=vendor.id)
    licence.licence_type = body.licence_type
    licence.number = body.number.strip().upper()
    licence.issuing_authority = (body.issuing_authority or "").strip() or None
    licence.valid_from = body.valid_from
    licence.valid_until = body.valid_until
    # Licence types and their document kinds share names (documents.kinds).
    document_id = attach_document(db, principal, vendor, body.document_id, body.licence_type)
    if document_id is not None:  # left out: keep the copy already attached
        licence.document_id = document_id
    if licence not in vendor.licences:
        vendor.licences.append(licence)
    vendor.updated_by_id = principal.user.id
    return licence


def get_licence(vendor: Vendor, public_id: str) -> VendorLicence:
    for licence in vendor.licences:
        if licence.public_id == public_id:
            return licence
    raise AppError(404, "licence_not_found", "Licence not found")


# ---------- Checklist and submit ----------


def missing_items(vendor: Vendor) -> list[MissingItem]:
    out: list[MissingItem] = []

    def need(ok: object, code: str, message: str) -> None:
        if not ok:
            out.append(MissingItem(code=code, message=message))

    business = vendor.kind == "business"
    need(vendor.legal_name, "legal_name", "Legal name (as on PAN" + (" / GST certificate)" if business else ")"))
    if business:
        need(vendor.business_type, "business_type", "Business type")
        need(vendor.gstin, "gstin", "GSTIN")
        need(vendor.gst_certificate_doc_id, "gst_certificate", "GST registration certificate (upload)")
    need(vendor.pan, "pan", "PAN")
    need(vendor.pan_card_doc_id, "pan_card", "PAN card (upload)")
    need(vendor.address_line and vendor.district_code and vendor.pincode, "address", "Full address with pincode")
    need(vendor.contact_phone, "contact_phone", "Contact phone")
    need(vendor.capabilities, "capabilities", "What you offer (at least one)")
    need(vendor.service_areas, "service_areas", "Districts you serve (at least one)")
    bank = vendor.bank_account
    need(bank, "bank_account", "Bank account for payments")
    need(bank and bank.cheque_doc_id, "cancelled_cheque", "Cancelled cheque or bank proof (upload)")

    today = rules.today()
    valid = {lic.licence_type: lic for lic in vendor.licences if lic.status == "valid" and lic.valid_until > today}
    required: dict[str, str] = {}
    for cap in vendor.capabilities:
        for licence_type in rules.CAPABILITIES[cap.code].licences:
            required[licence_type] = rules.CAPABILITIES[cap.code].name
    codes = {c.code for c in vendor.capabilities}
    if "labour" in codes:
        need(vendor.labour_team_size, "labour_team_size", "How many workers are in your labour team")
        if (vendor.labour_team_size or 0) >= rules.CONTRACT_LABOUR_THRESHOLD:
            required["contract_labour_licence"] = f"Labour teams of {rules.CONTRACT_LABOUR_THRESHOLD}+ workers"
    for licence_type, reason in required.items():
        lic = valid.get(licence_type)
        name = rules.LICENCE_TYPES[licence_type]
        need(lic, f"licence:{licence_type}", f"{name} (needed for {reason})")
        if lic is not None:
            need(lic.document_id, f"licence_document:{licence_type}", f"{name}: upload a copy")
    return out


def submit(db: Session, principal: Principal, vendor: Vendor) -> None:
    missing = missing_items(vendor)
    if missing:
        raise AppError(
            422, "application_incomplete", "Some details are still missing", [m.model_dump() for m in missing]
        )
    vendor.submitted_at = utcnow()
    vendor.rejection_reason = None
    for cap in vendor.capabilities:  # a resubmitted application is reviewed afresh
        cap.status = "pending"
    set_status(db, vendor, "submitted", principal.user.id)


def run_kyc_checks(db: Session, vendor: Vendor, verifier: KycVerifier) -> None:
    """Asks the KYC provider about GSTIN, PAN and bank account and keeps the answers for the reviewer.
    With KYC_PROVIDER=manual nothing is checked or stored. A provider failure never blocks the vendor."""
    bank = vendor.bank_account
    checks = []
    if vendor.gstin:
        checks.append(("gstin", lambda: verifier.verify_gstin(vendor.gstin, vendor.legal_name)))
    if vendor.pan:
        checks.append(("pan", lambda: verifier.verify_pan(vendor.pan, vendor.legal_name)))
    if bank is not None:
        checks.append(
            (
                "bank_account",
                lambda: verifier.verify_bank_account(decrypt(bank.account_number_enc), bank.ifsc, bank.holder_name),
            )
        )
    for check, run in checks:
        try:
            result = run()
        except Exception as exc:  # the provider's problem, not the vendor's
            result = CheckResult(check=check, status="error", summary=f"Check failed: {type(exc).__name__}")
        if result is not None:
            db.add(
                VendorVerification(
                    vendor_id=vendor.id,
                    check=check,
                    provider=verifier.name,
                    status=result.status,
                    summary=result.summary[:300],
                    details=result.details,
                )
            )


def documents_by_id(db: Session, vendor: Vendor) -> dict[int, ErpDocument]:
    ids = [vendor.gst_certificate_doc_id, vendor.pan_card_doc_id]
    ids += [lic.document_id for lic in vendor.licences]
    if vendor.bank_account is not None:
        ids.append(vendor.bank_account.cheque_doc_id)
    ids = [i for i in ids if i is not None]
    if not ids:
        return {}
    return {d.id: d for d in db.scalars(select(ErpDocument).where(ErpDocument.id.in_(ids)))}
