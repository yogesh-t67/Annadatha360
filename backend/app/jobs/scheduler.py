"""Runs the backend's background jobs on a timetable. Run exactly ONE of these per environment:

    python -m app.jobs.scheduler

Jobs are idempotent, so an extra run (e.g. after a restart) is harmless. One failing job never stops the others.
"""

import logging
import signal
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.jobs.housekeeping import prune
from app.services.market import DataGovInClient, sync
from app.services.shop import expire_unpaid_orders

log = logging.getLogger("annadata.scheduler")
IST = ZoneInfo("Asia/Kolkata")
TICK_SECONDS = 30


@dataclass
class Job:
    name: str
    run: Callable[[], object]
    every: timedelta | None = None  # interval job…
    daily_at: tuple[int, int] | None = None  # …or daily at (hour, minute) IST
    last_run: datetime | None = field(default=None, repr=False)

    def due(self, now: datetime) -> bool:
        if self.every is not None:
            return self.last_run is None or now - self.last_run >= self.every
        hour, minute = self.daily_at
        today_slot = now.astimezone(IST).replace(hour=hour, minute=minute, second=0, microsecond=0)
        # Due once the slot has passed and we haven't run since it. A fresh process waits for the next slot
        # rather than firing immediately, so restarts don't trigger an off-schedule run.
        if self.last_run is None:
            self.last_run = now if now >= today_slot else today_slot - timedelta(days=1)
            return False
        return now >= today_slot > self.last_run


def _with_session(fn: Callable) -> Callable[[], object]:
    def run():
        with SessionLocal() as db:
            return fn(db)

    return run


def _sync_market(db):
    settings = get_settings()
    if not settings.data_gov_in_api_key:
        return "skipped: DATA_GOV_IN_API_KEY not set"
    return sync(db, DataGovInClient(settings.data_gov_in_api_key), settings.market_states)


def default_jobs() -> list[Job]:
    return [
        Job("expire_unpaid_orders", _with_session(expire_unpaid_orders), every=timedelta(minutes=5)),
        Job("sync_market_prices", _with_session(_sync_market), daily_at=(19, 30)),
        Job("housekeeping", _with_session(prune), daily_at=(3, 0)),
    ]


def run_due(jobs: list[Job], now: datetime) -> list[str]:
    ran = []
    for job in jobs:
        if not job.due(now):
            continue
        job.last_run = now  # set first: a failing job retries at its next slot, not every tick
        try:
            result = job.run()
            log.info("%s done: %s", job.name, result)
        except Exception:
            log.exception("%s failed", job.name)
        ran.append(job.name)
    return ran


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    stopping = False

    def stop(*_):
        nonlocal stopping
        stopping = True

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)

    jobs = default_jobs()
    log.info("Scheduler started: %s", ", ".join(j.name for j in jobs))
    while not stopping:
        run_due(jobs, datetime.now(IST))
        for _ in range(TICK_SECONDS):
            if stopping:
                break
            time.sleep(1)
    log.info("Scheduler stopped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
