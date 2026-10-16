# Fields

A farmer's plots of land. All endpoints only see the logged-in farmer's fields; another farmer's field ID returns `404`.

## Field object

```json
{
  "id": 7,
  "name": "East plot",
  "crop": { "code": "cotton", "name": "పత్తి" },
  "acreage": 2.5,
  "growth_stage": "flowering",
  "planted_on": "2026-07-01",
  "latitude": 16.25,
  "longitude": 80.61,
  "notes": null,
  "created_at": "2026-10-16T10:20:00+00:00",
  "updated_at": "2026-10-16T11:02:00+00:00"
}
```

| Field | Rules |
|---|---|
| `name` | required, 1–120 chars |
| `acreage` | required, number > 0, ≤ 10000, max 2 decimals (acres) |
| `crop_code` (input) / `crop` (output) | optional; a `code` from `GET /crops` |
| `growth_stage` | optional; one of `land_preparation` `sowing` `germination` `vegetative` `flowering` `fruiting` `maturity` `harvested` |
| `planted_on` | optional date |
| `latitude` / `longitude` | optional |
| `notes` | optional, ≤ 2000 chars |

Growth stage values are codes — translate them in the app's i18n strings.

## GET /fields

**200** — array of Field objects, oldest first. Empty array if none.

## POST /fields

```json
{ "name": "East plot", "crop_code": "cotton", "acreage": 2.5, "growth_stage": "sowing", "planted_on": "2026-07-01" }
```

**201** — the created Field object.

## GET /fields/{id}

**200** — Field object.

## PATCH /fields/{id}

Partial update; same fields as create. `name` and `acreage` can't be set to `null`; the others can (to clear them).

**200** — updated Field object.

## DELETE /fields/{id}

**204**, no body.

## Errors

| Status | code | When |
|---|---|---|
| 404 | `field_not_found` | No such field, or it belongs to someone else |
| 422 | `unknown_crop` | `crop_code` isn't in the crop list |
| 422 | `validation_error` | Anything else invalid |
