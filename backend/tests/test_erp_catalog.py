import pytest

from app.core.config import get_settings
from tests.erp_helpers import API, PASSWORD, Account, headers

CAT = f"{API}/catalog/listings"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64

SEED = {
    "category": "seeds",
    "name": {"en": "BPT 5204 Paddy Seed", "te": "బీపీటీ 5204 వరి విత్తనం"},
    "brand": "Sri Lakshmi",
    "attributes": {"variety": "BPT 5204 (Samba Mahsuri)", "crop": "Paddy"},
    "crop_codes": ["paddy"],
    "variants": [
        {"label": "10 kg bag", "unit": "pack", "mrp_paise": 120000, "price_paise": 99000, "stock_qty": 40},
        {"label": "25 kg bag", "unit": "pack", "mrp_paise": 280000, "price_paise": 240000, "stock_qty": 10},
    ],
}
DRONE = {
    "category": "drone_spraying",
    "item_type": "drone_spraying",
    "name": {"en": "Drone spraying for paddy and cotton"},
    "district_codes": ["ap-guntur"],
    "variants": [{"label": "Per acre", "unit": "acre", "price_paise": 50000, "daily_capacity": 30}],
}


def test_listing_goes_live_at_once(client, shop):
    vendor, _ = shop
    res = client.post(CAT, headers=headers(vendor), json=SEED)
    assert res.status_code == 201, res.text
    listing = res.json()
    assert listing["kind"] == "product" and listing["approval_status"] == "live"
    assert listing["visible_to_farmers"] and not listing["enquiry_only"]
    assert listing["district_codes"] == ["ap-guntur", "ap-krishna"]  # default: everywhere the vendor serves
    assert [v["discount_percent"] for v in listing["variants"]] == [18, 14]
    assert listing["name"] == {"en": "BPT 5204 Paddy Seed", "te": "బీపీటీ 5204 వరి విత్తనం"}
    assert [x["name"]["en"] for x in client.get(CAT, headers=headers(vendor)).json()] == ["BPT 5204 Paddy Seed"]


def test_services_have_rates_not_stock(client, shop):
    vendor, _ = shop
    listing = client.post(CAT, headers=headers(vendor), json=DRONE).json()
    assert listing["kind"] == "service" and listing["item_type_name"] == "Drone spraying"
    assert listing["variants"][0] == listing["variants"][0] | {
        "unit": "acre",
        "mrp_paise": None,
        "stock_qty": None,
        "daily_capacity": 30,
    }


def test_only_approved_offerings_can_be_listed(client, shop):
    vendor, _ = shop
    res = client.post(CAT, headers=headers(vendor), json=SEED | {"category": "pesticides"})
    assert res.json()["error"]["code"] == "category_not_approved"
    options = client.get(f"{API}/catalog/options", headers=headers(vendor)).json()
    assert [c["code"] for c in options["categories"]] == ["drone_spraying", "seeds"]
    assert {a["key"] for a in options["categories"][1]["attributes"]} >= {"variety", "crop"}


def test_vendor_must_be_approved_first(client, register, storage, media):
    _, draft = register("new@vendor.test")
    assert client.post(CAT, headers=headers(draft), json=SEED).json()["error"]["code"] == "vendor_not_approved"


@pytest.mark.parametrize(
    ("change", "field"),
    [
        ({"attributes": {"crop": "Paddy"}}, "attributes.variety"),  # required detail missing
        ({"attributes": {"variety": "x", "crop": "y", "colour": "red"}}, "attributes.colour"),
        (
            {"variants": [{"label": "1 kg", "unit": "pack", "mrp_paise": 100, "price_paise": 200, "stock_qty": 1}]},
            "variants.0.price_paise",
        ),
        (
            {"variants": [{"label": "1 kg", "unit": "acre", "mrp_paise": 100, "price_paise": 50, "stock_qty": 1}]},
            "variants.0.unit",
        ),
        ({"variants": [{"label": "1 kg", "unit": "pack", "price_paise": 50, "stock_qty": 1}]}, "variants.0.mrp_paise"),
        ({"district_codes": ["tg-hyderabad"]}, "district_codes"),  # vendor doesn't serve Hyderabad
        ({"crop_codes": ["dragonfruit"]}, "crop_codes"),
        ({"item_type": "tractor"}, "item_type"),
    ],
)
def test_listing_checks(client, shop, change, field):
    vendor, _ = shop
    res = client.post(CAT, headers=headers(vendor), json=SEED | change)
    assert res.status_code == 422, res.text
    assert field in res.json()["error"]["details"]


