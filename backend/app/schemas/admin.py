from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.services import BookingOut
from app.schemas.shop import OrderOut


class FarmerRef(BaseModel):
    id: int
    name: str | None
    phone: str


class AdminOrderOut(OrderOut):
    farmer: FarmerRef


class AdminBookingOut(BookingOut):
    farmer: FarmerRef


class OrderStatusIn(BaseModel):
    status: Literal["shipped", "delivered", "refund_pending", "refunded", "cancelled"]
    note: str | None = Field(default=None, max_length=500)


class BookingStatusIn(BaseModel):
    status: Literal["confirmed", "rejected", "completed"]
    note: str | None = Field(default=None, max_length=500)


class FeatureUsage(BaseModel):
    requests: int
    cost_usd: float


class AiUsageOut(BaseModel):
    month_start: datetime
    budget_usd: float
    spent_usd: float
    remaining_usd: float
    by_feature: dict[str, FeatureUsage]
    by_model: dict[str, FeatureUsage]
    top_farmers: list[dict]  # [{farmer_id, requests, cost_usd}]


class ContentLoadOut(BaseModel):
    kind: str
    inserted: int
    updated: int


class AuditEntryOut(BaseModel):
    id: int
    staff_farmer_id: int | None
    action: str
    target_type: str
    target_id: int | None
    detail: dict
    created_at: datetime
