from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class CropPlan(TimestampMixin, Base):
    """One crop on one field for one season."""

    __tablename__ = "crop_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    farmer_id: Mapped[int] = mapped_column(ForeignKey("farmers.id", ondelete="CASCADE"), index=True)
    field_id: Mapped[int] = mapped_column(ForeignKey("fields.id", ondelete="CASCADE"), index=True)
    crop_code: Mapped[str] = mapped_column(ForeignKey("crops.code"))
    season: Mapped[str] = mapped_column(String(10))  # kharif | rabi | summer
    year: Mapped[int] = mapped_column(Integer)
    sowing_date: Mapped[date | None] = mapped_column(Date)
    expected_harvest_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(12), default="planned")  # planned | active | harvested | abandoned
    notes: Mapped[str | None] = mapped_column(Text)

    tasks: Mapped[list["PlanTask"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan", order_by="PlanTask.due_date, PlanTask.id"
    )
    harvests: Mapped[list["HarvestRecord"]] = relationship(back_populates="plan")


class PlanTask(TimestampMixin, Base):
    __tablename__ = "plan_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("crop_plans.id", ondelete="CASCADE"), index=True)
    category: Mapped[str] = mapped_column(String(20))  # land_preparation | sowing | fertilizer | irrigation | ...
    title: Mapped[str] = mapped_column(String(120))
    due_date: Mapped[date | None] = mapped_column(Date)
    done: Mapped[bool] = mapped_column(Boolean, default=False)
    cost_paise: Mapped[int | None] = mapped_column(Integer)  # what the farmer spent on it

    plan: Mapped[CropPlan] = relationship(back_populates="tasks")


class HarvestRecord(TimestampMixin, Base):
    __tablename__ = "harvest_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    farmer_id: Mapped[int] = mapped_column(ForeignKey("farmers.id", ondelete="CASCADE"), index=True)
    field_id: Mapped[int] = mapped_column(ForeignKey("fields.id", ondelete="CASCADE"), index=True)
    plan_id: Mapped[int | None] = mapped_column(ForeignKey("crop_plans.id", ondelete="SET NULL"), index=True)
    crop_code: Mapped[str] = mapped_column(ForeignKey("crops.code"))
    harvest_date: Mapped[date] = mapped_column(Date)
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    unit: Mapped[str] = mapped_column(String(10))  # quintal | kg | tonne
    sold_quantity: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    price_per_unit_paise: Mapped[int | None] = mapped_column(Integer)  # sale price per `unit`
    buyer: Mapped[str | None] = mapped_column(String(120))  # mandi / trader name
    notes: Mapped[str | None] = mapped_column(Text)

    plan: Mapped[CropPlan | None] = relationship(back_populates="harvests")
