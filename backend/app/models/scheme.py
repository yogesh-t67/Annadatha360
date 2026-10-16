from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.i18n import LocalizedText
from app.db.base import Base, JSONType, TimestampMixin


class Scheme(TimestampMixin, Base):
    """A government scheme. Text fields are LocalizedText; list fields are lists of LocalizedText."""

    __tablename__ = "schemes"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True)  # stable id, e.g. "pm-kisan"
    authority: Mapped[str] = mapped_column(String(10))  # "central" | "state"
    state: Mapped[str | None] = mapped_column(String(2))  # "AP" | "TG" for state schemes, NULL for central
    category: Mapped[str] = mapped_column(String(30))  # income_support | insurance | credit | subsidy | soil | irrigation | other
    name: Mapped[LocalizedText] = mapped_column(JSONType)
    summary: Mapped[LocalizedText] = mapped_column(JSONType)
    benefits: Mapped[LocalizedText] = mapped_column(JSONType, default=dict)
    eligibility: Mapped[list[LocalizedText]] = mapped_column(JSONType, default=list)
    documents: Mapped[list[LocalizedText]] = mapped_column(JSONType, default=list)
    steps: Mapped[list[LocalizedText]] = mapped_column(JSONType, default=list)
    application_url: Mapped[str | None] = mapped_column(String(300))
    source_url: Mapped[str] = mapped_column(String(300))  # official page the content was taken from
    # Optional machine-readable hints for "you may be eligible". The text in `eligibility` is authoritative.
    max_land_acres: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    crop_codes: Mapped[list[str]] = mapped_column(JSONType, default=list)  # [] = any crop
    last_verified_on: Mapped[date] = mapped_column(Date)
    published: Mapped[bool] = mapped_column(Boolean, default=False)
