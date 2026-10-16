from fastapi import APIRouter, status
from sqlalchemy import select

from app.api.deps import CurrentFarmer, DbSession, ensure_crop_exists
from app.core.errors import AppError, not_found
from app.models import Field
from app.schemas.field import FieldCreate, FieldOut, FieldUpdate
from app.services.serializers import field_out

router = APIRouter(prefix="/fields", tags=["fields"])

_NOT_NULLABLE = {"name", "acreage"}


def _get_owned(db, farmer, field_id: int) -> Field:
    field = db.get(Field, field_id)
    if field is None or field.farmer_id != farmer.id:
        raise not_found("field")
    return field


@router.get("", response_model=list[FieldOut])
def list_fields(farmer: CurrentFarmer, db: DbSession):
    rows = db.scalars(select(Field).where(Field.farmer_id == farmer.id).order_by(Field.created_at, Field.id))
    return [field_out(db, f, farmer.preferred_language) for f in rows]


@router.post("", response_model=FieldOut, status_code=status.HTTP_201_CREATED)
def create_field(body: FieldCreate, farmer: CurrentFarmer, db: DbSession):
    ensure_crop_exists(db, body.crop_code)
    field = Field(farmer_id=farmer.id, **body.model_dump())
    db.add(field)
    db.commit()
    db.refresh(field)
    return field_out(db, field, farmer.preferred_language)


@router.get("/{field_id}", response_model=FieldOut)
def get_field(field_id: int, farmer: CurrentFarmer, db: DbSession):
    return field_out(db, _get_owned(db, farmer, field_id), farmer.preferred_language)


@router.patch("/{field_id}", response_model=FieldOut)
def update_field(field_id: int, body: FieldUpdate, farmer: CurrentFarmer, db: DbSession):
    field = _get_owned(db, farmer, field_id)
    changes = body.model_dump(exclude_unset=True)
    for key in _NOT_NULLABLE:
        if key in changes and changes[key] is None:
            raise AppError(422, "validation_error", f"{key} cannot be null")
    if "crop_code" in changes:
        ensure_crop_exists(db, changes["crop_code"])
    for key, value in changes.items():
        setattr(field, key, value)
    db.commit()
    db.refresh(field)
    return field_out(db, field, farmer.preferred_language)


@router.delete("/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_field(field_id: int, farmer: CurrentFarmer, db: DbSession):
    db.delete(_get_owned(db, farmer, field_id))
    db.commit()
