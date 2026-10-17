"""AI_PROVIDER=gemini: Google Gemini (free tier) for TESTING ONLY, so real AI answers can be tried without a
paid Anthropic key. Production uses Claude (team decision); this provider is refused in production.

Free-tier caveat: Google may use free-tier prompts and images to improve its products. Use test questions and
test photos only, never real farmers' data.

The adapter speaks Gemini's OpenAI-compatible endpoint and returns responses shaped like the Anthropic SDK's,
so the chat and diagnosis code don't change.
"""

import logging
import time
from types import SimpleNamespace

import httpx

from app.core.errors import AppError

log = logging.getLogger("annadata.ai")

_STOP_REASONS = {"stop": "end_turn", "length": "max_tokens", "content_filter": "refusal"}


def _strip_additional_properties(node):
    """Gemini's schema support rejects `additionalProperties`; the backend still validates the full schema."""
    if isinstance(node, dict):
        return {k: _strip_additional_properties(v) for k, v in node.items() if k != "additionalProperties"}
    if isinstance(node, list):
        return [_strip_additional_properties(v) for v in node]
    return node


def _to_openai_content(content):
    if isinstance(content, str):
        return content
    parts = []
    for block in content:
        if block.get("type") == "text":
            parts.append({"type": "text", "text": block["text"]})
        elif block.get("type") == "image":
            src = block["source"]
            parts.append({"type": "image_url", "image_url": {"url": f"data:{src['media_type']};base64,{src['data']}"}})
    return parts


class _TryNextModel(Exception):
    """This model is out of quota or overloaded right now; the next model in the chain may still work."""


