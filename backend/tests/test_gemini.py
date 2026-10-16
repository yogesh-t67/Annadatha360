import io
import json

import httpx
import pytest

from app.core.config import get_settings
from app.models import AiUsage
from app.services.ai import claude
from app.services.ai.gemini import GeminiClient
from tests.test_diagnosis import JPEG, RESULT


def _gemini(handler) -> GeminiClient:
    return GeminiClient("g-key", "gemini-3.8-flash", "https://gemini.test/v1beta/openai/", http=httpx.Client(
        transport=httpx.MockTransport(handler), headers={"Authorization": "Bearer g-key"}
    ))  # fmt: skip


def _ok(text, finish="stop"):
    return httpx.Response(
        200,
        json={
            "id": "g-1",
            "choices": [{"message": {"role": "assistant", "content": text}, "finish_reason": finish}],
            "usage": {"prompt_tokens": 120, "completion_tokens": 40},
        },
    )


def test_translates_request_and_response():
    seen = {}

    def handler(request):
        seen["url"] = str(request.url)
        seen["body"] = json.loads(request.content)
        return _ok("నమస్తే")

    res = _gemini(handler).beta.messages.create(
        model="ignored",
        betas=["x"],
        fallbacks="default",
        max_tokens=500,
        cache_control={"type": "ephemeral"},
        system=[{"type": "text", "text": "A"}, {"type": "text", "text": "B"}],
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": {"type": "object", "additionalProperties": False, "properties": {"x": {"type": "object", "additionalProperties": False}}}}},
        messages=[
            {"role": "user", "content": "hi"},
            {"role": "assistant", "content": "hello"},
            {"role": "user", "content": [{"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": "QUJD"}}, {"type": "text", "text": "what?"}]},
        ],
    )  # fmt: skip
    body = seen["body"]
    assert seen["url"] == "https://gemini.test/v1beta/openai/chat/completions"
    assert body["model"] == "gemini-3.8-flash" and body["max_tokens"] == 500
    assert body["messages"][0] == {"role": "system", "content": "A\n\nB"}
    assert body["messages"][3]["content"][0] == {
        "type": "image_url",
        "image_url": {"url": "data:image/jpeg;base64,QUJD"},
    }
    assert "additionalProperties" not in json.dumps(body["response_format"])
    assert "betas" not in body and "fallbacks" not in body

    assert res.content[0].text == "నమస్తే" and res.stop_reason == "end_turn" and res.model == "gemini-3.8-flash"
    assert (res.usage.input_tokens, res.usage.output_tokens) == (120, 40)


@pytest.mark.parametrize("finish,stop", [("length", "max_tokens"), ("content_filter", "refusal")])
def test_finish_reasons(finish, stop):
    assert _gemini(lambda r: _ok("", finish)).beta.messages.create(max_tokens=10, messages=[]).stop_reason == stop


@pytest.mark.parametrize("status,code", [(429, "ai_busy"), (500, "ai_unavailable"), (400, "ai_unavailable")])
def test_errors(status, code):
    from app.core.errors import AppError

    with pytest.raises(AppError) as exc:
        _gemini(lambda r: httpx.Response(status, text="nope")).beta.messages.create(max_tokens=10, messages=[])
    assert exc.value.code == code


@pytest.fixture
def gemini_mode(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "ai_provider", "gemini")
    monkeypatch.setattr(s, "gemini_api_key", "g-key")
    replies = []

    def handler(request):
        body = json.loads(request.content)
        replies.append(body)
        return _ok(json.dumps(RESULT, ensure_ascii=False) if "response_format" in body else "Test answer")

    monkeypatch.setattr(claude, "_gemini_for", lambda *a: _gemini(handler))
    return replies


def test_chat_and_diagnosis_end_to_end_at_zero_cost(login, client, gemini_mode, db_session):
    headers, _ = login()
    res = client.post("/api/v1/assistant/messages", headers=headers, json={"message": "hi"})
    assert res.status_code == 200, res.text
    assert res.json()["reply"]["content"] == "Test answer"
    res = client.post("/api/v1/diagnoses", headers=headers, files={"image": ("l.jpg", io.BytesIO(JPEG), "image/jpeg")})
    assert res.status_code == 201, res.text
    assert res.json()["result"]["issue"]["name"] == RESULT["issue"]["name"]
    with db_session() as db:
        rows = db.query(AiUsage).all()
        assert [(r.model, r.cost_usd) for r in rows] == [("gemini-3.8-flash", 0), ("gemini-3.8-flash", 0)]


def test_gemini_without_key_is_not_configured(login, client, monkeypatch):
    monkeypatch.setattr(get_settings(), "ai_provider", "gemini")
    monkeypatch.setattr(get_settings(), "gemini_api_key", "")
    headers, _ = login()
    res = client.post("/api/v1/assistant/messages", headers=headers, json={"message": "hi"})
    assert res.status_code == 503 and res.json()["error"]["code"] == "ai_not_configured"
