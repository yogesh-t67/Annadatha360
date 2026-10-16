# Farm management (crop plans, tasks, harvests)

Builds on [fields](fields.md). A **crop plan** is one crop on one field for one season. Plans have **tasks**
(with optional cost, giving the farmer an expense log), and **harvest records** capture yield and sales. Each
plan comes with a cost / revenue / profit summary. Auth required; everything is private to the farmer.

Plans don't change the field's own `crop_code` / `growth_stage` — update the field too if the app wants them in
sync (e.g. when a plan goes `active`).

## Crop plans

### POST /fields/{field_id}/plans
```json
{
  "crop_code": "paddy",
  "season": "kharif",
  "year": 2026,
  "sowing_date": "2026-07-05",
  "expected_harvest_date": "2026-11-10",
  "status": "active",
  "notes": "BPT 5204"
}
```
`season`: `kharif` `rabi` `summer`. `status`: `planned` (default) `active` `harvested` `abandoned`. Dates, notes
optional; `expected_harvest_date` can't be before `sowing_date`.

**201** — Plan:
```json
{
  "id": 4,
  "field_id": 7,
  "crop": { "code": "paddy", "name": "వరి" },
  "season": "kharif",
  "year": 2026,
  "sowing_date": "2026-07-05",
  "expected_harvest_date": "2026-11-10",
  "days_since_sowing": 103,
  "status": "active",
  "notes": "BPT 5204",
  "tasks": [ { "id": 1, "category": "fertilizer", "title": "Urea top dressing", "due_date": "2026-08-10", "done": true, "cost": 1300.0 } ],
  "summary": {
    "total_cost": 5300.0,
    "revenue": 88000.0,
    "profit": 82700.0,
    "harvested": { "quintal": 50.0 },
    "tasks_done": 2,
    "tasks_total": 2
  },
  "created_at": "…",
  "updated_at": "…"
}
```
- `days_since_sowing` — `null` before sowing or without a sowing date.
- `summary` (rupees): `total_cost` = sum of task costs; `revenue` = Σ sold quantity × price over the plan's
  harvests (unsold or unpriced quantities count as 0); `profit` = revenue − cost (can be negative).
  `harvested` totals quantity per unit (we don't convert units).
- Tasks are ordered by due date.

### GET /plans
Query: `field_id`, `status`. Newest season first.

### GET /plans/{id} · PATCH /plans/{id} · DELETE /plans/{id}
PATCH is partial (same fields as create; `crop_code`, `season`, `year`, `status` can't be null). Date order is
checked against the stored values too. DELETE removes the plan and its tasks; harvests stay, with `plan_id: null`.

## Tasks

| Endpoint | Body |
|---|---|
| `POST /plans/{id}/tasks` | `{ "category": "fertilizer", "title": "Urea top dressing", "due_date": "2026-08-10", "done": false, "cost": 1200.5 }` |
| `PATCH /plans/{id}/tasks/{task_id}` | any of the same fields (`category`, `title`, `done` not null) |
| `DELETE /plans/{id}/tasks/{task_id}` | |

`category`: `land_preparation` `sowing` `fertilizer` `irrigation` `weeding` `spraying` `harvest` `labour` `other`.
`title` 1–120 chars. `cost` in rupees, optional (`null` = not recorded). Returns the Task object
(`201` / `200`), or `204` for delete.

## Harvests

### POST /harvests
```json
{
  "field_id": 7,
  "plan_id": 4,
  "harvest_date": "2026-11-12",
  "quantity": 50,
  "unit": "quintal",
  "sold_quantity": 40,
  "price_per_unit": 2200,
  "buyer": "Guntur mandi",
  "notes": "…"
}
```
- `unit`: `quintal` `kg` `tonne`. `price_per_unit` is rupees per that unit.
- `plan_id` optional, but must be a plan on the same field (`422 plan_field_mismatch`).
- `crop_code` optional: defaults to the plan's crop, else the field's crop (`422 crop_required` if neither).
- `sold_quantity` ≤ `quantity`.

**201** — Harvest:
```json
{
  "id": 3, "field_id": 7, "plan_id": 4, "crop": { "code": "paddy", "name": "వరి" },
  "harvest_date": "2026-11-12", "quantity": 50.0, "unit": "quintal",
  "sold_quantity": 40.0, "price_per_unit": 2200.0, "revenue": 88000.0,
  "buyer": "Guntur mandi", "notes": "…", "created_at": "…"
}
```
`revenue` is `null` unless both `sold_quantity` and `price_per_unit` are set.

### GET /harvests · PATCH /harvests/{id} · DELETE /harvests/{id}
List filters: `field_id`, `plan_id`; newest first. PATCH is partial (`harvest_date`, `quantity`, `unit` not
null; `sold_quantity` ≤ `quantity` checked against stored values).

## Errors

| Status | code |
|---|---|
| 404 | `field_not_found` `plan_not_found` `task_not_found` `harvest_not_found` |
| 422 | `unknown_crop` `crop_required` `plan_field_mismatch` `validation_error` |
