from datetime import datetime, timedelta

from app.core.security import utcnow
from app.jobs.housekeeping import prune
from app.jobs.scheduler import IST, Job, default_jobs, run_due
from app.models import Farmer, OtpChallenge, RefreshToken


def at(day, hour, minute=0):
    return datetime(2026, 10, day, hour, minute, tzinfo=IST)


def test_interval_job_runs_immediately_then_every_interval():
    calls = []
    job = Job("x", lambda: calls.append(1), every=timedelta(minutes=5))
    assert run_due([job], at(16, 10, 0)) == ["x"]
    assert run_due([job], at(16, 10, 4)) == []
    assert run_due([job], at(16, 10, 5)) == ["x"]
    assert len(calls) == 2


def test_daily_job_waits_for_its_slot_and_runs_once_per_day():
    calls = []
    job = Job("daily", lambda: calls.append(1), daily_at=(19, 30))
    assert run_due([job], at(16, 20, 0)) == []  # started after today's slot: don't fire off-schedule
    assert run_due([job], at(17, 19, 29)) == []
    assert run_due([job], at(17, 19, 30)) == ["daily"]
    assert run_due([job], at(17, 23, 0)) == []
    assert run_due([job], at(18, 19, 31)) == ["daily"]
    assert len(calls) == 2


def test_daily_job_started_before_slot_runs_today():
    job = Job("daily", lambda: None, daily_at=(19, 30))
    assert run_due([job], at(16, 9, 0)) == []
    assert run_due([job], at(16, 19, 30)) == ["daily"]


def test_run_on_start_job_catches_up_then_keeps_its_slot():
    calls = []
    job = Job("prices", lambda: calls.append(1), daily_at=(19, 30), run_on_start=True)
    assert run_due([job], at(31, 9, 0)) == ["prices"]  # restarted after missed slots: fetch now
    assert run_due([job], at(31, 12, 0)) == []
    assert run_due([job], at(31, 19, 30)) == ["prices"]
    assert len(calls) == 2


def test_market_sync_runs_on_start():
    assert next(j for j in default_jobs() if j.name == "sync_market_prices").run_on_start


def test_failing_job_does_not_stop_others_or_retry_every_tick():
    calls = []

    def boom():
        raise RuntimeError("down")

    jobs = [
        Job("bad", boom, every=timedelta(minutes=5)),
        Job("good", lambda: calls.append(1), every=timedelta(minutes=5)),
    ]
    assert run_due(jobs, at(16, 10)) == ["bad", "good"]
    assert run_due(jobs, at(16, 10, 1)) == []  # bad isn't retried until its next interval
    assert calls == [1]


def test_default_jobs_are_wired():
    assert {j.name for j in default_jobs()} == {"expire_unpaid_orders", "sync_market_prices", "housekeeping"}


def test_market_sync_is_skipped_without_key():
    job = next(j for j in default_jobs() if j.name == "sync_market_prices")
    assert job.run() == "skipped: DATA_GOV_IN_API_KEY not set"


def test_housekeeping_prunes_only_old_rows(db_session):
    now = utcnow()
    with db_session() as db:
        db.add(Farmer(id=1, phone="+919000000000"))
        db.flush()
        db.add_all(
            [
                OtpChallenge(phone="p", code_hash="h", expires_at=now, created_at=now - timedelta(days=2)),
                OtpChallenge(phone="p", code_hash="h", expires_at=now, created_at=now - timedelta(minutes=30)),
                RefreshToken(farmer_id=1, token_hash="a", expires_at=now - timedelta(days=31)),
                RefreshToken(
                    farmer_id=1,
                    token_hash="b",
                    expires_at=now + timedelta(days=10),
                    revoked_at=now - timedelta(days=31),
                ),
                RefreshToken(farmer_id=1, token_hash="c", expires_at=now + timedelta(days=10)),
                RefreshToken(farmer_id=1, token_hash="d", expires_at=now - timedelta(days=1)),  # expired recently: kept
            ]
        )
        db.commit()
        assert prune(db) == {"otp_challenges": 1, "refresh_tokens": 2}
        assert {t.token_hash for t in db.query(RefreshToken)} == {"c", "d"}
