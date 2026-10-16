"""Mandi prices: import from data.gov.in (Agmarknet) into market_prices, and query with day-over-day trend.

The app never calls data.gov.in directly — a scheduled job (`python -m app.jobs.sync_market_prices`)
pulls the day's reports into our table, and the API reads from there.
"""

import logging
import time
from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation

import httpx
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Farmer, MarketPrice
from app.schemas.market import MarketPriceOut, PreviousPrice
from app.services.serializers import crop_ref

log = logging.getLogger("annadata.market")

STATE_CODES = {"Andhra Pradesh": "AP", "Telangana": "TG"}
STATE_NAMES = {v: k for k, v in STATE_CODES.items()}

# Agmarknet commodity name (lowercased, prefix match) → our crop code. Longest prefix wins.
# Unmapped commodities are still stored (crop_code NULL) so they can be mapped later without re-importing.
COMMODITY_TO_CROP = {
    "paddy": "paddy",
    "maize": "maize",
    "jowar": "jowar",
    "arhar": "red_gram",
    "red gram/arhar/tur(whole)": "red_gram",  # not "red gram split/arhar dal": that's processed dal
    "bengal gram": "bengal_gram",
    "black gram": "black_gram",
    "green gram": "green_gram",
    "groundnut": "groundnut",
    "ground nut": "groundnut",
    "sunflower": "sunflower",
    "castor seed": "castor",
    "cotton": "cotton",
    "sugarcane": "sugarcane",
    "dry chillies": "chilli",
    "green chilli": "chilli",
    "chili red": "chilli",
    "turmeric": "turmeric",
    "tomato": "tomato",
    "onion": "onion",
    "mango": "mango",
    "banana": "banana",
}

LOOKBACK_DAYS = 14  # mandis report irregularly; show each market's latest report within this window
# Changes smaller than this (in %) count as "flat" — mandi prices wobble daily.
FLAT_THRESHOLD_PCT = 1.0


def crop_for_commodity(commodity: str) -> str | None:
    name = commodity.strip().lower()
    matches = [prefix for prefix in COMMODITY_TO_CROP if name.startswith(prefix)]
    return COMMODITY_TO_CROP[max(matches, key=len)] if matches else None


def _parse_date(value: str) -> date | None:
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except (ValueError, AttributeError):
            continue
    return None


def _parse_price(value) -> Decimal | None:
    try:
        price = Decimal(str(value).strip())
    except (InvalidOperation, TypeError):
        return None
    return price if price > 0 else None


def parse_record(record: dict) -> dict | None:
    """Normalise one data.gov.in record. Returns None for rows we can't use."""
    state = STATE_CODES.get((record.get("state") or "").strip())
    arrival = _parse_date(record.get("arrival_date") or "")
    modal = _parse_price(record.get("modal_price"))
    commodity = (record.get("commodity") or "").strip()
    market = (record.get("market") or "").strip()
    if not (state and arrival and modal and commodity and market):
        return None
    return {
        "crop_code": crop_for_commodity(commodity),
        "commodity": commodity,
        "variety": (record.get("variety") or "").strip(),
        "grade": (record.get("grade") or "").strip(),
        "state": state,
        "district": (record.get("district") or "").strip(),
        "market": market,
        "arrival_date": arrival,
        "min_price": _parse_price(record.get("min_price")),
        "max_price": _parse_price(record.get("max_price")),
        "modal_price": modal,
    }


class DataGovInClient:
    RESOURCE_URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"
    PAGE_SIZE = 500
    # The API has occasional slow/failed responses; retry each page a few times before giving up.
    RETRY_DELAYS = (2.0, 10.0)

    # data.gov.in stalls requests from generic library User-Agents (python-httpx, python-requests) until they
    # time out, so identify ourselves.
    USER_AGENT = "Annadata360-backend/0.1 (+https://github.com/yogesh-t67/Annadatha360)"

    def __init__(self, api_key: str, http: httpx.Client | None = None, sleep=time.sleep):
        self.api_key = api_key
        self.http = http or httpx.Client(timeout=60.0, headers={"User-Agent": self.USER_AGENT})
        self.sleep = sleep

    def _get_page(self, state_name: str, offset: int) -> list[dict]:
        params = {
            "api-key": self.api_key,
            "format": "json",
            "limit": self.PAGE_SIZE,
            "offset": offset,
            "filters[state.keyword]": state_name,
        }
        for attempt, delay in enumerate((*self.RETRY_DELAYS, None), start=1):
            try:
                res = self.http.get(self.RESOURCE_URL, params=params)
                res.raise_for_status()
                return res.json().get("records") or []
            except (httpx.HTTPError, ValueError) as exc:
                if delay is None:
                    raise RuntimeError(
                        f"data.gov.in fetch failed for {state_name} at offset {offset} after {attempt} attempts: {exc}"
                    ) from exc
                log.warning("data.gov.in attempt %d failed (%s); retrying in %ss", attempt, exc, delay)
                self.sleep(delay)
        return []  # unreachable

    def fetch_state(self, state_name: str) -> list[dict]:
        records: list[dict] = []
        offset = 0
        while True:
            page = self._get_page(state_name, offset)
            records.extend(page)
            if len(page) < self.PAGE_SIZE:
                return records
            offset += self.PAGE_SIZE


