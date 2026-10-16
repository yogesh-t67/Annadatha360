from fastapi import APIRouter, Query
from sqlalchemy import select

from app.api.deps import DbSession
from app.core.i18n import DEFAULT_LANGUAGE, Language
from app.models import Crop
from app.schemas.crop import CropOut
from app.services.serializers import crop_out

router = APIRouter(prefix="/crops", tags=["crops"])


@router.get("", response_model=list[CropOut])
def list_crops(db: DbSession, lang: Language = Query(DEFAULT_LANGUAGE)):
    """Public: used by onboarding's crop picker, possibly before the profile is filled in."""
    crops = db.scalars(select(Crop).order_by(Crop.category, Crop.code))
    return [crop_out(c, lang) for c in crops]
