# AI assistant (chat)

Text chat for the AI Assistant screen. The farmer asks a question; the answer comes back in their
`preferred_language` (Telugu for most farmers), grounded in their profile, fields (crop, stage, days since
planting) and the 3-day weather forecast for their location. Auth required. Voice comes later.

**Model:** Claude (Anthropic), `claude-opus-5-5` by default (server config `AI_MODEL`). If Claude's safety
filter declines a request, the server automatically retries on Anthropic's recommended fallback model.

## Behaviour to design for

- **Slow:** a reply can take **5–30 seconds**. Show a "thinking…" state and disable send. Set the HTTP client
  timeout to **≥ 120 s**.
- **Not streamed** (yet): the full reply arrives at once.
- **Plain text** replies, short lines or numbered steps. No markdown to render.
- **Conversations (threads):** omit `thread_id` to start a new one; pass it back for follow-ups so the assistant
  remembers what was said. The last 20 messages of a thread are used as memory.
- **Field-specific chats:** pass `field_id` when starting from a field's screen; answers focus on that field.
- **Limits:** each farmer gets 30 AI requests per rolling 24 h (chat + diagnosis combined), and the whole app has a
  monthly AI spend cap. Handle `ai_daily_limit` and `ai_budget_exceeded` (see Errors).
- If a request fails or is declined, **nothing is saved** — a new conversation isn't created, and the
  farmer's message isn't stored. Keep the typed text in the input box so they can retry.

## POST /assistant/messages

```json
{ "message": "నా వరి ఆకులు పసుపు రంగులోకి మారుతున్నాయి. ఏం చేయాలి?", "thread_id": null, "field_id": 7 }
```

| Field | Rules |
|---|---|
| `message` | required, 1–2000 chars |
| `thread_id` | optional; an existing thread of this farmer. Omit to start a new conversation |
| `field_id` | optional; only used when starting a new conversation |

**200**
```json
{
  "thread": {
    "id": 12,
    "title": "నా వరి ఆకులు పసుపు రంగులోకి మారుతున్నాయి. ఏం చేయాలి?",
    "field_id": 7,
    "created_at": "2026-10-16T09:00:00Z",
    "updated_at": "2026-10-16T09:00:14Z"
  },
  "message": { "id": 41, "role": "user", "content": "నా వరి ఆకులు…", "created_at": "2026-10-16T09:00:14Z" },
  "reply": { "id": 42, "role": "assistant", "content": "…", "created_at": "2026-10-16T09:00:14Z" }
}
```

`title` is the first line of the first message, cut to 60 characters.

## GET /assistant/threads

**200** — this farmer's threads, most recently active first: `[ { id, title, field_id, created_at, updated_at } ]`.

## GET /assistant/threads/{id}

**200** — the thread plus `messages`, oldest first:
```json
{ "id": 12, "title": "…", "field_id": 7, "created_at": "…", "updated_at": "…",
  "messages": [ { "id": 41, "role": "user", "content": "…", "created_at": "…" } ] }
```

## DELETE /assistant/threads/{id}

**204**. Deletes the thread and its messages.

## Errors

| Status | code | When | Suggested UI |
|---|---|---|---|
| 404 | `thread_not_found` | Not this farmer's thread | — |
| 404 | `field_not_found` | Not this farmer's field | — |
| 422 | `validation_error` | Empty or too-long message | — |
| 422 | `ai_declined` | Safety filter declined the request (rare) | "I can't help with that. Try asking differently." |
| 429 | `ai_daily_limit` | Farmer used their 30 requests in the last 24 h | "Daily limit reached, try tomorrow" |
| 503 | `ai_busy` | Provider rate limit | "Busy, try again in a minute" |
| 503 | `ai_unavailable` | Provider error / network | "Try again later" |
| 503 | `ai_budget_exceeded` | App-wide monthly AI budget used up | "Assistant paused, back next month" |
| 503 | `ai_not_configured` | Server has no AI key (dev setups) | — |

**Fake AI mode (dev/staging):** with `AI_PROVIDER=fake` the server returns canned replies in the farmer's
language, clearly labelled as test output (`[Test reply — AI not connected yet]` / `[పరీక్ష సమాధానం …]`), with
exactly the real response shape. Diagnosis returns a sample result the same way. Use it to build the screens
without an API key. Limits still apply; cost is zero. Not allowed in production.

**Gemini test mode (dev/staging):** with `AI_PROVIDER=gemini` + `GEMINI_API_KEY` (free from Google AI Studio)
the server answers with Google's free Gemini model instead of Claude — real AI answers, same response shapes,
recorded at zero cost. For testing only: Google may use free-tier prompts and photos to improve its products, so
use test data, never real farmers'. Answer quality and Telugu fluency will differ from Claude; judge the product
on Claude before launch. Not allowed in production.

Verified live on 2026-10-16 with `gemini-3.6-flash`: Telugu replies ~8–11 s, using the farmer's crop, village,
growth stage and the weather forecast; follow-ups keep context; diagnosis returns the documented result shape
(~7 s). Google's models can be temporarily overloaded (that day `gemini-3.8-flash` was) — the app then gets
`503 ai_busy`; switch `GEMINI_MODEL` if it persists. Any pesticide names/doses in answers need agronomist review
before real-farmer use.

## Cost controls (backend)

Every Claude call is logged with tokens and cost in `ai_usage`. Before each call the server checks this
month's total (UTC calendar month) against `AI_MONTHLY_BUDGET_USD` (placeholder **$50**), keeping
`AI_CALL_RESERVE_USD` ($0.20) of headroom so the last call can't overshoot by much. Two calls racing at the
very edge can still overshoot slightly. Change the cap with an env var, no deploy needed. Other knobs:
`AI_MODEL`, `AI_CHAT_EFFORT` (default `low`), `AI_FARMER_DAILY_REQUEST_LIMIT`, `AI_CHAT_HISTORY_MESSAGES`.
