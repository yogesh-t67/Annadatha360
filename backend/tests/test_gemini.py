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


def test_falls_back_to_next_model_when_quota_runs_out():
    asked = []

    def handler(request):
        model = json.loads(request.content)["model"]
        asked.append(model)
        return httpx.Response(429, text="quota") if model == "gemini-a" else _ok("from b")

    g = GeminiClient("k", ["gemini-a", "gemini-b"], "https://gemini.test/v1beta/openai/", http=httpx.Client(transport=httpx.MockTransport(handler)))
    res = g.beta.messages.create(max_tokens=10, messages=[{"role": "user", "content": "hi"}])
    assert res.content[0].text == "from b" and res.model == "gemini-b"  # usage is logged against the model that answered
    g.beta.messages.create(max_tokens=10, messages=[{"role": "user", "content": "again"}])
    assert asked == ["gemini-a", "gemini-b", "gemini-b"]  # exhausted model skipped for a while


def test_all_models_exhausted_is_busy():
    from app.core.errors import AppError

    g = GeminiClient("k", ["gemini-a", "gemini-b"], "https://gemini.test/v1beta/openai/",
                     http=httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(429, text="quota"))))  # fmt: skip
    with pytest.raises(AppError) as exc:
        g.beta.messages.create(max_tokens=10, messages=[])
    assert exc.value.code == "ai_busy"


def test_retries_once_on_high_demand(monkeypatch):
    monkeypatch.setattr(GeminiClient, "RETRY_DELAY_SECONDS", 0)
    calls = []

    def handler(request):
        calls.append(1)
        return httpx.Response(503, text="high demand") if len(calls) == 1 else _ok("ok")

    assert _gemini(handler).beta.messages.create(max_tokens=10, messages=[]).content[0].text == "ok"
    assert len(calls) == 2


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


def test_audio_goes_to_native_endpoint():
    seen = {}

    def handler(request):
        seen["url"] = str(request.url)
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={
            "responseId": "r-1",
            "candidates": [{"content": {"parts": [{"text": "plan", "thought": True}, {"text": '{"transcript":"t","answer":"a"}'}]}, "finishReason": "STOP"}],
            "usageMetadata": {"promptTokenCount": 300, "candidatesTokenCount": 20, "thoughtsTokenCount": 30},
        })  # fmt: skip

    res = _gemini(handler).beta.messages.create(
        max_tokens=800,
        system=[{"type": "text", "text": "S"}],
        output_config={"format": {"type": "json_schema", "schema": {"type": "object", "additionalProperties": False}}},
        messages=[
            {"role": "user", "content": "earlier"},
            {"role": "assistant", "content": "reply"},
            {"role": "user", "content": [{"type": "audio", "source": {"media_type": "audio/mp4", "data": "QUJD"}}]},
        ],
    )
    body = seen["body"]
    assert seen["url"] == "https://gemini.test/v1beta/models/gemini-3.8-flash:generateContent"
    assert body["systemInstruction"] == {"parts": [{"text": "S"}]}
    assert [c["role"] for c in body["contents"]] == ["user", "model", "user"]
    assert body["contents"][2]["parts"][0] == {"inline_data": {"mime_type": "audio/mp4", "data": "QUJD"}}
    assert body["generationConfig"]["responseMimeType"] == "application/json"
    assert res.content[0].text == '{"transcript":"t","answer":"a"}'  # thought parts dropped
    assert (res.usage.input_tokens, res.usage.output_tokens) == (300, 50)


def test_voice_question_end_to_end(login, client, monkeypatch, db_session):
    s = get_settings()
    monkeypatch.setattr(s, "ai_provider", "gemini")
    monkeypatch.setattr(s, "gemini_api_key", "g-key")

    def handler(request):
        assert request.url.path.endswith(":generateContent")
        return httpx.Response(200, json={
            "candidates": [{"content": {"parts": [{"text": '{"transcript":"మిర్చి ఆకులు ముడుచుకుంటున్నాయి","answer":"Spray neem oil."}'}]}, "finishReason": "STOP"}],
            "usageMetadata": {"promptTokenCount": 1, "candidatesTokenCount": 1},
        })  # fmt: skip

    monkeypatch.setattr(claude, "_gemini_for", lambda *a: _gemini(handler))
    headers, _ = login()
    res = client.post(
        "/api/v1/assistant/voice", headers=headers, files={"audio": ("q.m4a", io.BytesIO(b"\x00" * 100), "audio/m4a")}
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["message"]["content"] == "మిర్చి ఆకులు ముడుచుకుంటున్నాయి"
    assert body["reply"]["content"] == "Spray neem oil."
    # saved like a typed question: transcript + answer in the thread
    thread = client.get(f"/api/v1/assistant/threads/{body['thread']['id']}", headers=headers).json()
    assert [m["role"] for m in thread["messages"]] == ["user", "assistant"]


def test_voice_no_speech(login, client, monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "ai_provider", "gemini")
    monkeypatch.setattr(s, "gemini_api_key", "g-key")
    empty = {"candidates": [{"content": {"parts": [{"text": '{"transcript":"","answer":""}'}]}}], "usageMetadata": {}}
    monkeypatch.setattr(claude, "_gemini_for", lambda *a: _gemini(lambda r: httpx.Response(200, json=empty)))
    headers, _ = login()
    res = client.post("/api/v1/assistant/voice", headers=headers, files={"audio": ("q.m4a", io.BytesIO(b"\x00"), "audio/mp4")})
    assert res.status_code == 422 and res.json()["error"]["code"] == "no_speech"


def test_voice_needs_gemini(login, client, monkeypatch):
    monkeypatch.setattr(get_settings(), "ai_provider", "anthropic")
    monkeypatch.setattr(get_settings(), "anthropic_api_key", "k")
    headers, _ = login()
    res = client.post("/api/v1/assistant/voice", headers=headers, files={"audio": ("q.m4a", io.BytesIO(b"\x00"), "audio/mp4")})
    assert res.status_code == 422 and res.json()["error"]["code"] == "voice_not_supported"


def test_gemini_without_key_is_not_configured(login, client, monkeypatch):
    monkeypatch.setattr(get_settings(), "ai_provider", "gemini")
    monkeypatch.setattr(get_settings(), "gemini_api_key", "")
    headers, _ = login()
    res = client.post("/api/v1/assistant/messages", headers=headers, json={"message": "hi"})
    assert res.status_code == 503 and res.json()["error"]["code"] == "ai_not_configured"
