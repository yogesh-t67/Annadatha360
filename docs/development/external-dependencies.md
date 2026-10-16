# External dependencies

Accounts, keys and approvals the backend needs from outside the codebase. Code never blocks on these: each has a
dev fallback. Owner = who has to act.

| Dependency | Needed for | Status | Dev fallback | Owner |
|---|---|---|---|---|
| **DLT registration** (TRAI) | Sending OTP SMS in India | ⛔ Not started | OTP printed to server log (`SMS_PROVIDER=console`) | Business — needs PAN/GST |
| **MSG91 account** | OTP SMS delivery | ⛔ Not started (blocked on DLT) | Same as above | Business |
| **Anthropic API key** | AI assistant, crop diagnosis | ⛔ Not provided | AI endpoints return `503 ai_not_configured` | Team |
| **Open-Meteo commercial plan** | Weather, at launch | Not needed until launch | Free non-commercial API (no key) | Team |
| **data.gov.in API key** | Mandi prices | ⛔ Not provided | No live sync; sample data in tests | Anyone (free signup) |

## DLT registration → MSG91

Every commercial SMS in India must use a sender ID and message template registered on a DLT platform (Jio, Airtel,
Vodafone Idea, BSNL…). Without it, operators drop the SMS.

1. Register the business as a **Principal Entity** on a DLT portal. Needs PAN, GST certificate, authorised
   signatory details. Approval usually takes a few working days.
2. Register a **sender ID / header** (6 letters, e.g. `ANNDTA`).
3. Register the **OTP template**, e.g. `{#var#} is your Annadata 360 login code. Valid for 5 minutes. Do not share it.`
   Add a Telugu variant if we want Telugu SMS (Unicode).
4. In MSG91: link the DLT entity ID, header and template; create an OTP template there and note its ID.
5. Set `SMS_PROVIDER=msg91`, `MSG91_AUTH_KEY`, `MSG91_OTP_TEMPLATE_ID` on the server.
6. MSG91 auth keys can be IP-restricted by default — whitelist the server's egress IP.

The MSG91 adapter (`backend/app/services/sms.py`) follows MSG91's documented v5 OTP API but hasn't been run against
a live account yet. Do a real send on staging before launch.

## Open-Meteo licence

The free `api.open-meteo.com` endpoint is for **non-commercial** use. Annadata 360 sells products, so it needs a
commercial subscription before public launch. When we have one: set `OPEN_METEO_API_KEY` and
`OPEN_METEO_BASE_URL=https://customer-api.open-meteo.com`. No code change.

## data.gov.in

Mandi prices come from the Agmarknet "Current Daily Price of Various Commodities from Various Markets (Mandi)"
dataset. Register at data.gov.in for a free personal API key and set `DATA_GOV_IN_API_KEY`. The shared sample key
in their docs is rate-limited to the point of being unusable. Field names in our importer need checking against a
live response once we have a key (see `docs/api/market-prices.md`).

## Anthropic

Set `ANTHROPIC_API_KEY`. Spend is capped by `AI_MONTHLY_BUDGET_USD` (placeholder $50/month for the dev sandbox) —
see `docs/api/assistant.md`. Raise it before launch.
