from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy import func, select

from app.api.deps import DbSession
from app.core.config import get_settings
from app.core.errors import AppError, not_found
from app.modules.audit.service import client_ip, record
from app.modules.iam import service
from app.modules.iam.deps import CurrentPrincipal, Principal, require
from app.modules.iam.models import ErpBackupCode, ErpSession, ErpUser, ErpUserRole
from app.modules.iam.permissions import P
from app.modules.iam.schemas import (
    ForgotPasswordIn,
    InviteAcceptIn,
    LoginIn,
    LoginOut,
    MeOut,
    MfaActivatedOut,
    MfaCodeIn,
    MfaSetupOut,
    MfaTokenIn,
    PasswordChangeIn,
    RefreshIn,
    ResetPasswordIn,
    SessionInfo,
    SessionOut,
    UserInvitedOut,
    UserInviteIn,
    UserOut,
)
from app.services.email import EmailSender, get_email_sender

router = APIRouter(prefix="/erp", tags=["erp-auth"])
Email = Annotated[EmailSender, Depends(get_email_sender)]


def me_out(user: ErpUser) -> MeOut:
    return MeOut(
        id=user.public_id,
        email=user.email,
        full_name=user.full_name,
        user_type=user.user_type,
        roles=user.role_codes,
        permissions=sorted(service.user_permissions(user)),
    )


def user_out(user: ErpUser) -> UserOut:
    return UserOut(
        id=user.public_id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        user_type=user.user_type,
        status=user.status,
        roles=user.role_codes,
        mfa_enabled=user.totp_enabled_at is not None,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
    )


def _open_session(db, user: ErpUser, request: Request, method: str, mail: EmailSender) -> SessionOut:
    ip = client_ip(request)
    # Alert on a new address, but not on the very first login (every address is new then).
    alert = user.last_login_at is not None and service.is_new_ip(db, user, ip)
    session, refresh = service.start_session(db, user, ip, request.headers.get("user-agent"))
    record(db, "erp.login", "erp_user", user.id, actor_id=user.id, request=request, method=method)
    db.commit()
    if alert:
        mail.send(
            user.email,
            "New login to Annadata 360",
            f"Your account was used to log in from a new address ({ip}).\n"
            "If this wasn't you, change your password and tell Annadata support right away.",
        )
    access, ttl = service.create_access_token(user, session)
    return SessionOut(access_token=access, expires_in=ttl, refresh_token=refresh, user=me_out(user))


# ---------- Login ----------


@router.post("/auth/login", response_model=LoginOut)
def login(body: LoginIn, db: DbSession, request: Request):
    user = service.check_password(db, body.email, body.password, client_ip(request))
    stage = "mfa" if user.totp_enabled_at is not None else "mfa_setup"
    return LoginOut(stage=stage, mfa_token=service.create_mfa_token(user))


@router.post("/auth/mfa/setup", response_model=MfaSetupOut)
def mfa_setup(body: MfaTokenIn, db: DbSession):
    user = service.user_from_mfa_token(db, body.mfa_token)
    secret, uri = service.start_totp_setup(db, user)
    return MfaSetupOut(secret=secret, otpauth_uri=uri)


@router.post("/auth/mfa/activate", response_model=MfaActivatedOut)
def mfa_activate(body: MfaCodeIn, db: DbSession, request: Request, mail: Email):
    user = service.user_from_mfa_token(db, body.mfa_token)
    codes = service.activate_totp(db, user, body.code, client_ip(request))
    record(db, "erp.mfa.enable", "erp_user", user.id, actor_id=user.id, request=request)
    out = _open_session(db, user, request, "totp", mail)
    return MfaActivatedOut(**out.model_dump(), backup_codes=codes)


@router.post("/auth/mfa/verify", response_model=SessionOut)
def mfa_verify(body: MfaCodeIn, db: DbSession, request: Request, mail: Email):
    user = service.user_from_mfa_token(db, body.mfa_token)
    method = service.verify_second_factor(db, user, body.code, client_ip(request))
    if method == "backup_code":
        left = db.scalar(select(func.count()).where(ErpBackupCode.user_id == user.id, ErpBackupCode.used_at.is_(None)))
        if left <= 3:
            mail.send(
                user.email,
                "Annadata 360: backup codes running out",
                f"You have {left} backup codes left. Ask a Super Admin to reset your authenticator app.",
            )
    return _open_session(db, user, request, method, mail)


