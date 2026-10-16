# External dependencies

Accounts, keys and approvals the backend needs from outside the codebase. Code never blocks on these: each has a
dev fallback. Owner = who has to act.

| Dependency | Needed for | Status | Dev fallback | Owner |
|---|---|---|---|---|
| **DLT registration** (TRAI) | Sending OTP SMS in India | ⛔ Not started | OTP printed to server log (`SMS_PROVIDER=console`) | Business — needs PAN/GST |
| **MSG91 account** | OTP SMS delivery | ⛔ Not started (blocked on DLT) | Same as above | Business |
| **Anthropic API key** | AI assistant, crop diagnosis | ⛔ Not provided | `AI_PROVIDER=fake` (canned) or `AI_PROVIDER=gemini` (free, testing only) | Team |
| **Gemini API key** (optional, testing) | Real AI answers before the Anthropic key | Free from aistudio.google.com/apikey | — | Anyone with a Google account |
| **Open-Meteo commercial plan** | Weather, at launch | Not needed until launch | Free non-commercial API (no key) | Team |
| **data.gov.in API key** | Mandi prices | ✅ Have it (2026-10-16); live import verified | — | Set `DATA_GOV_IN_API_KEY` on each server |
| **Razorpay account** (KYC) | Agri Mart payments | ⛔ Not started | `PAYMENT_PROVIDER=fake` + dev-complete endpoint | Business — needs PAN, bank account, GST |
| **Product catalogue** | Agri Mart | ⛔ No real data | `sample_data/products.sample.json` | Business — products, prices, images, stock |
| **Service providers** | Labour & Farm Services | ⛔ No real data | `sample_data/providers.sample.json` | Business — onboard and verify providers |
| **Advisory content** | Crop Advisory, Home | ⛔ No real data | `sample_data/advisories.sample.json` | Agronomist / university sources; Telugu translation |
| **Scheme content** | Government Schemes | ⛔ No real data | `sample_data/schemes.sample.json` | Someone to research official portals; Telugu translation |

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
in their docs is rate-limited to the point of being unusable. The importer was verified against the live feed on
2026-10-16. Gotcha: the API stalls requests from generic library User-Agents (`python-httpx`, `python-requests`)
until they time out, so the client sends `Annadata360-backend/…` — keep that if you change the HTTP code.

## Anthropic

Set `ANTHROPIC_API_KEY`. Spend is capped by `AI_MONTHLY_BUDGET_USD` (placeholder $50/month for the dev sandbox) —
see `docs/api/assistant.md`. Raise it before launch.

## Razorpay

1. Create a Razorpay account and complete business KYC (PAN, bank account, GST, business proof). Test mode works
   immediately; live mode needs KYC approval.
2. Settings → Payment capture → **automatic**.
3. Webhooks → add `https://<api-host>/api/v1/payments/razorpay/webhook`, events `payment.captured` + `order.paid`,
   set a secret.
4. Server env: `PAYMENT_PROVIDER=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
5. Test a full UPI payment in test mode before going live. The adapter is tested against mocks only so far.

Selling pesticides and fertilisers may need state dealer licences — confirm with the business before launch.

## Scheme content

Load with `python -m app.jobs.load_schemes schemes.json` (format in that file's docstring and
`sample_data/schemes.sample.json`). For each scheme:

1. Copy the facts from the **official** portal (central: the scheme's .gov.in site; AP / Telangana: the state
   agriculture department). Put that page in `source_url` and today's date in `last_verified_on`.
2. Write `en`; add `te` (native-speaker reviewed).
3. Set `max_land_acres` / `crop_codes` only if the official criteria say so — they drive the "may be
   eligible" hint.
4. Load with `"published": false`, have a second person check against the source, then publish.
5. Re-check every scheme at least each season; amounts and names change with state budgets.
