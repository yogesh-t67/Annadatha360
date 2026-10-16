# Weather

7-day forecast and farming alerts for the Weather screen and the Home alert strip. Both endpoints need auth.

**Provider:** [Open-Meteo](https://open-meteo.com) (no key needed for development). Chosen because it's free to
start, gives a 7–16 day daily forecast for any lat/lng with no per-district setup, and has rain probability and
wind, which matter for spraying decisions. **Before launch it needs a paid commercial plan** — the free API is for
non-commercial use only (see `docs/development/external-dependencies.md`). The backend already supports the key.

**Alerts are computed by the backend, not issued by IMD.** Open-Meteo has no official warning feed for India, so we
flag forecast days that cross IMD's daily thresholds. Label them as forecast-based guidance in the UI, not as
official warnings.

## Location

Both endpoints pick a location in this order:

1. `lat` + `lng` query params (send both or neither)
2. `field_id` → that field's coordinates, if the field has them
3. the farmer's saved `location.latitude` / `longitude`

If none of these give coordinates → `422 location_required`. Prompt the farmer to set their location.

Forecasts are cached for 30 minutes per ~1 km grid cell, so repeated calls are cheap.

## GET /weather/forecast

Query: `lat`, `lng`, `field_id` — all optional, see Location.

**200**
```json
{
  "latitude": 16.31,
  "longitude": 80.44,
  "days": [
    {
      "date": "2026-10-16",
      "condition": "rain",
      "weather_code": 80,
      "temp_max_c": 32.1,
      "temp_min_c": 24.7,
      "precipitation_mm": 3.5,
      "precipitation_probability": 88,
      "wind_max_kmh": 11.7,
      "humidity_mean": 86,
      "good_for_spraying": false
    }
  ],
  "alerts": [
    { "type": "thunderstorm", "severity": "watch", "date": "2026-10-20", "value": null, "unit": null }
  ]
}
```

- `days`: 7 entries, today first, dates in IST.
- Any numeric field can be `null` if the provider has no value for that day.
- `condition` — translate in the app: `clear` `partly_cloudy` `overcast` `fog` `drizzle` `rain` `heavy_rain`
  `snow` `thunderstorm` `unknown`. `weather_code` is the raw WMO code if you want finer icons.
- `good_for_spraying` — rain probability < 30% and max wind < 15 km/h (so spray isn't washed off or drifts).
  A simple heuristic; show it as a hint, not advice.
- `alerts` — same as `GET /weather/alerts`.

## GET /weather/alerts

Same query params. Lightweight version for the Home screen.

**200**
```json
{
  "alerts": [
    { "type": "heavy_rain", "severity": "watch", "date": "2026-10-18", "value": 120.0, "unit": "mm" }
  ]
}
```

Empty `alerts` array = nothing to show. Alerts are ordered by date.

| `type` | Triggers when | `severity` |
|---|---|---|
| `heavy_rain` | daily rain ≥ 64.5 mm (IMD "heavy") | `advisory` ≥ 64.5 · `watch` ≥ 115.6 (very heavy) · `warning` ≥ 204.5 (extremely heavy) |
| `heat` | max temp ≥ 40 °C | `watch` ≥ 40 · `warning` ≥ 45 |
| `strong_wind` | max wind ≥ 40 km/h | `watch` ≥ 40 · `warning` ≥ 62 (gale) |
| `thunderstorm` | thunderstorm forecast (WMO 95–99) | `watch` |

`value` + `unit` let you build copy like "120 mm rain expected on Saturday". Message text is the app's job.

## Errors

| Status | code | When |
|---|---|---|
| 404 | `field_not_found` | `field_id` isn't one of this farmer's fields |
| 422 | `location_required` | No coordinates available (see Location) |
| 422 | `validation_error` | Only one of `lat`/`lng`, or out of range |
| 503 | `weather_unavailable` | Provider down — show cached data or "try again later" |
