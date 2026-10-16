from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import PhoneNumber


class CategoryOut(BaseModel):
    code: str
    name: str


class ProductOut(BaseModel):
    id: int
    sku: str
    category: CategoryOut
    name: str
    description: str | None
    brand: str | None
    pack_size: str
    price: float  # rupees
    mrp: float
    discount_pct: int  # whole percent off MRP; 0 = no discount
    in_stock: bool
    stock: int
    image_urls: list[str]
    crop_codes: list[str]


class CartQuantityIn(BaseModel):
    quantity: int = Field(ge=0, le=100)  # 0 removes the item


class CartLineOut(BaseModel):
    product: ProductOut
    quantity: int
    line_total: float
    available: bool  # false → inactive or not enough stock; checkout will fail until fixed


class CartOut(BaseModel):
    items: list[CartLineOut]
    item_count: int
    total: float
    mrp_total: float
    savings: float


class Address(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: PhoneNumber
    line1: str = Field(min_length=1, max_length=200)
    village: str | None = Field(default=None, max_length=120)
    mandal: str | None = Field(default=None, max_length=80)
    district: str = Field(min_length=1, max_length=80)
    state: Literal["AP", "TG"]
    pincode: str = Field(pattern=r"^[1-9]\d{5}$")


class PlaceOrderIn(BaseModel):
    address: Address
    payment_method: Literal["online", "cod"] = "online"


class OrderLineOut(BaseModel):
    product_id: int | None
    name: str
    pack_size: str
    unit_price: float
    quantity: int
    line_total: float


class PaymentInfo(BaseModel):
    """What the app passes to Razorpay Checkout."""

    provider: Literal["razorpay", "fake"]
    key_id: str
    provider_order_id: str
    amount_paise: int
    currency: Literal["INR"] = "INR"


OrderStatus = Literal[
    "pending_payment", "confirmed", "paid", "shipped", "delivered", "cancelled", "refund_pending", "refunded"
]


class OrderOut(BaseModel):
    id: int
    status: OrderStatus
    payment_method: Literal["online", "cod"]
    items: list[OrderLineOut]
    total: float
    mrp_total: float
    savings: float
    delivery_address: Address
    payment: PaymentInfo | None  # present only while status is pending_payment
    pay_by: datetime | None
    paid_at: datetime | None
    created_at: datetime


class VerifyPaymentIn(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
