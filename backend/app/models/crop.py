from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.i18n import LocalizedText
from app.db.base import Base, JSONType


class Crop(Base):
    """Reference list of crops. Farmers/fields refer to crops by stable `code`."""

    __tablename__ = "crops"

    code: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[LocalizedText] = mapped_column(JSONType)
    category: Mapped[str] = mapped_column(String(40))  # cereal, pulse, oilseed, commercial, vegetable, fruit, spice
