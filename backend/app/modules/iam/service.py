"""ERP login: password + authenticator app (required), sessions, lockout, invites.

Flow: password → short-lived "mfa token" → 6-digit code (or a backup code) → session with access + refresh tokens.
A first login (no authenticator yet) must set one up before any session is created.
"""

import hmac
import secrets
import time
from datetime import UTC, datetime, timedelta

import jwt
import pyotp
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.crypto import decrypt, encrypt
from app.core.errors import AppError
from app.core.security import hash_secret, utcnow
from app.modules.iam.models import ErpBackupCode, ErpLoginAttempt, ErpSession, ErpUser, ErpUserToken
from app.modules.iam.permissions import permissions_for

AUDIENCE = "erp"
MFA_TOKEN_TTL = timedelta(minutes=5)
TOTP_ISSUER = "Annadata 360"
BACKUP_CODE_COUNT = 10

_hasher = PasswordHasher()
# Checked against when the email is unknown, so a wrong email takes as long as a wrong password.
_DUMMY_HASH = _hasher.hash("not-a-real-password")

# A password whose letters are just one of these ("Password@123", "Annadata2026!") is guessed first by attackers.
COMMON_WORDS = {
    "password",
    "passw",
    "pass",
    "qwerty",
    "qwertyuiop",
    "asdf",
    "admin",
    "administrator",
    "welcome",
    "letmein",
    "iloveyou",
    "abc",
    "abcd",
    "abcdef",
    "test",
    "user",
    "login",
    "india",
    "bharat",
    "annadata",
    "kisan",
    "farmer",
    "vendor",
}


def _as_utc(value: datetime) -> datetime:
    # SQLite drops tzinfo; Postgres keeps it. Normalise before comparing.
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def _now_ts() -> float:
    return time.time()  # separate so tests can move the clock for authenticator codes


# ---------- Passwords ----------


def password_strength(password: str, email: str = "") -> tuple[str, list[str]]:
    """Returns ("weak" | "medium" | "strong", what is missing). Weak is refused; the web app shows the same meter.

    medium: 8+ characters with 3 of the 4 kinds (small, capital, number, symbol), or 12+ with 2 kinds.
    strong: 12+ characters with 3 or more kinds.
    """
    kinds = sum(
        (
            any(c.islower() for c in password),
            any(c.isupper() for c in password),
            any(c.isdigit() for c in password),
            any(not c.isalnum() for c in password),
        )
    )
    lower = password.lower()
    missing = []
    if len(password) < 8:
        missing.append("at least 8 characters")
    if kinds < 2 or (kinds < 3 and len(password) < 12):
        missing.append("a mix of small letters, capital letters, numbers and symbols")
    if len(set(password)) < 5:
        missing.append("more different characters")
    letters = "".join(c for c in lower if c.isalpha())
    if letters in COMMON_WORDS or lower.strip("0123456789") == "":
        missing.append("not a common password")
    local = email.split("@")[0].lower()
    if len(local) >= 4 and local in lower:
        missing.append("not your email name")
    if missing:
        return "weak", missing
    return ("strong" if len(password) >= 12 and kinds >= 3 else "medium"), []


def check_password_policy(password: str, email: str) -> None:
    strength, missing = password_strength(password, email)
    if strength == "weak":
        raise AppError(
            422,
            "weak_password",
            "Password is too weak. It needs: " + "; ".join(missing),
            {"strength": strength, "missing": missing},
        )


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def _password_matches(user: ErpUser | None, password: str) -> bool:
    stored = user.password_hash if user is not None else None
    try:
        ok = _hasher.verify(stored or _DUMMY_HASH, password)
    except (VerificationError, InvalidHashError):
        return False
    return ok and stored is not None


# ---------- Lockout ----------


