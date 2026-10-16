"""Localisation helpers.

User-facing content (crop names, scheme text, advisory copy) is stored as a
LocalizedText JSON object keyed by language code, e.g. {"en": "Paddy", "te": "వరి"}.
New languages are added as new keys — no schema change. Reads fall back to English.
"""

from typing import Literal

Language = Literal["en", "te", "hi", "ta", "kn", "mr", "gu"]
SUPPORTED_LANGUAGES: tuple[str, ...] = ("en", "te", "hi", "ta", "kn", "mr", "gu")
DEFAULT_LANGUAGE = "en"

LocalizedText = dict[str, str]


def resolve(text: LocalizedText | None, lang: str) -> str | None:
    if not text:
        return None
    return text.get(lang) or text.get(DEFAULT_LANGUAGE) or next(iter(text.values()))
