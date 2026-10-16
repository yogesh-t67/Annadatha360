from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import Crop, Farmer

_bearer = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]


def get_current_farmer(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> Farmer:
    if credentials is None:
        raise AppError(401, "unauthorized", "Missing bearer token")
    farmer_id = decode_access_token(credentials.credentials)
    farmer = db.get(Farmer, farmer_id) if farmer_id is not None else None
    if farmer is None:
        raise AppError(401, "invalid_token", "Invalid or expired access token")
    return farmer


CurrentFarmer = Annotated[Farmer, Depends(get_current_farmer)]


def ensure_crop_exists(db: Session, code: str | None) -> None:
    if code is not None and db.get(Crop, code) is None:
        raise AppError(422, "unknown_crop", f"Unknown crop code: {code}")
