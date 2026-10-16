"""Farmer context given to Claude: who they are, what they grow, and the weather where they farm."""

import logging
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.i18n import resolve
from app.models import Crop, Farmer, Field
from app.services.weather import WeatherProvider, get_forecast

log = logging.getLogger("annadata.ai")

LANGUAGE_NAMES = {
    "en": "English",
    "te": "Telugu",
    "hi": "Hindi",
    "ta": "Tamil",
    "kn": "Kannada",
    "mr": "Marathi",
    "gu": "Gujarati",
}
STATE_NAMES = {"AP": "Andhra Pradesh", "TG": "Telangana"}
MAX_FIELDS = 10


def _crop_name(db: Session, code: str | None) -> str | None:
    if code is None:
        return None
    crop = db.get(Crop, code)
    return resolve(crop.name, "en") if crop else code


def _field_line(db: Session, f: Field, today: date) -> str:
    parts = [f'"{f.name}"', f"{f.acreage} acres"]
    crop = _crop_name(db, f.crop_code)
    parts.append(f"crop: {crop}" if crop else "crop: not set")
    if f.growth_stage:
        parts.append(f"stage: {f.growth_stage.replace('_', ' ')}")
    if f.planted_on:
        parts.append(f"planted {f.planted_on.isoformat()} ({(today - f.planted_on).days} days ago)")
    if f.notes:
        parts.append(f"farmer's notes: {f.notes[:300]}")
    return "; ".join(parts)


def _weather_lines(provider: WeatherProvider | None, lat: float | None, lng: float | None) -> list[str]:
    if provider is None or lat is None or lng is None:
        return []
    try:
        forecast = get_forecast(provider, lat, lng)
    except Exception as exc:  # weather is nice-to-have context; never fail the chat over it
        log.warning("Skipping weather context: %s", exc)
        return []
    lines = []
    for d in forecast.days[:3]:
        lines.append(
            f"{d.date.isoformat()}: {d.condition.replace('_', ' ')}, {d.temp_min_c}-{d.temp_max_c} °C, "
            f"rain {d.precipitation_mm} mm ({d.precipitation_probability}% chance), wind up to {d.wind_max_kmh} km/h"
        )
    for a in forecast.alerts:
        lines.append(f"ALERT {a.date.isoformat()}: {a.type.replace('_', ' ')} ({a.severity})")
    return lines


def farmer_context(
    db: Session,
    farmer: Farmer,
    focus_field: Field | None,
    weather: WeatherProvider | None,
    today: date | None = None,
) -> str:
    today = today or date.today()
    lines = [f"Today's date: {today.isoformat()}"]
    lines.append(f"Farmer's name: {farmer.name or 'not given'}")
    lines.append(f"Reply language: {LANGUAGE_NAMES.get(farmer.preferred_language, 'English')}")

    place = [p for p in (farmer.village, farmer.mandal, farmer.district) if p]
    if farmer.state:
        place.append(STATE_NAMES.get(farmer.state, farmer.state))
    lines.append(f"Location: {', '.join(place) if place else 'not given'}")
    primary = _crop_name(db, farmer.primary_crop_code)
    lines.append(f"Main crop: {primary or 'not given'}")

    fields = list(db.scalars(select(Field).where(Field.farmer_id == farmer.id).order_by(Field.id).limit(MAX_FIELDS)))
    if fields:
        lines.append("Fields:")
        lines.extend(f"- {_field_line(db, f, today)}" for f in fields)
    if focus_field is not None:
        lines.append(f'This conversation is about the field "{focus_field.name}".')

    lat = focus_field.latitude if focus_field and focus_field.latitude is not None else farmer.latitude
    lng = focus_field.longitude if focus_field and focus_field.longitude is not None else farmer.longitude
    weather_lines = _weather_lines(weather, lat, lng)
    if weather_lines:
        lines.append("Weather forecast for their location (Open-Meteo; alerts are computed from IMD thresholds):")
        lines.extend(f"- {line}" for line in weather_lines)

    return "\n".join(lines)
