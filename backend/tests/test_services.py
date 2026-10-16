import json
from datetime import date, timedelta
from pathlib import Path

import pytest

from app.jobs.load_providers import load
from app.models import ServiceOffering

SAMPLE = json.loads(
    (Path(__file__).parent.parent / "sample_data" / "providers.sample.json").read_text(encoding="utf-8")
)
TOMORROW = date.today() + timedelta(days=1)


@pytest.fixture
def providers(db_session):
    with db_session() as db:
        load(db, SAMPLE)
        return {(o.provider.code, o.service_type): o.id for o in db.query(ServiceOffering).all()}


@pytest.fixture
def farmer(login, client):
    headers, _ = login()
    client.patch(
        "/api/v1/farmers/me",
        headers=headers,
        json={"location": {"state": "TG", "district": "Warangal", "mandal": "Hanamkonda"}},
    )
    return headers


def test_provider_listing_filters_and_order(client, farmer, providers):
    res = client.get("/api/v1/services/providers", headers=farmer).json()
    assert res[0]["district"] == "Warangal"  # farmer's district first
    assert [p["name"] for p in res[1:]] == [
        "Sample tractor services (Guntur)",
        "Sample labour group (Guntur)",
    ]  # then rating

    labour = client.get("/api/v1/services/providers", headers=farmer, params={"kind": "labour"}).json()
    assert [p["kind"] for p in labour] == ["labour"]
    drone = client.get("/api/v1/services/providers", headers=farmer, params={"type": "drone_spraying"}).json()
    assert len(drone) == 1 and [o["service_type"] for o in drone[0]["offerings"]] == ["drone_spraying"]
    assert drone[0]["offerings"][0] == {
        "id": providers[("SAMPLE-DRONE-WARANGAL-1", "drone_spraying")],
        "service_type": "drone_spraying",
        "rate": 500.0,
        "unit": "acre",
        "daily_capacity": 25,
    }
    assert drone[0]["phone"] == "+919000000103"
    res = client.get("/api/v1/services/providers", headers=farmer, params={"type": "teleportation"})
    assert res.json()["error"]["code"] == "unknown_service_type"
    assert len(client.get("/api/v1/services/providers", headers=farmer, params={"district": "guntur"}).json()) == 2
    assert len(client.get("/api/v1/services/types", headers=farmer).json()) == 12


def test_booking_consumes_availability(client, farmer, providers):
    oid = providers[("SAMPLE-TRACTOR-GUNTUR-1", "tractor_ploughing")]  # capacity 8 acres/day
    res = client.post(
        "/api/v1/services/bookings",
        headers=farmer,
        json={"offering_id": oid, "date": TOMORROW.isoformat(), "quantity": 5},
    )
    assert res.status_code == 201, res.text
    b = res.json()
    assert (b["status"], b["unit"], b["rate"], b["estimated_total"]) == ("requested", "acre", 1500.0, 7500.0)

    avail = client.get(f"/api/v1/services/offerings/{oid}/availability", headers=farmer, params={"days": 3}).json()
    assert [d["remaining"] for d in avail["days"]] == [8, 3, 8]

    res = client.post(
        "/api/v1/services/bookings",
        headers=farmer,
        json={"offering_id": oid, "date": TOMORROW.isoformat(), "quantity": 4},
    )
    assert res.status_code == 409 and res.json()["error"]["details"] == {"remaining": 3}

    # Cancelling frees the capacity again.
    assert client.post(f"/api/v1/services/bookings/{b['id']}/cancel", headers=farmer).json()["status"] == "cancelled"
    avail = client.get(f"/api/v1/services/offerings/{oid}/availability", headers=farmer, params={"days": 2}).json()
    assert avail["days"][1]["remaining"] == 8
    assert (
        client.post(f"/api/v1/services/bookings/{b['id']}/cancel", headers=farmer).json()["error"]["code"]
        == "booking_not_cancellable"
    )


