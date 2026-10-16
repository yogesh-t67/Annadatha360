from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import PhoneNumber

Kind = Literal["labour", "farm_service"]
Unit = Literal["worker_day", "acre", "hour", "sample", "trip"]
LabourWork = Literal["sowing", "transplanting", "weeding", "harvesting", "spraying", "general"]


class ServiceTypeOut(BaseModel):
    code: str
    kind: Kind
    unit: Unit


class OfferingOut(BaseModel):
    id: int
    service_type: str
    rate: float  # rupees per unit
    unit: Unit
    daily_capacity: int


class ProviderOut(BaseModel):
    id: int
    kind: Kind
    name: str
    phone: str
    description: str | None
    state: str
    district: str
    mandal: str | None
    rating: float | None
    rating_count: int
    verified: bool
    offerings: list[OfferingOut]


class DayAvailability(BaseModel):
    date: date
    remaining: int  # units still bookable that day


class AvailabilityOut(BaseModel):
    offering_id: int
    unit: Unit
    days: list[DayAvailability]


class BookingIn(BaseModel):
    offering_id: int
    date: date
    quantity: int = Field(ge=1, le=1000)
    field_id: int | None = None
    notes: str | None = Field(default=None, max_length=500)


BookingStatus = Literal["requested", "confirmed", "completed", "cancelled", "rejected"]


class BookingOut(BaseModel):
    id: int
    status: BookingStatus
    date: date
    quantity: int
    unit: Unit
    rate: float
    estimated_total: float
    service_type: str
    provider: ProviderOut
    field_id: int | None
    notes: str | None
    created_at: datetime


class RequirementIn(BaseModel):
    work_type: LabourWork
    workers_needed: int = Field(ge=1, le=500)
    start_date: date
    days: int = Field(ge=1, le=60)
    wage_per_day: float | None = Field(default=None, gt=0, le=10000)  # rupees per worker per day
    village: str | None = Field(default=None, max_length=120)
    contact_phone: PhoneNumber | None = None  # default: farmer's own phone
    description: str | None = Field(default=None, max_length=1000)


class RequirementOut(BaseModel):
    id: int
    work_type: LabourWork
    workers_needed: int
    start_date: date
    days: int
    wage_per_day: float | None
    state: str
    district: str
    mandal: str | None
    village: str | None
    contact_phone: str
    description: str | None
    status: Literal["open", "filled", "cancelled"]
    is_mine: bool
    created_at: datetime


class RequirementCloseIn(BaseModel):
    status: Literal["filled", "cancelled"]