def test_pesticides_need_registration_number():
    # A pesticide vendor would also need the licence; here we only check the listing rule.
    from app.modules.catalog.rules import ATTRIBUTES

    required = {a.key for a in ATTRIBUTES["pesticides"] if a.required}
    assert required == {"cib_registration_number", "technical_name"}


def test_expensive_products_become_enquiry_only(client, shop):
    vendor, _ = shop
    body = SEED | {
        "variants": [
            {"label": "1 unit", "unit": "pack", "mrp_paise": 9_000_000, "price_paise": 8_500_000, "stock_qty": 1}
        ]
    }
    assert client.post(CAT, headers=headers(vendor), json=body).json()["enquiry_only"]


def test_edit_keeps_variant_ids_and_hide_show_delete(client, shop):
    vendor, _ = shop
    listing = client.post(CAT, headers=headers(vendor), json=SEED).json()
    small = listing["variants"][0]
    edited = SEED | {"variants": [{**SEED["variants"][0], "id": small["id"], "price_paise": 95000, "stock_qty": 0}]}
    res = client.put(f"{CAT}/{listing['id']}", headers=headers(vendor), json=edited).json()
    assert [(v["id"], v["price_paise"]) for v in res["variants"]] == [(small["id"], 95000)]  # 25 kg bag removed
    hidden = client.post(f"{CAT}/{listing['id']}/hide", headers=headers(vendor)).json()
    assert not hidden["active"] and not hidden["visible_to_farmers"]
    assert client.post(f"{CAT}/{listing['id']}/show", headers=headers(vendor)).json()["visible_to_farmers"]
    assert client.delete(f"{CAT}/{listing['id']}", headers=headers(vendor)).status_code == 204
    assert client.get(f"{CAT}/{listing['id']}", headers=headers(vendor)).status_code == 404


def test_photos_are_public(client, shop, media, tmp_path):
    vendor, _ = shop
    listing = client.post(CAT, headers=headers(vendor), json=SEED).json()
    res = client.post(
        f"{CAT}/{listing['id']}/images", headers=headers(vendor), files={"file": ("p.png", PNG, "image/png")}
    )
    assert res.status_code == 201, res.text
    image = res.json()["images"][0]
    photo = client.get(image["url"])  # no login needed
    assert photo.status_code == 200 and photo.content == PNG
    assert "immutable" in photo.headers["cache-control"]
    pdf = client.post(
        f"{CAT}/{listing['id']}/images", headers=headers(vendor), files={"file": ("x.pdf", b"%PDF-1.7", "image/png")}
    )
    assert pdf.json()["error"]["code"] == "unsupported_file_type"
    assert client.get("/api/v1/media/catalog/..%2F..%2F.env").status_code == 404
    client.delete(f"{CAT}/{listing['id']}/images/{image['key']}", headers=headers(vendor))
    assert client.get(image["url"]).status_code == 404


def test_vendors_cannot_touch_each_others_listings(client, shop, register):
    vendor, _ = shop
    listing = client.post(CAT, headers=headers(vendor), json=SEED).json()
    _, other = register("other@vendor.test")
    assert client.get(f"{CAT}/{listing['id']}", headers=headers(other)).status_code == 403  # not approved yet
    assert client.get(f"{CAT}/{listing['id']}", headers={}).status_code == 401


