from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, Float, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.i18n import LocalizedText
from app.db.base import Base, JSONType, TimestampMixin

# Service type → (kind, unit). Units: what rate_paise is charged per, and what booking quantity counts.
SERVICE_TYPES: dict[str, tuple[str, str]] = {
    # Labour (per worker per day)
    "labour_sowing": ("labour", "worker_day"),
    "labour_transplanting": ("labour", "worker_day"),
    "labour_weeding": ("labour", "worker_day"),
    "labour_harvesting": ("labour", "worker_day"),
    "labour_spraying": ("labour", "worker_day"),
    "labour_general": ("labour", "worker_day"),
    # Farm services
    "tractor_ploughing": ("farm_service", "acre"),
    "tractor_rental": ("farm_service", "hour"),
    "harvester": ("farm_service", "acre"),
    "drone_spraying": ("farm_service", "acre"),
    "soil_testing": ("farm_service", "sample"),
    "transport": ("farm_service", "trip"),
}


class ServiceProvider(TimestampMixin, Base):
    __tablename__ = "service_providers"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(60), unique=True)  # stable id for the loader
    kind: Mapped[str] = mapped_column(String(20), index=True)  # "labour" | "farm_service"
    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(16))
    description: Mapped[LocalizedText] = mapped_column(JSONType, default=dict)
    state: Mapped[str] = mapped_column(String(2))
    district: Mapped[str] = mapped_column(String(80))
    mandal: Mapped[str | None] = mapped_column(String(80))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    rating: Mapped[Decimal | None] = mapped_column(Numeric(2, 1))
    rating_count: Mapped[int] = mapped_column(Integer, default=0)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    offerings: Mapped[list["ServiceOffering"]] = relationship(
        back_populates="provider", cascade="all, delete-orphan", order_by="ServiceOffering.id"
    )


class ServiceOffering(Base):
    __tablename__ = "service_offerings"

    id: Mapped[int] = mapped_column(primary_key=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("service_providers.id", ondelete="CASCADE"), index=True)
    service_type: Mapped[str] = mapped_column(String(30), index=True)
    rate_paise: Mapped[int] = mapped_column(Integer)
    unit: Mapped[str] = mapped_column(String(20))
    daily_capacity: Mapped[int] = mapped_column(Integer)  # units per day (workers, acres, hours, samples, trips)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    provider: Mapped[ServiceProvider] = relationship(back_populates="offerings")


class ServiceBooking(TimestampMixin, Base):
    __tablename__ = "service_bookings"

    id: Mapped[int] = mapped_column(primary_key=True)
    farmer_id: Mapped[int] = mapped_column(ForeignKey("farmers.id", ondelete="CASCADE"), index=True)
    offering_id: Mapped[int] = mapped_column(ForeignKey("service_offerings.id", ondelete="RESTRICT"), index=True)
    field_id: Mapped[int | None] = mapped_column(ForeignKey("fields.id", ondelete="SET NULL"))
    date: Mapped[date] = mapped_column(Date, index=True)
    quantity: Mapped[int] = mapped_column(Integer)
    rate_paise: Mapped[int] = mapped_column(Integer)  # snapshot at booking time
    # requested → confirmed → completed; or → cancelled (farmer) / rejected (provider)
    status: Mapped[str] = mapped_column(String(20))
    notes: Mapped[str | None] = mapped_column(Text)

    offering: Mapped[ServiceOffering] = relationship()


class LabourRequirement(TimestampMixin, Base):
    """A farmer's "need N workers" post, visible to others in the district."""

    __tablename__ = "labour_requirements"

    id: Mapped[int] = mapped_column(primary_key=True)
    farmer_id: Mapped[int] = mapped_column(ForeignKey("farmers.id", ondelete="CASCADE"), index=True)
    work_type: Mapped[str] = mapped_column(String(30))
    workers_needed: Mapped[int] = mapped_column(Integer)
    start_date: Mapped[date] = mapped_column(Date)
    days: Mapped[int] = mapped_column(Integer)
    wage_per_day_paise: Mapped[int | None] = mapped_column(Integer)
    state: Mapped[str] = mapped_column(String(2))
    district: Mapped[str] = mapped_column(String(80), index=True)
    mandal: Mapped[str | None] = mapped_column(String(80))
    village: Mapped[str | None] = mapped_column(String(120))
    contact_phone: Mapped[str] = mapped_column(String(16))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="open")  # open | filled | cancelled
