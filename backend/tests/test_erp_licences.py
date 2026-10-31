from datetime import date, timedelta

import pytest

from app.modules.vendors import rules
from app.modules.vendors.licences import _due_reminder, send_reminders
from tests.erp_helpers import API, NEXT_YEAR, headers, upload

CAT = f"{API}/catalog/listings"
EXPIRY = date.fromisoformat(NEXT_YEAR)  # the shop's licences all end on this day
SEED = {
    "category": "seeds",
    "name": {"en": "BPT 5204 Paddy Seed"},
    "attributes": {"variety": "BPT 5204", "crop": "Paddy"},
    "variants": [{"label": "10 kg bag", "unit": "pack", "mrp_paise": 120000, "price_paise": 99000, "stock_qty": 40}],
}
DRONE = {
    "category": "drone_spraying",
    "item_type": "drone_spraying",
    "name": {"en": "Drone spraying"},
    "variants": [{"label": "Per acre", "unit": "acre", "price_paise": 50000}],
}


@pytest.fixture
def calendar(monkeypatch):
    """Moves "today" for licence checks: calendar(days_before_expiry)."""

    def _set(days_before_expiry: int) -> date:
        day = EXPIRY - timedelta(days=days_before_expiry)
        monkeypatch.setattr(rules, "today", lambda: day)
        return day

    return _set


@pytest.fixture
def run_reminders(db_session, mail):
    def _run():
        with db_session() as db:
            return send_reminders(db, mail)

    return _run


def subjects(mail, to=None):
    return [subject for t, subject, _ in mail.sent if to is None or t == to]


def test_reminder_steps():
    assert _due_reminder(45, None) is None
    assert _due_reminder(30, None) == 30
    assert _due_reminder(30, 30) is None  # already sent today
    assert _due_reminder(14, 30) == 15  # a missed day still gets the 15-day reminder
    assert _due_reminder(3, 15) == 7
    assert _due_reminder(1, 7) == 1
    assert _due_reminder(1, 1) is None


def test_reminders_30_15_7_1_days_before(shop, mail, calendar, run_reminders):
    mail.sent.clear()
    calendar(31)
    assert run_reminders() == {"reminders": 0, "expired": 0}
    calendar(30)
    # seed licence + both drone papers
    assert run_reminders() == {"reminders": 3, "expired": 0}
    assert "Annadata 360: Seed dealer licence (Seeds Control Order 1983) expires in 30 days" in subjects(
        mail, "shop@vendor.test"
    )
    assert run_reminders()["reminders"] == 0  # same day again: nothing new
    for days in (15, 7, 1):
        calendar(days)
        assert run_reminders()["reminders"] == 3
    assert len(subjects(mail)) == 12


def test_expired_licence_hides_only_the_listings_that_need_it(client, shop, mail, calendar, run_reminders):
    vendor, _ = shop
    seed = client.post(CAT, headers=headers(vendor), json=SEED).json()
    tools = client.post(CAT, headers=headers(vendor), json=DRONE).json()
    assert seed["visible_to_farmers"] and tools["visible_to_farmers"]

    calendar(0)  # expiry day
    seed = client.get(f"{CAT}/{seed['id']}", headers=headers(vendor)).json()
    assert not seed["visible_to_farmers"]
    assert seed["hidden_reason"].startswith("Licence expired or missing: Seed dealer licence")
    # The drone papers expire the same day in this setup, so drone spraying hides too
    assert not client.get(f"{CAT}/{tools['id']}", headers=headers(vendor)).json()["visible_to_farmers"]

    mail.sent.clear()
    assert run_reminders()["expired"] == 3
    assert any("has expired" in s for s in subjects(mail, "shop@vendor.test"))
    assert any(s.startswith("Licence expired: Sri Lakshmi Agro") for s in subjects(mail, "root@annadata.test"))
    assert run_reminders()["expired"] == 0  # told once


