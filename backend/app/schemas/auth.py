from pydantic import BaseModel, Field

from app.schemas.common import PhoneNumber
from app.schemas.farmer import FarmerOut


class OtpRequest(BaseModel):
    phone: PhoneNumber


class OtpRequestOut(BaseModel):
    phone: str
    expires_in: int
    resend_after: int


class OtpVerify(BaseModel):
    phone: PhoneNumber
    code: str = Field(pattern=r"^\d{6}$")


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class LoginOut(TokenPair):
    is_new_user: bool
    farmer: FarmerOut


class RefreshIn(BaseModel):
    refresh_token: str
