from datetime import date, timedelta
from decimal import Decimal

import httpx
import pytest

from app.models import MarketPrice
from app.services.market import DataGovInClient, crop_for_commodity, parse_record, sync

TODAY = date.today()


def _rec(**kw):
    base = {
        "state": "Andhra Pradesh",
        "district": "Guntur",
        "market": "Guntur",
        "commodity": "Paddy(Dhan)(Common)",
        "variety": "Common",
        "grade": "FAQ",
        "arrival_date": TODAY.strftime("%d/%m/%Y"),
        "min_price": "2100",
        "max_price": "2300",
        "modal_price": "2200",
    }
    base.update(kw)
    return base


@pytest.mark.parametrize(
    "commodity,crop",
    [
        ("Paddy(Dhan)(Common)", "paddy"),
        ("Arhar (Tur/Red Gram)(Whole)", "red_gram"),
        ("Dry Chillies", "chilli"),
        ("Green Chilli", "chilli"),
        ("Groundnut pods (raw)", "groundnut"),
        ("Bengal Gram(Gram)(Whole)", "bengal_gram"),
        ("Black Gram (Urd Beans)(Whole)", "black_gram"),
        ("Castor Seed", "castor"),
        ("Bhindi(Ladies Finger)", None),
        # Real names seen in the live AP/TG feed (2026-10-16):
        ("Paddy(Common)", "paddy"),
        ("Red gram/Arhar/Tur(whole)", "red_gram"),
        ("Red gram split/Arhar dal/Tur dal", None),  # processed dal, not the crop
        ("Chili Red", "chilli"),
        ("Ground Nut Seed", "groundnut"),
        ("Rice", None),  # milled rice is not paddy
    ],
)
def test_commodity_mapping(commodity, crop):
    assert crop_for_commodity(commodity) == crop


def test_parse_record_rejects_bad_rows():
    assert parse_record(_rec())["modal_price"] == Decimal("2200")
    assert parse_record(_rec())["state"] == "AP"
    assert parse_record(_rec(state="Karnataka")) is None
    assert parse_record(_rec(modal_price="0")) is None
    assert parse_record(_rec(modal_price="NR")) is None
    assert parse_record(_rec(arrival_date="garbage")) is None
    assert parse_record(_rec(min_price="", max_price=None))["min_price"] is None


def _client(pages_by_state):
    calls = []

    def handler(request: httpx.Request):
        state = request.url.params["filters[state.keyword]"]
        offset = int(request.url.params["offset"])
        calls.append((state, offset))
        return httpx.Response(200, json={"records": pages_by_state.get(state, {}).get(offset, [])})

    return DataGovInClient("k", http=httpx.Client(transport=httpx.MockTransport(handler))), calls


def test_sync_paginates_upserts_and_dedupes(db_session, monkeypatch):
    monkeypatch.setattr(DataGovInClient, "PAGE_SIZE", 2)
    ap = {0: [_rec(), _rec(market="Tenali")], 2: [_rec(market="Tenali"), _rec(state="Andhra Pradesh", modal_price="x")]}
    client, calls = _client(
        {"Andhra Pradesh": ap, "Telangana": {0: [_rec(state="Telangana", district="Warangal", market="Enumamula")]}}
    )
    with db_session() as db:
        stats = sync(db, client, ["Andhra Pradesh", "Telangana"])
        assert stats["Andhra Pradesh"] == {"fetched": 4, "usable": 2, "inserted": 2, "updated": 0}
        assert stats["Telangana"]["inserted"] == 1
        # Full pages keep paging; the empty page at offset 4 ends it.
        assert [o for s, o in calls if s == "Andhra Pradesh"] == [0, 2, 4]

        # Re-sync with a corrected price updates rather than duplicates.
        client2, _ = _client({"Andhra Pradesh": {0: [_rec(modal_price="2250")]}})
        stats = sync(db, client2, ["Andhra Pradesh"])
        assert stats["Andhra Pradesh"] == {"fetched": 1, "usable": 1, "inserted": 0, "updated": 1}
        assert db.query(MarketPrice).count() == 3


def _price(db, days_ago, modal, **kw):
    row = dict(
        crop_code="paddy",
        commodity="Paddy(Dhan)(Common)",
        variety="Common",
        grade="FAQ",
        state="AP",
        district="Guntur",
        market="Guntur",
        arrival_date=TODAY - timedelta(days=days_ago),
        min_price=None,
        max_price=None,
        modal_price=Decimal(modal),
    )
    row.update(kw)
    db.add(MarketPrice(**row))


