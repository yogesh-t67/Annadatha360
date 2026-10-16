# Crop diagnosis (photo)

The farmer photographs a sick plant; the server returns a structured diagnosis in their `preferred_language`:
what the problem likely is, how confident, what to do, and whether to see an expert. Auth required.

**Model:** Claude vision (same model, fallback and budget rules as the [assistant](assistant.md)). The answer
uses the field's crop and growth stage, the farmer's location and the weather forecast (e.g. "wait to spray,
rain tomorrow").

## Behaviour to design for

- **Slow:** 10–40 seconds. Show progress; HTTP timeout **≥ 120 s**.
- **Resize on the phone before upload:** longest side ~1500 px, JPEG quality ~80. Larger photos don't help the
  diagnosis and cost upload data on rural networks. Hard limit is 5 MB.
- Counts towards the same **30 AI requests / 24 h** per farmer and the monthly budget as chat.
- **Photos are not stored** on the server (only a hash), so history shows the result, not the photo. Keep a
  local copy on the device if you want to show it in history.
- If the photo isn't a plant or is too blurry, you still get `201` — see `is_plant_image` / `image_quality`
  and show `summary`, which says how to retake it.
- This is **guidance, not a certified diagnosis**. Show a short disclaimer, and when `consult_expert` is
  true, highlight "contact your Agriculture Extension Officer / KVK".

## POST /diagnoses

`multipart/form-data`:

| Part | Required | |
|---|---|---|
| `image` | ✅ | JPEG, PNG or WebP, ≤ 5 MB. Type is detected from the file bytes. |
| `field_id` | | The field the photo is from — gives crop + growth stage |
| `crop_code` | | Override the crop (e.g. no field). Default: field's crop → farmer's primary crop |
| `notes` | | ≤ 500 chars, what the farmer noticed ("leaves drying from the tip since a week") |

**201**
```json
{
  "id": 31,
  "field_id": 7,
  "crop": { "code": "paddy", "name": "వరి" },
  "language": "te",
  "notes": "ఆకులు ఎండిపోతున్నాయి",
  "created_at": "2026-10-16T10:15:00Z",
  "result": {
    "is_plant_image": true,
    "image_quality": "good",
    "crop_identified": "వరి",
    "matches_expected_crop": true,
    "health_status": "problem_found",
    "issue": { "name": "అగ్గి తెగులు (Blast)", "category": "disease", "confidence": "medium" },
    "symptoms": ["ఆకులపై కంటి ఆకారపు మచ్చలు"],
    "actions": [
      { "step": "…", "type": "cultural" },
      { "step": "…", "type": "chemical" }
    ],
    "prevention": ["…"],
    "consult_expert": false,
    "summary": "…"
  }
}
```

`result` fields — every field is always present:

| Field | Values |
|---|---|
| `is_plant_image` | `false` → not a plant; show `summary` (asks for a better photo) |
| `image_quality` | `good` · `poor` (retake advice in `summary`) |
| `crop_identified` | Crop seen in the photo, in the farmer's language. `""` if unclear |
| `matches_expected_crop` | `false` → the photo doesn't look like the field's crop; worth flagging |
| `health_status` | `healthy` · `problem_found` · `uncertain` |
| `issue.category` | `disease` `pest` `nutrient_deficiency` `water_stress` `weather_damage` `weed` `other` `none` |
| `issue.confidence` | `low` · `medium` · `high` |
| `actions[].type` | `cultural` (field practice) · `organic` · `chemical` (show a safety icon) · `monitor` |
| `summary` | 2–3 sentences to show at the top |

Text fields are in the farmer's language; `category`, `confidence`, `type` etc. are codes — translate them in the app.

## GET /diagnoses

Query: `field_id` (optional), `limit` (1–100, default 20). **200** — newest first, same object as above.

## GET /diagnoses/{id}

**200** — one diagnosis.

## DELETE /diagnoses/{id}

**204**.

## Errors

| Status | code | When |
|---|---|---|
| 404 | `field_not_found` / `diagnosis_not_found` | Not this farmer's |
| 413 | `image_too_large` | Over 5 MB |
| 415 | `unsupported_image` | Not JPEG / PNG / WebP |
| 422 | `image_required` | Empty file |
| 422 | `unknown_crop` | Bad `crop_code` |
| 422 | `validation_error` | No `image` part, notes too long |
| 422 / 429 / 503 | `ai_declined`, `ai_daily_limit`, `ai_busy`, `ai_unavailable`, `ai_budget_exceeded`, `ai_not_configured` | Same as [assistant](assistant.md#errors) |

Failed diagnoses are not saved, so the farmer can just retry.
