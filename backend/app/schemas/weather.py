from datetime import date
from typing import Literal

from pydantic import BaseModel

Condition = Literal[
    "clear", "partly_cloudy", "overcast", "fog", "drizzle", "rain", "heavy_rain", "snow", "thunderstorm", "unknown"
]
AlertType = Literal["heavy_rain", "heat", "strong_wind", "thunderstorm"]
Severity = Literal["advisory", "watch", "warning"]


class DayForecast(BaseModel):
    date: date
    condition: Condition
    weather_code: int | None
    temp_max_c: float | None
    temp_min_c: float | None
    precipitation_mm: float | None
    precipitation_probability: int | None
    wind_max_kmh: float | None
    humidity_mean: int | None
    good_for_spraying: bool


class WeatherAlert(BaseModel):
    type: AlertType
    severity: Severity
    date: date
    value: float | None
    unit: str | None


class Forecast(BaseModel):
    latitude: float | None
    longitude: float | None
    days: list[DayForecast]
    alerts: list[WeatherAlert]


class AlertsOut(BaseModel):
    alerts: list[WeatherAlert]
