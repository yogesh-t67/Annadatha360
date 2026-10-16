from datetime import date
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, PlainSerializer

from app.schemas.farmer import CropRef

Rupees = Annotated[Decimal, PlainSerializer(float, return_type=float)]


class PreviousPrice(BaseModel):
    arrival_date: date
    modal_price: Rupees


class MarketPriceOut(BaseModel):
    crop: CropRef | None
    commodity: str
    variety: str
    grade: str
    market: str
    district: str
    state: Literal["AP", "TG"]
    arrival_date: date
    unit: Literal["quintal"] = "quintal"
    currency: Literal["INR"] = "INR"
    min_price: Rupees | None
    max_price: Rupees | None
    modal_price: Rupees
    previous: PreviousPrice | None
    change: Rupees | None
    change_pct: float | None
    trend: Literal["up", "down", "flat"] | None


class MarketPricesOut(BaseModel):
    as_of: date | None
    prices: list[MarketPriceOut]