class GeminiClient:
    """Implements the one SDK call the backend uses: client.beta.messages.create(...).

    Takes a chain of models: on the free tier each model has its own daily request quota, so when one runs out
    (429) or stays overloaded (503 after a retry), the request goes to the next model. An exhausted model is
    skipped for a while instead of being asked again on every request.
    """

    USER_AGENT = "Annadata360-backend/0.1 (+https://github.com/yogesh-t67/Annadatha360)"
    RETRY_DELAY_SECONDS = 1.5
    QUOTA_SKIP_SECONDS = 15 * 60  # daily quotas reset once a day; re-check every 15 min
    OVERLOAD_SKIP_SECONDS = 60

    def __init__(self, api_key: str, model: str | list[str] | tuple[str, ...], base_url: str, http: httpx.Client | None = None):
        self.models = [model] if isinstance(model, str) else list(dict.fromkeys(model))
        self.model = self.models[0]
        self.url = base_url.rstrip("/") + "/chat/completions"
        # Gemini's own API, used for audio: the OpenAI-compatible endpoint only accepts WAV/MP3, while phones
        # record AAC/M4A, which the native endpoint takes as-is.
        self.native_base = base_url.rstrip("/").removesuffix("/openai")
        self.api_key = api_key
        self.http = http or httpx.Client(timeout=90.0, headers={"User-Agent": self.USER_AGENT})
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self._create))
        self._skip_until: dict[str, float] = {}

    def native_url(self, model: str) -> str:
        return f"{self.native_base}/models/{model}:generateContent"

    def _post(self, url: str, body: dict, *, native: bool) -> dict:
        # The two endpoints authenticate differently, and the native one rejects a Bearer API key.
        auth = {"x-goog-api-key": self.api_key} if native else {"Authorization": f"Bearer {self.api_key}"}
        for attempt in range(2):
            try:
                res = self.http.post(url, json=body, headers=auth)
            except httpx.HTTPError as exc:
                log.error("Gemini connection error: %s", exc)
                raise AppError(503, "ai_unavailable", "The AI assistant is unavailable right now") from exc
            # "High demand" 503s from Google usually clear within a second or two: retry once before giving up.
            if res.status_code != 503 or attempt == 1:
                break
            time.sleep(self.RETRY_DELAY_SECONDS)
        if res.status_code == 429:
            log.warning("Gemini quota/rate limit: %s", res.text[:300])
            raise _TryNextModel(self.QUOTA_SKIP_SECONDS)
        if res.status_code == 503:
            log.warning("Gemini overloaded: %s", res.text[:300])
            raise _TryNextModel(self.OVERLOAD_SKIP_SECONDS)
        if res.status_code >= 400:
            log.error("Gemini API error %s: %s", res.status_code, res.text[:500])
            raise AppError(503, "ai_unavailable", "The AI assistant is unavailable right now")
        return res.json()

    def _create(self, **params):
        params.pop("model", None)  # callers pass the configured model; the chain decides which one answers
        now = time.monotonic()
        available = [m for m in self.models if self._skip_until.get(m, 0) <= now] or self.models[-1:]
        for model in available:
            try:
                return self._create_with(model, **params)
            except _TryNextModel as busy:
                self._skip_until[model] = time.monotonic() + busy.args[0]
                log.warning("Gemini model %s unavailable; trying the next one", model)
        raise AppError(503, "ai_busy", "The AI assistant is busy. Try again in a minute.")

    def _create_native(self, model, *, system_text, messages, max_tokens, output_config):
        def parts(content):
            if isinstance(content, str):
                return [{"text": content}]
            out = []
            for block in content:
                if block.get("type") == "text":
                    out.append({"text": block["text"]})
                elif block.get("type") in ("audio", "image"):
                    src = block["source"]
                    out.append({"inline_data": {"mime_type": src["media_type"], "data": src["data"]}})
            return out

        body = {
            "contents": [
                {"role": "model" if m["role"] == "assistant" else "user", "parts": parts(m["content"])} for m in messages
            ],
            "generationConfig": {"maxOutputTokens": max_tokens},
        }
        if system_text:
            body["systemInstruction"] = {"parts": [{"text": system_text}]}
        fmt = (output_config or {}).get("format")
        if fmt and fmt.get("type") == "json_schema":
            body["generationConfig"]["responseMimeType"] = "application/json"
            body["generationConfig"]["responseJsonSchema"] = _strip_additional_properties(fmt["schema"])

        data = self._post(self.native_url(model), body, native=True)
        candidate = (data.get("candidates") or [{}])[0]
        text = "".join(
            p.get("text", "") for p in (candidate.get("content") or {}).get("parts", []) if not p.get("thought")
        )
        usage = data.get("usageMetadata") or {}
        return SimpleNamespace(
            content=[SimpleNamespace(type="text", text=text)],
            stop_reason="max_tokens" if candidate.get("finishReason") == "MAX_TOKENS" else "end_turn",
            stop_details=None,
            model=model,
            usage=SimpleNamespace(
                input_tokens=usage.get("promptTokenCount", 0),
                output_tokens=usage.get("candidatesTokenCount", 0) + usage.get("thoughtsTokenCount", 0),
                cache_creation_input_tokens=0,
                cache_read_input_tokens=0,
            ),
            _request_id=data.get("responseId"),
        )

    def _create_with(self, model, *, system=None, messages, max_tokens, output_config=None, **_ignored):
        # Claude-only parameters (betas, fallbacks, cache_control, effort) are ignored here.
        system_text = "\n\n".join(b["text"] for b in system or [] if b.get("type") == "text")
        has_audio = any(
            isinstance(m["content"], list) and any(b.get("type") == "audio" for b in m["content"]) for m in messages
        )
        if has_audio:
            return self._create_native(
                model, system_text=system_text, messages=messages, max_tokens=max_tokens, output_config=output_config
            )
        body = {
            "model": model,
            "max_tokens": max_tokens,
            "messages": ([{"role": "system", "content": system_text}] if system_text else [])
            + [{"role": m["role"], "content": _to_openai_content(m["content"])} for m in messages],
        }
        fmt = (output_config or {}).get("format")
        if fmt and fmt.get("type") == "json_schema":
            body["response_format"] = {
                "type": "json_schema",
                "json_schema": {"name": "result", "schema": _strip_additional_properties(fmt["schema"])},
            }

        data = self._post(self.url, body, native=False)
        choice = (data.get("choices") or [{}])[0]
        text = (choice.get("message") or {}).get("content") or ""
        usage = data.get("usage") or {}
        return SimpleNamespace(
            content=[SimpleNamespace(type="text", text=text)],
            stop_reason=_STOP_REASONS.get(choice.get("finish_reason"), "end_turn"),
            stop_details=None,
            model=model,
            usage=SimpleNamespace(
                input_tokens=usage.get("prompt_tokens", 0),
                output_tokens=usage.get("completion_tokens", 0),
                cache_creation_input_tokens=0,
                cache_read_input_tokens=0,
            ),
            _request_id=data.get("id"),
        )
