"""Vendors (any farm business) and their KYC application."""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.modules.iam.models import new_public_id

# draft → submitted → under_review → approved | rejected (→ edit → submitted again); approved → suspended → approved
VENDOR_STATUSES = ("draft", "submitted", "under_review", "approved", "rejected", "suspended")
EDITABLE_STATUSES = ("draft", "rejected")


class Vendor(TimestampMixin, Base):
    __tablename__ = "vendors"

    id: Mapped[int] = mapped_column(primary_key=True)
    public_id: Mapped[str] = mapped_column(String(36), unique=True, default=new_public_id)
    kind: Mapped[str] = mapped_column(String(12))  # "business" (has GSTIN) | "individual" (PAN only)
    status: Mapped[str] = mapped_column(String(15), default="draft", index=True)

    # Business details (may be empty while the application is a draft)
    legal_name: Mapped[str | None] = mapped_column(String(160))  # as on PAN / GST certificate
    trade_name: Mapped[str] = mapped_column(String(160))  # shown to farmers
    business_type: Mapped[str | None] = mapped_column(String(20))  # rules.BUSINESS_TYPES
    gstin: Mapped[str | None] = mapped_column(String(15), unique=True)
    gstin_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    gst_certificate_doc_id: Mapped[int | None] = mapped_column(ForeignKey("erp_documents.id", ondelete="SET NULL"))
    pan: Mapped[str | None] = mapped_column(String(10), index=True)
    pan_card_doc_id: Mapped[int | None] = mapped_column(ForeignKey("erp_documents.id", ondelete="SET NULL"))
    address_line: Mapped[str | None] = mapped_column(String(300))
    state: Mapped[str | None] = mapped_column(String(2))  # "AP" | "TG"
    district_code: Mapped[str | None] = mapped_column(String(60))  # rules.DISTRICT_CODES
    pincode: Mapped[str | None] = mapped_column(String(6))
    contact_phone: Mapped[str | None] = mapped_column(String(16))
    contact_email: Mapped[str | None] = mapped_column(String(254))
    labour_team_size: Mapped[int | None] = mapped_column(Integer)  # labour contractors only

    # Review
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decided_by_id: Mapped[int | None] = mapped_column(ForeignKey("erp_users.id", ondelete="SET NULL"))
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    suspended_reason: Mapped[str | None] = mapped_column(Text)

    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("erp_users.id", ondelete="SET NULL"))
    updated_by_id: Mapped[int | None] = mapped_column(ForeignKey("erp_users.id", ondelete="SET NULL"))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    capabilities: Mapped[list["VendorCapability"]] = relationship(
        cascade="all, delete-orphan", order_by="VendorCapability.code", lazy="selectin"
    )
    service_areas: Mapped[list["VendorServiceArea"]] = relationship(
        cascade="all, delete-orphan", order_by="VendorServiceArea.district_code", lazy="selectin"
    )
    licences: Mapped[list["VendorLicence"]] = relationship(
        cascade="all, delete-orphan", order_by="VendorLicence.id", lazy="selectin"
    )
    bank_account: Mapped["VendorBankAccount | None"] = relationship(
        cascade="all, delete-orphan", uselist=False, lazy="selectin"
    )


class VendorCapability(Base):
    """What the vendor offers (rules.CAPABILITIES). Each is approved separately at review."""

    __tablename__ = "vendor_capabilities"
    __table_args__ = (UniqueConstraint("vendor_id", "code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id", ondelete="CASCADE"), index=True)
    code: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(10), default="pending")  # pending | approved | rejected


class VendorServiceArea(Base):
    """Districts the vendor serves; drives the farmer app's district directory."""

    __tablename__ = "vendor_service_areas"
    __table_args__ = (UniqueConstraint("vendor_id", "district_code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id", ondelete="CASCADE"), index=True)
    district_code: Mapped[str] = mapped_column(String(60), index=True)


class VendorLicence(TimestampMixin, Base):
    __tablename__ = "vendor_licences"

    id: Mapped[int] = mapped_column(primary_key=True)
    public_id: Mapped[str] = mapped_column(String(36), unique=True, default=new_public_id)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id", ondelete="CASCADE"), index=True)
    licence_type: Mapped[str] = mapped_column(String(30))  # rules.LICENCE_TYPES
    number: Mapped[str] = mapped_column(String(60))
    issuing_authority: Mapped[str | None] = mapped_column(String(160))
    valid_from: Mapped[date | None] = mapped_column(Date)
    valid_until: Mapped[date] = mapped_column(Date, index=True)  # expiry reminders and auto-suspension use this
    document_id: Mapped[int | None] = mapped_column(ForeignKey("erp_documents.id", ondelete="SET NULL"))


class VendorBankAccount(TimestampMixin, Base):
    """Where payouts go. The account number is encrypted; only the last 4 digits are ever shown."""

    __tablename__ = "vendor_bank_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id", ondelete="CASCADE"), unique=True)
    holder_name: Mapped[str] = mapped_column(String(160))
    ifsc: Mapped[str] = mapped_column(String(11))
    account_number_enc: Mapped[str] = mapped_column(String(255))
    account_last4: Mapped[str] = mapped_column(String(4))
    cheque_doc_id: Mapped[int | None] = mapped_column(ForeignKey("erp_documents.id", ondelete="SET NULL"))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # penny-drop check, later


class VendorStatusHistory(Base):
    __tablename__ = "vendor_status_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id", ondelete="CASCADE"), index=True)
    from_status: Mapped[str | None] = mapped_column(String(15))
    to_status: Mapped[str] = mapped_column(String(15))
    reason: Mapped[str | None] = mapped_column(Text)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("erp_users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class VendorNote(Base):
    """Internal review notes by Annadata staff. Never shown to the vendor."""

    __tablename__ = "vendor_notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[int | None] = mapped_column(ForeignKey("erp_users.id", ondelete="SET NULL"))
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
