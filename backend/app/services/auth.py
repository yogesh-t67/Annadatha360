import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import (
    create_access_token,
    generate_otp,
    generate_refresh_token,
    hash_secret,
    utcnow,
)
from app.models import Farmer, OtpChallenge, RefreshToken
from app.schemas.common import normalize_indian_mobile
from app.services.sms import SmsSender


def _as_utc(value: datetime) -> datetime:
    # SQLite drops tzinfo; Postgres keeps it. Normalise before comparing.
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def is_test_number(phone: str) -> bool:
    """Closed-beta allowlist (OTP_TEST_NUMBERS). Needs OTP_TEST_CODE too; never active in production."""
    settings = get_settings()
    if settings.is_production or not settings.otp_test_code or not settings.otp_test_numbers:
        return False
    allowed = set()
    for raw in settings.otp_test_numbers:
        try:
            allowed.add(normalize_indian_mobile(raw))
        except ValueError:
            continue
    return phone in allowed


def request_otp(db: Session, phone: str, sms: SmsSender) -> OtpChallenge:
    settings = get_settings()
    now = utcnow()

    latest = db.scalar(
        select(OtpChallenge).where(OtpChallenge.phone == phone).order_by(OtpChallenge.created_at.desc()).limit(1)
    )
    if latest is not None:
        wait = settings.otp_resend_cooldown_seconds - (now - _as_utc(latest.created_at)).total_seconds()
        if wait > 0:
            raise AppError(429, "otp_cooldown", f"Please wait {int(wait) + 1} seconds before requesting another OTP")

    sent_last_hour = db.scalar(
        select(func.count())
        .select_from(OtpChallenge)
        .where(OtpChallenge.phone == phone, OtpChallenge.created_at > now - timedelta(hours=1))
    )
    if sent_last_hour >= settings.otp_max_sends_per_hour:
        raise AppError(429, "otp_rate_limited", "Too many OTP requests. Try again later.")

    test_number = is_test_number(phone)
    code = settings.otp_test_code if test_number else generate_otp()
    challenge = OtpChallenge(
        phone=phone,
        code_hash=hash_secret(code),
        expires_at=now + timedelta(seconds=settings.otp_ttl_seconds),
        attempts=0,
        created_at=now,
    )
    db.add(challenge)
    db.commit()
    if test_number:
        return challenge  # closed-beta tester: fixed code, no SMS
    try:
        sms.send_otp(phone, code)
    except Exception:
        # Don't let an undelivered OTP count towards cooldown / hourly limits.
        db.delete(challenge)
        db.commit()
        raise
    return challenge


def verify_otp(db: Session, phone: str, code: str) -> tuple[Farmer, bool]:
    settings = get_settings()
    now = utcnow()
    challenge = db.scalar(
        select(OtpChallenge)
        .where(OtpChallenge.phone == phone, OtpChallenge.consumed_at.is_(None))
        .order_by(OtpChallenge.created_at.desc())
        .limit(1)
    )
    if challenge is None or _as_utc(challenge.expires_at) < now:
        raise AppError(400, "otp_expired", "OTP expired or not requested. Request a new one.")
    if challenge.attempts >= settings.otp_max_attempts:
        raise AppError(400, "otp_attempts_exceeded", "Too many wrong attempts. Request a new OTP.")

    if challenge.code_hash != hash_secret(code):
        challenge.attempts += 1
        db.commit()
        raise AppError(400, "otp_invalid", "Incorrect OTP")

    challenge.consumed_at = now
    db.commit()

    farmer = db.scalar(select(Farmer).where(Farmer.phone == phone))
    if farmer is not None:
        return farmer, False
    try:
        farmer = Farmer(phone=phone)
        db.add(farmer)
        db.commit()
        return farmer, True
    except IntegrityError:
        # A concurrent verify for the same phone created the farmer first.
        db.rollback()
        return db.scalar(select(Farmer).where(Farmer.phone == phone)), False


def create_guest(db: Session, language: str) -> Farmer:
    """Closed-beta account without a phone number. The phone column gets a placeholder that can never be a real
    E.164 number ("+0" prefix), so a guest can't collide with, or be logged into as, a real farmer."""
    settings = get_settings()
    if not settings.guest_login_enabled or settings.is_production:
        raise AppError(403, "guest_login_disabled", "Guest login is not enabled on this server")
    for _ in range(5):
        farmer = Farmer(phone="+0" + "".join(secrets.choice("0123456789") for _ in range(14)), preferred_language=language)
        db.add(farmer)
        try:
            db.commit()
            return farmer
        except IntegrityError:  # placeholder collision (1 in 10^14): try another
            db.rollback()
    raise AppError(503, "guest_login_failed", "Could not create a guest account")


def issue_tokens(db: Session, farmer_id: int) -> dict:
    access, expires_in = create_access_token(farmer_id)
    refresh = generate_refresh_token()
    db.add(
        RefreshToken(
            farmer_id=farmer_id,
            token_hash=hash_secret(refresh),
            expires_at=utcnow() + timedelta(days=get_settings().refresh_token_ttl_days),
        )
    )
    db.commit()
    return {"access_token": access, "refresh_token": refresh, "expires_in": expires_in}


def rotate_refresh_token(db: Session, refresh_token: str) -> dict:
    row = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_secret(refresh_token)))
    if row is None or row.revoked_at is not None or _as_utc(row.expires_at) < utcnow():
        raise AppError(401, "invalid_refresh_token", "Session expired. Please log in again.")
    row.revoked_at = utcnow()
    db.commit()
    return issue_tokens(db, row.farmer_id)


def revoke_refresh_token(db: Session, refresh_token: str) -> None:
    row = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_secret(refresh_token)))
    if row is not None and row.revoked_at is None:
        row.revoked_at = utcnow()
        db.commit()
