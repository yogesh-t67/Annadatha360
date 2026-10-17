#!/bin/sh
# Container entry point: migrate, load content, (optionally) start background jobs, then serve the API.
set -e

alembic upgrade head

# Government schemes are authored in content/schemes.json; loading is an idempotent upsert by slug.
python -m app.jobs.load_schemes content/schemes.json || echo "WARNING: loading schemes failed"

# Single-service hosting (e.g. the closed-beta cloud deploy): run the scheduler in this container instead of a
# separate worker, and import today's mandi prices once so Market Prices isn't empty until the 19:30 IST run.
# Never set RUN_SCHEDULER on more than one instance, and not when a separate scheduler service runs.
if [ "$RUN_SCHEDULER" = "true" ]; then
  python -m app.jobs.scheduler &
  python -m app.jobs.sync_market_prices > /tmp/first-market-sync.log 2>&1 &
fi

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