def test_admin_takes_a_listing_down_and_vendor_is_told(client, shop, mail):
    vendor, admin = shop
    listing = client.post(CAT, headers=headers(vendor), json=SEED).json()
    url = f"{API}/admin/catalog/listings/{listing['id']}"
    res = client.post(f"{url}/remove", headers=headers(admin), json={"reason": "Photo shows a different brand"})
    assert res.json()["removed"] and not res.json()["visible_to_farmers"]
    assert res.json()["vendor_name"] == "Sri Lakshmi Agro"
    assert "taken down" in mail.sent[-1][1] and "different brand" in mail.sent[-1][2]
    mine = client.get(f"{CAT}/{listing['id']}", headers=headers(vendor)).json()
    assert mine["removed"] and mine["removed_reason"] == "Photo shows a different brand"
    # Editing doesn't bring it back; only Annadata can
    assert not client.put(f"{CAT}/{listing['id']}", headers=headers(vendor), json=SEED).json()["visible_to_farmers"]
    assert client.post(f"{url}/restore", headers=headers(admin)).json()["visible_to_farmers"]
    assert client.get(f"{API}/admin/catalog/listings", headers=headers(vendor)).status_code == 403


def test_approval_can_be_switched_on(client, shop, monkeypatch):
    vendor, admin = shop
    monkeypatch.setattr(get_settings(), "catalog_requires_approval", True)
    listing = client.post(CAT, headers=headers(vendor), json=SEED).json()
    assert listing["approval_status"] == "pending" and not listing["visible_to_farmers"]
    queue = client.get(f"{API}/admin/catalog/listings", headers=headers(admin), params={"pending": True}).json()
    assert [x["id"] for x in queue] == [listing["id"]]
    res = client.post(f"{API}/admin/catalog/listings/{listing['id']}/approve", headers=headers(admin))
    assert res.json()["visible_to_farmers"]


def test_suspended_vendor_listings_disappear(client, shop):
    vendor, admin = shop
    listing = client.post(CAT, headers=headers(vendor), json=SEED).json()
    vendor_id = client.get(f"{API}/vendor", headers=headers(vendor)).json()["id"]
    client.post(
        f"{API}/admin/vendors/{vendor_id}/suspend", headers=headers(admin), json={"reason": "Fake seed complaints"}
    )
    admin_view = client.get(f"{API}/admin/catalog/listings", headers=headers(admin)).json()
    assert admin_view[0]["id"] == listing["id"] and not admin_view[0]["visible_to_farmers"]
    assert client.get(CAT, headers=headers(vendor)).json()["error"]["code"] == "vendor_not_approved"


# ---------- Vendor team ----------


def test_owner_invites_staff_who_can_list_but_not_see_kyc(client, shop, mail, clock):
    vendor, _ = shop
    res = client.post(
        f"{API}/vendor/team", headers=headers(vendor), json={"email": "helper@vendor.test", "full_name": "Shop Helper"}
    )
    assert res.status_code == 201, res.text
    assert [m["role"] for m in res.json()] == ["vendor_owner", "vendor_staff"]
    token = mail.last_token("helper@vendor.test")
    assert client.post(f"{API}/auth/invite/accept", json={"token": token, "password": PASSWORD}).status_code == 204
    staff = Account(client, clock, "helper@vendor.test").login()
    assert staff["user"]["roles"] == ["vendor_staff"]

    assert client.post(CAT, headers=headers(staff), json=SEED).status_code == 201
    mine = client.get(f"{API}/vendor", headers=headers(staff)).json()
    pan_doc = mine["pan_card_document"]["id"]
    assert client.get(f"{API}/documents/{pan_doc}", headers=headers(staff)).status_code == 404  # KYC: owner only
    assert client.get(f"{API}/documents/{pan_doc}", headers=headers(vendor)).status_code == 200
    assert client.put(f"{API}/vendor/bank-account", headers=headers(staff), json={}).status_code in (403, 422)
    assert client.get(f"{API}/vendor/team", headers=headers(staff)).status_code == 403

    staff_id = res.json()[1]["id"]
    client.post(f"{API}/vendor/team/{staff_id}/disable", headers=headers(vendor))
    assert client.get(CAT, headers=headers(staff)).status_code == 401  # logged out at once


def test_owner_cannot_disable_themselves_through_team(client, shop):
    vendor, _ = shop
    owner_id = vendor["user"]["id"]
    assert client.post(f"{API}/vendor/team/{owner_id}/disable", headers=headers(vendor)).status_code == 404
