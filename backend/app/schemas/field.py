from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, Field, PlainSerializer

from app.schemas.farmer import CropRef

# Stored as NUMERIC; sent over the wire as a JSON number.
Acreage = Annotated[
    Decimal,
    Field(gt=0, le=10000, max_digits=8, decimal_places=2),
    PlainSerializer(float, return_type=float),
]

GrowthStage = Literal[
    "land_preparation", "sowing", "germination", "vegetative", "flowering", "fruiting", "maturity", "harvested"
]


class FieldBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    acreage: Acreage
    growth_stage: GrowthStage | None = None
    planted_on: date | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    notes: str | None = Field(default=None, max_length=2000)


class FieldCreate(FieldBase):
    crop_code: str | None = None


class FieldUpdate(BaseModel):
    """PATCH semantics: only fields present in the body are changed."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    crop_code: str | None = None
    acreage: Acreage | None = None
    growth_stage: GrowthStage | None = None
    planted_on: date | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    notes: str | None = Field(default=None, max_length=2000)


class FieldOut(FieldBase):
    id: int
    crop: CropRef | None
    created_at: datetime
    updated_at: datetime
