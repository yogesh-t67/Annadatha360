from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import DbSession
from app.models import AuditLog
from app.modules.iam.deps import Principal, require
from app.modules.iam.models import ErpUser
from app.modules.iam.permissions import P

router = APIRouter(prefix="/erp/audit", tags=["erp-audit"])


class AuditEntry(BaseModel):
    id: int
    action: str
    target_type: str
    target_id: int | None
    actor_email: str | None  # ERP account that did it
    staff_farmer_id: int | None  # app staff account (older admin API)
    ip: str | None
    detail: dict
    created_at: datetime


@router.get("", response_model=list[AuditEntry])
def list_audit(
    _: Annotated[Principal, Depends(require(P.AUDIT_VIEW))],
    db: DbSession,
    action: Annotated[str | None, Query(max_length=60, description="Prefix, e.g. 'erp.user'")] = None,
    target_type: Annotated[str | None, Query(max_length=40)] = None,
    target_id: int | None = None,
    before_id: Annotated[int | None, Query(description="For paging: entries older than this id")] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
):
    q = select(AuditLog, ErpUser.email).outerjoin(ErpUser, ErpUser.id == AuditLog.actor_user_id)
    if action:
        q = q.where(AuditLog.action.startswith(action, autoescape=True))
    if target_type:
        q = q.where(AuditLog.target_type == target_type)
    if target_id is not None:
        q = q.where(AuditLog.target_id == target_id)
    if before_id is not None:
        q = q.where(AuditLog.id < before_id)
    rows = db.execute(q.order_by(AuditLog.id.desc()).limit(limit)).all()
    return [
        AuditEntry(
            id=a.id,
            action=a.action,
            target_type=a.target_type,
            target_id=a.target_id,
            actor_email=email,
            staff_farmer_id=a.staff_farmer_id,
            ip=a.ip,
            detail=a.detail or {},
            created_at=a.created_at,
        )
        for a, email in rows
    ]
