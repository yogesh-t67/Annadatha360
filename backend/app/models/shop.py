from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.i18n import LocalizedText
from app.db.base import Base, JSONType, TimestampMixin

# All money is stored as integer paise (₹1 = 100 paise) to avoid rounding errors.


class ProductCategory(Base):
    __tablename__ = "product_categories"

    code: Mapped[str] = mapped_column(String(40), primary_key=True)  # seeds | fertilizers | pesticides | equipment
    name: Mapped[LocalizedText] = mapped_column(JSONType)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Product(TimestampMixin, Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    sku: Mapped[str] = mapped_column(String(60), unique=True)
    category_code: Mapped[str] = mapped_column(ForeignKey("product_categories.code"), index=True)
    name: Mapped[LocalizedText] = mapped_column(JSONType)
    description: Mapped[LocalizedText] = mapped_column(JSONType, default=dict)
    brand: Mapped[str | None] = mapped_column(String(80))
    pack_size: Mapped[str] = mapped_column(String(40))  # e.g. "25 kg bag", "500 ml"
    price_paise: Mapped[int] = mapped_column(Integer)
    mrp_paise: Mapped[int] = mapped_column(Integer)  # >= price; difference is the discount
    stock: Mapped[int] = mapped_column(Integer, default=0)
    image_urls: Mapped[list[str]] = mapped_column(JSONType, default=list)
    crop_codes: Mapped[list[str]] = mapped_column(JSONType, default=list)  # crops it's meant for; [] = any
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class CartItem(Base):
    __tablename__ = "cart_items"
    __table_args__ = (UniqueConstraint("farmer_id", "product_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    farmer_id: Mapped[int] = mapped_column(ForeignKey("farmers.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    quantity: Mapped[int] = mapped_column(Integer)

    product: Mapped[Product] = relationship()


class Order(TimestampMixin, Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    farmer_id: Mapped[int] = mapped_column(ForeignKey("farmers.id", ondelete="RESTRICT"), index=True)
    # pending_payment → paid → shipped → delivered; or pending_payment → cancelled | payment_failed
    status: Mapped[str] = mapped_column(String(20), index=True)
    total_paise: Mapped[int] = mapped_column(Integer)
    mrp_total_paise: Mapped[int] = mapped_column(Integer)
    delivery_address: Mapped[dict] = mapped_column(JSONType)
    payment_provider: Mapped[str] = mapped_column(String(20))
    provider_order_id: Mapped[str | None] = mapped_column(String(60), unique=True)
    provider_payment_id: Mapped[str | None] = mapped_column(String(60))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", order_by="OrderItem.id"
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id", ondelete="SET NULL"))
    # Snapshot at purchase time, so later catalogue edits don't change past orders.
    name: Mapped[LocalizedText] = mapped_column(JSONType)
    pack_size: Mapped[str] = mapped_column(String(40))
    unit_price_paise: Mapped[int] = mapped_column(Integer)
    unit_mrp_paise: Mapped[int] = mapped_column(Integer)
    quantity: Mapped[int] = mapped_column(Integer)

    order: Mapped[Order] = relationship(back_populates="items")
