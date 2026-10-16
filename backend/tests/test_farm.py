from datetime import date, timedelta

import pytest


@pytest.fixture
def setup(login, client):
    headers, _ = login()
    client.patch("/api/v1/farmers/me", headers=headers, json={"preferred_language": "te"})
    fid = client.post(
        "/api/v1/fields", headers=headers, json={"name": "East", "acreage": 2, "crop_code": "paddy"}
    ).json()["id"]
    return headers, fid


def _plan(client, headers, fid, **kw):
    body = {"crop_code": "paddy", "season": "kharif", "year": 2026, **kw}
    return client.post(f"/api/v1/fields/{fid}/plans", headers=headers, json=body)


def test_plan_tasks_harvest_summary(client, setup):
    headers, fid = setup
    sown = date.today() - timedelta(days=40)
    res = _plan(client, headers, fid, sowing_date=sown.isoformat(), status="active")
    assert res.status_code == 201, res.text
    plan = res.json()
    assert plan["crop"] == {"code": "paddy", "name": "వరి"} and plan["days_since_sowing"] == 40
    pid = plan["id"]

    t1 = client.post(
        f"/api/v1/plans/{pid}/tasks",
        headers=headers,
        json={"category": "fertilizer", "title": "Urea top dressing", "cost": 1200.5},
    ).json()
    client.post(
        f"/api/v1/plans/{pid}/tasks",
        headers=headers,
        json={"category": "labour", "title": "Transplanting labour", "cost": 4000, "done": True},
    )
    client.patch(f"/api/v1/plans/{pid}/tasks/{t1['id']}", headers=headers, json={"done": True, "cost": 1300})

    h = client.post(
        "/api/v1/harvests",
        headers=headers,
        json={
            "field_id": fid,
            "plan_id": pid,
            "harvest_date": date.today().isoformat(),
            "quantity": 50,
            "unit": "quintal",
            "sold_quantity": 40,
            "price_per_unit": 2200,
            "buyer": "Guntur mandi",
        },
    )
    assert h.status_code == 201, h.text
    assert (h.json()["revenue"], h.json()["crop"]["code"]) == (88000.0, "paddy")

    summary = client.get(f"/api/v1/plans/{pid}", headers=headers).json()["summary"]
    assert summary == {
        "total_cost": 5300.0,
        "revenue": 88000.0,
        "profit": 82700.0,
        "harvested": {"quintal": 50.0},
        "tasks_done": 2,
        "tasks_total": 2,
    }


def test_plan_validation_and_patch(client, setup):
    headers, fid = setup
    bad = _plan(client, headers, fid, sowing_date="2026-07-01", expected_harvest_date="2026-06-01")
    assert bad.json()["error"]["code"] == "validation_error"
    assert _plan(client, headers, fid, crop_code="durian").json()["error"]["code"] == "unknown_crop"
    assert _plan(client, headers, fid, season="monsoon").json()["error"]["code"] == "validation_error"

    pid = _plan(client, headers, fid, sowing_date="2026-07-01").json()["id"]
    res = client.patch(f"/api/v1/plans/{pid}", headers=headers, json={"expected_harvest_date": "2026-06-01"})
    assert res.json()["error"]["code"] == "validation_error"  # checked against the stored sowing date
    assert client.patch(f"/api/v1/plans/{pid}", headers=headers, json={"status": None}).status_code == 422
    assert (
        client.patch(f"/api/v1/plans/{pid}", headers=headers, json={"status": "harvested"}).json()["status"]
        == "harvested"
    )

    assert [p["id"] for p in client.get("/api/v1/plans", headers=headers, params={"field_id": fid}).json()] == [pid]
    assert client.get("/api/v1/plans", headers=headers, params={"status": "active"}).json() == []


def test_harvest_rules(client, setup):
    headers, fid = setup
    other_fid = client.post("/api/v1/fields", headers=headers, json={"name": "West", "acreage": 1}).json()["id"]
    pid = _plan(client, headers, fid).json()["id"]
    base = {"field_id": fid, "harvest_date": "2026-11-01", "quantity": 10, "unit": "quintal"}

    assert (
        client.post("/api/v1/harvests", headers=headers, json={**base, "sold_quantity": 11}).json()["error"]["code"]
        == "validation_error"
    )
    assert (
        client.post("/api/v1/harvests", headers=headers, json={**base, "field_id": other_fid, "plan_id": pid}).json()[
            "error"
        ]["code"]
        == "plan_field_mismatch"
    )
    assert (
        client.post("/api/v1/harvests", headers=headers, json={**base, "field_id": other_fid}).json()["error"]["code"]
        == "crop_required"
    )

    hid = client.post("/api/v1/harvests", headers=headers, json=base).json()["id"]  # crop from field
    assert client.patch(f"/api/v1/harvests/{hid}", headers=headers, json={"sold_quantity": 12}).status_code == 422
    res = client.patch(
        f"/api/v1/harvests/{hid}", headers=headers, json={"sold_quantity": 10, "price_per_unit": 2000.25}
    ).json()
    assert (res["revenue"], res["price_per_unit"]) == (20002.5, 2000.25)
    assert client.get("/api/v1/harvests", headers=headers, params={"field_id": fid}).json()[0]["id"] == hid


def test_deleting_plan_keeps_harvest(client, setup):
    headers, fid = setup
    pid = _plan(client, headers, fid).json()["id"]
    hid = client.post(
        "/api/v1/harvests",
        headers=headers,
        json={"field_id": fid, "plan_id": pid, "harvest_date": "2026-11-01", "quantity": 5, "unit": "kg"},
    ).json()["id"]
    assert client.delete(f"/api/v1/plans/{pid}", headers=headers).status_code == 204
    harvest = client.get("/api/v1/harvests", headers=headers).json()[0]
    assert (harvest["id"], harvest["plan_id"]) == (hid, None)


def test_privacy(client, setup, login):
    headers, fid = setup
    pid = _plan(client, headers, fid).json()["id"]
    tid = client.post(f"/api/v1/plans/{pid}/tasks", headers=headers, json={"category": "other", "title": "x"}).json()[
        "id"
    ]
    hid = client.post(
        "/api/v1/harvests",
        headers=headers,
        json={"field_id": fid, "harvest_date": "2026-11-01", "quantity": 5, "unit": "kg"},
    ).json()["id"]
    other, _ = login("9999999990")
    assert _plan(client, other, fid).json()["error"]["code"] == "field_not_found"
    assert client.get(f"/api/v1/plans/{pid}", headers=other).json()["error"]["code"] == "plan_not_found"
    assert client.patch(f"/api/v1/plans/{pid}/tasks/{tid}", headers=other, json={"done": True}).status_code == 404
    assert client.delete(f"/api/v1/harvests/{hid}", headers=other).status_code == 404
    assert (
        client.get("/api/v1/plans", headers=other).json() == []
        and client.get("/api/v1/harvests", headers=other).json() == []
    )
    # Task id from one plan can't be reached through another plan.
    pid2 = _plan(client, headers, fid).json()["id"]
    assert (
        client.delete(f"/api/v1/plans/{pid2}/tasks/{tid}", headers=headers).json()["error"]["code"] == "task_not_found"
    )