def _failures_since_last_success(db: Session, email: str, since: datetime) -> int:
    # Only a complete login (the code step) clears the count. Otherwise someone who knows the password could
    # re-enter it between wrong codes and keep guessing codes forever.
    last_ok = db.scalar(
        select(func.max(ErpLoginAttempt.created_at)).where(
            ErpLoginAttempt.email == email,
            ErpLoginAttempt.stage == "mfa",
            ErpLoginAttempt.success.is_(True),
            ErpLoginAttempt.created_at >= since,
        )
    )
    start = max(since, _as_utc(last_ok)) if last_ok else since
    return db.scalar(
        select(func.count()).where(
            ErpLoginAttempt.email == email, ErpLoginAttempt.success.is_(False), ErpLoginAttempt.created_at > start
        )
    )


def ensure_not_locked(db: Session, email: str, ip: str | None) -> None:
    settings = get_settings()
    since = utcnow() - timedelta(minutes=settings.erp_login_lock_minutes)
    locked = _failures_since_last_success(db, email, since) >= settings.erp_login_max_failures
    if not locked and ip:
        per_ip = db.scalar(select(func.count()).where(ErpLoginAttempt.ip == ip, ErpLoginAttempt.created_at >= since))
        locked = per_ip >= settings.erp_login_max_attempts_per_ip
    if locked:
        raise AppError(
            429, "too_many_attempts", f"Too many attempts. Try again in {settings.erp_login_lock_minutes} minutes."
        )


def note_attempt(db: Session, email: str, ip: str | None, stage: str, success: bool) -> None:
    db.add(ErpLoginAttempt(email=email, ip=ip, stage=stage, success=success, created_at=utcnow()))
    db.commit()


# ---------- Step 1: password ----------


def check_password(db: Session, email: str, password: str, ip: str | None) -> ErpUser:
    email = email.strip().lower()
    ensure_not_locked(db, email, ip)
    user = db.scalar(select(ErpUser).where(ErpUser.email == email, ErpUser.deleted_at.is_(None)))
    ok = _password_matches(user, password)
    note_attempt(db, email, ip, "password", ok)
    if not ok:
        raise AppError(401, "invalid_credentials", "Wrong email or password")
    if user.status != "active":
        raise AppError(403, "account_disabled", "This account is disabled. Contact Annadata support.")
    return user


def create_mfa_token(user: ErpUser) -> str:
    settings = get_settings()
    now = utcnow()
    payload = {"sub": user.public_id, "aud": AUDIENCE, "typ": "erp_mfa", "iat": now, "exp": now + MFA_TOKEN_TTL}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def user_from_mfa_token(db: Session, token: str) -> ErpUser:
    user = _user_from_token(db, token, "erp_mfa")
    if user is None or user.status != "active":
        raise AppError(401, "login_expired", "Login timed out. Enter your password again.")
    return user


# ---------- Step 2: authenticator app ----------


def start_totp_setup(db: Session, user: ErpUser) -> tuple[str, str]:
    """New secret for a user who has none active yet. Returns (secret, otpauth URI for the QR code)."""
    if user.totp_enabled_at is not None:
        raise AppError(409, "mfa_already_enabled", "Authenticator app is already set up")
    secret = pyotp.random_base32()
    user.totp_secret_enc = encrypt(secret)
    db.commit()
    return secret, pyotp.TOTP(secret).provisioning_uri(name=user.email, issuer_name=TOTP_ISSUER)


def _totp_matches(user: ErpUser, code: str) -> bool:
    if not user.totp_secret_enc or not code.isdigit() or len(code) != 6:
        return False
    totp = pyotp.TOTP(decrypt(user.totp_secret_enc))
    current = int(_now_ts()) // 30
    for step in (current - 1, current, current + 1):  # allow for a phone clock up to 30 s off
        if user.totp_last_step is not None and step <= user.totp_last_step:
            continue  # this code (or an older one) was already used
        if hmac.compare_digest(totp.at(step * 30), code):
            user.totp_last_step = step
            return True
    return False