@pytest.fixture
def seeded(db_session):
    with db_session() as db:
        _price(db, 0, "2200")
        _price(db, 1, "2000")  # Guntur: +10% → up
        _price(db, 0, "2105", market="Tenali")
        _price(db, 2, "2100", market="Tenali")  # Tenali: +0.24% → flat
        _price(db, 3, "1900", market="Warangal", district="Warangal", state="TG")
        _price(db, 4, "2000", market="Warangal", district="Warangal", state="TG")  # down
        _price(db, 0, "2500", market="Nellore", district="Nellore")  # no previous
        _price(db, 30, "1800", market="Stale", district="Nellore")  # outside lookback
        _price(db, 0, "9000", crop_code="cotton", commodity="Cotton", market="Guntur")
        db.commit()


def test_prices_default_to_primary_crop_with_trend(login, client, seeded):
    headers, _ = login()
    client.patch(
        "/api/v1/farmers/me",
        headers=headers,
        json={"primary_crop_code": "paddy", "location": {"state": "TG", "district": "Warangal"}},
    )
    res = client.get("/api/v1/market/prices", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["as_of"] == TODAY.isoformat()
    by_market = {p["market"]: p for p in body["prices"]}
    assert set(by_market) == {"Guntur", "Tenali", "Warangal", "Nellore"}
    assert body["prices"][0]["market"] == "Warangal"  # farmer's district first

    g = by_market["Guntur"]
    assert (g["modal_price"], g["change"], g["change_pct"], g["trend"]) == (2200.0, 200.0, 10.0, "up")
    assert g["previous"] == {"arrival_date": (TODAY - timedelta(days=1)).isoformat(), "modal_price": 2000.0}
    assert by_market["Tenali"]["trend"] == "flat"
    assert by_market["Warangal"]["trend"] == "down"
    assert by_market["Nellore"]["trend"] is None and by_market["Nellore"]["previous"] is None
    assert g["unit"] == "quintal" and g["crop"]["code"] == "paddy"


def test_prices_filters(login, client, seeded):
    headers, _ = login()
    res = client.get("/api/v1/market/prices", headers=headers, params={"crop": "paddy", "state": "TG"})
    assert [p["market"] for p in res.json()["prices"]] == ["Warangal"]
    res = client.get("/api/v1/market/prices", headers=headers, params={"crop": "paddy", "district": "guntur"})
    assert {p["market"] for p in res.json()["prices"]} == {"Guntur", "Tenali"}
    res = client.get("/api/v1/market/prices", headers=headers, params={"category": "commercial"})
    assert [p["commodity"] for p in res.json()["prices"]] == ["Cotton"]


def test_prices_errors(login, client, seeded):
    headers, _ = login()
    assert client.get("/api/v1/market/prices", headers=headers).json()["error"]["code"] == "crop_required"
    res = client.get("/api/v1/market/prices", headers=headers, params={"crop": "durian"})
    assert res.json()["error"]["code"] == "unknown_crop"
    res = client.get("/api/v1/market/prices", headers=headers, params={"category": "spaceships"})
    assert res.json()["error"]["code"] == "unknown_category"
    res = client.get("/api/v1/market/prices", headers=headers, params={"crop": "paddy", "category": "cereal"})
    assert res.json()["error"]["code"] == "validation_error"


def test_no_data_is_empty_not_error(login, client):
    headers, _ = login()
    body = client.get("/api/v1/market/prices", headers=headers, params={"crop": "mango"}).json()
    assert body == {"as_of": None, "prices": []}


def test_fetch_retries_transient_failures():
    attempts, slept = [], []

    def handler(request: httpx.Request):
        attempts.append(1)
        if len(attempts) == 1:
            raise httpx.ReadTimeout("slow", request=request)
        if len(attempts) == 2:
            return httpx.Response(502)
        return httpx.Response(200, json={"records": [_rec()]})

    client = DataGovInClient("k", http=httpx.Client(transport=httpx.MockTransport(handler)), sleep=slept.append)
    assert len(client.fetch_state("Andhra Pradesh")) == 1
    assert slept == [2.0, 10.0]


def test_fetch_gives_up_after_retries():
    def handler(request: httpx.Request):
        raise httpx.ReadTimeout("slow", request=request)

    client = DataGovInClient("k", http=httpx.Client(transport=httpx.MockTransport(handler)), sleep=lambda _: None)
    with pytest.raises(RuntimeError, match="after 3 attempts"):
        client.fetch_state("Andhra Pradesh")
