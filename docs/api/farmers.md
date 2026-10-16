# Farmer profile

Serves the onboarding flow, the Home greeting/context strip, Language Select and Profile.

## Farmer object

```json
{
  "id": 12,
  "phone": "+919876543210",
  "name": "Ramesh",
  "preferred_language": "te",
  "location": {
    "state": "AP",
    "district": "Guntur",
    "mandal": "Tenali",
    "village": "Kolakaluru",
    "latitude": 16.24,
    "longitude": 80.64
  },
  "primary_crop": { "code": "paddy", "name": "వరి" },
  "profile_complete": true,
  "created_at": "2026-10-16T10:12:00+00:00"
}
```

- New accounts start with `name`, every `location` field and `primary_crop` as `null`, and `preferred_language: "te"`.
- `primary_crop.name` is in the farmer's `preferred_language` (English fallback).
- `profile_complete` is true once `name`, `location.district` and `primary_crop` are set. Use it to decide whether
  to show onboarding.
- `location.state` is `"AP"` or `"TG"`.

## GET /farmers/me

**200** — Farmer object.

## PATCH /farmers/me

Partial update — send only what changed. `location` is also partial: `{"location": {"village": "X"}}` leaves
the other location fields alone.

```json
{
  "name": "Ramesh",
  "preferred_language": "te",
  "primary_crop_code": "paddy",
  "location": { "state": "AP", "district": "Guntur", "mandal": "Tenali", "latitude": 16.24, "longitude": 80.64 }
}
```

| Field | Rules |
|---|---|
| `name` | 1–120 chars |
| `preferred_language` | `en` `te` `hi` `ta` `kn` `mr` `gu` |
| `primary_crop_code` | a `code` from `GET /crops`, or `null` to clear |
| `location.state` | `AP` or `TG` |
| `location.latitude` / `longitude` | −90…90 / −180…180 |

Language Select should PATCH `preferred_language` once the farmer is logged in, so server-side content comes back
in that language.

**200** — updated Farmer object.

| Status | code | When |
|---|---|---|
| 422 | `unknown_crop` | `primary_crop_code` isn't in the crop list |
| 422 | `validation_error` | Any other invalid field |