def test_renewal_brings_listings_back_after_super_admin_checks_it(client, shop, mail, calendar, run_reminders):
    vendor, admin = shop
    listing = client.post(CAT, headers=headers(vendor), json=SEED).json()
    calendar(0)
    assert not client.get(f"{CAT}/{listing['id']}", headers=headers(vendor)).json()["visible_to_farmers"]

    new_until = (EXPIRY + timedelta(days=3 * 365)).isoformat()
    body = {
        "licence_type": "seed_licence",
        "number": "sl-2027-99",
        "valid_until": new_until,
        "document_id": upload(client, vendor, "seed_licence"),
    }
    res = client.post(f"{API}/vendor/licences/renewals", headers=headers(vendor), json=body)
    assert res.status_code == 201, res.text
    renewal = next(x for x in res.json()["licences"] if x["status"] == "pending_review")
    assert any("renewal to check" in s for s in subjects(mail, "root@annadata.test"))
    # Not trusted until checked
    assert not client.get(f"{CAT}/{listing['id']}", headers=headers(vendor)).json()["visible_to_farmers"]

    pending = client.get(f"{API}/admin/licences", headers=headers(admin)).json()
    assert [p["id"] for p in pending] == [renewal["id"]] and pending[0]["document_id"]
    url = f"{API}/admin/licences/{renewal['id']}/approve"
    assert client.post(url, headers=headers(admin), json={}).json()["error"]["code"] == "checks_required"
    assert client.post(url, headers=headers(admin), json={"documents_checked": True}).status_code == 200
    assert "renewed licence approved" in subjects(mail, "shop@vendor.test")[-1]

    assert client.get(f"{CAT}/{listing['id']}", headers=headers(vendor)).json()["visible_to_farmers"]
    statuses = {
        (x["number"], x["status"])
        for x in client.get(f"{API}/vendor", headers=headers(vendor)).json()["licences"]
        if x["licence_type"] == "seed_licence"
    }
    assert statuses == {("LIC-001", "superseded"), ("SL-2027-99", "valid")}


def test_rejected_renewal_keeps_listings_hidden(client, shop, mail, calendar):
    vendor, admin = shop
    listing = client.post(CAT, headers=headers(vendor), json=SEED).json()
    calendar(0)
    body = {
        "licence_type": "seed_licence",
        "number": "SL-1",
        "valid_until": (EXPIRY + timedelta(days=365)).isoformat(),
        "document_id": upload(client, vendor, "seed_licence"),
    }
    renewal = next(
        x
        for x in client.post(f"{API}/vendor/licences/renewals", headers=headers(vendor), json=body).json()["licences"]
        if x["status"] == "pending_review"
    )
    reason = {"reason": "The copy shows the old expiry date"}
    res = client.post(f"{API}/admin/licences/{renewal['id']}/reject", headers=headers(admin), json=reason)
    assert res.json()[0]["status"] == "rejected"
    assert "old expiry date" in mail.sent[-1][2]
    assert not client.get(f"{CAT}/{listing['id']}", headers=headers(vendor)).json()["visible_to_farmers"]
    mine = [
        x for x in client.get(f"{API}/vendor", headers=headers(vendor)).json()["licences"] if x["status"] == "rejected"
    ]
    assert mine[0]["review_reason"] == "The copy shows the old expiry date"


def test_renewal_rules(client, shop, register):
    vendor, _ = shop
    other = {"licence_type": "pesticide_licence", "number": "P-1", "valid_until": NEXT_YEAR}
    res = client.post(
        f"{API}/vendor/licences/renewals",
        headers=headers(vendor),
        json=other | {"document_id": upload(client, vendor, "pesticide_licence")},
    )
    assert res.json()["error"]["code"] == "unknown_licence"  # can only renew what's on file
    no_copy = {"licence_type": "seed_licence", "number": "S-2", "valid_until": NEXT_YEAR}
    assert client.post(f"{API}/vendor/licences/renewals", headers=headers(vendor), json=no_copy).status_code == 422
    _, draft = register("draft@vendor.test")
    body = no_copy | {"document_id": upload(client, draft, "seed_licence")}
    res = client.post(f"{API}/vendor/licences/renewals", headers=headers(draft), json=body)
    assert res.json()["error"]["code"] == "not_approved_yet"


def test_watch_list_and_summary(client, shop, invite, calendar):
    vendor, admin = shop
    calendar(20)
    summary = client.get(f"{API}/admin/licences/summary", headers=headers(admin)).json()
    assert summary == {"renewals_to_check": 0, "expiring_30_days": 3, "expired": 0}
    expiring = client.get(f"{API}/admin/licences", headers=headers(admin), params={"show": "expiring"}).json()
    assert {r["licence_type"] for r in expiring} == {"seed_licence", "drone_pilot_certificate", "drone_uin"}
    assert expiring[0]["days_left"] == 20 and expiring[0]["vendor_name"] == "Sri Lakshmi Agro"
    calendar(-1)
    expired = client.get(f"{API}/admin/licences", headers=headers(admin), params={"show": "expired"}).json()
    assert len(expired) == 3 and expired[0]["days_left"] == -1

    ops = invite(admin, "ops@annadata.test").login()
    assert client.get(f"{API}/admin/licences/summary", headers=headers(ops)).status_code == 200
    some_id = expired[0]["id"]
    assert client.post(f"{API}/admin/licences/{some_id}/approve", headers=headers(ops), json={}).status_code == 403
