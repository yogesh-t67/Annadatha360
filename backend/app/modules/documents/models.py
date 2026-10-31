from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.modules.iam.models import new_public_id


class ErpDocument(Base):
    """A private file (KYC proof, licence…). Bytes are in DocumentStorage; this row is everything else."""

    __tablename__ = "erp_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    public_id: Mapped[str] = mapped_column(String(36), unique=True, default=new_public_id)
    kind: Mapped[str] = mapped_column(String(40))  # see kinds.DOCUMENT_KINDS
    # Who it belongs to. "erp_user": uploaded but not yet attached; "vendor": part of a vendor's KYC.
    owner_type: Mapped[str] = mapped_column(String(20))
    owner_id: Mapped[int] = mapped_column(Integer)
    storage_key: Mapped[str] = mapped_column(String(60), unique=True)
    original_filename: Mapped[str] = mapped_column(String(200))
    content_type: Mapped[str] = mapped_column(String(40))
    size_bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    uploaded_by_id: Mapped[int | None] = mapped_column(ForeignKey("erp_users.id", ondelete="SET NULL"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_by_id: Mapped[int | None] = mapped_column(ForeignKey("erp_users.id", ondelete="SET NULL"))

    __table_args__ = (Index("ix_erp_documents_owner", "owner_type", "owner_id"),)
