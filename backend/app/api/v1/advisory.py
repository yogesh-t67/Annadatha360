import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select

from app.api.deps import CurrentFarmer, DbSession
from app.core.errors import not_found
from app.models import Advisory, Field
from app.schemas.advisory import AdvisoryOut, AdvisorySummaryOut, HomeOut, HomeWeather
from app.services.advisory import detail_out, farmer_targets, relevance, relevant_advisories, summary_out
from app.services.market import price_rows
from app.services.serializers import farmer_out
from app.services.weather import WeatherProvider, get_forecast, get_weather_provider

log = logging.getLogger("annadata.home")
router = APIRouter(tags=["advisory"])


@router.get("/advisories", response_model=list[AdvisorySummaryOut])
def list_advisories(farmer: CurrentFarmer, db: DbSession, category: str | None = None):
    lang = farmer.preferred_language
    return [summary_out(db, a, rel, lang) for a, rel in relevant_advisories(db, farmer, category)]


@router.get("/advisories/{slug}", response_model=AdvisoryOut)
def get_advisory(slug: str, farmer: CurrentFarmer, db: DbSession):
    a = db.scalar(select(Advisory).where(Advisory.slug == slug, Advisory.published.is_(True)))
    if a is None:
        raise not_found("advisory")
    pairs, crops = farmer_targets(db, farmer)
    # Direct links (e.g. shared) still open even if not targeted at this farmer.
    return detail_out(db, a, relevance(a, pairs, crops) or "general", farmer.preferred_language)


@router.get("/home", response_model=HomeOut)
def home(
    farmer: CurrentFarmer,
    db: DbSession,
    weather: Annotated[WeatherProvider, Depends(get_weather_provider)],
):
    """Everything the Home screen needs in one call. Optional parts are null rather than failing the screen."""
    lang = farmer.preferred_language

    weather_out = None
    if farmer.latitude is not None and farmer.longitude is not None:
        try:
            forecast = get_forecast(weather, farmer.latitude, farmer.longitude)
            weather_out = HomeWeather(today=forecast.days[0] if forecast.days else None, alerts=forecast.alerts)
        except Exception as exc:  # weather is optional on Home
            log.warning("Home: weather unavailable: %s", exc)

    advisories = relevant_advisories(db, farmer)
    latest = summary_out(db, *advisories[0], lang) if advisories else None

    price = None
    if farmer.primary_crop_code:
        rows = price_rows(db, farmer, [farmer.primary_crop_code], state=farmer.state, limit=1)
        price = rows[0] if rows else None

    return HomeOut(
        farmer=farmer_out(db, farmer),
        weather=weather_out,
        latest_advisory=latest,
        primary_crop_price=price,
        fields_count=db.scalar(select(func.count()).select_from(Field).where(Field.farmer_id == farmer.id)),
    )
