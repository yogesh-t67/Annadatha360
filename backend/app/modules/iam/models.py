"""ERP accounts (Annadata staff and vendors). Separate from `farmers`: a vendor is never a farmer record."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


def new_public_id() -> str:
    return str(uuid.uuid4())


class ErpUser(TimestampMixin, Base):
    __tablename__ = "erp_users"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Used in URLs and tokens instead of `id`, so accounts can't be counted or guessed.
    public_id: Mapped[str] = mapped_column(String(36), unique=True, default=new_public_id)
    email: Mapped[str] = mapped_column(String(254), unique=True)  # stored lower-case
    full_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(16))  # contact only, never used to log in
    user_type: Mapped[str] = mapped_column(String(10))  # "platform" | "vendor"
    # invited (no password yet) → active; disabled blocks login and ends all sessions
    status: Mapped[str] = mapped_column(String(10), default="invited", index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    totp_secret_enc: Mapped[str | None] = mapped_column(String(255))  # encrypted, see app.core.crypto
    totp_enabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    totp_last_step: Mapped[int | None] = mapped_column(Integer)  # last accepted 30 s step: a code works once
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("erp_users.id", ondelete="SET NULL"))
    updated_by_id: Mapped[int | None] = mapped_column(ForeignKey("erp_users.id", ondelete="SET NULL"))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    roles: Mapped[list["ErpUserRole"]] = relationship(
        cascade="all, delete-orphan", passive_deletes=True, foreign_keys="ErpUserRole.user_id", lazy="selectin"
    )
    vendor_membership: Mapped["ErpVendorMember | None"] = relationship(
        uselist=False, passive_deletes=True, lazy="selectin"
    )

    @property
    def role_codes(self) -> list[str]:
        """Platform roles, plus the vendor team role for vendor accounts."""
        codes = {r.role_code for r in self.roles}
        if self.vendor_membership is not None:
            codes.add(self.vendor_membership.role_code)
        return sorted(codes)

    @property
    def vendor_id(self) -> int | None:
        return self.vendor_membership.vendor_id if self.vendor_membership is not None else None


class ErpUserRole(Base):
    """Platform roles (super_admin, ops). Vendor roles are per vendor and live with the vendor's team."""

    __tablename__ = "erp_user_roles"
    __table_args__ = (UniqueConstraint("user_id", "role_code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("erp_users.id", ondelete="CASCADE"), index=True)
    role_code: Mapped[str] = mapped_column(String(30))
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("erp_users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ErpVendorMember(Base):
    """A vendor-side account's place in its vendor's team (vendor_owner or vendor_staff). One vendor per account."""

    __tablename__ = "erp_vendor_members"
    __table_args__ = (UniqueConstraint("user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("erp_users.id", ondelete="CASCADE"))
    role_code: Mapped[str] = mapped_column(String(30))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ErpSession(Base):
    """One logged-in device. Access tokens carry its id, so ending a session ends access within the same request."""

    __tablename__ = "erp_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    public_id: Mapped[str] = mapped_column(String(36), unique=True, default=new_public_id)
    user_id: Mapped[int] = mapped_column(ForeignKey("erp_users.id", ondelete="CASCADE"), index=True)
    refresh_hash: Mapped[str] = mapped_column(String(64), unique=True)
    # The refresh token before the last rotation. If it is ever presented again it was stolen: end the session.
    previous_refresh_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    ip: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoke_reason: Mapped[str | None] = mapped_column(String(30))


class ErpUserToken(Base):
    """One-time links sent by email (invites; later password reset and email verification)."""

    __tablename__ = "erp_user_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("erp_users.id", ondelete="CASCADE"), index=True)
    purpose: Mapped[str] = mapped_column(String(20))  # "invite"
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ErpBackupCode(Base):
    """Ten one-time codes for when the authenticator phone is lost."""

    __tablename__ = "erp_backup_codes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("erp_users.id", ondelete="CASCADE"), index=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ErpLoginAttempt(Base):
    """Every password and code attempt, right or wrong. Drives account lockout and per-IP limits."""

    __tablename__ = "erp_login_attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), index=True)
    ip: Mapped[str | None] = mapped_column(String(45), index=True)
    stage: Mapped[str] = mapped_column(String(10))  # "password" | "mfa"
    success: Mapped[bool] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
