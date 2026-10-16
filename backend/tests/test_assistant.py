from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace

import anthropic
import httpx2
import pytest

from app.core.config import get_settings
from app.core.security import utcnow
from app.main import app
from app.models import AiUsage, ChatThread
from app.services.ai.claude import cost_usd, get_ai_client, month_start
from app.services.weather import forecast_cache, get_weather_provider
from tests.test_weather import FakeProvider


def _response(text="వరి పంటకు ఇప్పుడు యూరియా వేయండి.", stop_reason="end_turn", model="claude-opus-5-5", **usage):
    u = {"input_tokens": 1000, "output_tokens": 500, "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0}
    u.update(usage)
    return SimpleNamespace(
        content=[SimpleNamespace(type="thinking", thinking=""), SimpleNamespace(type="text", text=text)],
        stop_reason=stop_reason,
        stop_details=SimpleNamespace(category="general_harms") if stop_reason == "refusal" else None,
        model=model,
        usage=SimpleNamespace(**u),
        _request_id="req_test",
    )


class FakeClaude:
    def __init__(self, *responses, error=None):
        self.responses = list(responses) or [_response()]
        self.error = error
        self.requests = []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self._create))

    def _create(self, **kwargs):
        self.requests.append(kwargs)
        if self.error:
            raise self.error
        return self.responses.pop(0) if len(self.responses) > 1 else self.responses[0]


@pytest.fixture
def claude():
    fake = FakeClaude()
    app.dependency_overrides[get_ai_client] = lambda: fake
    forecast_cache.clear()
    weather = FakeProvider()
    app.dependency_overrides[get_weather_provider] = lambda: weather
    yield fake
    forecast_cache.clear()


@pytest.fixture
def farmer(login, client):
    headers, body = login()
    client.patch(
        "/api/v1/farmers/me",
        headers=headers,
        json={
            "name": "Ramesh",
            "preferred_language": "te",
            "primary_crop_code": "paddy",
            "location": {
                "state": "AP",
                "district": "Guntur",
                "mandal": "Tenali",
                "latitude": 16.24,
                "longitude": 80.64,
            },
        },
    )
    fid = client.post(
        "/api/v1/fields",
        headers=headers,
        json={
            "name": "East plot",
            "crop_code": "paddy",
            "acreage": 2,
            "growth_stage": "vegetative",
            "planted_on": "2026-08-01",
        },
    ).json()["id"]
    return headers, fid


