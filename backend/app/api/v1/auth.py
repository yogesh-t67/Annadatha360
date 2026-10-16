from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.api.deps import DbSession
from app.core.config import get_settings
from app.schemas.auth import LoginOut, OtpRequest, OtpRequestOut, OtpVerify, RefreshIn, TokenPair
from app.services import auth as auth_service
from app.services.serializers import farmer_out
from app.services.sms import SmsSender, get_sms_sender

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/otp/request", response_model=OtpRequestOut)
def request_otp(body: OtpRequest, db: DbSession, sms: Annotated[SmsSender, Depends(get_sms_sender)]):
    settings = get_settings()
    auth_service.request_otp(db, body.phone, sms)
    return OtpRequestOut(
        phone=body.phone,
        expires_in=settings.otp_ttl_seconds,
        resend_after=settings.otp_resend_cooldown_seconds,
    )


@router.post("/otp/verify", response_model=LoginOut)
def verify_otp(body: OtpVerify, db: DbSession):
    farmer, is_new = auth_service.verify_otp(db, body.phone, body.code)
    tokens = auth_service.issue_tokens(db, farmer.id)
    return LoginOut(**tokens, is_new_user=is_new, farmer=farmer_out(db, farmer))


@router.post("/refresh", response_model=TokenPair)
def refresh(body: RefreshIn, db: DbSession):
    return TokenPair(**auth_service.rotate_refresh_token(db, body.refresh_token))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(body: RefreshIn, db: DbSession):
    auth_service.revoke_refresh_token(db, body.refresh_token)
