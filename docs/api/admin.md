# Admin / ops API

For Annadata staff, not the farmer app. There's no admin UI yet — use Swagger UI at `/docs` (Authorize with
your token) or curl. Everything is under `/api/v1/admin`, uses the same bearer token as the app, and every
change is written to an audit log.

## Getting access

Staff log in like farmers (phone OTP, once, from the app or `POST /auth/otp/*`), then someone with server
access grants a role:

```sh
python -m app.jobs.grant_staff 9876543210 admin   # or ops
python -m app.jobs.grant_staff 9876543210 revoke
```

| Role | Can |
|---|---|
| `ops` | Orders and bookings (list, change status) |
| `admin` | Everything `ops` can, plus AI spend, content upload, audit log |

Non-staff get `403 forbidden`.

## Orders

`GET /admin/orders?status=paid&limit=100` — all farmers' orders, newest first, each with
`farmer: { id, name, phone }` added to the normal [Order](agri-mart.md) object.

`POST /admin/orders/{id}/status` `{ "status": "shipped", "note": "Courier ABC, AWB 123" }`

| From | Allowed to |
|---|---|
| `confirmed` (cash on delivery) | `shipped`, `cancelled` (stock is released) |
| `paid` | `shipped`, `refund_pending` (stock is released) |
| `shipped` | `delivered` |
| `refund_pending` | `refunded` — do the refund in the Razorpay dashboard first, then record it here |

Anything else → `409 invalid_transition`.

## Service bookings

`GET /admin/bookings?status=requested&date=2026-10-17` — earliest date first, with `farmer` added.

`POST /admin/bookings/{id}/status` `{ "status": "confirmed", "note": "Spoke to provider" }`

| From | Allowed to |
|---|---|
| `requested` | `confirmed`, `rejected` |
| `confirmed` | `completed`, `rejected` |

Typical flow: call the provider, confirm or reject, call the farmer back.

## AI spend (admin)

`GET /admin/ai/usage`
```json
{
  "month_start": "2026-10-01T00:00:00Z",
  "budget_usd": 50.0,
  "spent_usd": 3.75,
  "remaining_usd": 46.25,
  "by_feature": { "chat": { "requests": 120, "cost_usd": 1.5 }, "diagnosis": { "requests": 30, "cost_usd": 2.25 } },
  "by_model": { "claude-opus-5-5": { "requests": 150, "cost_usd": 3.75 } },
  "top_farmers": [ { "farmer_id": 12, "requests": 30, "cost_usd": 0.9 } ]
}
```
Calendar month in UTC. When `remaining_usd` hits the reserve, the app's AI features pause until next month or
until `AI_MONTHLY_BUDGET_USD` is raised.

## Content (admin)

`POST /admin/content/{kind}` with a JSON array body — `kind` is `products`, `schemes`, `providers` or
`advisories`. Same format and validation as the `python -m app.jobs.load_*` commands (see each file's
docstring and `backend/sample_data/`). Items are matched by `sku` / `slug` / `code` and inserted or updated.

**200** `{ "kind": "products", "inserted": 2, "updated": 0 }`. Invalid items → `422 invalid_content` with the
reason, and **nothing** from that upload is saved.

## Audit log (admin)

`GET /admin/audit?limit=100` — newest first:
`{ id, staff_farmer_id, action, target_type, target_id, detail, created_at }`. `detail` holds old/new status
and the note, or upload counts.