def upsert_prices(db: Session, rows: list[dict]) -> tuple[int, int]:
    """Insert new reports, update changed ones. Returns (inserted, updated)."""
    inserted = updated = 0
    for row in rows:
        existing = db.scalar(
            select(MarketPrice).where(
                MarketPrice.state == row["state"],
                MarketPrice.district == row["district"],
                MarketPrice.market == row["market"],
                MarketPrice.commodity == row["commodity"],
                MarketPrice.variety == row["variety"],
                MarketPrice.grade == row["grade"],
                MarketPrice.arrival_date == row["arrival_date"],
            )
        )
        if existing is None:
            db.add(MarketPrice(**row))
            inserted += 1
        else:
            for key in ("crop_code", "min_price", "max_price", "modal_price"):
                setattr(existing, key, row[key])
            updated += 1
    db.commit()
    return inserted, updated


def sync(db: Session, client: DataGovInClient, state_names: list[str]) -> dict:
    stats = {}
    for name in state_names:
        raw = client.fetch_state(name)
        rows = [r for r in (parse_record(x) for x in raw) if r]
        # The same report can appear twice in one response; keep the last.
        unique = {
            (r["state"], r["district"], r["market"], r["commodity"], r["variety"], r["grade"], r["arrival_date"]): r
            for r in rows
        }
        inserted, updated = upsert_prices(db, list(unique.values()))
        stats[name] = {"fetched": len(raw), "usable": len(unique), "inserted": inserted, "updated": updated}
        log.info("Market sync %s: %s", name, stats[name])
    return stats


def latest_with_trend(
    db: Session,
    crop_codes: list[str],
    state: str | None = None,
    district: str | None = None,
    today: date | None = None,
) -> list[tuple[MarketPrice, MarketPrice | None]]:
    """Each market's most recent report (within LOOKBACK_DAYS) paired with its previous report, if any."""
    today = today or date.today()
    # Look back an extra window so the oldest "latest" row can still find its previous report.
    since = today - timedelta(days=LOOKBACK_DAYS * 2)
    q = select(MarketPrice).where(MarketPrice.crop_code.in_(crop_codes), MarketPrice.arrival_date >= since)
    if state:
        q = q.where(MarketPrice.state == state)
    if district:
        q = q.where(func.lower(MarketPrice.district) == district.strip().lower())
    q = q.order_by(MarketPrice.arrival_date.desc(), MarketPrice.id.desc())

    series: dict[tuple, list[MarketPrice]] = defaultdict(list)
    for row in db.scalars(q):
        series[(row.state, row.district, row.market, row.commodity, row.variety, row.grade)].append(row)

    cutoff = today - timedelta(days=LOOKBACK_DAYS)
    result = []
    for rows in series.values():
        latest = rows[0]
        if latest.arrival_date >= cutoff:
            result.append((latest, rows[1] if len(rows) > 1 else None))
    return result


def price_rows(
    db: Session,
    farmer: Farmer,
    crop_codes: list[str],
    state: str | None = None,
    district: str | None = None,
    limit: int = 100,
) -> list[MarketPriceOut]:
    """Latest price per market with trend, the farmer's own district first."""
    pairs = latest_with_trend(db, crop_codes, state=state, district=district)
    home = (farmer.district or "").lower()
    pairs.sort(key=lambda p: (p[0].district.lower() != home, -p[0].arrival_date.toordinal(), p[0].market))

    lang = farmer.preferred_language
    out = []
    for latest, prev in pairs[:limit]:
        change = change_pct = trend = None
        if prev is not None:
            change = latest.modal_price - prev.modal_price
            change_pct = round(float(change / prev.modal_price * 100), 2)
            trend = "flat" if abs(change_pct) < FLAT_THRESHOLD_PCT else ("up" if change > 0 else "down")
        out.append(
            MarketPriceOut(
                crop=crop_ref(db, latest.crop_code, lang),
                commodity=latest.commodity,
                variety=latest.variety,
                grade=latest.grade,
                market=latest.market,
                district=latest.district,
                state=latest.state,
                arrival_date=latest.arrival_date,
                min_price=latest.min_price,
                max_price=latest.max_price,
                modal_price=latest.modal_price,
                previous=PreviousPrice(arrival_date=prev.arrival_date, modal_price=prev.modal_price) if prev else None,
                change=change,
                change_pct=change_pct,
                trend=trend,
            )
        )
    return out
