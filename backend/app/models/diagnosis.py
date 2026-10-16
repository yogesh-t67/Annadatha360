from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, JSONType


class Diagnosis(Base):
    """A photo diagnosis result. The photo itself is not stored yet (only its hash and size)."""

    __tablename__ = "diagnoses"

    id: Mapped[int] = mapped_column(primary_key=True)
    farmer_id: Mapped[int] = mapped_column(ForeignKey("farmers.id", ondelete="CASCADE"), index=True)
    field_id: Mapped[int | None] = mapped_column(ForeignKey("fields.id", ondelete="SET NULL"))
    crop_code: Mapped[str | None] = mapped_column(ForeignKey("crops.code"))
    language: Mapped[str] = mapped_column(String(5))
    notes: Mapped[str | None] = mapped_column(Text)
    image_sha256: Mapped[str] = mapped_column(String(64))
    image_bytes: Mapped[int] = mapped_column(Integer)
    image_media_type: Mapped[str] = mapped_column(String(20))
    result: Mapped[dict] = mapped_column(JSONType)
    model: Mapped[str] = mapped_column(String(60))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
