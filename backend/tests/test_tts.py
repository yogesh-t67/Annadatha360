import base64
import json

import httpx
import pytest

from app.core.config import get_settings
from app.services.ai import tts

PCM = b"\x01\x00" * 2400  # 0.1 s of 24 kHz 16-bit mono


@pytest.fixture
def gemini_tts(monkeypatch, tmp_path):
    s = get_settings()
    monkeypatch.setattr(s, "ai_provider", "gemini")
    monkeypatch.setattr(s, "gemini_api_key", "g-key")
    monkeypatch.setattr(s, "gemini_tts_models", ["tts-a", "tts-b"])
    monkeypatch.setattr(tts, "CACHE_DIR", tmp_path)
    tts._skip_until.clear()
    calls = []

    def handler(request):
        model = request.url.path.split("/")[-1].split(":")[0]
        calls.append((model, json.loads(request.content)))
        if model == "tts-a":
            return httpx.Response(429, text="quota")
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"inlineData": {
            "mimeType": "audio/L16;codec=pcm;rate=24000", "data": base64.b64encode(PCM).decode()}}]}}]})  # fmt: skip

    real_client = httpx.Client
    monkeypatch.setattr(tts.httpx, "Client", lambda **kw: real_client(transport=httpx.MockTransport(handler)))
    return calls


def test_speak_returns_playable_wav_and_caches(client, login, gemini_tts):
    headers, _ = login()
    res = client.post("/api/v1/tts", headers=headers, json={"text": "నమస్తే రైతన్నా", "language": "te"})
    assert res.status_code == 200, res.text
    url = res.json()["audio_url"]
    assert [m for m, _ in gemini_tts] == ["tts-a", "tts-b"]  # busy model skipped to the next
    body = gemini_tts[-1][1]
    assert body["generationConfig"]["speechConfig"]["voiceConfig"]["prebuiltVoiceConfig"]["voiceName"] == "Charon"

    audio = client.get(url)  # no auth needed for the hashed file
    assert audio.status_code == 200 and audio.headers["content-type"] == "audio/wav"
    assert audio.content[:4] == b"RIFF"  # raw PCM was wrapped as WAV

    again = client.post("/api/v1/tts", headers=headers, json={"text": "నమస్తే   రైతన్నా"})  # same text, extra spaces
    assert again.json()["audio_url"] == url and len(gemini_tts) == 2  # served from cache, no new call


def test_audio_name_is_validated(client):
    assert client.get("/api/v1/tts/audio/..%2F..%2Fetc%2Fpasswd").status_code == 404
    assert client.get("/api/v1/tts/audio/" + "a" * 64 + ".wav").status_code == 404


def test_needs_gemini(client, login, monkeypatch):
    monkeypatch.setattr(get_settings(), "ai_provider", "anthropic")
    headers, _ = login()
    res = client.post("/api/v1/tts", headers=headers, json={"text": "hi"})
    assert res.status_code == 422 and res.json()["error"]["code"] == "tts_not_available"
