# Annadata 360 — Backend

FastAPI + PostgreSQL API for the Annadata 360 mobile app. API contract for the frontend lives in [`../docs/api/`](../docs/api/README.md).

## Run locally

**With Docker (Postgres + API):**

```sh
docker compose up --build
# API: http://localhost:8000  ·  Swagger UI: http://localhost:8000/docs
```

If 5432/8000 are taken by other projects, pick other host ports:
`ANNADATA_DB_PORT=5440 ANNADATA_API_PORT=8010 docker compose up --build`.

**Without Docker** (needs a Postgres you can reach):

```sh
python -m venv .venv
.venv/Scripts/activate            # Windows; use .venv/bin/activate on macOS/Linux
pip install -r requirements-dev.txt
cp .env.example .env              # edit DATABASE_URL / JWT_SECRET
alembic upgrade head
uvicorn app.main:app --reload
```

In development (`SMS_PROVIDER=console`) OTPs are printed to the server log instead of being sent by SMS.

## Scheduled jobs

One scheduler process runs all background jobs: `python -m app.jobs.scheduler` (the `scheduler` service in
docker-compose). **Run exactly one per environment.** Jobs are idempotent and a failing job doesn't stop the others.

| Job | When | Also runnable alone |
|---|---|---|
| Cancel unpaid orders, release stock | Every 5 minutes | `python -m app.jobs.expire_unpaid_orders` |
| Mandi price import (AP + TG) | Daily 19:30 IST; skipped without `DATA_GOV_IN_API_KEY` | `python -m app.jobs.sync_market_prices` |
| Prune old OTP codes and dead refresh tokens | Daily 03:00 IST | `python -m app.jobs.housekeeping` |

## Content and staff

No admin UI yet. Load content with the commands below or `POST /api/v1/admin/content/{kind}`
(see `docs/api/admin.md`). For local dev, `sample_data/` has clearly-labelled sample files.

```sh
python -m app.jobs.load_products products.json
python -m app.jobs.load_schemes schemes.json
python -m app.jobs.load_providers providers.json
python -m app.jobs.load_advisories advisories.json
python -m app.jobs.grant_staff 9876543210 admin    # ops | admin | revoke
```

## Tests

```sh
pytest
```

Tests run against in-memory SQLite by default, so no database is needed. Models avoid Postgres-only types except
through portable variants (`JSONType` = JSONB on Postgres, JSON elsewhere).

Run the same suite against real Postgres before merging schema changes. Use a **throwaway** database — tables are
dropped after every test:

```sh
docker compose up -d db
docker compose exec db psql -U annadata -c "CREATE DATABASE annadata_test"
TEST_DATABASE_URL=postgresql+psycopg://annadata:annadata@127.0.0.1:5432/annadata_test pytest
```

## Lint & format

```sh
ruff check .          # lint
ruff format .         # format (CI runs `ruff format --check`)
```

CI (`.github/workflows/backend.yml`) runs lint, a migration round-trip with `alembic check` (models and
migrations must match), and the test suite on SQLite and Postgres for every PR touching `backend/`.

## Layout

```
app/
  main.py            app factory, CORS, error handlers
  core/              config, security (JWT/OTP hashing), error envelope, i18n helpers
  db/                SQLAlchemy base + session, seed data
  models/            ORM models
  schemas/           Pydantic request/response models (the API contract)
  services/          business logic and third-party adapters (OTP/SMS, weather, market prices)
  jobs/              scheduled jobs, run with python -m
  api/v1/            routers, mounted under /api/v1
alembic/             migrations
tests/
```

## Conventions

- Every error response: `{"error": {"code": "...", "message": "...", "details"?: ...}}`.
- Localised content is stored as a JSON object keyed by language (`{"en": "...", "te": "..."}`) and resolved to the
  farmer's `preferred_language`, falling back to English. New languages need no schema change.
- New schema changes: edit models, then `alembic revision --autogenerate -m "..."` and review the output before committing.
- Document every new or changed endpoint in `docs/api/` in the same PR.
