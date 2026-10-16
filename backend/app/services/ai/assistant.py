from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import utcnow
from app.models import ChatMessage, ChatThread, Farmer, Field
from app.services.ai.claude import call_claude, response_text
from app.services.ai.context import farmer_context
from app.services.ai.prompts import ASSISTANT_SYSTEM
from app.services.weather import WeatherProvider

MAX_TOKENS = 8000  # includes thinking; answers themselves are short
TITLE_LENGTH = 60


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
