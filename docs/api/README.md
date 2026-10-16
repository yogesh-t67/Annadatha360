# Annadata 360 API

Contract between `backend/` and `mobile/`. If an endpoint is documented here, it's live on the backend branch;
changes to anything already in use get a heads-up before they land.

| Area | Doc | Status |
|---|---|---|
| Auth (phone OTP) | [auth.md](auth.md) | ✅ P0 built |
| Farmer profile | [farmers.md](farmers.md) | ✅ P0 built |
| Fields | [fields.md](fields.md) | ✅ P0 built |
| Crops (reference list) | [crops.md](crops.md) | ✅ P0 built |
| Weather, Market prices, AI assistant, Crop advisory | — | P1, not started |
| Agri Mart, Cart/Checkout, Schemes, Labour, Farm services, Farm management | — | P2, not started |

Open decisions that affect the contract: [open-decisions.md](open-decisions.md).

Each contract covers: method, path, request shape, response shape, auth requirement, and error cases.

## Conventions

- **Base URL:** `/api/v1`. Local dev: `http://localhost:8000/api/v1` (Android emulator: `http://10.0.2.2:8000/api/v1`).
  Interactive docs at `/docs` on a running server.
- **JSON** in and out. Dates are `YYYY-MM-DD`; timestamps are ISO 8601 with timezone.
- **Auth:** `Authorization: Bearer <access_token>` on every endpoint except `/auth/*` and `/crops`.
- **PATCH** endpoints are partial: send only the fields you're changing. Omitted fields are untouched.
- **IDs** are integers.

### Errors

Every non-2xx response has this shape:

```json
{ "error": { "code": "otp_invalid", "message": "Incorrect OTP" } }
```

- `code` is stable and machine-readable — branch on it, and map it to your own localised copy.
- `message` is English, for logs/debugging. Don't show it to farmers.
- Validation failures (`422`, `code: "validation_error"`) add `details`:

```json
{ "error": { "code": "validation_error", "message": "Request validation failed",
             "details": [{ "field": "acreage", "message": "Input should be greater than 0" }] } }
```

Common codes on any authenticated endpoint: `unauthorized` (no token), `invalid_token` (bad/expired access
token → call `/auth/refresh`), `internal_error` (500).

### Localisation

Supported language codes: `en`, `te`, `hi`, `ta`, `kn`, `mr`, `gu`.

Content the server owns (crop names now; scheme text and advisory copy later) is returned **already resolved**
to the farmer's `preferred_language`, falling back to English when a translation is missing. Today crop names
exist in `en` and `te` only. Public endpoints take `?lang=` instead.
