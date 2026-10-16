import base64
import hashlib
import json
import logging

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.models import Diagnosis, Farmer, Field
from app.schemas.diagnosis import DiagnosisResult, strict_json_schema
from app.services.ai.claude import call_claude, response_text
from app.services.ai.context import farmer_context
from app.services.ai.prompts import DIAGNOSIS_SYSTEM
from app.services.weather import WeatherProvider

log = logging.getLogger("annadata.ai")

MAX_IMAGE_BYTES = 5 * 1024 * 1024  # Claude's per-image limit
MAX_TOKENS = 8000
RESULT_SCHEMA = strict_json_schema(DiagnosisResult)


def sniff_media_type(data: bytes) -> str | None:
    """Trust the bytes, not the client's Content-Type."""
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def diagnose(
    db: Session,
    client,
    farmer: Farmer,
    field: Field | None,
    crop_code: str | None,
    notes: str | None,
    image: bytes,
    weather: WeatherProvider | None,
) -> Diagnosis:
    if not image:
        raise AppError(422, "image_required", "Attach a photo")
    if len(image) > MAX_IMAGE_BYTES:
        raise AppError(413, "image_too_large", "Photo must be 5 MB or smaller")
    media_type = sniff_media_type(image)
    if media_type is None:
        raise AppError(415, "unsupported_image", "Photo must be JPEG, PNG or WebP")

    crop_code = crop_code or (field.crop_code if field else None) or farmer.primary_crop_code
    context = farmer_context(db, farmer, field, weather)
    request_text = "Diagnose the crop in this photo."
    if crop_code:
        request_text += f" Expected crop (code): {crop_code}."
    if notes:
        request_text += f"\nFarmer's description: {notes}"

    response = call_claude(
        client,
        db,
        farmer_id=farmer.id,
        feature="diagnosis",
        max_tokens=MAX_TOKENS,
        output_config={
            "effort": get_settings().ai_diagnosis_effort,
            "format": {"type": "json_schema", "schema": RESULT_SCHEMA},
        },
        system=[
            {"type": "text", "text": DIAGNOSIS_SYSTEM},
            {"type": "text", "text": f"Farmer context:\n{context}"},
        ],
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": base64.standard_b64encode(image).decode("ascii"),
                        },
                    },
                    {"type": "text", "text": request_text},
                ],
            }
        ],
    )
    if response.stop_reason == "max_tokens":
        log.error("Diagnosis hit max_tokens")
        raise AppError(503, "ai_unavailable", "Diagnosis failed. Try again.")
    try:
        result = DiagnosisResult.model_validate(json.loads(response_text(response)))
    except (json.JSONDecodeError, ValidationError) as exc:
        log.error("Diagnosis returned invalid JSON: %s", exc)
        raise AppError(503, "ai_unavailable", "Diagnosis failed. Try again.") from exc

    record = Diagnosis(
        farmer_id=farmer.id,
        field_id=field.id if field else None,
        crop_code=crop_code,
        language=farmer.preferred_language,
        notes=notes,
        image_sha256=hashlib.sha256(image).hexdigest(),
        image_bytes=len(image),
        image_media_type=media_type,
        result=result.model_dump(),
        model=getattr(response, "model", None) or get_settings().ai_model,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
