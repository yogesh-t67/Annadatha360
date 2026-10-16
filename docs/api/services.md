# Labour Services & Farm Services

Find and book farm labour groups and farm services (tractor, harvester, drone spraying, soil testing,
transport), and post "workers needed" requirements. Auth required.

**How it works today:** providers are onboarded by the Annadata team (no provider app yet). A booking is a
**request**. The provider or our team confirms it by phone, and the status is updated on our side. Payment
goes to the provider directly (cash/UPI) — not through the app. Show the provider's phone so the farmer can
call. With no real providers loaded yet, dev has three clearly-labelled sample providers.

## Service types

`GET /services/types` → `[ { "code": "drone_spraying", "kind": "farm_service", "unit": "acre" }, … ]`

| kind | code | unit (what `rate` is per) |
|---|---|---|
| `labour` | `labour_sowing` `labour_transplanting` `labour_weeding` `labour_harvesting` `labour_spraying` `labour_general` | `worker_day` |
| `farm_service` | `tractor_ploughing` · `harvester` · `drone_spraying` | `acre` |
| `farm_service` | `tractor_rental` | `hour` |
| `farm_service` | `soil_testing` | `sample` |
| `farm_service` | `transport` | `trip` |

Codes and units are stable — translate them in the app.

## GET /services/providers

| Query | |
|---|---|
| `kind` | `labour` or `farm_service` |
| `type` | a service type code — only providers offering it, and only that offering is listed |
| `district` | case-insensitive |

**200** — farmer's own district first, then verified, then highest rated:
```json
[
  {
    "id": 2,
    "kind": "farm_service",
    "name": "…",
    "phone": "+919000000102",
    "description": "…",
    "state": "AP",
    "district": "Guntur",
    "mandal": null,
    "rating": 4.6,
    "rating_count": 30,
    "verified": true,
    "offerings": [
      { "id": 5, "service_type": "tractor_ploughing", "rate": 1500.0, "unit": "acre", "daily_capacity": 8 }
    ]
  }
]
```
`rate` is rupees per `unit`. `rating` can be `null` (no ratings yet). `verified` = checked by the Annadata team.

`GET /services/providers/{id}` — one provider, all active offerings. `422 unknown_service_type` for a bad `type`.

## GET /services/offerings/{id}/availability

Query: `from` (date, default today; past dates are moved to today), `days` (1–31, default 14).

**200**
```json
{ "offering_id": 5, "unit": "acre", "days": [ { "date": "2026-10-17", "remaining": 3 } ] }
```
`remaining` = how many units (acres, workers, hours…) can still be booked that day. `0` = full.

## Bookings

### POST /services/bookings
```json
{ "offering_id": 5, "date": "2026-10-17", "quantity": 5, "field_id": 7, "notes": "Field is next to the canal" }
```
`date` must be today to 60 days ahead. `quantity` is in the offering's unit (5 acres, 10 workers…).
`field_id` and `notes` (≤ 500 chars) are optional.

**201** — Booking:
```json
{
  "id": 9,
  "status": "requested",
  "date": "2026-10-17",
  "quantity": 5,
  "unit": "acre",
  "rate": 1500.0,
  "estimated_total": 7500.0,
  "service_type": "tractor_ploughing",
  "provider": { "…": "Provider" },
  "field_id": 7,
  "notes": "…",
  "created_at": "…"
}
```
`rate` is locked in at booking time. `estimated_total` = rate × quantity; the final amount is settled with the
provider.

| Status | code | When |
|---|---|---|
| 409 | `slot_unavailable` | Not enough capacity that day — `details: { "remaining": 3 }` |
| 422 | `invalid_date` | Past, or more than 60 days ahead |
| 404 | `offering_not_found` / `field_not_found` | |

### GET /services/bookings · GET /services/bookings/{id}
The farmer's bookings (Profile → booking history), latest date first.

### POST /services/bookings/{id}/cancel
For `requested` or `confirmed` bookings whose date hasn't passed. Frees the capacity.
`409 booking_not_cancellable` otherwise.

| `status` | |
|---|---|
| `requested` | Waiting for the provider to confirm |
| `confirmed` | Provider confirmed |
| `completed` | Work done |
| `cancelled` | Cancelled by the farmer |
| `rejected` | Provider couldn't take it |

Only `cancelled` is set through the app today; the rest are set by ops (no API yet).

## Labour requirements ("need workers" posts)

A farmer posts what work they need done; other users in the same district can see it and call.

### POST /labour/requirements
```json
{
  "work_type": "harvesting",
  "workers_needed": 10,
  "start_date": "2026-10-20",
  "days": 3,
  "wage_per_day": 600,
  "village": "Kolakaluru",
  "contact_phone": "9876543210",
  "description": "Paddy harvesting, lunch provided"
}
```
`work_type`: `sowing` `transplanting` `weeding` `harvesting` `spraying` `general`. `wage_per_day` (₹ per worker
per day), `village`, `contact_phone` (default: the farmer's own number) and `description` are optional.
State / district / mandal come from the farmer's profile — `422 location_required` if not set.

**201** — Requirement:
```json
{
  "id": 3, "work_type": "harvesting", "workers_needed": 10, "start_date": "2026-10-20", "days": 3,
  "wage_per_day": 600.0, "state": "TG", "district": "Warangal", "mandal": "Hanamkonda", "village": "…",
  "contact_phone": "+919876543210", "description": "…", "status": "open", "is_mine": true, "created_at": "…"
}
```

### GET /labour/requirements
- Default: **open** posts in the farmer's district (or `?district=`), excluding ones whose work period has
  ended. Ordered by start date.
- `?mine=true`: the farmer's own posts, every status.

### POST /labour/requirements/{id}/close
`{ "status": "filled" }` or `{ "status": "cancelled" }`. Owner only. `409 requirement_closed` if already closed.

**Privacy note:** posts show the contact phone to everyone in the district — make that clear on the posting form.