def _use_backup_code(db: Session, user: ErpUser, code: str) -> bool:
    normalized = code.replace("-", "").replace(" ", "").lower()
    row = db.scalar(
        select(ErpBackupCode).where(
            ErpBackupCode.user_id == user.id,
            ErpBackupCode.code_hash == hash_secret("backup:" + normalized),
            ErpBackupCode.used_at.is_(None),
        )
    )
    if row is None:
        return False
    row.used_at = utcnow()
    return True


def new_backup_codes(db: Session, user: ErpUser) -> list[str]:
    db.query(ErpBackupCode).filter(ErpBackupCode.user_id == user.id).delete()
    codes = [secrets.token_hex(5) for _ in range(BACKUP_CODE_COUNT)]  # 10 hex characters each
    db.add_all(ErpBackupCode(user_id=user.id, code_hash=hash_secret("backup:" + c)) for c in codes)
    return [f"{c[:5]}-{c[5:]}" for c in codes]


def activate_totp(db: Session, user: ErpUser, code: str, ip: str | None) -> list[str]:
    if user.totp_enabled_at is not None:
        raise AppError(409, "mfa_already_enabled", "Authenticator app is already set up")
    ensure_not_locked(db, user.email, ip)
    if not _totp_matches(user, code):
        note_attempt(db, user.email, ip, "mfa", False)
        raise AppError(401, "invalid_code", "Wrong code. Check the time on your phone and try again.")
    user.totp_enabled_at = utcnow()
    codes = new_backup_codes(db, user)
    note_attempt(db, user.email, ip, "mfa", True)  # commits
    return codes


def verify_second_factor(db: Session, user: ErpUser, code: str, ip: str | None) -> str:
    """Returns how the user got in: "totp" or "backup_code"."""
    if user.totp_enabled_at is None:
        raise AppError(409, "mfa_setup_required", "Set up the authenticator app first")
    ensure_not_locked(db, user.email, ip)
    method = None
    if _totp_matches(user, code):
        method = "totp"
    elif _use_backup_code(db, user, code):
        method = "backup_code"
    note_attempt(db, user.email, ip, "mfa", method is not None)
    if method is None:
        raise AppError(401, "invalid_code", "Wrong code. Check the time on your phone and try again.")
    return method


def reset_totp(db: Session, user: ErpUser) -> None:
    """Super Admin action for a lost phone: next login asks the user to set up the app again."""
    user.totp_secret_enc = None
    user.totp_enabled_at = None
    user.totp_last_step = None
    db.query(ErpBackupCode).filter(ErpBackupCode.user_id == user.id).delete()
    revoke_all_sessions(db, user, "mfa_reset")


# ---------- Sessions ----------


def create_access_token(user: ErpUser, session: ErpSession) -> tuple[str, int]:
    settings = get_settings()
    ttl = settings.erp_access_token_ttl_minutes * 60
    now = utcnow()
    payload = {
        "sub": user.public_id,
        "sid": session.public_id,
        "aud": AUDIENCE,
        "typ": "erp_access",
        "iat": now,
        "exp": now + timedelta(seconds=ttl),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm), ttl


def _decode(token: str, typ: str) -> dict | None:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm], audience=AUDIENCE)
    except jwt.PyJWTError:
        return None
    return payload if payload.get("typ") == typ else None


def _user_from_token(db: Session, token: str, typ: str) -> ErpUser | None:
    payload = _decode(token, typ)
    if payload is None:
        return None
    return db.scalar(select(ErpUser).where(ErpUser.public_id == payload["sub"], ErpUser.deleted_at.is_(None)))


def start_session(db: Session, user: ErpUser, ip: str | None, user_agent: str | None) -> tuple[ErpSession, str]:
    settings = get_settings()
    now = utcnow()
    refresh = secrets.token_urlsafe(48)
    session = ErpSession(
        user_id=user.id,
        refresh_hash=hash_secret(refresh),
        ip=ip,
        user_agent=(user_agent or "")[:300] or None,
        created_at=now,
        last_seen_at=now,
        expires_at=now + timedelta(hours=settings.erp_session_max_hours),
    )
    db.add(session)
    user.last_login_at = now
    db.flush()
    return session, refresh


