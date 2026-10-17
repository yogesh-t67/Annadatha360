import re
from typing import Literal

from fastapi import APIRouter
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.api.deps import CurrentFarmer
from app.core.errors import not_found
from app.services.ai.tts import audio_path, synthesize

router = APIRouter(prefix="/tts", tags=["tts"])


class SpeakIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    language: Literal["te", "en"] = "te"


class SpeakOut(BaseModel):
    audio_url: str


@router.post("", response_model=SpeakOut)
def speak(body: SpeakIn, farmer: CurrentFarmer):
    """Natural male voice for an answer. Returns a URL the app plays; the same text is cached (instant replay)."""
    key = synthesize(body.text)
    return SpeakOut(audio_url=f"/api/v1/tts/audio/{key}.wav")


@router.get("/audio/{name}")
def audio(name: str):
    """No auth: the name is a SHA-256 of the text, so it can't be guessed, and players can't send our token."""
    if not re.fullmatch(r"[0-9a-f]{64}\.wav", name):
        raise not_found("audio")
    path = audio_path(name[:-4])
    if not path.exists():
        raise not_found("audio")
    return FileResponse(path, media_type="audio/wav", headers={"Cache-Control": "public, max-age=86400"})
