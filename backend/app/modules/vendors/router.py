from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import DbSession
from app.core.config import get_settings
from app.modules.audit.service import client_ip, record
from app.modules.documents.models import ErpDocument
from app.modules.iam.deps import CurrentPrincipal, Principal, require
from app.modules.iam.permissions import P
from app.modules.iam.router import Email
from app.modules.vendors import review, rules, service
from app.modules.vendors.models import EDITABLE_STATUSES, Vendor
from app.modules.vendors.schemas import (
    AreaOut,
    BankIn,
    BankOut,
    CapabilitiesIn,
    CapabilityOut,
    DocumentRef,
    LicenceIn,
    LicenceOut,
    ProfileIn,
    RegisterIn,
    ServiceAreasIn,
    VendorOut,
)
from app.modules.vendors.verification import KycVerifier, Lookups, get_kyc_verifier, get_lookups
from app.services.captcha import Captcha, get_captcha

router = APIRouter(prefix="/erp", tags=["erp-vendor"])

Editor = Annotated[Principal, Depends(require(P.VENDOR_PROFILE_EDIT))]
Submitter = Annotated[Principal, Depends(require(P.VENDOR_KYC_SUBMIT))]
Lookup = Annotated[Lookups, Depends(get_lookups)]
Verifier = Annotated[KycVerifier, Depends(get_kyc_verifier)]


def vendor_out(db: Session, vendor: Vendor) -> VendorOut:
    docs = service.documents_by_id(db, vendor)

    def ref(doc_id: int | None) -> DocumentRef | None:
        doc: ErpDocument | None = docs.get(doc_id) if doc_id is not None else None
        return DocumentRef(id=doc.public_id, kind=doc.kind, filename=doc.original_filename) if doc else None

    bank = vendor.bank_account
    today = rules.today()
    return VendorOut(
        id=vendor.public_id,
        kind=vendor.kind,
        status=vendor.status,
        editable=vendor.status in EDITABLE_STATUSES,
        trade_name=vendor.trade_name,
        legal_name=vendor.legal_name,
        business_type=vendor.business_type,
        gstin=vendor.gstin,
        gstin_verified=vendor.gstin_verified_at is not None,
        gst_certificate_document=ref(vendor.gst_certificate_doc_id),
        pan=vendor.pan,
        pan_card_document=ref(vendor.pan_card_doc_id),
        address_line=vendor.address_line,
        state=vendor.state,
        district_code=vendor.district_code,
        pincode=vendor.pincode,
        postal_district=vendor.postal_district,
        contact_phone=vendor.contact_phone,
        contact_email=vendor.contact_email,
        labour_team_size=vendor.labour_team_size,
        capabilities=[
            CapabilityOut(code=c.code, name=rules.CAPABILITIES[c.code].name, status=c.status)
            for c in vendor.capabilities
        ],
        service_areas=[
            AreaOut(
                code=a.district_code,
                name=rules.DISTRICT_CODES[a.district_code][0],
                state=rules.DISTRICT_CODES[a.district_code][1],
            )
            for a in vendor.service_areas
            if a.district_code in rules.DISTRICT_CODES
        ],
        bank_account=BankOut(
            holder_name=bank.holder_name,
            ifsc=bank.ifsc,
            account_masked="XXXXXX" + bank.account_last4,
            bank_name=bank.bank_name,
            branch=bank.branch,
            cheque_document=ref(bank.cheque_doc_id),
            verified=bank.verified_at is not None,
        )
        if bank
        else None,
        licences=[
            LicenceOut(
                id=lic.public_id,
                licence_type=lic.licence_type,
                licence_name=rules.LICENCE_TYPES.get(lic.licence_type, lic.licence_type),
                number=lic.number,
                issuing_authority=lic.issuing_authority,
                valid_from=lic.valid_from,
                valid_until=lic.valid_until,
                expired=lic.valid_until <= today,
                document=ref(lic.document_id),
                status=lic.status,
                days_left=(lic.valid_until - today).days,
                review_reason=lic.review_reason,
            )
            for lic in vendor.licences
        ],
        missing=service.missing_items(vendor),
        submitted_at=vendor.submitted_at,
        rejection_reason=vendor.rejection_reason,
    )


def saved(db, principal: Principal, vendor: Vendor, request: Request, action: str, **detail) -> VendorOut:
    record(db, action, "vendor", vendor.id, actor_id=principal.user.id, request=request, **detail)
    db.commit()
    db.refresh(vendor)
    return vendor_out(db, vendor)


# ---------- Public ----------


@router.get("/vendor-options")
def vendor_options():
    """Everything the registration form needs to show its choices."""
    return {
        "capabilities": [
            {"code": c.code, "name": c.name, "group": c.group, "licences": list(c.licences)}
            for c in rules.CAPABILITIES.values()
        ],
        "licence_types": rules.LICENCE_TYPES,
        "contract_labour_threshold": rules.CONTRACT_LABOUR_THRESHOLD,
        "business_types": list(rules.BUSINESS_TYPES),
        "districts": [{"code": code, "name": n, "state": s} for code, (n, s) in rules.DISTRICT_CODES.items()],
    }


