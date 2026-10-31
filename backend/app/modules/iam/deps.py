from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.api.deps import DbSession
from app.core.errors import AppError
from app.modules.iam.models import ErpSession, ErpUser
from app.modules.iam.permissions import P
from app.modules.iam.service import session_from_access_token, user_permissions

_bearer = HTTPBearer(auto_error=False)


@dataclass
class Principal:
    user: ErpUser
    session: ErpSession
    permissions: set[str]

    def has(self, permission: P) -> bool:
        return str(permission) in self.permissions


def get_principal(
    db: DbSession, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]
) -> Principal:
    if credentials is None:
        raise AppError(401, "unauthorized", "Missing bearer token")
    found = session_from_access_token(db, credentials.credentials)
    if found is None:
        raise AppError(401, "invalid_token", "Session ended or token expired. Log in again.")
    user, session = found
    return Principal(user=user, session=session, permissions=user_permissions(user))


CurrentPrincipal = Annotated[Principal, Depends(get_principal)]


def require(*permissions: P):
    """Dependency: the logged-in ERP user must hold every one of these permissions."""

    def dependency(principal: CurrentPrincipal) -> Principal:
        if not all(principal.has(p) for p in permissions):
            raise AppError(403, "forbidden", "You don't have permission to do this")
        return principal

    return dependency
