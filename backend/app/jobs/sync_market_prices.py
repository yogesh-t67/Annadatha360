"""Pull today's AP/TG mandi prices from data.gov.in into market_prices.

Run daily (Agmarknet updates through the day; evening IST catches most reports):
    python -m app.jobs.sync_market_prices
"""

import json
import logging
import sys

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.services.market import DataGovInClient, sync


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    settings = get_settings()
    if not settings.data_gov_in_api_key:
        logging.error("DATA_GOV_IN_API_KEY is not set")
        return 1
    with SessionLocal() as db:
        stats = sync(db, DataGovInClient(settings.data_gov_in_api_key), settings.market_states)
    print(json.dumps(stats, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
