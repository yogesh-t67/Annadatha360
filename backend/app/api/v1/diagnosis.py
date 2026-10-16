from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy import select

from app.api.deps import CurrentFarmer, DbSession, ensure_crop_exists
from app.core.errors import not_found
from app.models import Diagnosis, Field
from app.schemas.diagnosis import DiagnosisOut, DiagnosisResult
from app.services.ai.claude import get_ai_client
from app.services.ai.diagnosis import MAX_IMAGE_BYTES, diagnose
from app.services.serializers import crop_ref
from app.services.weather import WeatherProvider, get_weather_provider

router = APIRouter(prefix="/diagnoses", tags=["diagnosis"])


def _out(db, d: Diagnosis, lang: str) -> DiagnosisOut:
    return DiagnosisOut(
        id=d.id,
        field_id=d.field_id,
        crop=crop_ref(db, d.crop_code, lang),
        language=d.language,
        notes=d.notes,
        result=DiagnosisResult.model_validate(d.result),
        created_at=d.created_at,
    )


def _owned(db, farmer, diagnosis_id: int) -> Diagnosis:
    d = db.get(Diagnosis, diagnosis_id)
    if d is None or d.farmer_id != farmer.id:
        raise not_found("diagnosis")
    return d


@router.post("", response_model=DiagnosisOut, status_code=status.HTTP_201_CREATED)
def create_diagnosis(
    farmer: CurrentFarmer,
    db: DbSession,
    client: Annotated[object, Depends(get_ai_client)],
    weather: Annotated[WeatherProvider, Depends(get_weather_provider)],
    image: Annotated[UploadFile, File(description="JPEG, PNG or WebP, ≤ 5 MB")],
    field_id: Annotated[int | None, Form()] = None,
    crop_code: Annotated[str | None, Form()] = None,
    notes: Annotated[str | None, Form(max_length=500)] = None,
):
    field = None
    if field_id is not None:
        field = db.get(Field, field_id)
        if field is None or field.farmer_id != farmer.id:
            raise not_found("field")
    ensure_crop_exists(db, crop_code)
    data = image.file.read(MAX_IMAGE_BYTES + 1)  # read one byte past the limit to detect oversize cheaply
    record = diagnose(db, client, farmer, field, crop_code, (notes or "").strip() or None, data, weather)
    return _out(db, record, farmer.preferred_language)


@router.get("", response_model=list[DiagnosisOut])
def list_diagnoses(
    farmer: CurrentFarmer,
    db: DbSession,
    field_id: int | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    q = select(Diagnosis).where(Diagnosis.farmer_id == farmer.id)
    if field_id is not None:
        q = q.where(Diagnosis.field_id == field_id)
    rows = db.scalars(q.order_by(Diagnosis.created_at.desc(), Diagnosis.id.desc()).limit(limit))
    return [_out(db, d, farmer.preferred_language) for d in rows]


@router.get("/{diagnosis_id}", response_model=DiagnosisOut)
def get_diagnosis(diagnosis_id: int, farmer: CurrentFarmer, db: DbSession):
    return _out(db, _owned(db, farmer, diagnosis_id), farmer.preferred_language)


@router.delete("/{diagnosis_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_diagnosis(diagnosis_id: int, farmer: CurrentFarmer, db: DbSession):
    db.delete(_owned(db, farmer, diagnosis_id))
    db.commit()
