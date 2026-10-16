import json
from pathlib import Path

import pytest

from app.jobs.load_schemes import load

SAMPLE = json.loads((Path(__file__).parent.parent / "sample_data" / "schemes.sample.json").read_text(encoding="utf-8"))


def _scheme(slug, **kw):
    base = {
        "slug": slug, "authority": "central", "state": None, "category": "other",
        "name": {"en": f"Scheme {slug}", "te": f"పథకం {slug}"}, "summary": {"en": "Summary"},
        "source_url": "https://example.gov.in", "last_verified_on": "2026-10-01", "published": True,
    }
    base.update(kw)
    return base


@pytest.fixture
def schemes(db_session):
    with db_session() as db:
        load(db, SAMPLE + [_scheme("draft", published=False)])


def _slugs(res):
    return [s["slug"] for s in res.json()]


def test_state_filtering_defaults_to_farmer_state(login, client, schemes):
    headers, _ = login()
    everything = {"sample-central-income-support", "sample-ap-small-farmer-subsidy", "sample-tg-chilli-scheme"}
    assert set(_slugs(client.get("/api/v1/schemes", headers=headers))) == everything  # no state set → all, no drafts

    client.patch("/api/v1/farmers/me", headers=headers, json={"location": {"state": "TG"}})
    assert set(_slugs(client.get("/api/v1/schemes", headers=headers))) == {"sample-central-income-support", "sample-tg-chilli-scheme"}
    res = client.get("/api/v1/schemes", headers=headers, params={"state": "AP", "authority": "state"})
    assert _slugs(res) == ["sample-ap-small-farmer-subsidy"]
    assert _slugs(client.get("/api/v1/schemes", headers=headers, params={"q": "chilli"})) == ["sample-tg-chilli-scheme"]


def test_possibly_eligible_hint(login, client, schemes):
    headers, _ = login()
    elig = lambda: {s["slug"]: s["possibly_eligible"] for s in client.get("/api/v1/schemes", headers=headers).json()}  # noqa: E731
    first = elig()
    assert first["sample-central-income-support"] is True  # no limits
    assert first["sample-ap-small-farmer-subsidy"] is None  # land limit, but no fields yet
    assert first["sample-tg-chilli-scheme"] is None  # crop limit, but no crops known

    client.post("/api/v1/fields", headers=headers, json={"name": "A", "acreage": 3, "crop_code": "paddy"})
    client.post("/api/v1/fields", headers=headers, json={"name": "B", "acreage": 3, "crop_code": "chilli"})
    second = elig()
    assert second["sample-ap-small-farmer-subsidy"] is False  # 6 acres > 5
    assert second["sample-tg-chilli-scheme"] is True
    assert list(second)[-1] == "sample-ap-small-farmer-subsidy"  # likely-ineligible sorted last


def test_detail_localised_and_drafts_hidden(login, client, schemes, db_session):
    headers, _ = login()
    with db_session() as db:
        load(db, [_scheme("pm-x", eligibility=[{"en": "Small farmers", "te": "చిన్న రైతులు"}], steps=[{"en": "Apply online"}])])
    client.patch("/api/v1/farmers/me", headers=headers, json={"preferred_language": "te"})
    s = client.get("/api/v1/schemes/pm-x", headers=headers).json()
    assert s["name"] == "పథకం pm-x" and s["summary"] == "Summary"  # te, English fallback
    assert s["eligibility"] == ["చిన్న రైతులు"] and s["steps"] == ["Apply online"]
    assert s["source_url"] == "https://example.gov.in" and s["last_verified_on"] == "2026-10-01"
    assert client.get("/api/v1/schemes/draft", headers=headers).json()["error"]["code"] == "scheme_not_found"


@pytest.mark.parametrize(
    "bad,match",
    [
        ({"source_url": ""}, "missing"),
        ({"authority": "state"}, "state schemes need state"),
        ({"state": "AP"}, "central schemes must not"),
        ({"name": {"te": "పేరు"}}, "English"),
    ],
)
def test_loader_validation(db_session, bad, match):
    with db_session() as db, pytest.raises(ValueError, match=match):
        load(db, [_scheme("x", **bad)])
