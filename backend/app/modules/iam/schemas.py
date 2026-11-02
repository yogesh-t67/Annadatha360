from datetime import datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, Field

from app.schemas.common import PhoneNumber


def normalize_email(value: str) -> str:
    value = value.strip().lower()
    local, _, domain = value.partition("@")
    if not local or "." not in domain or " " in value:
        raise ValueError("Enter a valid email address")
    return value


Email = Annotated[str, Field(max_length=254), AfterValidator(normalize_email)]
Password = Annotated[str, Field(min_length=1, max_length=128)]


class LoginIn(BaseModel):
    email: Email
    password: Password


class LoginOut(BaseModel):
    # mfa: enter the 6-digit code; mfa_setup: first login, set up the authenticator app;
    # done: logged in with the password alone (ERP_MFA_REQUIRED off and no app set up) — session is filled in
    stage: Literal["mfa", "mfa_setup", "done"]
    mfa_token: str | None = None
    session: "SessionOut | None" = None


class MfaTokenIn(BaseModel):
    mfa_token: str = Field(max_length=2000)


class MfaSetupOut(BaseModel):
    secret: str  # for typing in by hand when the QR code can't be scanned
    otpauth_uri: str  # the web app turns this into the QR code


class MfaCodeIn(MfaTokenIn):
    code: str = Field(min_length=6, max_length=20)  # 6-digit app code, or a backup code like "a1b2c-3d4e5"


class MeOut(BaseModel):
    id: str
    email: str
    full_name: str
    user_type: str
    roles: list[str]
    permissions: list[str]


class SessionOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_token: str
    user: MeOut


class MfaActivatedOut(SessionOut):
    backup_codes: list[str]  # shown once; the user must save them


class RefreshIn(BaseModel):
    refresh_token: str = Field(max_length=200)


class InviteAcceptIn(BaseModel):
    token: str = Field(max_length=200)
    password: Password


class ForgotPasswordIn(BaseModel):
    email: Email


class ResetPasswordIn(BaseModel):
    token: str = Field(max_length=200)
    password: Password


class PasswordChangeIn(BaseModel):
    current_password: Password
    new_password: Password


class SessionInfo(BaseModel):
    id: str
    ip: str | None
    user_agent: str | None
    created_at: datetime
    last_seen_at: datetime
    current: bool


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    phone: str | None
    user_type: str
    status: str
    roles: list[str]
    mfa_enabled: bool
    last_login_at: datetime | None
    created_at: datetime


class UserInviteIn(BaseModel):
    email: Email
    full_name: str = Field(min_length=2, max_length=120)
    phone: PhoneNumber | None = None
    role: Literal["super_admin", "ops"]


class UserInvitedOut(UserOut):
    invite_expires_hours: int


LoginOut.model_rebuild()  # it refers to SessionOut, defined further down