def is_new_ip(db: Session, user: ErpUser, ip: str | None) -> bool:
    """True when no earlier session of this user came from this address (used for the new-login email)."""
    if ip is None:
        return False
    return db.scalar(select(func.count()).where(ErpSession.user_id == user.id, ErpSession.ip == ip)) == 0


def session_alive(session: ErpSession) -> bool:
    now = utcnow()
    idle = timedelta(minutes=get_settings().erp_session_idle_minutes)
    return (
        session.revoked_at is None and _as_utc(session.expires_at) > now and _as_utc(session.last_seen_at) + idle > now
    )


def session_from_access_token(db: Session, token: str) -> tuple[ErpUser, ErpSession] | None:
    payload = _decode(token, "erp_access")
    if payload is None:
        return None
    session = db.scalar(select(ErpSession).where(ErpSession.public_id == payload.get("sid")))
    if session is None or not session_alive(session):
        return None
    user = db.get(ErpUser, session.user_id)
    if user is None or user.public_id != payload["sub"] or user.status != "active" or user.deleted_at is not None:
        return None
    now = utcnow()
    if (now - _as_utc(session.last_seen_at)).total_seconds() > 60:  # don't write on every request
        session.last_seen_at = now
        db.commit()
    return user, session


def rotate_refresh(db: Session, refresh: str) -> tuple[ErpUser, ErpSession, str]:
    token_hash = hash_secret(refresh)
    session = db.scalar(select(ErpSession).where(ErpSession.refresh_hash == token_hash))
    if session is None:
        reused = db.scalar(select(ErpSession).where(ErpSession.previous_refresh_hash == token_hash))
        if reused is not None and reused.revoked_at is None:
            reused.revoked_at, reused.revoke_reason = utcnow(), "refresh_reuse"
            db.commit()
        raise AppError(401, "invalid_refresh_token", "Session ended. Log in again.")
    user = db.get(ErpUser, session.user_id)
    if not session_alive(session) or user is None or user.status != "active":
        raise AppError(401, "invalid_refresh_token", "Session ended. Log in again.")
    new_refresh = secrets.token_urlsafe(48)
    session.previous_refresh_hash = session.refresh_hash
    session.refresh_hash = hash_secret(new_refresh)
    session.last_seen_at = utcnow()
    db.commit()
    return user, session, new_refresh


def revoke_session(db: Session, session: ErpSession, reason: str) -> None:
    if session.revoked_at is None:
        session.revoked_at, session.revoke_reason = utcnow(), reason


def revoke_all_sessions(db: Session, user: ErpUser, reason: str, keep: ErpSession | None = None) -> None:
    q = update(ErpSession).where(ErpSession.user_id == user.id, ErpSession.revoked_at.is_(None))
    if keep is not None:
        q = q.where(ErpSession.id != keep.id)
    db.execute(q.values(revoked_at=utcnow(), revoke_reason=reason))


def user_permissions(user: ErpUser) -> set[str]:
    return {str(p) for p in permissions_for(user.role_codes)}


# ---------- One-time email links (invite, password reset) ----------


def _new_link_token(db: Session, user: ErpUser, purpose: str, ttl: timedelta) -> str:
    """Returns the token for the link. Earlier unused links of the same kind for this user stop working."""
    db.execute(
        update(ErpUserToken)
        .where(ErpUserToken.user_id == user.id, ErpUserToken.purpose == purpose, ErpUserToken.used_at.is_(None))
        .values(used_at=utcnow())
    )
    token = secrets.token_urlsafe(32)
    db.add(
        ErpUserToken(
            user_id=user.id,
            purpose=purpose,
            token_hash=hash_secret(f"{purpose}:{token}"),
            expires_at=utcnow() + ttl,
            created_at=utcnow(),
        )
    )
    return token