def test_booking_validation_and_privacy(client, farmer, providers, login):
    oid = providers[("SAMPLE-LABOUR-GUNTUR-1", "labour_harvesting")]
    post = lambda h, **kw: client.post(
        "/api/v1/services/bookings",
        headers=h,
        json={"offering_id": oid, "date": TOMORROW.isoformat(), "quantity": 2, **kw},
    )
    assert post(farmer, date=(date.today() - timedelta(days=1)).isoformat()).json()["error"]["code"] == "invalid_date"
    assert post(farmer, date=(date.today() + timedelta(days=61)).isoformat()).json()["error"]["code"] == "invalid_date"
    assert post(farmer, offering_id=9999).json()["error"]["code"] == "offering_not_found"
    assert post(farmer, field_id=9999).json()["error"]["code"] == "field_not_found"

    bid = post(farmer, notes="Bring sickles").json()["id"]
    other, _ = login("9777777777")
    assert client.get(f"/api/v1/services/bookings/{bid}", headers=other).json()["error"]["code"] == "booking_not_found"
    assert client.get("/api/v1/services/bookings", headers=other).json() == []
    assert [b["id"] for b in client.get("/api/v1/services/bookings", headers=farmer).json()] == [bid]


def test_reload_replaces_offerings(client, farmer, providers, db_session):
    changed = [
        dict(SAMPLE[1], offerings=[{"service_type": "tractor_rental", "rate_paise": 90000, "daily_capacity": 10}])
    ]
    with db_session() as db:
        assert load(db, changed) == (0, 1)
    tractor = next(
        p
        for p in client.get("/api/v1/services/providers", headers=farmer).json()
        if p["name"].startswith("Sample tractor")
    )
    assert [(o["service_type"], o["rate"]) for o in tractor["offerings"]] == [("tractor_rental", 900.0)]


@pytest.mark.parametrize(
    "bad,match",
    [
        ({"state": "KA"}, "state"),
        ({"offerings": [{"service_type": "drone_spraying", "rate_paise": 1, "daily_capacity": 1}]}, "not a labour"),
        ({"phone": "123"}, "mobile"),
    ],
)
def test_loader_validation(db_session, bad, match):
    with db_session() as db, pytest.raises(ValueError, match=match):
        load(db, [dict(SAMPLE[0], **bad)])


def test_labour_requirements(client, farmer, login):
    start = TOMORROW.isoformat()
    res = client.post(
        "/api/v1/labour/requirements",
        headers=farmer,
        json={"work_type": "harvesting", "workers_needed": 10, "start_date": start, "days": 3, "wage_per_day": 600},
    )
    assert res.status_code == 201, res.text
    r = res.json()
    assert (r["district"], r["mandal"], r["wage_per_day"], r["is_mine"], r["status"]) == (
        "Warangal",
        "Hanamkonda",
        600.0,
        True,
        "open",
    )
    assert r["contact_phone"] == "+919876543210"

    neighbour, _ = login("9888888888")
    client.patch("/api/v1/farmers/me", headers=neighbour, json={"location": {"state": "TG", "district": "warangal"}})
    seen = client.get("/api/v1/labour/requirements", headers=neighbour).json()
    assert [x["id"] for x in seen] == [r["id"]] and seen[0]["is_mine"] is False
    assert client.get("/api/v1/labour/requirements", headers=neighbour, params={"district": "Guntur"}).json() == []

    assert (
        client.post(
            f"/api/v1/labour/requirements/{r['id']}/close", headers=neighbour, json={"status": "filled"}
        ).status_code
        == 404
    )
    assert (
        client.post(f"/api/v1/labour/requirements/{r['id']}/close", headers=farmer, json={"status": "filled"}).json()[
            "status"
        ]
        == "filled"
    )
    assert client.get("/api/v1/labour/requirements", headers=neighbour).json() == []  # closed posts hidden
    assert [
        x["status"] for x in client.get("/api/v1/labour/requirements", headers=farmer, params={"mine": True}).json()
    ] == ["filled"]


def test_labour_requirement_needs_location(client, login):
    headers, _ = login("9123456780")
    res = client.post(
        "/api/v1/labour/requirements",
        headers=headers,
        json={"work_type": "weeding", "workers_needed": 2, "start_date": TOMORROW.isoformat(), "days": 1},
    )
    assert res.json()["error"]["code"] == "location_required"
    assert client.get("/api/v1/labour/requirements", headers=headers).json()["error"]["code"] == "location_required"
