from datetime import date
from typing import Literal

from pydantic import BaseModel


class SchemeSummaryOut(BaseModel):
    id: int
    slug: str
    authority: Literal["central", "state"]
    state: Literal["AP", "TG"] | None
    category: str
    name: str
    summary: str
    possibly_eligible: bool | None  # null = not enough farmer data to say
    last_verified_on: date


class SchemeOut(SchemeSummaryOut):
    benefits: str | None
    eligibility: list[str]
    documents: list[str]
    steps: list[str]
    application_url: str | None
    source_url: str
