from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.models import AuditLog
from app.modules.vendors.models import VendorLicence
from tests.erp_helpers import API, headers
from tests.test_erp_vendors import complete_application, profile

ADMIN = f"{API}/admin/vendors"
CHECKED = {"gstin_checked": True, "documents_checked": True}


@pytest.fixture
def people(client, super_admin, invite, register, storage):
    """A Super Admin, an Ops user and a vendor with a submitted application."""
    admin = super_admin.login()
    ops = invite(admin, "ops@annadata.test").login()
    _, vendor = register()
    complete_application(client, vendor)
    assert client.post(f"{API}/vendor/submit", headers=headers(vendor)).status_code == 200
    vendor_id = client.get(f"{API}/vendor", headers=headers(vendor)).json()["id"]
    return admin, ops, vendor, vendor_id


def test_queue_shows_submitted_applications_oldest_first(client, people, register):
    admin, ops, _, vendor_id = people
    _, draft = register("draft@vendor.test", trade_name="Still Drafting")
    queue = client.get(ADMIN, headers=headers(ops)).json()
    assert [v["id"] for v in queue] == [vendor_id]  # drafts are not in the review queue
    assert queue[0]["district"] == "Guntur" and queue[0]["capabilities"] == ["drone_spraying", "seeds"]
    assert (
        client.get(ADMIN, headers=headers(admin), params={"status": "draft"}).json()[0]["trade_name"]
        == "Still Drafting"
    )
    assert client.get(ADMIN, headers=headers(admin), params={"q": "lakshmi"}).json()[0]["id"] == vendor_id
    assert client.get(ADMIN, headers=headers(admin), params={"district": "ap-krishna"}).json()[0]["id"] == vendor_id
    assert client.get(ADMIN, headers=headers(admin), params={"capability": "labour"}).json() == []
    counts = client.get(f"{ADMIN}/counts", headers=headers(admin)).json()
    assert counts["submitted"] == 1 and counts["draft"] == 1 and counts["approved"] == 0


def test_detail_has_contact_history_and_internal_notes(client, people):
    admin, ops, vendor, vendor_id = people
    detail = client.get(f"{ADMIN}/{vendor_id}", headers=headers(ops)).json()
    assert detail["members"][0]["email"] == "shop@vendor.test" and detail["members"][0]["role"] == "vendor_owner"
    assert [h["to_status"] for h in detail["history"]] == ["draft", "submitted"]
    assert detail["bank_account"]["account_masked"] == "XXXXXX9012"
    res = client.post(f"{ADMIN}/{vendor_id}/notes", headers=headers(ops), json={"text": "Called the owner, docs OK"})
    assert res.json()["notes"][0] == {
        "text": "Called the owner, docs OK",
        "by": "ops@annadata.test",
        "at": res.json()["notes"][0]["at"],
    }
    # The vendor never sees internal notes or the admin view
    assert "notes" not in client.get(f"{API}/vendor", headers=headers(vendor)).json()
    assert client.get(f"{ADMIN}/{vendor_id}", headers=headers(vendor)).status_code == 403


def test_only_super_admin_decides_and_ops_cannot_open_kyc_documents(client, people):
    admin, ops, _, vendor_id = people
    for action, body in (("start-review", None), ("approve", CHECKED), ("reject", {"reason": "Blurry PAN card copy"})):
        assert client.post(f"{ADMIN}/{vendor_id}/{action}", headers=headers(ops), json=body).status_code == 403
    doc_id = client.get(f"{ADMIN}/{vendor_id}", headers=headers(ops)).json()["pan_card_document"]["id"]
    assert client.post(f"{API}/documents/{doc_id}/view-link", headers=headers(ops)).status_code == 404
    assert client.post(f"{API}/documents/{doc_id}/view-link", headers=headers(admin)).status_code == 200


