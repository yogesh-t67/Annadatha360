# Annadata 360 — Backend

FastAPI + PostgreSQL API for the Annadata 360 mobile app. API contract for the frontend lives in [`../docs/api/`](../docs/api/README.md).

## Run locally

**With Docker (Postgres + API):**

```sh
docker compose up --build
# API: http://localhost:8000  ·  Swagger UI: http://localhost:8000/docs
```

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

## Tests

```sh
pytest
```

Tests run against in-memory SQLite, so no database is needed. Models avoid Postgres-only types except through
portable variants (`JSONType` = JSONB on Postgres, JSON elsewhere).

## Layout

```
app/
  main.py            app factory, CORS, error handlers
  core/              config, security (JWT/OTP hashing), error envelope, i18n helpers
  db/                SQLAlchemy base + session, seed data
  models/            ORM models
  schemas/           Pydantic request/response models (the API contract)
  services/          business logic (auth/OTP, SMS, serialisers)
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
