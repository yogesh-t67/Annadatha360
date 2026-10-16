from datetime import date
from decimal import Decimal

from sqlalchemy import Date, Float, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class Field(TimestampMixin, Base):
    __tablename__ = "fields"

    id: Mapped[int] = mapped_column(primary_key=True)
    farmer_id: Mapped[int] = mapped_column(ForeignKey("farmers.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    crop_code: Mapped[str | None] = mapped_column(ForeignKey("crops.code"))
    acreage: Mapped[Decimal] = mapped_column(Numeric(8, 2))
    growth_stage: Mapped[str | None] = mapped_column(String(20))
    planted_on: Mapped[date | None] = mapped_column(Date)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    notes: Mapped[str | None] = mapped_column(Text)

    farmer: Mapped["Farmer"] = relationship(back_populates="fields")  # noqa: F821
