from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.i18n import LocalizedText
from app.db.base import Base, JSONType, TimestampMixin


class Advisory(TimestampMixin, Base):
    """Curated crop advice, targeted by crop and growth stage. AI diagnoses are stored separately (Diagnosis)."""

    __tablename__ = "advisories"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True)
    crop_code: Mapped[str | None] = mapped_column(ForeignKey("crops.code"), index=True)  # NULL = any crop
    growth_stage: Mapped[str | None] = mapped_column(String(20))  # same codes as fields; NULL = any stage
    # nutrition | pest_disease | irrigation | weed | harvest | weather | general
    category: Mapped[str] = mapped_column(String(20))
    title: Mapped[LocalizedText] = mapped_column(JSONType)
    body: Mapped[LocalizedText] = mapped_column(JSONType)  # plain text; paragraphs separated by blank lines
    source_url: Mapped[str] = mapped_column(String(300))  # e.g. agricultural university / ICAR page
    last_verified_on: Mapped[date] = mapped_column(Date)
    published: Mapped[bool] = mapped_column(Boolean, default=False)
