# Crop advisories & Home

## Advisories

Curated, stage-based crop advice for the Crop Advisory screen (the photo diagnosis part is in
[diagnosis.md](diagnosis.md)). Auth required.

**Content status:** API built, **no real advice loaded yet** — only clearly-labelled samples in dev. Advice must
come from an agricultural university, ICAR or the state agriculture department, with the source link, and be
reviewed before publishing (see `docs/development/external-dependencies.md`). Show `last_verified_on` and a
link to `source_url`.

### GET /advisories

Advice relevant to this farmer, most relevant first. Query: `category` (optional) — `nutrition`
`pest_disease` `irrigation` `weed` `harvest` `weather` `general`.

```json
[
  {
    "slug": "paddy-vegetative-nitrogen",
    "crop": { "code": "paddy", "name": "వరి" },
    "growth_stage": "vegetative",
    "category": "nutrition",
    "title": "…",
    "last_verified_on": "2026-10-16",
    "relevance": "your_field"
  }
]
```

`relevance` (and the sort order):

| value | meaning |
|---|---|
| `your_field` | Matches the crop **and** current `growth_stage` of one of the farmer's fields |
| `your_crop` | For a crop they grow (any field, or primary crop), any stage |
| `general` | Not crop-specific (or crop-agnostic advice for a stage one of their fields is at) |

Within each group, most recently verified first. Advice for crops/stages the farmer doesn't have isn't listed.
**Keep fields' `growth_stage` up to date** — that's what makes `your_field` advice appear.

### GET /advisories/{slug}

**200** — the summary fields plus `body` (plain text; paragraphs separated by a blank line) and `source_url`.
`404 advisory_not_found` for unknown/unpublished slugs.

## GET /home

One call for the Home Dashboard. Optional parts come back `null` instead of failing the screen.

```json
{
  "farmer": { "…": "Farmer object (farmers.md) — greeting, location, primary crop" },
  "weather": {
    "today": { "…": "DayForecast (weather.md)" },
    "alerts": [ { "type": "heavy_rain", "severity": "watch", "date": "2026-10-18", "value": 120.0, "unit": "mm" } ]
  },
  "latest_advisory": { "…": "advisory summary, as above" },
  "primary_crop_price": { "…": "MarketPrice (market-prices.md) — nearest market for the primary crop" },
  "fields_count": 2
}
```

| Field | `null` when |
|---|---|
| `weather` | farmer has no lat/lng, or the weather provider is down (then show "set location" / nothing) |
| `latest_advisory` | no published advice matches |
| `primary_crop_price` | no primary crop, or no recent mandi report in the farmer's state |

`fields_count: 0` is a good prompt for "add your first field".
