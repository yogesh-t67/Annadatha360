import base64
import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import utcnow
from app.models import ChatMessage, ChatThread, Farmer, Field
from app.services.ai.claude import call_claude, response_text
from app.services.ai.context import farmer_context
from app.services.ai.prompts import ASSISTANT_SYSTEM, VOICE_INSTRUCTIONS
from app.services.weather import WeatherProvider

MAX_TOKENS = 8000  # includes thinking; answers themselves are short
TITLE_LENGTH = 60
MAX_AUDIO_BYTES = 5 * 1024 * 1024  # ~5 minutes of phone-quality AAC; questions are a few seconds


def _history(db: Session, thread: ChatThread | None, limit: int) -> list[dict]:
    if thread is None:
        return []
    rows = list(
        db.scalars(
            select(ChatMessage).where(ChatMessage.thread_id == thread.id).order_by(ChatMessage.id.desc()).limit(limit)
        )
    )
    rows.reverse()
    while rows and rows[0].role != "user":  # the API needs the conversation to start with a user turn
        rows.pop(0)
    return [{"role": r.role, "content": r.content} for r in rows]


VOICE_SCHEMA = {
    "type": "object",
    "properties": {"transcript": {"type": "string"}, "answer": {"type": "string"}},
    "required": ["transcript", "answer"],
    "additionalProperties": False,
}


def ask_by_voice(
    db: Session,
    client,
    farmer: Farmer,
    thread: ChatThread | None,
    field: Field | None,
    audio: bytes,
    media_type: str,
    weather: WeatherProvider | None,
) -> tuple[ChatThread, ChatMessage, ChatMessage]:
    """Answer a spoken question in ONE AI call: the model hears the recording and returns what was said plus
    the answer. Skips on-device speech-to-text, which is slow and weak for Telugu. Gemini only (Claude doesn't
    take audio) — the app falls back to on-device speech-to-text on `voice_not_supported`."""
    settings = get_settings()
    if settings.ai_provider not in ("gemini", "fake"):
        raise AppError(422, "voice_not_supported", "Spoken questions need AI_PROVIDER=gemini")
    if not audio:
        raise AppError(422, "audio_required", "Attach the recording")
    if len(audio) > MAX_AUDIO_BYTES:
        raise AppError(413, "audio_too_large", "Recording must be 5 MB or smaller")
    if thread is not None and thread.field_id is not None:
        field = db.get(Field, thread.field_id)
    context = farmer_context(db, farmer, field, weather)

    response = call_claude(
        client,
        db,
        farmer_id=farmer.id,
        feature="chat",
        max_tokens=MAX_TOKENS,
        output_config={"effort": settings.ai_chat_effort, "format": {"type": "json_schema", "schema": VOICE_SCHEMA}},
        system=[
            {"type": "text", "text": ASSISTANT_SYSTEM},
            {"type": "text", "text": VOICE_INSTRUCTIONS},
            {"type": "text", "text": f"Farmer context:\n{context}"},
        ],
        messages=_history(db, thread, settings.ai_chat_history_messages)
        + [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "The farmer's spoken question:"},
                    {"type": "audio", "source": {"media_type": media_type, "data": base64.b64encode(audio).decode()}},
                ],
            }
        ],
    )
    try:
        data = json.loads(response_text(response))
        transcript, answer = data["transcript"].strip(), data["answer"].strip()
    except (ValueError, KeyError, TypeError, AttributeError) as exc:
        raise AppError(503, "ai_unavailable", "The assistant didn't return an answer. Try again.") from exc
    if not transcript:
        raise AppError(422, "no_speech", "No speech was heard in the recording")
    if not answer:
        raise AppError(503, "ai_unavailable", "The assistant didn't return an answer. Try again.")
    return _save_turn(db, farmer, thread, field, transcript, answer)


def _save_turn(db, farmer, thread, field, question: str, answer: str):
    if thread is None:
        title = question.splitlines()[0][:TITLE_LENGTH]
        thread = ChatThread(farmer_id=farmer.id, field_id=field.id if field else None, title=title)
        db.add(thread)
        db.flush()
    user_msg = ChatMessage(thread_id=thread.id, role="user", content=question)
    reply = ChatMessage(thread_id=thread.id, role="assistant", content=answer)
    db.add_all([user_msg, reply])
    thread.updated_at = utcnow()  # threads list sorts by last activity
    db.commit()
    for obj in (thread, user_msg, reply):
        db.refresh(obj)
    return thread, user_msg, reply


def ask(
    db: Session,
    client,
    farmer: Farmer,
    thread: ChatThread | None,
    field: Field | None,
    question: str,
    weather: WeatherProvider | None,
) -> tuple[ChatThread, ChatMessage, ChatMessage]:
    """Answer `question`. With thread=None a new thread is created — but only once Claude has answered,
    so failed or declined first messages leave nothing behind."""
    settings = get_settings()
    if thread is not None and thread.field_id is not None:
        field = db.get(Field, thread.field_id)
    context = farmer_context(db, farmer, field, weather)

    response = call_claude(
        client,
        db,
        farmer_id=farmer.id,
        feature="chat",
        max_tokens=MAX_TOKENS,
        output_config={"effort": settings.ai_chat_effort},
        cache_control={"type": "ephemeral"},  # caches the growing conversation prefix between turns
        system=[
            {"type": "text", "text": ASSISTANT_SYSTEM},
            {"type": "text", "text": f"Farmer context:\n{context}"},
        ],
        messages=_history(db, thread, settings.ai_chat_history_messages) + [{"role": "user", "content": question}],
    )
    answer = response_text(response)
    if not answer:
        raise AppError(503, "ai_unavailable", "The assistant didn't return an answer. Try again.")
    return _save_turn(db, farmer, thread, field, question, answer)
