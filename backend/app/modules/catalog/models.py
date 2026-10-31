"""Vendor listings: products, equipment rental, services and labour, each with its pack sizes or rates.

Separate from the farmer app's current shop tables (app.models.shop); the app moves to these with orders (Phase 3).
All money is integer paise (₹1 = 100 paise).
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.i18n import LocalizedText
from app.db.base import Base, JSONType, TimestampMixin
from app.modules.iam.models import new_public_id


class CatalogListing(TimestampMixin, Base):
    __tablename__ = "catalog_listings"

    id: Mapped[int] = mapped_column(primary_key=True)
    public_id: Mapped[str] = mapped_column(String(36), unique=True, default=new_public_id)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(10))  # product | rental | service | labour
    category: Mapped[str] = mapped_column(String(30), index=True)  # the vendor offering it's under, e.g. "seeds"
    item_type: Mapped[str | None] = mapped_column(String(30))  # rental/service/labour: "tractor", "ploughing"…
    name: Mapped[LocalizedText] = mapped_column(JSONType)  # {"en": …, "te": …, "hi": …}; English required
    description: Mapped[LocalizedText] = mapped_column(JSONType, default=dict)
    brand: Mapped[str | None] = mapped_column(String(80))
    attributes: Mapped[dict] = mapped_column(JSONType, default=dict)  # category details, see rules.ATTRIBUTES
    crop_codes: Mapped[list[str]] = mapped_column(JSONType, default=list)  # crops it's meant for; [] = any
    image_keys: Mapped[list[str]] = mapped_column(JSONType, default=list)  # public media, in display order
    enquiry_only: Mapped[bool] = mapped_column(Boolean, default=False)  # expensive: "Send enquiry", not "Buy"

    # Visibility. A listing reaches farmers only when all of these allow it (and the vendor is approved).
    active: Mapped[bool] = mapped_column(Boolean, default=True)  # vendor's own on/off switch
    approval_status: Mapped[str] = mapped_column(String(10), default="live")  # live | pending (if approval is on)
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # taken down by Annadata
    removed_reason: Mapped[str | None] = mapped_column(Text)
    removed_by_id: Mapped[int | None] = mapped_column(ForeignKey("erp_users.id", ondelete="SET NULL"))

    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("erp_users.id", ondelete="SET NULL"))
    updated_by_id: Mapped[int | None] = mapped_column(ForeignKey("erp_users.id", ondelete="SET NULL"))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    variants: Mapped[list["CatalogVariant"]] = relationship(
        cascade="all, delete-orphan", order_by="CatalogVariant.sort_order", lazy="selectin"
    )
    areas: Mapped[list["CatalogListingArea"]] = relationship(
        cascade="all, delete-orphan", order_by="CatalogListingArea.district_code", lazy="selectin"
    )


class CatalogVariant(Base):
    """A pack size (products) or a rate (rental, services, labour)."""

    __tablename__ = "catalog_variants"

    id: Mapped[int] = mapped_column(primary_key=True)
    public_id: Mapped[str] = mapped_column(String(36), unique=True, default=new_public_id)
    listing_id: Mapped[int] = mapped_column(ForeignKey("catalog_listings.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(60))  # "45 kg bag", "Per acre"
    unit: Mapped[str] = mapped_column(String(12))  # rules.UNITS
    sku: Mapped[str | None] = mapped_column(String(60))
    mrp_paise: Mapped[int | None] = mapped_column(Integer)  # products: printed MRP; price can't exceed it
    price_paise: Mapped[int] = mapped_column(Integer)
    stock_qty: Mapped[int | None] = mapped_column(Integer)  # products
    daily_capacity: Mapped[int | None] = mapped_column(Integer)  # rental/services/labour: units per day
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class CatalogListingArea(Base):
    """Districts where this listing is offered (a subset of the vendor's service areas)."""

    __tablename__ = "catalog_listing_areas"
    __table_args__ = (UniqueConstraint("listing_id", "district_code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("catalog_listings.id", ondelete="CASCADE"), index=True)
    district_code: Mapped[str] = mapped_column(String(60), index=True)
