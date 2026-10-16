from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.deps import CurrentFarmer, DbSession
from app.core.errors import AppError, not_found
from app.models import Farmer, Field
from app.schemas.weather import AlertsOut, Forecast
from app.services.weather import WeatherProvider, get_forecast, get_weather_provider

router = APIRouter(prefix="/weather", tags=["weather"])

Provider = Annotated[WeatherProvider, Depends(get_weather_provider)]


def _resolve_location(db, farmer: Farmer, lat: float | None, lng: float | None, field_id: int | None):
    """Explicit lat/lng → the field's coordinates → the farmer's saved location."""
    if (lat is None) != (lng is None):
        raise AppError(422, "validation_error", "Send both lat and lng, or neither")
    if lat is not None:
        return lat, lng
    if field_id is not None:
        field = db.get(Field, field_id)
        if field is None or field.farmer_id != farmer.id:
            raise not_found("field")
        if field.latitude is not None and field.longitude is not None:
            return field.latitude, field.longitude
    if farmer.latitude is not None and farmer.longitude is not None:
        return farmer.latitude, farmer.longitude
    raise AppError(422, "location_required", "No location: set the farmer's location or pass lat/lng")


LatQ = Annotated[float | None, Query(ge=-90, le=90)]
LngQ = Annotated[float | None, Query(ge=-180, le=180)]


@router.get("/forecast", response_model=Forecast)
def forecast(
    farmer: CurrentFarmer,
    db: DbSession,
    provider: Provider,
    lat: LatQ = None,
    lng: LngQ = None,
    field_id: int | None = None,
):
    la, ln = _resolve_location(db, farmer, lat, lng, field_id)
    return get_forecast(provider, la, ln)


@router.get("/alerts", response_model=AlertsOut)
def alerts(
    farmer: CurrentFarmer,
    db: DbSession,
    provider: Provider,
    lat: LatQ = None,
    lng: LngQ = None,
    field_id: int | None = None,
):
    la, ln = _resolve_location(db, farmer, lat, lng, field_id)
    return AlertsOut(alerts=get_forecast(provider, la, ln).alerts)
