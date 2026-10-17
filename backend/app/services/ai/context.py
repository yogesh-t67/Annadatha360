"""Farmer context given to Claude: who they are, what they grow, and the weather where they farm."""

import logging
from collections import defaultdict
from datetime import date
from statistics import median

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.i18n import resolve
from app.models import Crop, Farmer, Field, Scheme
from app.services.market import latest_with_trend
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


def _rupees(value) -> str:
    return f"₹{int(round(float(value))):,}"


def _market_lines(db: Session, farmer: Farmer, today: date) -> list[str]:
    """Latest mandi prices from the app's own data (Agmarknet). The farmer's district in full (every market);
    every other district in AP/TG as one median price per crop, so "price in Khammam?" can be answered."""
    try:
        crop_codes = list(db.scalars(select(Crop.code)))
        pairs = latest_with_trend(db, crop_codes, today=today)
    except Exception as exc:  # prices are nice-to-have context; never fail the chat over them
        log.warning("Skipping market context: %s", exc)
        return []
    if not pairs:
        return []

    home = (farmer.district or "").strip().lower()
    names = {c.code: resolve(c.name, "en") for c in db.scalars(select(Crop))}
    mine: list[str] = []
    by_crop: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))
    for latest, prev in pairs:
        crop = names.get(latest.crop_code, latest.crop_code)
        by_crop[crop][f"{latest.district} ({latest.state})"].append(latest)
        if home and latest.district.strip().lower() == home:
            trend = ""
            if prev is not None and prev.modal_price:
                pct = (latest.modal_price - prev.modal_price) / prev.modal_price * 100
                trend = f", {'up' if pct > 0 else 'down'} {abs(pct):.0f}% from {_rupees(prev.modal_price)} on {prev.arrival_date:%d %b}" if abs(pct) >= 1 else ", steady"
            # Skip varieties that just repeat the crop ("Cotton (Unginned)" for Cotton).
            v = (latest.variety or "").strip()
            variety = f" {v}" if v and crop.lower().split()[0] not in v.lower() else ""
            mine.append(
                f"- {crop}{variety} at {latest.market}: {_rupees(latest.modal_price)} "
                f"(range {_rupees(latest.min_price or latest.modal_price)}–{_rupees(latest.max_price or latest.modal_price)}) "
                f"on {latest.arrival_date:%d %b}{trend}"
            )

    lines = ["Mandi prices from the app's data (₹ per quintal, latest report in the last 14 days; Agmarknet):"]
    if mine:
        lines.append(f"In the farmer's district ({farmer.district}):")
        lines.extend(sorted(mine))
    elif farmer.district:
        lines.append(f"No recent reports from the farmer's district ({farmer.district}).")
    lines.append("All districts (median of each district's markets, date of latest report):")
    for crop in sorted(by_crop):
        parts = []
        for district, rows in sorted(by_crop[crop].items()):
            prices = sorted(float(r.modal_price) for r in rows)
            parts.append(f"{district} {_rupees(median(prices))} ({max(r.arrival_date for r in rows):%d %b})")
        lines.append(f"- {crop}: " + "; ".join(parts))
    return lines


def _scheme_lines(db: Session) -> list[str]:
    """The government schemes shown in the app (checked content), so scheme questions get the app's facts."""
    try:
        schemes = list(db.scalars(select(Scheme).where(Scheme.published.is_(True)).order_by(Scheme.authority, Scheme.slug)))
    except Exception as exc:
        log.warning("Skipping scheme context: %s", exc)
        return []
    if not schemes:
        return []
    lines = ["Government schemes in the app (checked content; use these facts, in the reply language):"]
    for s in schemes:
        who = "Central" if s.authority == "central" else STATE_NAMES.get(s.state or "", s.state or "State")
        te_name = (s.name or {}).get("te")
        parts = [
            f"{resolve(s.name, 'en')}" + (f" / {te_name}" if te_name else "") + f" [{who}, checked {s.last_verified_on:%d %b %Y}]",
            resolve(s.benefits, "en") or resolve(s.summary, "en"),
        ]
        if s.eligibility:
            parts.append("Who: " + " ".join(resolve(e, "en") for e in s.eligibility))
        if s.steps:
            parts.append("Apply: " + " ".join(resolve(e, "en") for e in s.steps))
        if s.application_url:
            parts.append(f"Website: {s.application_url}")
        lines.append("- " + " | ".join(p for p in parts if p))
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

    lines.extend(_market_lines(db, farmer, today))
    lines.extend(_scheme_lines(db))
    return "\n".join(lines)
