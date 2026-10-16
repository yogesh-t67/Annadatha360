from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class Farmer(TimestampMixin, Base):
    __tablename__ = "farmers"

    id: Mapped[int] = mapped_column(primary_key=True)
    phone: Mapped[str] = mapped_column(String(16), unique=True, index=True)  # E.164, e.g. +919876543210
    name: Mapped[str | None] = mapped_column(String(120))
    preferred_language: Mapped[str] = mapped_column(String(5), default="te")

    state: Mapped[str | None] = mapped_column(String(40))  # "AP" | "TG"
    district: Mapped[str | None] = mapped_column(String(80))
    mandal: Mapped[str | None] = mapped_column(String(80))
    village: Mapped[str | None] = mapped_column(String(120))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)

    primary_crop_code: Mapped[str | None] = mapped_column(ForeignKey("crops.code"))

    fields: Mapped[list["Field"]] = relationship(  # noqa: F821
        back_populates="farmer", cascade="all, delete-orphan", passive_deletes=True
    )
