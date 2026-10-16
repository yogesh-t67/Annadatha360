"""Delete auth rows nobody needs any more, so these tables don't grow forever.

python -m app.jobs.housekeeping
"""

import logging
import sys
from datetime import timedelta

from sqlalchemy import delete, or_
from sqlalchemy.orm import Session

from app.core.security import utcnow
from app.db.session import SessionLocal
from app.models import OtpChallenge, RefreshToken

OTP_RETENTION = timedelta(days=1)  # well past expiry; keeps the hourly rate-limit window intact
TOKEN_RETENTION = timedelta(days=30)  # keep revoked/expired tokens briefly for debugging


def prune(db: Session) -> dict[str, int]:
    now = utcnow()
    otps = db.execute(delete(OtpChallenge).where(OtpChallenge.created_at < now - OTP_RETENTION)).rowcount
    tokens = db.execute(
        delete(RefreshToken).where(
            or_(
                RefreshToken.expires_at < now - TOKEN_RETENTION,
                RefreshToken.revoked_at < now - TOKEN_RETENTION,
            )
        )
    ).rowcount
    db.commit()
    return {"otp_challenges": otps, "refresh_tokens": tokens}


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    with SessionLocal() as db:
        logging.info("Pruned %s", prune(db))
    return 0


if __name__ == "__main__":
    sys.exit(main())
