from fastapi import Request
from sqlalchemy.orm import Session

from app.models import AuditLog


def client_ip(request: Request | None) -> str | None:
    # Behind nginx the API only sees 127.0.0.1; nginx passes the real address on.
    if request is None:
        return None
    forwarded = request.headers.get("x-real-ip") or request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    return forwarded or (request.client.host if request.client else None)


def record(
    db: Session,
    action: str,
    target_type: str,
    target_id: int | None = None,
    *,
    actor_id: int | None = None,
    request: Request | None = None,
    **detail,
) -> None:
    """Adds an audit entry to the caller's transaction, so it is saved exactly when the change it describes is."""
    db.add(
        AuditLog(
            actor_user_id=actor_id,
            ip=client_ip(request),
            action=action,
            target_type=target_type,
            target_id=target_id,
            detail=detail,
        )
    )
