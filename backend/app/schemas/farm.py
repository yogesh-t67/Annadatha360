from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, Field, PlainSerializer, model_validator

from app.schemas.farmer import CropRef

Season = Literal["kharif", "rabi", "summer"]
PlanStatus = Literal["planned", "active", "harvested", "abandoned"]
TaskCategory = Literal[
    "land_preparation", "sowing", "fertilizer", "irrigation", "weeding", "spraying", "harvest", "labour", "other"
]
YieldUnit = Literal["quintal", "kg", "tonne"]
Quantity = Annotated[
    Decimal, Field(gt=0, le=1_000_000, max_digits=10, decimal_places=2), PlainSerializer(float, return_type=float)
]
Rupees = Annotated[float, Field(ge=0, le=10_000_000)]


def _check_dates(sowing: date | None, harvest: date | None) -> None:
    if sowing and harvest and harvest < sowing:
        raise ValueError("expected_harvest_date can't be before sowing_date")


class PlanIn(BaseModel):
    crop_code: str
    season: Season
    year: int = Field(ge=2000, le=2100)
    sowing_date: date | None = None
    expected_harvest_date: date | None = None
    status: PlanStatus = "planned"
    notes: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def _dates(self):
        _check_dates(self.sowing_date, self.expected_harvest_date)
        return self


class PlanUpdate(BaseModel):
    crop_code: str | None = None
    season: Season | None = None
    year: int | None = Field(default=None, ge=2000, le=2100)
    sowing_date: date | None = None
    expected_harvest_date: date | None = None
    status: PlanStatus | None = None
    notes: str | None = Field(default=None, max_length=2000)


class TaskIn(BaseModel):
    category: TaskCategory
    title: str = Field(min_length=1, max_length=120)
    due_date: date | None = None
    done: bool = False
    cost: Rupees | None = None


class TaskUpdate(BaseModel):
    category: TaskCategory | None = None
    title: str | None = Field(default=None, min_length=1, max_length=120)
    due_date: date | None = None
    done: bool | None = None
    cost: Rupees | None = None


class TaskOut(BaseModel):
    id: int
    category: TaskCategory
    title: str
    due_date: date | None
    done: bool
    cost: float | None


class PlanSummary(BaseModel):
    """Money is rupees. Revenue counts only sold quantity with a price. Harvest totals are per unit."""

    total_cost: float
    revenue: float
    profit: float
    harvested: dict[str, float]  # unit → quantity, e.g. {"quintal": 42.5}
    tasks_done: int
    tasks_total: int


class PlanOut(BaseModel):
    id: int
    field_id: int
    crop: CropRef
    season: Season
    year: int
    sowing_date: date | None
    expected_harvest_date: date | None
    days_since_sowing: int | None
    status: PlanStatus
    notes: str | None
    tasks: list[TaskOut]
    summary: PlanSummary
    created_at: datetime
    updated_at: datetime


class HarvestIn(BaseModel):
    field_id: int
    plan_id: int | None = None
    crop_code: str | None = None  # default: the plan's crop, else the field's crop
    harvest_date: date
    quantity: Quantity
    unit: YieldUnit
    sold_quantity: Quantity | None = None
    price_per_unit: Rupees | None = None
    buyer: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def _sold(self):
        if self.sold_quantity is not None and self.sold_quantity > self.quantity:
            raise ValueError("sold_quantity can't exceed quantity")
        return self


class HarvestUpdate(BaseModel):
    harvest_date: date | None = None
    quantity: Quantity | None = None
    unit: YieldUnit | None = None
    sold_quantity: Quantity | None = None
    price_per_unit: Rupees | None = None
    buyer: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=1000)


class HarvestOut(BaseModel):
    id: int
    field_id: int
    plan_id: int | None
    crop: CropRef
    harvest_date: date
    quantity: float
    unit: YieldUnit
    sold_quantity: float | None
    price_per_unit: float | None
    revenue: float | None  # sold_quantity × price_per_unit, when both are known
    buyer: str | None
    notes: str | None
    created_at: datetime