@router.post("/auth/refresh", response_model=SessionOut)
def refresh(body: RefreshIn, db: DbSession):
    user, session, new_refresh = service.rotate_refresh(db, body.refresh_token)
    access, ttl = service.create_access_token(user, session)
    return SessionOut(access_token=access, expires_in=ttl, refresh_token=new_refresh, user=me_out(user))


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(principal: CurrentPrincipal, db: DbSession, request: Request):
    service.revoke_session(db, principal.session, "logout")
    record(db, "erp.logout", "erp_user", principal.user.id, actor_id=principal.user.id, request=request)
    db.commit()


@router.post("/auth/logout-all", status_code=status.HTTP_204_NO_CONTENT)
def logout_all(principal: CurrentPrincipal, db: DbSession, request: Request):
    service.revoke_all_sessions(db, principal.user, "logout_all")
    record(db, "erp.logout_all", "erp_user", principal.user.id, actor_id=principal.user.id, request=request)
    db.commit()


@router.post("/auth/invite/accept", status_code=status.HTTP_204_NO_CONTENT)
def accept_invite(body: InviteAcceptIn, db: DbSession, request: Request):
    user = service.accept_invite(db, body.token, body.password)
    record(db, "erp.invite.accept", "erp_user", user.id, actor_id=user.id, request=request)
    db.commit()


@router.post("/auth/password/forgot", status_code=status.HTTP_202_ACCEPTED)
def forgot_password(body: ForgotPasswordIn, db: DbSession, request: Request, mail: Email):
    """Always the same answer, whether or not the email has an account."""
    found = service.request_password_reset(db, body.email, client_ip(request))
    if found is not None:
        user, link = found
        record(db, "erp.password.reset_request", "erp_user", user.id, actor_id=user.id, request=request)
        db.commit()
        minutes = get_settings().erp_password_reset_ttl_minutes
        mail.send(
            user.email,
            "Reset your Annadata 360 password",
            f"Set a new password here (link works once, for {minutes} minutes):\n{link}\n\n"
            "If you didn't ask for this, ignore this email. Your password stays the same.",
        )
    return {"message": "If this email has an account, a reset link has been sent."}


