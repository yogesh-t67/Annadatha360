import json
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

import pytest

from app.jobs.load_advisories import load
from app.main import app
from app.models import MarketPrice
from app.services.weather import forecast_cache, get_weather_provider
from tests.test_weather import FakeProvider

SAMPLE = json.loads(
    (Path(__file__).parent.parent / "sample_data" / "advisories.sample.json").read_text(encoding="utf-8")
)


def _adv(slug, **kw):
    return {
        "slug": slug,
        "category": "general",
        "title": {"en": f"T {slug}", "te": f"శీర్షిక {slug}"},
        "body": {"en": "Body"},
        "source_url": "https://example.org",
        "last_verified_on": "2026-10-01",
        "published": True,
        **kw,
    }


@pytest.fixture
def advisories(db_session):
    with db_session() as db:
        load(
            db,
            SAMPLE
            + [
                _adv("cotton-flowering", crop_code="cotton", growth_stage="flowering"),
                _adv("any-crop-flowering", growth_stage="flowering"),
                _adv("draft", published=False),
            ],
        )


@pytest.fixture
def weather():
    forecast_cache.clear()
    app.dependency_overrides[get_weather_provider] = lambda: FakeProvider()
    yield
    forecast_cache.clear()


def test_targeting_by_field_crop_and_stage(login, client, advisories):
    headers, _ = login()
    slugs = lambda: [(a["slug"], a["relevance"]) for a in client.get("/api/v1/advisories", headers=headers).json()]
    assert slugs() == [("sample-general-monsoon", "general")]  # no crops, no fields → general only

    client.patch("/api/v1/farmers/me", headers=headers, json={"primary_crop_code": "paddy"})
    assert slugs() == [("sample-paddy-general", "your_crop"), ("sample-general-monsoon", "general")]

    client.post(
        "/api/v1/fields",
        headers=headers,
        json={"name": "A", "acreage": 1, "crop_code": "paddy", "growth_stage": "vegetative"},
    )
    client.post(
        "/api/v1/fields",
        headers=headers,
        json={"name": "B", "acreage": 1, "crop_code": "cotton", "growth_stage": "flowering"},
    )
    assert slugs() == [  # by relevance, then most recently verified
        ("sample-paddy-vegetative", "your_field"),
        ("cotton-flowering", "your_field"),
        ("sample-paddy-general", "your_crop"),
        ("any-crop-flowering", "general"),
        ("sample-general-monsoon", "general"),
    ]
    res = client.get("/api/v1/advisories", headers=headers, params={"category": "nutrition"}).json()
    assert [a["slug"] for a in res] == ["sample-paddy-vegetative"]


def test_detail(login, client, advisories):
    headers, _ = login()
    client.patch("/api/v1/farmers/me", headers=headers, json={"preferred_language": "te"})
    a = client.get("/api/v1/advisories/cotton-flowering", headers=headers).json()
    assert (a["title"], a["body"], a["crop"]["name"], a["relevance"]) == (
        "శీర్షిక cotton-flowering",
        "Body",
        "పత్తి",
        "general",
    )
    assert client.get("/api/v1/advisories/draft", headers=headers).json()["error"]["code"] == "advisory_not_found"


@pytest.mark.parametrize(
    "bad,match",
    [({"category": "magic"}, "category"), ({"crop_code": "durian"}, "crop"), ({"growth_stage": "teen"}, "stage")],
)
def test_loader_validation(db_session, bad, match):
    with db_session() as db, pytest.raises(ValueError, match=match):
        load(db, [_adv("x", **bad)])


def test_home_everything(login, client, advisories, weather, db_session):
    headers, _ = login()
    client.patch(
        "/api/v1/farmers/me",
        headers=headers,
        json={
            "primary_crop_code": "paddy",
            "location": {"state": "AP", "district": "Guntur", "latitude": 16.3, "longitude": 80.4},
        },
    )
    with db_session() as db:
        for days_ago, modal in ((0, "2200"), (1, "2000")):
            db.add(
                MarketPrice(
                    crop_code="paddy", commodity="Paddy(Dhan)(Common)", variety="", grade="", state="AP",
                    district="Guntur", market="Guntur", arrival_date=date.today() - timedelta(days=days_ago),
                    modal_price=Decimal(modal),
                )
            )  # fmt: skip
        db.commit()

    home = client.get("/api/v1/home", headers=headers).json()
    assert home["farmer"]["primary_crop"]["code"] == "paddy"
    assert home["weather"]["today"]["date"] == "2026-10-16"  # fake forecast's first day
    assert len(home["weather"]["alerts"]) == 7
    assert home["latest_advisory"]["slug"] == "sample-paddy-general"
    assert (home["primary_crop_price"]["modal_price"], home["primary_crop_price"]["trend"]) == (2200.0, "up")
    assert home["fields_count"] == 0


def test_home_degrades_gracefully(login, client):
    headers, _ = login()
    home = client.get("/api/v1/home", headers=headers).json()  # brand-new farmer, nothing set
    assert (home["weather"], home["latest_advisory"], home["primary_crop_price"]) == (None, None, None)

    class Down:
        def fetch_daily(self, *a):
            raise RuntimeError("down")

    app.dependency_overrides[get_weather_provider] = lambda: Down()
    forecast_cache.clear()
    client.patch("/api/v1/farmers/me", headers=headers, json={"location": {"latitude": 1, "longitude": 1}})
    res = client.get("/api/v1/home", headers=headers)
    assert res.status_code == 200 and res.json()["weather"] is None
