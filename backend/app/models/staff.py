from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, JSONType


class Staff(Base):
    """Marks an account as Annadata staff. Staff log in with the normal phone OTP flow."""

    __tablename__ = "staff"

    id: Mapped[int] = mapped_column(primary_key=True)
    farmer_id: Mapped[int] = mapped_column(ForeignKey("farmers.id", ondelete="CASCADE"), unique=True)
    role: Mapped[str] = mapped_column(String(10))  # "ops" | "admin"
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    staff_farmer_id: Mapped[int | None] = mapped_column(ForeignKey("farmers.id", ondelete="SET NULL"), index=True)
    action: Mapped[str] = mapped_column(String(40))  # e.g. "order.status", "booking.status", "content.load"
    target_type: Mapped[str] = mapped_column(String(20))
    target_id: Mapped[int | None] = mapped_column(Integer)
    detail: Mapped[dict] = mapped_column(JSONType, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
