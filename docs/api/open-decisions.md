# Decisions

## Decided (2026-10-16)

| Topic | Decision |
|---|---|
| SMS / OTP | **MSG91**, behind a provider-agnostic adapter. Dev mode logs OTPs. DLT registration is an external dependency (`docs/development/external-dependencies.md`). |
| AI: crop diagnosis + chat | **Claude** (Anthropic) for both, grounded in the farmer's crop, stage and location. |
| AI budget | **$50/month** placeholder, enforced by a configurable guard (`AI_MONTHLY_BUDGET_USD`). Raise before launch. |
| Telugu voice | Deferred. Evaluate Bhashini / Sarvam AI later. |
| Weather | **Open-Meteo** (`weather.md`). Needs a commercial plan before launch. |
| Market prices | **Agmarknet via data.gov.in** (`market-prices.md`). |

The original proposals are kept below for context.

---


## 1. SMS provider for OTP

Auth is built against a pluggable sender; only a dev "console" sender exists. Needs: an Indian SMS gateway with
DLT-registered templates (TRAI requirement for OTP SMS). Candidates: MSG91, Gupshup, Twilio (via an Indian route).
**Proposal:** MSG91 — widely used for Indian OTP, supports DLT templates and Telugu SMS. Needs a business account
and DLT registration, which takes days, so start it early.

## 2. AI: crop diagnosis (photo → issue + treatment)

**Proposal:** a hosted multimodal LLM (e.g. Claude) behind a backend endpoint, prompted with the crop, growth
stage and location, returning structured JSON (`issue`, `confidence`, `symptoms`, `treatment`, `when_to_consult_expert`)
in the farmer's language.

- Why not a dedicated plant-disease model first: those need labelled AP/TG field photos we don't have; an LLM
  works from day one and lets us collect photos + farmer feedback to evaluate (or train) later.
- Guardrails: always show confidence, never recommend banned pesticides, recommend contacting the local
  KVK / agriculture officer on low confidence.
- Before launch: test on a set of real photos for the top AP/TG crops (paddy, cotton, chilli) with an agronomist.
- Offline: not possible. App should queue the photo and submit when back online.

## 3. AI: assistant chat (Telugu text, later voice)

**Proposal:**
- **Text (P1):** the same LLM, given the farmer's profile, fields, crop stage, location and recent weather as
  context. Answers in the farmer's language. Store conversations as `ChatMessage` rows.
- **Voice (later):** Telugu speech-to-text and text-to-speech from an Indian-language speech provider —
  evaluate Bhashini (Government of India, free) and Sarvam AI against real farmer recordings, since accents and
  background noise matter more than benchmark scores.

## Questions for the team

1. OK to go with an LLM-first approach for both AI features? Which vendor/account?
2. Monthly AI budget ceiling? This decides model size and per-farmer rate limits.
3. Who owns the SMS gateway / DLT registration?
