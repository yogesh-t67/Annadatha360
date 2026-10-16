from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.i18n import Language


class CropRef(BaseModel):
    code: str
    name: str  # resolved to the farmer's language


class Location(BaseModel):
    state: str | None = Field(default=None, pattern=r"^(AP|TG)$")
    district: str | None = Field(default=None, max_length=80)
    mandal: str | None = Field(default=None, max_length=80)
    village: str | None = Field(default=None, max_length=120)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


class FarmerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    phone: str
    name: str | None
    preferred_language: Language
    location: Location
    primary_crop: CropRef | None
    profile_complete: bool
    created_at: datetime


class FarmerUpdate(BaseModel):
    """PATCH semantics: only fields present in the body are changed."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    preferred_language: Language | None = None
    location: Location | None = None
    primary_crop_code: str | None = None
