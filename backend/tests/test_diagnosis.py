import base64
import json

import pytest

from app.main import app
from app.models import AiUsage, Diagnosis
from app.services.ai.claude import get_ai_client
from app.services.weather import forecast_cache, get_weather_provider
from tests.test_assistant import FakeClaude, _response
from tests.test_weather import FakeProvider

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 100
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
WEBP = b"RIFF\x00\x00\x00\x00WEBPVP8 " + b"\x00" * 100

RESULT = {
    "is_plant_image": True,
    "image_quality": "good",
    "crop_identified": "వరి",
    "matches_expected_crop": True,
    "health_status": "problem_found",
    "issue": {"name": "అగ్గి తెగులు (Blast)", "category": "disease", "confidence": "medium"},
    "symptoms": ["ఆకులపై కంటి ఆకారపు మచ్చలు"],
    "actions": [
        {"step": "నత్రజని ఎరువు ఆపండి", "type": "cultural"},
        {"step": "ట్రైసైక్లాజోల్ 0.6 గ్రా/లీటరు లేబుల్ ప్రకారం పిచికారీ", "type": "chemical"},
    ],
    "prevention": ["తెగులు తట్టుకునే రకాలు వాడండి"],
    "consult_expert": False,
    "summary": "ఇది అగ్గి తెగులు లాగా ఉంది.",
}


@pytest.fixture
def claude():
    fake = FakeClaude(_response(text=json.dumps(RESULT, ensure_ascii=False)))
    app.dependency_overrides[get_ai_client] = lambda: fake
    forecast_cache.clear()
    app.dependency_overrides[get_weather_provider] = lambda: FakeProvider()
    yield fake
    forecast_cache.clear()


@pytest.fixture
def farmer(login, client):
    headers, _ = login()
    client.patch("/api/v1/farmers/me", headers=headers, json={"preferred_language": "te", "primary_crop_code": "cotton"})
    fid = client.post(
        "/api/v1/fields", headers=headers, json={"name": "Wet plot", "crop_code": "paddy", "acreage": 1, "growth_stage": "flowering"}
    ).json()["id"]
    return headers, fid


def _post(client, headers, image=JPEG, name="leaf.jpg", ctype="image/jpeg", **form):
    return client.post("/api/v1/diagnoses", headers=headers, files={"image": (name, image, ctype)}, data=form)


def test_diagnosis_request_and_response(client, claude, farmer, db_session):
    headers, fid = farmer
    res = _post(client, headers, field_id=str(fid), notes="ఆకులు ఎండిపోతున్నాయి")
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["result"] == RESULT
    assert body["crop"] == {"code": "paddy", "name": "వరి"}  # field's crop wins over the farmer's primary crop
    assert body["field_id"] == fid and body["language"] == "te"

    req = claude.requests[0]
    assert req["output_config"]["effort"] == "medium"
    schema = req["output_config"]["format"]["schema"]
    assert req["output_config"]["format"]["type"] == "json_schema" and schema["additionalProperties"] is False
    assert set(schema["required"]) == set(RESULT)
    image_block, text_block = req["messages"][0]["content"]
    assert image_block["source"] == {"type": "base64", "media_type": "image/jpeg", "data": base64.standard_b64encode(JPEG).decode()}
    assert "Expected crop (code): paddy" in text_block["text"]
    assert "ఆకులు ఎండిపోతున్నాయి" in text_block["text"]
    assert "stage: flowering" in req["system"][1]["text"]

    with db_session() as s:
        row = s.query(Diagnosis).one()
        assert len(row.image_sha256) == 64 and row.image_bytes == len(JPEG)
        assert s.query(AiUsage).one().feature == "diagnosis"


@pytest.mark.parametrize("image,media_type", [(PNG, "image/png"), (WEBP, "image/webp")])
def test_media_type_is_sniffed_not_trusted(client, claude, farmer, image, media_type):
    headers, _ = farmer
    assert _post(client, headers, image=image, ctype="application/octet-stream").status_code == 201
    assert claude.requests[0]["messages"][0]["content"][0]["source"]["media_type"] == media_type


def test_crop_falls_back_to_explicit_then_primary(client, claude, farmer):
    headers, _ = farmer
    assert _post(client, headers, crop_code="chilli").json()["crop"]["code"] == "chilli"
    assert _post(client, headers).json()["crop"]["code"] == "cotton"


@pytest.mark.parametrize(
    "kwargs,status,code",
    [
        ({"image": b"GIF89a" + b"\x00" * 50, "ctype": "image/gif"}, 415, "unsupported_image"),
        ({"image": b"\xff\xd8\xff" + b"\x00" * (5 * 1024 * 1024)}, 413, "image_too_large"),
        ({"image": b""}, 422, "image_required"),
        ({"crop_code": "durian"}, 422, "unknown_crop"),
        ({"field_id": "999"}, 404, "field_not_found"),
    ],
)
def test_bad_uploads_never_reach_claude(client, claude, farmer, kwargs, status, code):
    headers, _ = farmer
    res = _post(client, headers, **kwargs)
    assert res.status_code == status, res.text
    assert res.json()["error"]["code"] == code
    assert claude.requests == []


def test_missing_image_is_validation_error(client, claude, farmer):
    headers, _ = farmer
    res = client.post("/api/v1/diagnoses", headers=headers, data={"notes": "x"})
    assert res.json()["error"]["code"] == "validation_error"


@pytest.mark.parametrize(
    "response",
    [
        _response(text="not json"),
        _response(text=json.dumps({**RESULT, "health_status": "dying"})),
        _response(text=json.dumps(RESULT)[:50], stop_reason="max_tokens"),
    ],
)
def test_bad_model_output_is_503_and_not_saved(client, farmer, db_session, response):
    headers, _ = farmer
    app.dependency_overrides[get_ai_client] = lambda: FakeClaude(response)
    app.dependency_overrides[get_weather_provider] = lambda: FakeProvider()
    res = _post(client, headers)
    assert res.status_code == 503 and res.json()["error"]["code"] == "ai_unavailable"
    with db_session() as s:
        assert s.query(Diagnosis).count() == 0
        assert s.query(AiUsage).count() == 1  # still billed, still counted


def test_history_and_privacy(client, claude, farmer, login):
    headers, fid = farmer
    first = _post(client, headers, field_id=str(fid)).json()["id"]
    _post(client, headers)
    assert [d["id"] for d in client.get("/api/v1/diagnoses", headers=headers).json()] == [first + 1, first]
    assert [d["id"] for d in client.get("/api/v1/diagnoses", headers=headers, params={"field_id": fid}).json()] == [first]
    assert client.get(f"/api/v1/diagnoses/{first}", headers=headers).json()["result"]["summary"] == RESULT["summary"]

    other, _ = login("9555555555")
    assert client.get(f"/api/v1/diagnoses/{first}", headers=other).json()["error"]["code"] == "diagnosis_not_found"
    assert client.get("/api/v1/diagnoses", headers=other).json() == []
    assert client.delete(f"/api/v1/diagnoses/{first}", headers=other).status_code == 404
    assert client.delete(f"/api/v1/diagnoses/{first}", headers=headers).status_code == 204
