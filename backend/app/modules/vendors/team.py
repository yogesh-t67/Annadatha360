"""A vendor owner's team: staff accounts that manage listings but never see KYC or bank details."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.api.deps import DbSession
from app.core.config import get_settings
from app.core.errors import AppError, not_found
from app.modules.audit.service import record
from app.modules.iam import service as iam
from app.modules.iam.deps import Principal, require
from app.modules.iam.models import ErpUser, ErpVendorMember
from app.modules.iam.permissions import P
from app.modules.iam.router import Email
from app.modules.iam.schemas import Email as EmailAddress
from app.modules.vendors.service import my_vendor
from app.schemas.common import PhoneNumber

router = APIRouter(prefix="/erp/vendor/team", tags=["erp-vendor"])

Owner = Annotated[Principal, Depends(require(P.VENDOR_TEAM_MANAGE))]


class TeamMemberOut(BaseModel):
    id: str
    full_name: str
    email: str
    phone: str | None
    role: str
    status: str
    last_login_at: datetime | None


class TeamInviteIn(BaseModel):
    email: EmailAddress
    full_name: str = Field(min_length=2, max_length=120)
    phone: PhoneNumber | None = None


def _member_out(user: ErpUser, role: str) -> TeamMemberOut:
    return TeamMemberOut(
        id=user.public_id,
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        role=role,
        status=user.status,
        last_login_at=user.last_login_at,
    )


def _team(db, vendor_id: int) -> list[TeamMemberOut]:
    rows = db.execute(
        select(ErpUser, ErpVendorMember.role_code)
        .join(ErpVendorMember, ErpVendorMember.user_id == ErpUser.id)
        .where(ErpVendorMember.vendor_id == vendor_id, ErpUser.deleted_at.is_(None))
        .order_by(ErpVendorMember.id)
    ).all()
    return [_member_out(u, role) for u, role in rows]


def _staff_member(db, vendor_id: int, public_id: str) -> ErpUser:
    user = db.scalar(
        select(ErpUser)
        .join(ErpVendorMember, ErpVendorMember.user_id == ErpUser.id)
        .where(
            ErpUser.public_id == public_id,
            ErpVendorMember.vendor_id == vendor_id,
            ErpVendorMember.role_code == "vendor_staff",
        )
    )
    if user is None:
        raise not_found("team_member")
    return user


@router.get("", response_model=list[TeamMemberOut])
def list_team(principal: Owner, db: DbSession):
    return _team(db, my_vendor(db, principal).id)


@router.post("", response_model=list[TeamMemberOut], status_code=status.HTTP_201_CREATED)
def invite_staff(body: TeamInviteIn, principal: Owner, db: DbSession, request: Request, mail: Email):
    vendor = my_vendor(db, principal)
    if db.scalar(select(ErpUser.id).where(ErpUser.email == body.email)) is not None:
        raise AppError(409, "email_taken", "This email already has an Annadata account. Use a different email.")
    user = ErpUser(
        email=body.email,
        full_name=body.full_name,
        phone=body.phone,
        user_type="vendor",
        status="invited",
        created_by_id=principal.user.id,
    )
    db.add(user)
    db.flush()
    db.add(ErpVendorMember(vendor_id=vendor.id, user_id=user.id, role_code="vendor_staff"))
    token = iam.create_invite(db, user)
    record(db, "erp.vendor.team.invite", "erp_user", user.id, actor_id=principal.user.id, request=request)
    db.commit()
    mail.send(
        user.email,
        f"{vendor.trade_name} invited you to Annadata 360",
        f"{principal.user.full_name} added you to {vendor.trade_name}'s team to manage products and services.\n"
        f"Set your password here (works once, for {get_settings().erp_invite_ttl_hours} hours):\n"
        f"{iam.invite_link(token)}",
    )
    return _team(db, vendor.id)


@router.post("/{user_id}/disable", response_model=list[TeamMemberOut])
def disable_staff(user_id: str, principal: Owner, db: DbSession, request: Request):
    vendor = my_vendor(db, principal)
    user = _staff_member(db, vendor.id, user_id)
    user.status = "disabled"
    iam.revoke_all_sessions(db, user, "disabled")
    record(db, "erp.vendor.team.disable", "erp_user", user.id, actor_id=principal.user.id, request=request)
    db.commit()
    return _team(db, vendor.id)


@router.post("/{user_id}/enable", response_model=list[TeamMemberOut])
def enable_staff(user_id: str, principal: Owner, db: DbSession, request: Request):
    vendor = my_vendor(db, principal)
    user = _staff_member(db, vendor.id, user_id)
    if user.status != "disabled":
        raise AppError(409, "not_disabled", "This person is not disabled")
    user.status = "active" if user.password_hash else "invited"
    record(db, "erp.vendor.team.enable", "erp_user", user.id, actor_id=principal.user.id, request=request)
    db.commit()
    return _team(db, vendor.id)
