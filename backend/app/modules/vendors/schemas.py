from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, Field

from app.modules.iam.schemas import Email
from app.schemas.common import PhoneNumber


def _upper_strip(value: str) -> str:
    return value.strip().upper().replace(" ", "")


Code = Annotated[str, Field(max_length=20), AfterValidator(_upper_strip)]  # GSTIN, PAN, IFSC
DocumentId = Annotated[str, Field(max_length=36)]
VendorKind = Literal["business", "individual"]


class RegisterIn(BaseModel):
    email: Email
    full_name: str = Field(min_length=2, max_length=120)
    phone: PhoneNumber
    kind: VendorKind
    trade_name: str = Field(min_length=2, max_length=160)  # shop / business name farmers will see


class ProfileIn(BaseModel):
    """Business details. Every field may be empty while the application is a draft; Submit checks completeness."""

    kind: VendorKind
    trade_name: str = Field(min_length=2, max_length=160)
    legal_name: str | None = Field(default=None, max_length=160)
    business_type: str | None = Field(default=None, max_length=20)
    gstin: Code | None = None
    gst_certificate_document_id: DocumentId | None = None
    pan: Code | None = None
    pan_card_document_id: DocumentId | None = None
    address_line: str | None = Field(default=None, max_length=300)
    district_code: str | None = Field(default=None, max_length=60)  # state follows from the district
    pincode: str | None = Field(default=None, max_length=6)
    contact_phone: PhoneNumber | None = None
    contact_email: Email | None = None


class CapabilitiesIn(BaseModel):
    codes: list[str] = Field(max_length=20)
    labour_team_size: int | None = Field(default=None, ge=1, le=10000)


class ServiceAreasIn(BaseModel):
    district_codes: list[str] = Field(max_length=100)


class BankIn(BaseModel):
    holder_name: str = Field(min_length=2, max_length=160)
    ifsc: Code
    account_number: str = Field(min_length=9, max_length=18)
    cheque_document_id: DocumentId | None = None


class LicenceIn(BaseModel):
    licence_type: str = Field(max_length=30)
    number: str = Field(min_length=2, max_length=60)
    issuing_authority: str | None = Field(default=None, max_length=160)
    valid_from: date | None = None
    valid_until: date
    document_id: DocumentId | None = None


# ---------- Out ----------


class DocumentRef(BaseModel):
    id: str
    kind: str
    filename: str


class CapabilityOut(BaseModel):
    code: str
    name: str
    status: str


class AreaOut(BaseModel):
    code: str
    name: str
    state: str


class BankOut(BaseModel):
    holder_name: str
    ifsc: str
    account_masked: str  # "XXXXXX1234"
    bank_name: str | None  # from the IFSC directory, so the vendor can see a wrong IFSC at once
    branch: str | None
    cheque_document: DocumentRef | None
    verified: bool


class LicenceOut(BaseModel):
    id: str
    licence_type: str
    licence_name: str
    number: str
    issuing_authority: str | None
    valid_from: date | None
    valid_until: date
    expired: bool
    document: DocumentRef | None
    status: str  # valid | pending_review (renewal being checked) | rejected | superseded
    days_left: int  # negative once expired
    review_reason: str | None  # why a renewal was refused


class MissingItem(BaseModel):
    code: str  # stable, for the web app to link to the right section
    message: str


class VendorOut(BaseModel):
    id: str
    kind: str
    status: str
    editable: bool
    trade_name: str
    legal_name: str | None
    business_type: str | None
    gstin: str | None
    gstin_verified: bool
    gst_certificate_document: DocumentRef | None
    pan: str | None
    pan_card_document: DocumentRef | None
    address_line: str | None
    state: str | None
    district_code: str | None
    pincode: str | None
    postal_district: str | None  # India Post's district for the pincode
    contact_phone: str | None
    contact_email: str | None
    labour_team_size: int | None
    capabilities: list[CapabilityOut]
    service_areas: list[AreaOut]
    bank_account: BankOut | None
    licences: list[LicenceOut]
    missing: list[MissingItem]  # empty = ready to submit
    submitted_at: datetime | None
    rejection_reason: str | None


class RenewalIn(LicenceIn):
    document_id: DocumentId  # a renewal must come with the new copy
