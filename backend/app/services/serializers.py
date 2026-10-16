"""Model → response conversion, resolving localized text to the farmer's language."""

from sqlalchemy.orm import Session

from app.core.i18n import resolve
from app.models import Crop, Farmer, Field
from app.schemas.crop import CropOut
from app.schemas.farmer import CropRef, FarmerOut, Location
from app.schemas.field import FieldOut


def crop_ref(db: Session, code: str | None, lang: str) -> CropRef | None:
    if code is None:
        return None
    crop = db.get(Crop, code)
    return CropRef(code=code, name=resolve(crop.name, lang) if crop else code)


def crop_out(crop: Crop, lang: str) -> CropOut:
    return CropOut(code=crop.code, name=resolve(crop.name, lang), category=crop.category)


def farmer_out(db: Session, farmer: Farmer) -> FarmerOut:
    return FarmerOut(
        id=farmer.id,
        phone=farmer.phone,
        name=farmer.name,
        preferred_language=farmer.preferred_language,
        location=Location(
            state=farmer.state,
            district=farmer.district,
            mandal=farmer.mandal,
            village=farmer.village,
            latitude=farmer.latitude,
            longitude=farmer.longitude,
        ),
        primary_crop=crop_ref(db, farmer.primary_crop_code, farmer.preferred_language),
        profile_complete=bool(farmer.name and farmer.district and farmer.primary_crop_code),
        created_at=farmer.created_at,
    )


def field_out(db: Session, field: Field, lang: str) -> FieldOut:
    return FieldOut(
        id=field.id,
        name=field.name,
        crop=crop_ref(db, field.crop_code, lang),
        acreage=field.acreage,
        growth_stage=field.growth_stage,
        planted_on=field.planted_on,
        latitude=field.latitude,
        longitude=field.longitude,
        notes=field.notes,
        created_at=field.created_at,
        updated_at=field.updated_at,
    )
