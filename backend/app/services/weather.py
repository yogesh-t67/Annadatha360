"""7-day forecast from Open-Meteo, plus farming alerts derived from it.

Open-Meteo has no official warning feed for India, so alerts are computed from the forecast
using IMD's daily thresholds. They are guidance, not official IMD warnings.
"""

import logging
import threading
import time
from datetime import date
from functools import lru_cache
from typing import Protocol

import httpx

from app.core.config import get_settings
from app.core.errors import AppError
from app.schemas.weather import DayForecast, Forecast, WeatherAlert

log = logging.getLogger("annadata.weather")

DAILY_VARS = (
    "weather_code",
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_sum",
    "precipitation_probability_max",
    "wind_speed_10m_max",
    "relative_humidity_2m_mean",
)

# WMO weather code → stable condition code. The app translates these; we never send display text.
_CONDITIONS = [
    ({0}, "clear"),
    ({1, 2}, "partly_cloudy"),
    ({3}, "overcast"),
    ({45, 48}, "fog"),
    ({51, 53, 55, 56, 57}, "drizzle"),
    ({61, 63, 66, 80, 81}, "rain"),
    ({65, 67, 82}, "heavy_rain"),
    ({71, 73, 75, 77, 85, 86}, "snow"),
    ({95, 96, 97, 99}, "thunderstorm"),
]

# IMD daily rainfall categories (mm/24h).
HEAVY_RAIN_MM = 64.5
VERY_HEAVY_RAIN_MM = 115.6
EXTREMELY_HEAVY_RAIN_MM = 204.5
# IMD heatwave basis for the plains: max temp ≥ 40 °C; ≥ 45 °C is a heatwave regardless of normal.
HEAT_C = 40.0
SEVERE_HEAT_C = 45.0
STRONG_WIND_KMH = 40.0
GALE_KMH = 62.0
# Heuristic spray window: unlikely rain and low wind, so pesticide isn't washed off or drifts.
SPRAY_MAX_RAIN_PROBABILITY = 30
SPRAY_MAX_WIND_KMH = 15.0


def condition_for(code: int | None) -> str:
    for codes, name in _CONDITIONS:
        if code in codes:
            return name
    return "unknown"


class WeatherProvider(Protocol):
    def fetch_daily(self, lat: float, lng: float, days: int) -> dict: ...


class OpenMeteoProvider:
    def __init__(self, base_url: str, api_key: str = "", http: httpx.Client | None = None):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.http = http or httpx.Client(timeout=10.0)

    def fetch_daily(self, lat: float, lng: float, days: int) -> dict:
        params = {
            "latitude": lat,
            "longitude": lng,
            "daily": ",".join(DAILY_VARS),
            "timezone": "Asia/Kolkata",
            "forecast_days": days,
        }
        if self.api_key:
            params["apikey"] = self.api_key
        try:
            res = self.http.get(f"{self.base_url}/v1/forecast", params=params)
            res.raise_for_status()
            return res.json()
        except (httpx.HTTPError, ValueError) as exc:
            log.error("Open-Meteo request failed: %s", exc)
            raise AppError(503, "weather_unavailable", "Weather data is unavailable right now") from exc


@lru_cache  # one shared HTTP client (connection reuse); settings are fixed per process
def get_weather_provider() -> WeatherProvider:
    s = get_settings()
    return OpenMeteoProvider(s.open_meteo_base_url, s.open_meteo_api_key)


def _alerts_for(day: DayForecast) -> list[WeatherAlert]:
    alerts: list[WeatherAlert] = []
    rain = day.precipitation_mm
    if rain is not None and rain >= HEAVY_RAIN_MM:
        if rain >= EXTREMELY_HEAVY_RAIN_MM:
            severity = "warning"
        elif rain >= VERY_HEAVY_RAIN_MM:
            severity = "watch"
        else:
            severity = "advisory"
        alerts.append(WeatherAlert(type="heavy_rain", severity=severity, date=day.date, value=rain, unit="mm"))
    if day.temp_max_c is not None and day.temp_max_c >= HEAT_C:
        severity = "warning" if day.temp_max_c >= SEVERE_HEAT_C else "watch"
        alerts.append(WeatherAlert(type="heat", severity=severity, date=day.date, value=day.temp_max_c, unit="°C"))
    if day.wind_max_kmh is not None and day.wind_max_kmh >= STRONG_WIND_KMH:
        severity = "warning" if day.wind_max_kmh >= GALE_KMH else "watch"
        alerts.append(
            WeatherAlert(type="strong_wind", severity=severity, date=day.date, value=day.wind_max_kmh, unit="km/h")
        )
    if day.condition == "thunderstorm":
        alerts.append(WeatherAlert(type="thunderstorm", severity="watch", date=day.date, value=None, unit=None))
    return alerts


def _at(values: list | None, i: int):
    return values[i] if values and i < len(values) else None


def build_forecast(raw: dict) -> Forecast:
    daily = raw.get("daily") or {}
    days: list[DayForecast] = []
    for i, day_str in enumerate(daily.get("time") or []):
        code = _at(daily.get("weather_code"), i)
        rain_prob = _at(daily.get("precipitation_probability_max"), i)
        wind = _at(daily.get("wind_speed_10m_max"), i)
        days.append(
            DayForecast(
                date=date.fromisoformat(day_str),
                condition=condition_for(code),
                weather_code=code,
                temp_max_c=_at(daily.get("temperature_2m_max"), i),
                temp_min_c=_at(daily.get("temperature_2m_min"), i),
                precipitation_mm=_at(daily.get("precipitation_sum"), i),
                precipitation_probability=rain_prob,
                wind_max_kmh=wind,
                humidity_mean=_at(daily.get("relative_humidity_2m_mean"), i),
                good_for_spraying=(
                    rain_prob is not None
                    and wind is not None
                    and rain_prob < SPRAY_MAX_RAIN_PROBABILITY
                    and wind < SPRAY_MAX_WIND_KMH
                ),
            )
        )
    alerts = [a for d in days for a in _alerts_for(d)]
    return Forecast(latitude=raw.get("latitude"), longitude=raw.get("longitude"), days=days, alerts=alerts)


class _TtlCache:
    """Per-process cache keyed by ~1 km grid cell. Good enough until we run several workers."""

    def __init__(self):
        self._data: dict[tuple, tuple[float, Forecast]] = {}
        self._lock = threading.Lock()

    def get(self, key: tuple, ttl: int) -> Forecast | None:
        with self._lock:
            hit = self._data.get(key)
            if hit and time.monotonic() - hit[0] < ttl:
                return hit[1]
            return None

    def put(self, key: tuple, value: Forecast) -> None:
        with self._lock:
            self._data[key] = (time.monotonic(), value)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()


forecast_cache = _TtlCache()


def get_forecast(provider: WeatherProvider, lat: float, lng: float, days: int = 7) -> Forecast:
    key = (round(lat, 2), round(lng, 2), days)
    ttl = get_settings().weather_cache_ttl_seconds
    cached = forecast_cache.get(key, ttl)
    if cached is not None:
        return cached
    forecast = build_forecast(provider.fetch_daily(key[0], key[1], days))
    forecast_cache.put(key, forecast)
    return forecast
