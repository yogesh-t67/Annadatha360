"""Natural spoken answers with Gemini text-to-speech, for languages where phones lack a good (male) voice.

The app sends the text; we return a URL to a WAV file. Audio is cached on disk by a hash of (voice, text), so
repeated lines — the welcome, a re-played answer — cost nothing and play instantly. Several TTS models are tried
in order because each has its own small free-tier quota (a few requests per minute).
"""

import base64
import hashlib
import io
import logging
import os
import struct
import time
import wave
from pathlib import Path

import httpx

from app.core.config import get_settings
from app.core.errors import AppError

log = logging.getLogger("annadata.tts")

CACHE_DIR = Path(os.getenv("TTS_CACHE_DIR", "/tmp/annadata-tts"))
MAX_CHARS = 2000
SKIP_SECONDS = 60  # a model that hit its per-minute quota is skipped for this long

# Send only the words to speak: a style instruction in front ("Say this warmly: …") was sometimes read aloud
# in English before the Telugu. The voice ("Charon") already gives the calm, warm delivery.
CACHE_VERSION = "v2"  # bump when the request changes, so old cached audio isn't reused

_skip_until: dict[str, float] = {}


def audio_path(key: str) -> Path:
    return CACHE_DIR / f"{key}.wav"


def cache_key(voice: str, text: str) -> str:
    return hashlib.sha256(f"{CACHE_VERSION}\n{voice}\n{text}".encode()).hexdigest()


def _to_wav(data: bytes, mime: str) -> bytes:
    """Some TTS models return raw 16-bit PCM (audio/L16); wrap it so phones can play it."""
    if data[:4] == b"RIFF":
        return data
    rate = 24000
    for part in mime.replace(" ", "").split(";"):
        if part.lower().startswith("rate="):
            rate = int(part.split("=", 1)[1])
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        # L16 is big-endian by spec; Gemini sends little-endian samples labelled L16, which WAV expects as-is.
        w.writeframes(data)
    return buf.getvalue()


def synthesize(text: str, http: httpx.Client | None = None) -> str:
    """Return the cache key of a WAV file speaking `text` (generating it if needed)."""
    s = get_settings()
    if s.ai_provider != "gemini" or not s.gemini_api_key:
        raise AppError(422, "tts_not_available", "Server voice needs AI_PROVIDER=gemini")
    text = " ".join(text.split())[:MAX_CHARS]
    if not text:
        raise AppError(422, "text_required", "Nothing to speak")
    key = cache_key(s.gemini_tts_voice, text)
    path = audio_path(key)
    if path.exists():
        return key

    client = http or httpx.Client(timeout=60.0)
    now = time.monotonic()
    models = [m for m in s.gemini_tts_models if _skip_until.get(m, 0) <= now] or s.gemini_tts_models[-1:]
    for model in models:
        url = f"{s.gemini_base_url.rstrip('/').removesuffix('/openai')}/models/{model}:generateContent"
        body = {
            "contents": [{"parts": [{"text": text}]}],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": s.gemini_tts_voice}}},
            },
        }
        try:
            res = client.post(url, json=body, headers={"x-goog-api-key": s.gemini_api_key})
        except httpx.HTTPError as exc:
            log.warning("TTS %s connection error: %s", model, exc)
            continue
        if res.status_code in (429, 503):
            log.warning("TTS %s busy (%s); trying the next model", model, res.status_code)
            _skip_until[model] = time.monotonic() + SKIP_SECONDS
            continue
        if res.status_code >= 400:
            log.error("TTS %s error %s: %s", model, res.status_code, res.text[:300])
            continue
        try:
            part = res.json()["candidates"][0]["content"]["parts"][0]["inlineData"]
            audio = _to_wav(base64.b64decode(part["data"]), part.get("mimeType", ""))
        except (KeyError, IndexError, ValueError, struct.error) as exc:
            log.error("TTS %s returned no audio: %s", model, exc)
            continue
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".part")
        tmp.write_bytes(audio)
        tmp.replace(path)
        return key
    raise AppError(503, "tts_busy", "The voice service is busy; the app will use the phone voice")
