from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class AskIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    thread_id: int | None = None  # omit to start a new conversation
    field_id: int | None = None  # only used when starting a new conversation


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime


class ThreadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    field_id: int | None
    created_at: datetime
    updated_at: datetime


class AskOut(BaseModel):
    thread: ThreadOut
    message: ChatMessageOut
    reply: ChatMessageOut


class ThreadDetailOut(ThreadOut):
    messages: list[ChatMessageOut]
