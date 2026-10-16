# Government schemes

Central and state (AP / Telangana) schemes for farmers: what each gives, who qualifies, documents needed, and
how to apply. Auth required.

**Content status:** the API is built, but **no real scheme content is loaded yet**. Scheme details change
often (both states have renamed their main farmer schemes recently), so content must be copied from official
portals by a person, with the source link and the date it was checked. Until then, only clearly-labelled sample
schemes exist in dev (`backend/sample_data/schemes.sample.json`). See `docs/development/external-dependencies.md`.

Show `last_verified_on` ("Information checked on 1 Oct 2026") and a link to `source_url` on the detail screen,
so farmers can confirm with the official source.

## GET /schemes

| Query | Default | |
|---|---|---|
| `authority` | both | `central` or `state` |
| `state` | farmer's `location.state`, else both | `AP` or `TG` — which state's schemes to include. Central schemes are always included unless `authority=state`. |
| `category` | all | `income_support` `insurance` `credit` `subsidy` `soil` `irrigation` `other` |
| `q` | — | search in name and summary (any language) |

**200** — array, schemes the farmer may be eligible for first:
```json
[
  {
    "id": 4,
    "slug": "pm-kisan",
    "authority": "central",
    "state": null,
    "category": "income_support",
    "name": "…",
    "summary": "…",
    "possibly_eligible": true,
    "last_verified_on": "2026-10-01"
  }
]
```

**`possibly_eligible`** is a rough hint from the farmer's total field acreage and crops only:
- `true` — nothing we know rules them out
- `false` — their land is over the scheme's limit, or they grow none of its crops. Shown last.
- `null` — the scheme has a land or crop limit but we don't know the farmer's acreage or crops (no fields
  added). Good moment to prompt "add your fields to check eligibility".

Never present it as a guarantee — the `eligibility` text on the detail screen is what counts.

## GET /schemes/{slug}

**200** — the summary fields plus:
```json
{
  "benefits": "…",
  "eligibility": ["…", "…"],
  "documents": ["Aadhaar card", "…"],
  "steps": ["…", "…"],
  "application_url": "https://…",
  "source_url": "https://…"
}
```
Lists are in display order. `benefits` and `application_url` can be `null` (some schemes are applied for
offline — then `steps` says where). All text is in the farmer's language with English fallback.

| Status | code | When |
|---|---|---|
| 404 | `scheme_not_found` | Unknown or unpublished slug |