@router.post("/vendors/register", status_code=status.HTTP_202_ACCEPTED)
def register(
    body: RegisterIn, db: DbSession, request: Request, mail: Email, captcha: Annotated[Captcha, Depends(get_captcha)]
):
    """Always the same answer, so the form can't be used to find out which emails have accounts."""
    captcha.verify(body.captcha_token, client_ip(request))
    created = service.register(db, body, client_ip(request))
    if created is None:
        db.commit()
        mail.send(
            body.email,
            "Annadata 360: you already have an account",
            "Someone (hopefully you) tried to register this email again.\n"
            "Log in instead, or use 'Forgot password' if you can't remember it.",
        )
    else:
        user, link = created
        record(db, "erp.vendor.register", "erp_user", user.id, actor_id=user.id, request=request, kind=body.kind)
        db.commit()
        hours = get_settings().erp_invite_ttl_hours
        mail.send(
            user.email,
            "Verify your email for Annadata 360",
            f"Welcome, {user.full_name}!\nConfirm your email and set your password here "
            f"(link works once, for {hours} hours):\n{link}",
        )
    return {"message": "Check your email for a link to continue."}


# ---------- My application ----------


@router.get("/vendor", response_model=VendorOut)
def get_my_vendor(principal: CurrentPrincipal, db: DbSession):
    return vendor_out(db, service.my_vendor(db, principal))


@router.put("/vendor/profile", response_model=VendorOut)
def put_profile(body: ProfileIn, principal: Editor, db: DbSession, request: Request, lookups: Lookup):
    vendor = service.editable_vendor(db, principal)
    service.update_profile(db, principal, vendor, body, lookups)
    return saved(db, principal, vendor, request, "erp.vendor.profile.update")


@router.put("/vendor/capabilities", response_model=VendorOut)
def put_capabilities(body: CapabilitiesIn, principal: Editor, db: DbSession, request: Request):
    vendor = service.editable_vendor(db, principal)
    service.update_capabilities(db, principal, vendor, body)
    return saved(db, principal, vendor, request, "erp.vendor.capabilities.update", codes=sorted(set(body.codes)))


@router.put("/vendor/service-areas", response_model=VendorOut)
def put_service_areas(body: ServiceAreasIn, principal: Editor, db: DbSession, request: Request):
    vendor = service.editable_vendor(db, principal)
    service.update_service_areas(db, principal, vendor, body.district_codes)
    return saved(db, principal, vendor, request, "erp.vendor.areas.update", count=len(set(body.district_codes)))


@router.put("/vendor/bank-account", response_model=VendorOut)
def put_bank(body: BankIn, principal: Editor, db: DbSession, request: Request, lookups: Lookup):
    vendor = service.editable_vendor(db, principal)
    service.update_bank(db, principal, vendor, body, lookups)
    return saved(db, principal, vendor, request, "erp.vendor.bank.update")  # never log the account number


@router.post("/vendor/licences", response_model=VendorOut, status_code=status.HTTP_201_CREATED)
def add_licence(body: LicenceIn, principal: Editor, db: DbSession, request: Request):
    vendor = service.editable_vendor(db, principal)
    service.save_licence(db, principal, vendor, body)
    return saved(db, principal, vendor, request, "erp.vendor.licence.add", licence_type=body.licence_type)


@router.put("/vendor/licences/{licence_id}", response_model=VendorOut)
def update_licence(licence_id: str, body: LicenceIn, principal: Editor, db: DbSession, request: Request):
    vendor = service.editable_vendor(db, principal)
    service.save_licence(db, principal, vendor, body, service.get_licence(vendor, licence_id))
    return saved(db, principal, vendor, request, "erp.vendor.licence.update", licence_type=body.licence_type)


@router.delete("/vendor/licences/{licence_id}", response_model=VendorOut)
def delete_licence(licence_id: str, principal: Editor, db: DbSession, request: Request):
    vendor = service.editable_vendor(db, principal)
    licence = service.get_licence(vendor, licence_id)
    vendor.licences.remove(licence)
    return saved(db, principal, vendor, request, "erp.vendor.licence.delete", licence_type=licence.licence_type)


@router.post("/vendor/submit", response_model=VendorOut)
def submit(principal: Submitter, db: DbSession, request: Request, mail: Email, verifier: Verifier):
    vendor = service.editable_vendor(db, principal)
    service.submit(db, principal, vendor)
    service.run_kyc_checks(db, vendor, verifier)
    if get_settings().vendor_auto_approve:
        review.auto_approve(db, vendor)
        record(db, "erp.vendor.auto_approve", "vendor", vendor.id, request=request)
    out = saved(db, principal, vendor, request, "erp.vendor.submit")
    if vendor.status == "approved":
        mail.send(
            principal.user.email,
            "Annadata 360: application approved",
            f"{vendor.trade_name} is approved on Annadata 360. You can now add your products and services.",
        )
    else:
        mail.send(
            principal.user.email,
            "Annadata 360: application received",
            f"Thank you. We have received the application for {vendor.trade_name} and will review it soon.",
        )
    return out