@router.post("/auth/password/reset", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(body: ResetPasswordIn, db: DbSession, request: Request, mail: Email):
    user = service.reset_password(db, body.token, body.password)
    record(db, "erp.password.reset", "erp_user", user.id, actor_id=user.id, request=request)
    db.commit()
    mail.send(
        user.email,
        "Your Annadata 360 password was changed",
        "Your password was just reset and all devices were logged out.\n"
        "If this wasn't you, tell Annadata support right away.",
    )


@router.post("/auth/password/change", status_code=status.HTTP_204_NO_CONTENT)
def change_password(body: PasswordChangeIn, principal: CurrentPrincipal, db: DbSession, request: Request):
    service.change_password(db, principal.user, body.current_password, body.new_password, keep=principal.session)
    record(db, "erp.password.change", "erp_user", principal.user.id, actor_id=principal.user.id, request=request)
    db.commit()


# ---------- Me ----------


@router.get("/me", response_model=MeOut)
def me(principal: CurrentPrincipal):
    return me_out(principal.user)


@router.get("/me/sessions", response_model=list[SessionInfo])
def my_sessions(principal: CurrentPrincipal, db: DbSession):
    rows = db.scalars(
        select(ErpSession)
        .where(ErpSession.user_id == principal.user.id, ErpSession.revoked_at.is_(None))
        .order_by(ErpSession.last_seen_at.desc())
    )
    return [
        SessionInfo(
            id=s.public_id,
            ip=s.ip,
            user_agent=s.user_agent,
            created_at=s.created_at,
            last_seen_at=s.last_seen_at,
            current=s.id == principal.session.id,
        )
        for s in rows
        if service.session_alive(s)
    ]


@router.delete("/me/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def end_session(session_id: str, principal: CurrentPrincipal, db: DbSession, request: Request):
    s = db.scalar(select(ErpSession).where(ErpSession.public_id == session_id, ErpSession.user_id == principal.user.id))
    if s is None:
        raise not_found("session")
    service.revoke_session(db, s, "ended_by_user")
    record(db, "erp.session.end", "erp_session", s.id, actor_id=principal.user.id, request=request)
    db.commit()


# ---------- Platform users (Super Admin) ----------

UserAdmin = Annotated[Principal, Depends(require(P.USERS_MANAGE))]


def _get_user(db, public_id: str) -> ErpUser:
    user = db.scalar(select(ErpUser).where(ErpUser.public_id == public_id, ErpUser.deleted_at.is_(None)))
    if user is None:
        raise not_found("user")
    return user


def _active_super_admins(db) -> int:
    return db.scalar(
        select(func.count())
        .select_from(ErpUser)
        .join(ErpUserRole, ErpUserRole.user_id == ErpUser.id)
        .where(ErpUserRole.role_code == "super_admin", ErpUser.status == "active", ErpUser.deleted_at.is_(None))
    )


@router.get("/users", response_model=list[UserOut])
def list_users(admin: UserAdmin, db: DbSession, user_type: str = "platform"):
    rows = db.scalars(
        select(ErpUser).where(ErpUser.user_type == user_type, ErpUser.deleted_at.is_(None)).order_by(ErpUser.email)
    )
    return [user_out(u) for u in rows]


@router.post("/users", response_model=UserInvitedOut, status_code=status.HTTP_201_CREATED)
def invite_user(body: UserInviteIn, admin: UserAdmin, db: DbSession, request: Request, mail: Email):
    if db.scalar(select(ErpUser.id).where(ErpUser.email == body.email)) is not None:
        raise AppError(409, "email_taken", "An account with this email already exists")
    user = ErpUser(
        email=body.email,
        full_name=body.full_name,
        phone=body.phone,
        user_type="platform",
        status="invited",
        created_by_id=admin.user.id,
        updated_by_id=admin.user.id,
    )
    user.roles.append(ErpUserRole(role_code=body.role, created_by_id=admin.user.id))
    db.add(user)
    db.flush()
    token = service.create_invite(db, user)
    record(db, "erp.user.invite", "erp_user", user.id, actor_id=admin.user.id, request=request, role=body.role)
    db.commit()
    hours = get_settings().erp_invite_ttl_hours
    mail.send(
        user.email,
        "You're invited to Annadata 360 ERP",
        f"Set your password here (link works once, for {hours} hours):\n{service.invite_link(token)}",
    )
    return UserInvitedOut(**user_out(user).model_dump(), invite_expires_hours=hours)


@router.post("/users/{user_id}/resend-invite", status_code=status.HTTP_204_NO_CONTENT)
def resend_invite(user_id: str, admin: UserAdmin, db: DbSession, request: Request, mail: Email):
    user = _get_user(db, user_id)
    if user.status != "invited":
        raise AppError(409, "already_active", "This user has already set a password")
    token = service.create_invite(db, user)
    record(db, "erp.user.resend_invite", "erp_user", user.id, actor_id=admin.user.id, request=request)
    db.commit()
    mail.send(user.email, "Your Annadata 360 ERP invite", f"Set your password here:\n{service.invite_link(token)}")


@router.post("/users/{user_id}/disable", response_model=UserOut)
def disable_user(user_id: str, admin: UserAdmin, db: DbSession, request: Request):
    user = _get_user(db, user_id)
    if user.id == admin.user.id:
        raise AppError(409, "cannot_disable_self", "You can't disable your own account")
    if "super_admin" in user.role_codes and user.status == "active" and _active_super_admins(db) <= 1:
        raise AppError(409, "last_super_admin", "Keep at least one active Super Admin")
    user.status = "disabled"
    user.updated_by_id = admin.user.id
    service.revoke_all_sessions(db, user, "disabled")
    record(db, "erp.user.disable", "erp_user", user.id, actor_id=admin.user.id, request=request)
    db.commit()
    return user_out(user)


@router.post("/users/{user_id}/enable", response_model=UserOut)
def enable_user(user_id: str, admin: UserAdmin, db: DbSession, request: Request):
    user = _get_user(db, user_id)
    if user.status != "disabled":
        raise AppError(409, "not_disabled", "This user is not disabled")
    user.status = "active" if user.password_hash else "invited"
    user.updated_by_id = admin.user.id
    record(db, "erp.user.enable", "erp_user", user.id, actor_id=admin.user.id, request=request)
    db.commit()
    return user_out(user)


@router.post("/users/{user_id}/reset-mfa", response_model=UserOut)
def reset_mfa(user_id: str, admin: UserAdmin, db: DbSession, request: Request):
    """Lost phone: check who is asking (call them back on their known number) before doing this."""
    user = _get_user(db, user_id)
    service.reset_totp(db, user)
    user.updated_by_id = admin.user.id
    record(db, "erp.user.reset_mfa", "erp_user", user.id, actor_id=admin.user.id, request=request)
    db.commit()
    return user_out(user)
