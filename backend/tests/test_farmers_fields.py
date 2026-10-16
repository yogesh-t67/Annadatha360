def test_profile_update_and_localised_crop(login, client):
    headers, _ = login()
    res = client.patch(
        "/api/v1/farmers/me",
        headers=headers,
        json={
            "name": "Ramesh",
            "preferred_language": "te",
            "primary_crop_code": "paddy",
            "location": {
                "state": "AP",
                "district": "Guntur",
                "mandal": "Tenali",
                "latitude": 16.24,
                "longitude": 80.64,
            },
        },
    )
    assert res.status_code == 200, res.text
    me = res.json()
    assert me["primary_crop"] == {"code": "paddy", "name": "వరి"}
    assert me["location"]["district"] == "Guntur"
    assert me["profile_complete"] is True

    # Partial location update keeps other location fields.
    res = client.patch("/api/v1/farmers/me", headers=headers, json={"location": {"village": "Kolakaluru"}})
    assert res.json()["location"]["district"] == "Guntur"
    assert res.json()["location"]["village"] == "Kolakaluru"


def test_profile_rejects_unknown_crop_and_language(login, client):
    headers, _ = login()
    res = client.patch("/api/v1/farmers/me", headers=headers, json={"primary_crop_code": "durian"})
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "unknown_crop"
    res = client.patch("/api/v1/farmers/me", headers=headers, json={"preferred_language": "fr"})
    assert res.json()["error"]["code"] == "validation_error"


def test_fields_crud(login, client):
    headers, _ = login()
    res = client.post(
        "/api/v1/fields",
        headers=headers,
        json={
            "name": "East plot",
            "crop_code": "cotton",
            "acreage": 2.5,
            "growth_stage": "sowing",
            "planted_on": "2026-07-01",
        },
    )
    assert res.status_code == 201, res.text
    field = res.json()
    assert field["acreage"] == 2.5  # number, not string
    assert field["crop"]["code"] == "cotton"

    fid = field["id"]
    res = client.patch(f"/api/v1/fields/{fid}", headers=headers, json={"growth_stage": "flowering"})
    assert res.json()["growth_stage"] == "flowering"
    assert res.json()["name"] == "East plot"

    assert len(client.get("/api/v1/fields", headers=headers).json()) == 1
    assert client.delete(f"/api/v1/fields/{fid}", headers=headers).status_code == 204
    res = client.get(f"/api/v1/fields/{fid}", headers=headers)
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "field_not_found"


def test_field_validation(login, client):
    headers, _ = login()
    res = client.post("/api/v1/fields", headers=headers, json={"name": "X", "acreage": -1})
    assert res.json()["error"]["code"] == "validation_error"
    res = client.post("/api/v1/fields", headers=headers, json={"name": "X", "acreage": 1, "growth_stage": "dancing"})
    assert res.json()["error"]["code"] == "validation_error"
    fid = client.post("/api/v1/fields", headers=headers, json={"name": "X", "acreage": 1}).json()["id"]
    res = client.patch(f"/api/v1/fields/{fid}", headers=headers, json={"acreage": None})
    assert res.status_code == 422


def test_fields_are_private_to_owner(login, client):
    owner, _ = login("9111111111")
    other, _ = login("9222222222")
    fid = client.post("/api/v1/fields", headers=owner, json={"name": "Mine", "acreage": 1}).json()["id"]

    assert client.get(f"/api/v1/fields/{fid}", headers=other).status_code == 404
    assert client.patch(f"/api/v1/fields/{fid}", headers=other, json={"name": "Stolen"}).status_code == 404
    assert client.delete(f"/api/v1/fields/{fid}", headers=other).status_code == 404
    assert client.get("/api/v1/fields", headers=other).json() == []


def test_crops_list_localised(client):
    crops = client.get("/api/v1/crops", params={"lang": "te"}).json()
    paddy = next(c for c in crops if c["code"] == "paddy")
    assert paddy["name"] == "వరి"
    # Languages without translations fall back to English.
    crops = client.get("/api/v1/crops", params={"lang": "hi"}).json()
    assert next(c for c in crops if c["code"] == "paddy")["name"] == "Paddy"
