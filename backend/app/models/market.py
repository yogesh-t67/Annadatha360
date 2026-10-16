from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Index, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MarketPrice(Base):
    """One Agmarknet price report: a commodity/variety/grade at a mandi on a date. Prices are ₹ per quintal."""

    __tablename__ = "market_prices"
    __table_args__ = (
        UniqueConstraint("state", "district", "market", "commodity", "variety", "grade", "arrival_date"),
        Index("ix_market_prices_crop_date", "crop_code", "arrival_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    crop_code: Mapped[str | None] = mapped_column(ForeignKey("crops.code"))  # null = commodity we don't map yet
    commodity: Mapped[str] = mapped_column(String(120))  # source name, e.g. "Paddy(Dhan)(Common)"
    variety: Mapped[str] = mapped_column(String(120), default="")
    grade: Mapped[str] = mapped_column(String(60), default="")
    state: Mapped[str] = mapped_column(String(60))  # "AP" | "TG"
    district: Mapped[str] = mapped_column(String(80))
    market: Mapped[str] = mapped_column(String(120))
    arrival_date: Mapped[date] = mapped_column(Date)
    min_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    max_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    modal_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    source: Mapped[str] = mapped_column(String(20), default="agmarknet")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
