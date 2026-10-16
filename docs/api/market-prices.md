# Market prices

Mandi (APMC) prices for the Market Prices screen: latest price at each market for a crop, with the change since
that market's previous report. Auth required.

**Source:** Agmarknet's daily wholesale prices, via the data.gov.in open data API (Government of India). It's free,
official, and covers AP and Telangana mandis. A backend job imports AP + TG reports into our database once a day;
the app only ever reads from our API, so it works even when data.gov.in is down.

Things to know about the data:

- Prices are **₹ per quintal** (100 kg), the mandi standard. Convert in the app if you show per-kg.
- Mandis report irregularly — not every market reports every day. We show each market's **latest report from
  the last 14 days**; check `arrival_date` and show it ("as of 14 Oct").
- `commodity`, `variety`, `grade` and market/district names come from Agmarknet **in English only**. The
  localised name is in `crop.name`. Treat the others as proper nouns.
- ✅ Verified against the live feed on 2026-10-16: ~300 AP and ~300 Telangana reports a day, all parsed.
  Commodities outside our crop list (most vegetables, livestock) are stored but don't appear under a crop.

## GET /market/prices

| Query | Default | |
|---|---|---|
| `crop` | farmer's primary crop | crop code from `GET /crops` |
| `category` | — | instead of `crop`: all crops in a category (`cereal` `pulse` `oilseed` `commercial` `spice` `vegetable` `fruit`) |
| `state` | both | `AP` or `TG` |
| `district` | all | case-insensitive exact match |
| `limit` | 100 | 1–500 |

Send `crop` **or** `category`, not both.

**200**
```json
{
  "as_of": "2026-10-16",
  "prices": [
    {
      "crop": { "code": "paddy", "name": "వరి" },
      "commodity": "Paddy(Dhan)(Common)",
      "variety": "Common",
      "grade": "FAQ",
      "market": "Guntur",
      "district": "Guntur",
      "state": "AP",
      "arrival_date": "2026-10-16",
      "unit": "quintal",
      "currency": "INR",
      "min_price": 2100.0,
      "max_price": 2300.0,
      "modal_price": 2200.0,
      "previous": { "arrival_date": "2026-10-15", "modal_price": 2000.0 },
      "change": 200.0,
      "change_pct": 10.0,
      "trend": "up"
    }
  ]
}
```

- **`modal_price`** is the most common trading price — use it as "the price". `min_price` / `max_price` can be `null`.
- **Trend** compares `modal_price` with the same market's previous report (which may be several days back —
  see `previous.arrival_date`).
  - `trend`: `up` / `down`, or `flat` if the change is under 1%. `null` when there's no earlier report.
  - `change` is in ₹/quintal, `change_pct` in percent. Both `null` when `trend` is `null`.
- One crop can have several entries per market (e.g. chilli has `Dry Chillies` and `Green Chilli`; paddy has
  several varieties). Each is its own row.
- **Order:** the farmer's own district first, then most recent `arrival_date`, then market name.
- `as_of` is the newest `arrival_date` in the list, or `null` if empty.
- No prices → `200` with an empty list, not an error. Show an empty state.

## Errors

| Status | code | When |
|---|---|---|
| 422 | `crop_required` | No `crop`/`category` and the farmer has no primary crop |
| 422 | `unknown_crop` | `crop` isn't in the crop list |
| 422 | `unknown_category` | `category` isn't a known category |
| 422 | `validation_error` | Both `crop` and `category`, bad `state`, `limit` out of range |
