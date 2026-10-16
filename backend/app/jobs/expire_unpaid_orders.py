"""Cancel orders left unpaid past ORDER_PAYMENT_WINDOW_MINUTES and put their stock back.

Run every 5 minutes:
    python -m app.jobs.expire_unpaid_orders
"""

import logging
import sys

from app.db.session import SessionLocal
from app.services.shop import expire_unpaid_orders


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    with SessionLocal() as db:
        count = expire_unpaid_orders(db)
    logging.info("Expired %d unpaid orders", count)
    return 0


if __name__ == "__main__":
    sys.exit(main())