def test_new_conversation_sends_grounded_request(client, claude, farmer):
    headers, fid = farmer
    res = client.post(
        "/api/v1/assistant/messages", headers=headers, json={"message": "ఎరువు ఎప్పుడు వేయాలి?", "field_id": fid}
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["reply"]["role"] == "assistant" and body["reply"]["content"].startswith("వరి")
    assert body["message"]["content"] == "ఎరువు ఎప్పుడు వేయాలి?"
    assert body["thread"]["field_id"] == fid and body["thread"]["title"] == "ఎరువు ఎప్పుడు వేయాలి?"

    req = claude.requests[0]
    assert req["model"] == "claude-opus-5-5"
    assert req["fallbacks"] == "default" and req["betas"] == ["server-side-fallback-2026-07-01"]
    assert req["output_config"] == {"effort": "low"}
    assert "thinking" not in req  # Opus 5.5: thinking is always on; effort controls depth
    assert req["messages"] == [{"role": "user", "content": "ఎరువు ఎప్పుడు వేయాలి?"}]
    stable, context = (b["text"] for b in req["system"])
    assert "Ramesh" not in stable  # keep the cached prompt farmer-independent
    assert "Reply language: Telugu" in context
    assert "Tenali, Guntur, Andhra Pradesh" in context
    assert '"East plot"; 2.00 acres; crop: Paddy; stage: vegetative; planted 2026-08-01' in context
    assert 'This conversation is about the field "East plot"' in context
    assert "ALERT 2026-10-18: heavy rain (watch)" in context  # from the fake forecast


def test_follow_up_includes_history(client, claude, farmer):
    headers, _ = farmer
    tid = client.post("/api/v1/assistant/messages", headers=headers, json={"message": "Q1"}).json()["thread"]["id"]
    client.post("/api/v1/assistant/messages", headers=headers, json={"message": "Q2", "thread_id": tid})
    first_answer = _response().content[1].text
    assert [m["content"] for m in claude.requests[1]["messages"]] == ["Q1", first_answer, "Q2"]

    detail = client.get(f"/api/v1/assistant/threads/{tid}", headers=headers).json()
    assert [m["role"] for m in detail["messages"]] == ["user", "assistant", "user", "assistant"]
    assert len(client.get("/api/v1/assistant/threads", headers=headers).json()) == 1


def test_history_is_trimmed_and_starts_with_user(client, claude, farmer, monkeypatch):
    headers, _ = farmer
    monkeypatch.setattr(get_settings(), "ai_chat_history_messages", 3)
    tid = client.post("/api/v1/assistant/messages", headers=headers, json={"message": "Q1"}).json()["thread"]["id"]
    client.post("/api/v1/assistant/messages", headers=headers, json={"message": "Q2", "thread_id": tid})
    client.post("/api/v1/assistant/messages", headers=headers, json={"message": "Q3", "thread_id": tid})
    # Last 3 of [Q1 A1 Q2 A2] = [A1 Q2 A2] → leading assistant dropped → [Q2 A2] + Q3
    sent = claude.requests[2]["messages"]
    assert [m["role"] for m in sent] == ["user", "assistant", "user"]
    assert sent[0]["content"] == "Q2" and sent[-1]["content"] == "Q3"


def test_threads_are_private(client, claude, farmer, login):
    headers, _ = farmer
    tid = client.post("/api/v1/assistant/messages", headers=headers, json={"message": "Q1"}).json()["thread"]["id"]
    other, _ = login("9444444444")
    assert client.get(f"/api/v1/assistant/threads/{tid}", headers=other).status_code == 404
    res = client.post("/api/v1/assistant/messages", headers=other, json={"message": "hi", "thread_id": tid})
    assert res.json()["error"]["code"] == "thread_not_found"
    assert client.delete(f"/api/v1/assistant/threads/{tid}", headers=other).status_code == 404
    assert client.delete(f"/api/v1/assistant/threads/{tid}", headers=headers).status_code == 204


def test_usage_is_recorded_with_cost(client, claude, farmer, db_session):
    headers, _ = farmer
    claude.responses = [_response(input_tokens=2000, output_tokens=1000, cache_read_input_tokens=10000)]
    client.post("/api/v1/assistant/messages", headers=headers, json={"message": "Q"})
    with db_session() as s:
        row = s.query(AiUsage).one()
        # 2000*$4 + 1000*$20 + 10000*$0.20, per million
        assert row.cost_usd == Decimal("0.030000")
        assert (row.feature, row.model, row.request_id) == ("chat", "claude-opus-5-5", "req_test")


def test_cost_uses_dearer_model_when_fallback_served():
    usage = SimpleNamespace(
        input_tokens=1_000_000, output_tokens=0, cache_creation_input_tokens=0, cache_read_input_tokens=0
    )
    assert cost_usd(["claude-opus-5-5", "claude-opus-4-8"], usage) == Decimal("5")
    assert cost_usd(["claude-opus-5-5", "some-future-model"], usage) == Decimal("10")  # unknown → dearest known


def test_budget_guard_blocks_before_calling(client, claude, farmer, db_session):
    headers, _ = farmer
    with db_session() as s:
        s.add(AiUsage(farmer_id=None, feature="chat", model="x", cost_usd=Decimal("49.85"), created_at=utcnow()))
        s.commit()
    res = client.post("/api/v1/assistant/messages", headers=headers, json={"message": "Q"})
    assert res.status_code == 503 and res.json()["error"]["code"] == "ai_budget_exceeded"
    assert claude.requests == []


def test_budget_resets_each_month(client, claude, farmer, db_session):
    headers, _ = farmer
    last_month = month_start(utcnow()) - timedelta(seconds=1)
    with db_session() as s:
        s.add(AiUsage(farmer_id=None, feature="chat", model="x", cost_usd=Decimal("500"), created_at=last_month))
        s.commit()
    assert client.post("/api/v1/assistant/messages", headers=headers, json={"message": "Q"}).status_code == 200


def test_budget_is_configurable(client, claude, farmer, monkeypatch):
    headers, _ = farmer
    monkeypatch.setattr(get_settings(), "ai_monthly_budget_usd", 0.0)
    res = client.post("/api/v1/assistant/messages", headers=headers, json={"message": "Q"})
    assert res.json()["error"]["code"] == "ai_budget_exceeded"


def test_daily_limit_per_farmer(client, claude, farmer, monkeypatch):
    headers, _ = farmer
    monkeypatch.setattr(get_settings(), "ai_farmer_daily_request_limit", 2)
    for _ in range(2):
        assert client.post("/api/v1/assistant/messages", headers=headers, json={"message": "Q"}).status_code == 200
    res = client.post("/api/v1/assistant/messages", headers=headers, json={"message": "Q"})
    assert res.status_code == 429 and res.json()["error"]["code"] == "ai_daily_limit"


def test_refusal_is_recorded_and_leaves_no_thread(client, claude, farmer, db_session):
    headers, _ = farmer
    claude.responses = [_response(text="", stop_reason="refusal")]
    res = client.post("/api/v1/assistant/messages", headers=headers, json={"message": "Q"})
    assert res.status_code == 422 and res.json()["error"]["code"] == "ai_declined"
    with db_session() as s:
        assert s.query(AiUsage).count() == 1  # declines can be billed, so they count
        assert s.query(ChatThread).count() == 0


@pytest.mark.parametrize(
    "error,code",
    [
        (
            anthropic.RateLimitError(
                "slow down", response=httpx2.Response(429, request=httpx2.Request("POST", "https://x")), body=None
            ),
            "ai_busy",
        ),
        (
            anthropic.InternalServerError(
                "boom", response=httpx2.Response(529, request=httpx2.Request("POST", "https://x")), body=None
            ),
            "ai_unavailable",
        ),
        (anthropic.APIConnectionError(request=httpx2.Request("POST", "https://x")), "ai_unavailable"),
    ],
)
def test_provider_errors(client, farmer, error, code, db_session):
    headers, _ = farmer
    app.dependency_overrides[get_ai_client] = lambda: FakeClaude(error=error)
    app.dependency_overrides[get_weather_provider] = lambda: FakeProvider()
    res = client.post("/api/v1/assistant/messages", headers=headers, json={"message": "Q"})
    assert res.status_code == 503 and res.json()["error"]["code"] == code
    with db_session() as s:
        assert s.query(ChatThread).count() == 0


def test_not_configured_without_api_key(client, farmer, monkeypatch):
    headers, _ = farmer
    monkeypatch.setattr(get_settings(), "anthropic_api_key", "")
    res = client.post("/api/v1/assistant/messages", headers=headers, json={"message": "Q"})
    assert res.status_code == 503 and res.json()["error"]["code"] == "ai_not_configured"


def test_weather_failure_does_not_break_chat(client, farmer, claude):
    headers, _ = farmer

    class Down:
        def fetch_daily(self, *a):
            raise RuntimeError("down")

    app.dependency_overrides[get_weather_provider] = lambda: Down()
    assert client.post("/api/v1/assistant/messages", headers=headers, json={"message": "Q"}).status_code == 200
    assert "Weather forecast" not in claude.requests[0]["system"][1]["text"]


def test_validation(client, farmer, claude):
    headers, _ = farmer
    assert client.post("/api/v1/assistant/messages", headers=headers, json={"message": ""}).status_code == 422
    assert client.post("/api/v1/assistant/messages", headers=headers, json={"message": "x" * 2001}).status_code == 422
    res = client.post("/api/v1/assistant/messages", headers=headers, json={"message": "Q", "field_id": 999})
    assert res.json()["error"]["code"] == "field_not_found"