def test_approve_needs_the_checks_and_emails_the_vendor(client, people, mail):
    admin, _, vendor, vendor_id = people
    assert client.post(f"{ADMIN}/{vendor_id}/start-review", headers=headers(admin)).json()["status"] == "under_review"
    res = client.post(f"{ADMIN}/{vendor_id}/approve", headers=headers(admin), json={"documents_checked": True})
    assert res.json()["error"]["code"] == "checks_required"  # GSTIN not checked on the portal
    res = client.post(f"{ADMIN}/{vendor_id}/approve", headers=headers(admin), json=CHECKED | {"note": "All good"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "approved" and body["gstin_verified"]
    assert {c["status"] for c in body["capabilities"]} == {"approved"}
    assert body["history"][-1] == {
        "from_status": "under_review",
        "to_status": "approved",
        "reason": "All good",
        "by": "root@annadata.test",
        "at": body["history"][-1]["at"],
    }
    to, subject, text = mail.sent[-1]
    assert to == "shop@vendor.test" and "approved" in subject and "Drone spraying, Seeds" in text
    # Approved application stays locked for the vendor
    assert profile(client, vendor).json()["error"]["code"] == "application_locked"


def test_approve_some_offerings_only(client, people, mail):
    admin, _, vendor, vendor_id = people
    res = client.post(
        f"{ADMIN}/{vendor_id}/approve", headers=headers(admin), json=CHECKED | {"capabilities": ["seeds"]}
    )
    statuses = {c["code"]: c["status"] for c in res.json()["capabilities"]}
    assert statuses == {"seeds": "approved", "drone_spraying": "rejected"}
    assert "Not approved for now: Drone spraying" in mail.sent[-1][2]
    bad = client.post(
        f"{ADMIN}/{vendor_id}/approve", headers=headers(admin), json=CHECKED | {"capabilities": ["labour"]}
    )
    assert bad.status_code == 409  # already approved; and labour was never asked for


def test_approval_rechecks_licences_that_expired_after_submission(client, people, db_session):
    admin, _, _, vendor_id = people
    with db_session() as db:
        seed = db.scalar(select(VendorLicence).where(VendorLicence.licence_type == "seed_licence"))
        seed.valid_until = date.today() - timedelta(days=1)
        db.commit()
    res = client.post(f"{ADMIN}/{vendor_id}/approve", headers=headers(admin), json=CHECKED)
    assert res.json()["error"]["code"] == "application_incomplete"
    # Still possible to approve only the offerings whose licences are fine
    res = client.post(
        f"{ADMIN}/{vendor_id}/approve", headers=headers(admin), json=CHECKED | {"capabilities": ["drone_spraying"]}
    )
    assert res.json()["status"] == "approved"


def test_reject_lets_the_vendor_fix_and_resubmit(client, people, mail):
    admin, _, vendor, vendor_id = people
    assert (
        client.post(f"{ADMIN}/{vendor_id}/reject", headers=headers(admin), json={"reason": "short"}).status_code == 422
    )
    reason = "PAN card copy is blurry. Upload a clear scan."
    res = client.post(f"{ADMIN}/{vendor_id}/reject", headers=headers(admin), json={"reason": reason})
    assert res.json()["status"] == "rejected"
    assert reason in mail.sent[-1][2]
    mine = client.get(f"{API}/vendor", headers=headers(vendor)).json()
    assert mine["editable"] and mine["rejection_reason"] == reason
    assert profile(client, vendor, legal_name="Sri Lakshmi Agro Traders Private Limited").status_code == 200
    again = client.post(f"{API}/vendor/submit", headers=headers(vendor)).json()
    assert again["status"] == "submitted" and again["rejection_reason"] is None


def test_suspend_and_reinstate(client, people, mail):
    admin, _, _, vendor_id = people
    reason = {"reason": "Complaints about fake seed packets"}
    assert client.post(f"{ADMIN}/{vendor_id}/suspend", headers=headers(admin), json=reason).json()["error"]["code"] == (
        "invalid_status_change"  # only approved vendors can be suspended
    )
    client.post(f"{ADMIN}/{vendor_id}/approve", headers=headers(admin), json=CHECKED)
    assert (
        client.post(f"{ADMIN}/{vendor_id}/suspend", headers=headers(admin), json=reason).json()["status"] == "suspended"
    )
    assert "suspended" in mail.sent[-1][1]
    res = client.post(
        f"{ADMIN}/{vendor_id}/reinstate", headers=headers(admin), json={"text": "Resolved after inspection"}
    )
    assert res.json()["status"] == "approved"
    assert [h["to_status"] for h in res.json()["history"]] == [
        "draft",
        "submitted",
        "approved",
        "suspended",
        "approved",
    ]


def test_every_decision_is_audited(client, people, db_session):
    admin, _, _, vendor_id = people
    client.post(f"{ADMIN}/{vendor_id}/start-review", headers=headers(admin))
    client.post(f"{ADMIN}/{vendor_id}/approve", headers=headers(admin), json=CHECKED)
    with db_session() as db:
        actions = list(
            db.scalars(select(AuditLog.action).where(AuditLog.target_type == "vendor").order_by(AuditLog.id))
        )
    assert actions[-2:] == ["erp.vendor.start_review", "erp.vendor.approve"]
