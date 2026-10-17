from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy import select

from app.api.deps import CurrentFarmer, DbSession
from app.core.errors import not_found
from app.models import ChatThread, Field
from app.schemas.assistant import AskIn, AskOut, ThreadDetailOut, ThreadOut
from app.services.ai.assistant import MAX_AUDIO_BYTES, ask, ask_by_voice
from app.services.ai.claude import get_ai_client
from app.services.weather import WeatherProvider, get_weather_provider

router = APIRouter(prefix="/assistant", tags=["assistant"])


def _owned_thread(db, farmer, thread_id: int) -> ChatThread:
    thread = db.get(ChatThread, thread_id)
    if thread is None or thread.farmer_id != farmer.id:
        raise not_found("thread")
    return thread


@router.post("/messages", response_model=AskOut)
def send_message(
    body: AskIn,
    farmer: CurrentFarmer,
    db: DbSession,
    client: Annotated[object, Depends(get_ai_client)],
    weather: Annotated[WeatherProvider, Depends(get_weather_provider)],
):
    thread = field = None
    if body.thread_id is not None:
        thread = _owned_thread(db, farmer, body.thread_id)
    elif body.field_id is not None:
        field = db.get(Field, body.field_id)
        if field is None or field.farmer_id != farmer.id:
            raise not_found("field")

    thread, user_msg, reply = ask(db, client, farmer, thread, field, body.message.strip(), weather)
    return AskOut(thread=thread, message=user_msg, reply=reply)


AUDIO_TYPES = {"audio/mp4", "audio/m4a", "audio/x-m4a", "audio/aac", "audio/mpeg", "audio/mp3", "audio/wav",
               "audio/x-wav", "audio/ogg", "audio/webm", "audio/flac", "audio/3gpp"}  # fmt: skip


@router.post("/voice", response_model=AskOut)
def send_voice_message(
    farmer: CurrentFarmer,
    db: DbSession,
    client: Annotated[object, Depends(get_ai_client)],
    weather: Annotated[WeatherProvider, Depends(get_weather_provider)],
    audio: Annotated[UploadFile, File(description="Recording of the question (M4A/AAC/MP3/WAV/OGG), ≤ 5 MB")],
    thread_id: Annotated[int | None, Form()] = None,
    field_id: Annotated[int | None, Form()] = None,
):
    """Spoken question → the AI hears it directly and returns what was said (message) and the answer (reply)."""
    media_type = (audio.content_type or "").split(";")[0].strip().lower()
    if media_type not in AUDIO_TYPES:
        media_type = "audio/mp4"  # phones send M4A; some clients label it application/octet-stream
    elif media_type in ("audio/m4a", "audio/x-m4a"):
        media_type = "audio/mp4"
    thread = field = None
    if thread_id is not None:
        thread = _owned_thread(db, farmer, thread_id)
    elif field_id is not None:
        field = db.get(Field, field_id)
        if field is None or field.farmer_id != farmer.id:
            raise not_found("field")
    data = audio.file.read(MAX_AUDIO_BYTES + 1)
    thread, user_msg, reply = ask_by_voice(db, client, farmer, thread, field, data, media_type, weather)
    return AskOut(thread=thread, message=user_msg, reply=reply)


@router.get("/threads", response_model=list[ThreadOut])
def list_threads(farmer: CurrentFarmer, db: DbSession):
    return db.scalars(
        select(ChatThread)
        .where(ChatThread.farmer_id == farmer.id)
        .order_by(ChatThread.updated_at.desc(), ChatThread.id.desc())
    ).all()


@router.get("/threads/{thread_id}", response_model=ThreadDetailOut)
def get_thread(thread_id: int, farmer: CurrentFarmer, db: DbSession):
    return _owned_thread(db, farmer, thread_id)


@router.delete("/threads/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_thread(thread_id: int, farmer: CurrentFarmer, db: DbSession):
    db.delete(_owned_thread(db, farmer, thread_id))
    db.commit()
