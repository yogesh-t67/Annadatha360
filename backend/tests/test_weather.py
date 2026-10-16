import httpx
import pytest

from app.main import app
from app.services.weather import OpenMeteoProvider, forecast_cache, get_weather_provider


def _raw(**overrides):
    daily = {
        "time": ["2026-10-16", "2026-10-17", "2026-10-18"],
        "weather_code": [0, 95, 65],
        "temperature_2m_max": [33.0, 41.0, 46.0],
        "temperature_2m_min": [24.0, 26.0, 27.0],
        "precipitation_sum": [0.0, 70.0, 120.0],
        "precipitation_probability_max": [10, 80, 95],
        "wind_speed_10m_max": [8.0, 45.0, 70.0],
        "relative_humidity_2m_mean": [60, 85, 90],
    }
    daily.update(overrides)
    return {"latitude": 16.27, "longitude": 80.43, "daily": daily}


class FakeProvider:
    def __init__(self, raw=None):
        self.raw = raw or _raw()
        self.calls = []

    def fetch_daily(self, lat, lng, days):
        self.calls.append((lat, lng, days))
        return self.raw


@pytest.fixture
def provider():
    forecast_cache.clear()
    p = FakeProvider()
    app.dependency_overrides[get_weather_provider] = lambda: p
    yield p
    forecast_cache.clear()


def _with_location(client, headers):
    client.patch("/api/v1/farmers/me", headers=headers, json={"location": {"latitude": 16.2742, "longitude": 80.4273}})


def test_forecast_uses_farmer_location_and_derives_alerts(login, client, provider):
    headers, _ = login()
    _with_location(client, headers)
    res = client.get("/api/v1/weather/forecast", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert provider.calls == [(16.27, 80.43, 7)]

    d0, d1, d2 = body["days"]
    assert d0["condition"] == "clear" and d0["good_for_spraying"] is True
    assert d1["condition"] == "thunderstorm" and d1["good_for_spraying"] is False
    assert d2["condition"] == "heavy_rain"

    alerts = {(a["date"], a["type"]): a["severity"] for a in body["alerts"]}
    assert alerts == {
        ("2026-10-17", "heavy_rain"): "advisory",
        ("2026-10-17", "heat"): "watch",
        ("2026-10-17", "strong_wind"): "watch",
        ("2026-10-17", "thunderstorm"): "watch",
        ("2026-10-18", "heavy_rain"): "watch",
        ("2026-10-18", "heat"): "warning",
        ("2026-10-18", "strong_wind"): "warning",
    }


def test_forecast_is_cached_per_grid_cell(login, client, provider):
    headers, _ = login()
    client.get("/api/v1/weather/forecast", headers=headers, params={"lat": 16.271, "lng": 80.431})
    client.get("/api/v1/weather/alerts", headers=headers, params={"lat": 16.272, "lng": 80.432})
    assert len(provider.calls) == 1


def test_field_location_preferred_over_farmer(login, client, provider):
    headers, _ = login()
    _with_location(client, headers)
    fid = client.post(
        "/api/v1/fields", headers=headers, json={"name": "F", "acreage": 1, "latitude": 17.0, "longitude": 79.5}
    ).json()["id"]
    client.get("/api/v1/weather/forecast", headers=headers, params={"field_id": fid})
    assert provider.calls[-1][:2] == (17.0, 79.5)


def test_location_required(login, client, provider):
    headers, _ = login()
    res = client.get("/api/v1/weather/forecast", headers=headers)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "location_required"
    res = client.get("/api/v1/weather/forecast", headers=headers, params={"lat": 16.0})
    assert res.json()["error"]["code"] == "validation_error"


def test_handles_missing_values(login, client):
    forecast_cache.clear()
    p = FakeProvider(_raw(precipitation_probability_max=[None, None, None], weather_code=[None, 2, 3]))
    app.dependency_overrides[get_weather_provider] = lambda: p
    headers, _ = login()
    body = client.get("/api/v1/weather/forecast", headers=headers, params={"lat": 1, "lng": 1}).json()
    assert body["days"][0]["condition"] == "unknown"
    assert body["days"][0]["good_for_spraying"] is False
    forecast_cache.clear()


def test_provider_failure_is_503(login, client):
    forecast_cache.clear()
    http = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(500)))
    app.dependency_overrides[get_weather_provider] = lambda: OpenMeteoProvider("https://x.test", http=http)
    headers, _ = login()
    res = client.get("/api/v1/weather/forecast", headers=headers, params={"lat": 1, "lng": 1})
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "weather_unavailable"


def test_open_meteo_request_shape():
    seen = {}

    def handler(request):
        seen.update(request.url.params)
        return httpx.Response(200, json=_raw())

    p = OpenMeteoProvider("https://api.open-meteo.com", http=httpx.Client(transport=httpx.MockTransport(handler)))
    p.fetch_daily(16.27, 80.43, 7)
    assert seen["timezone"] == "Asia/Kolkata"
    assert seen["forecast_days"] == "7"
    assert "precipitation_probability_max" in seen["daily"]
    assert "apikey" not in seen