def _use_link_token(db: Session, token: str, purpose: str, user_status: str) -> ErpUser | None:
    row = db.scalar(select(ErpUserToken).where(ErpUserToken.token_hash == hash_secret(f"{purpose}:{token}")))
    if row is None or row.used_at is not None or _as_utc(row.expires_at) < utcnow():
        return None
    user = db.get(ErpUser, row.user_id)
    if user is None or user.status != user_status or user.deleted_at is not None:
        return None
    row.used_at = utcnow()
    return user


def _link(path: str, token: str) -> str:
    return f"{get_settings().erp_web_base_url.rstrip('/')}/{path}?token={token}"


def create_invite(db: Session, user: ErpUser) -> str:
    return _new_link_token(db, user, "invite", timedelta(hours=get_settings().erp_invite_ttl_hours))


def invite_link(token: str) -> str:
    return _link("accept-invite", token)


def accept_invite(db: Session, token: str, password: str) -> ErpUser:
    user = _use_link_token(db, token, "invite", "invited")
    if user is None:
        raise AppError(400, "invalid_invite", "This invite link has expired or was already used. Ask for a new one.")
    check_password_policy(password, user.email)
    _set_password(user, password)
    user.status = "active"
    return user


def _set_password(user: ErpUser, password: str) -> None:
    user.password_hash = hash_password(password)
    user.password_changed_at = utcnow()


def change_password(db: Session, user: ErpUser, current: str, new: str, keep: ErpSession) -> None:
    if not _password_matches(user, current):
        raise AppError(401, "invalid_credentials", "Current password is wrong")
    check_password_policy(new, user.email)
    if _password_matches(user, new):
        raise AppError(422, "weak_password", "New password must be different from the current one")
    _set_password(user, new)
    revoke_all_sessions(db, user, "password_changed", keep=keep)


# ---------- Forgot password ----------


def request_password_reset(db: Session, email: str, ip: str | None) -> tuple[ErpUser, str] | None:
    """Returns (user, link) to email, or None. The caller answers the same either way, so nobody can use this
    to find out which emails have accounts."""
    settings = get_settings()
    email = email.strip().lower()
    since = utcnow() - timedelta(minutes=settings.erp_login_lock_minutes)
    if (
        ip
        and db.scalar(select(func.count()).where(ErpLoginAttempt.ip == ip, ErpLoginAttempt.created_at >= since))
        >= settings.erp_login_max_attempts_per_ip
    ):
        raise AppError(
            429, "too_many_attempts", f"Too many attempts. Try again in {settings.erp_login_lock_minutes} minutes."
        )
    # Counts toward the per-IP limit; success=True so it never counts as a wrong password.
    note_attempt(db, email, ip, "reset", True)
    user = db.scalar(select(ErpUser).where(ErpUser.email == email, ErpUser.deleted_at.is_(None)))
    if user is None or user.status != "active":
        return None
    hour_ago = utcnow() - timedelta(hours=1)
    sent = db.scalar(
        select(func.count()).where(
            ErpUserToken.user_id == user.id, ErpUserToken.purpose == "reset", ErpUserToken.created_at >= hour_ago
        )
    )
    if sent >= settings.erp_password_reset_max_per_hour:
        return None
    token = _new_link_token(db, user, "reset", timedelta(minutes=settings.erp_password_reset_ttl_minutes))
    return user, _link("reset-password", token)


def reset_password(db: Session, token: str, password: str) -> ErpUser:
    """Sets a new password and logs out every device. The authenticator code is still needed at the next login."""
    user = _use_link_token(db, token, "reset", "active")
    if user is None:
        raise AppError(400, "invalid_reset_link", "This link has expired or was already used. Ask for a new one.")
    check_password_policy(password, user.email)
    _set_password(user, password)
    revoke_all_sessions(db, user, "password_reset")
    return user
