from datetime import datetime

from pydantic import BaseModel, Field


class NameIn(BaseModel):
    en: str = Field(min_length=2, max_length=120)
    te: str | None = Field(default=None, max_length=120)
    hi: str | None = Field(default=None, max_length=120)


class DescriptionIn(BaseModel):
    en: str | None = Field(default=None, max_length=2000)
    te: str | None = Field(default=None, max_length=2000)
    hi: str | None = Field(default=None, max_length=2000)


class VariantIn(BaseModel):
    id: str | None = Field(default=None, max_length=36)  # keep an existing variant's id when editing
    label: str = Field(min_length=1, max_length=60)  # "45 kg bag", "Per acre"
    unit: str = Field(max_length=12)
    sku: str | None = Field(default=None, max_length=60)
    mrp_paise: int | None = Field(default=None, ge=1, le=10**10)
    price_paise: int = Field(ge=1, le=10**10)
    stock_qty: int | None = Field(default=None, ge=0, le=10**7)
    daily_capacity: int | None = Field(default=None, ge=1, le=10**5)


class ListingIn(BaseModel):
    category: str = Field(max_length=30)  # one of the vendor's approved offerings
    item_type: str | None = Field(default=None, max_length=30)  # rental / services / labour
    name: NameIn
    description: DescriptionIn = DescriptionIn()
    brand: str | None = Field(default=None, max_length=80)
    attributes: dict[str, str] = Field(default_factory=dict, max_length=20)
    crop_codes: list[str] = Field(default_factory=list, max_length=30)
    district_codes: list[str] | None = Field(default=None, max_length=100)  # None: every district the vendor serves
    variants: list[VariantIn] = Field(min_length=1, max_length=10)


class VariantOut(BaseModel):
    id: str
    label: str
    unit: str
    sku: str | None
    mrp_paise: int | None
    price_paise: int
    discount_percent: int | None
    stock_qty: int | None
    daily_capacity: int | None


class ImageOut(BaseModel):
    key: str
    url: str


class ListingOut(BaseModel):
    id: str
    kind: str
    category: str
    category_name: str
    item_type: str | None
    item_type_name: str | None
    name: dict[str, str]
    description: dict[str, str]
    brand: str | None
    attributes: dict[str, str]
    crop_codes: list[str]
    district_codes: list[str]
    images: list[ImageOut]
    variants: list[VariantOut]
    enquiry_only: bool
    active: bool
    approval_status: str
    removed: bool
    removed_reason: str | None
    visible_to_farmers: (
        bool  # everything allows it: vendor approved, offering approved, licences valid, on, not removed
    )
    hidden_reason: str | None  # why not, in words for the vendor
    created_at: datetime
    updated_at: datetime


class AdminListingOut(ListingOut):
    vendor_id: str
    vendor_name: str
    vendor_status: str


class RemoveIn(BaseModel):
    reason: str = Field(min_length=10, max_length=2000)  # emailed to the vendor
