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

## Questions for the team (answered 2026-10-16 — see "Decided" above)

1. OK to go with an LLM-first approach for both AI features? Which vendor/account?
2. Monthly AI budget ceiling? This decides model size and per-farmer rate limits.
3. Who owns the SMS gateway / DLT registration?

---

# Open: Telugu voice for the assistant (proposal, 2026-10-16)

Voice was deferred from P1. Nothing is built for it; this is the proposal to decide on. The text chat API
(`POST /assistant/messages`) already does the hard part, so voice is mostly *speech in → text* and
*text → speech out* around it.

## Option A — on the phone (recommended first step)

- **Speech → text:** Android's built-in speech recogniser (Google), which supports Telugu (`te-IN`). From React
  Native via a speech-recognition library; needs an Expo development build.
- **Text → speech:** Android's built-in TTS via `expo-speech` (Telugu voice available on most phones with Google
  TTS; some cheaper phones may need the voice data downloaded once).
- **Backend:** no change. The app sends the recognised text to the existing endpoint and reads the reply aloud.
- **Pros:** free, no new vendor, no audio uploaded over weak rural networks, works today.
- **Cons:** quality depends on the phone; we can't tune it for farming vocabulary or dialect; no control over
  voice quality.
- **Owner:** almost entirely mobile.

## Option B — on the server

`POST /assistant/voice` (audio upload) → speech-to-text → existing chat → text-to-speech → reply text + audio.
Candidate providers to evaluate for Telugu: **Bhashini** (Government of India language platform; free) and
**Sarvam AI** (commercial, Indian-language speech models). Verify current Telugu support, pricing and terms for
both before choosing.

- **Pros:** consistent quality on every phone; can pick/tune the best Telugu model; reply audio can be cached.
- **Cons:** new vendor + cost (outside the Claude budget), audio upload/download on slow networks, more latency.
- **Owner:** backend (endpoint, provider adapter, audio storage) + mobile (recording, playback).

## Recommendation

Ship **A** first — it's free and needs no backend work. Meanwhile, collect 30–50 real farmer voice questions
(with consent) and score A against Bhashini and Sarvam on them. Move to **B** only if A's accuracy on real
farmers is poor. Accents, background noise and farming terms matter more than published benchmarks.

## Decision needed

1. OK to start with A?
2. Who collects the sample recordings for the B evaluation?
