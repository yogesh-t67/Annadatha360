from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.main import app
from app.modules.documents.storage import LocalEncryptedStorage, get_document_storage
from app.modules.vendors import rules
from app.modules.vendors.models import VendorBankAccount
from tests.erp_helpers import API, PASSWORD, Account, headers

PDF = b"%PDF-1.7\n%%EOF\n"
PAN = "AAACK1234F"  # company PAN (4th letter C)
GSTIN = "37" + PAN + "1Z" + rules.gstin_checksum("37" + PAN + "1Z")  # Andhra Pradesh
NEXT_YEAR = (date.today() + timedelta(days=365)).isoformat()


@pytest.fixture(autouse=True)
def storage(client, tmp_path):
    s = LocalEncryptedStorage(tmp_path)
    app.dependency_overrides[get_document_storage] = lambda: s
    return s


@pytest.fixture
def register(client, mail, clock):
    """Signs a vendor up, follows the email link to set a password, logs in. Returns (Account, session)."""

    def _register(email="shop@vendor.test", kind="business", trade_name="Sri Lakshmi Agro"):
        body = {
            "email": email,
            "full_name": "Ravi Kumar",
            "phone": "9876543210",
            "kind": kind,
            "trade_name": trade_name,
        }
        assert client.post(f"{API}/vendors/register", json=body).status_code == 202
        token = mail.last_token(email)
        assert client.post(f"{API}/auth/invite/accept", json={"token": token, "password": PASSWORD}).status_code == 204
        account = Account(client, clock, email)
        return account, account.login()

    return _register


def upload(client, session, kind):
    res = client.post(
        f"{API}/documents",
        headers=headers(session),
        data={"kind": kind},
        files={"file": ("f.pdf", PDF, "application/pdf")},
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


def profile(client, session, **changes):
    body = {
        "kind": "business",
        "trade_name": "Sri Lakshmi Agro",
        "legal_name": "Sri Lakshmi Agro Traders Pvt Ltd",
        "business_type": "private_limited",
        "gstin": GSTIN,
        "pan": PAN,
        "address_line": "12-3 Main Road",
        "district_code": "ap-guntur",
        "pincode": "522001",
        "contact_phone": "9876543210",
    } | changes
    return client.put(f"{API}/vendor/profile", headers=headers(session), json=body)


def licence(client, session, licence_type, with_document=True, valid_until=NEXT_YEAR):
    body = {"licence_type": licence_type, "number": "lic-001", "valid_until": valid_until}
    if with_document:
        body["document_id"] = upload(client, session, licence_type)
    return client.post(f"{API}/vendor/licences", headers=headers(session), json=body)


def complete_application(client, s):
    assert (
        profile(
            client,
            s,
            gst_certificate_document_id=upload(client, s, "gst_certificate"),
            pan_card_document_id=upload(client, s, "pan_card"),
        ).status_code
        == 200
    )
    client.put(f"{API}/vendor/capabilities", headers=headers(s), json={"codes": ["seeds", "drone_spraying"]})
    client.put(f"{API}/vendor/service-areas", headers=headers(s), json={"district_codes": ["ap-guntur", "ap-krishna"]})
    bank = {
        "holder_name": "Sri Lakshmi Agro",
        "ifsc": "sbin0001234",
        "account_number": "123456789012",
        "cheque_document_id": upload(client, s, "cancelled_cheque"),
    }
    assert client.put(f"{API}/vendor/bank-account", headers=headers(s), json=bank).status_code == 200
    for t in ("seed_licence", "drone_pilot_certificate", "drone_uin"):
        assert licence(client, s, t).status_code == 201


# ---------- Identifier checks ----------


def test_gstin_checksum():
    assert rules.valid_gstin("27AAPFU0939F1ZV")  # a published sample GSTIN
    assert not rules.valid_gstin("27AAPFU0939F1ZX")  # one character changed
    assert rules.valid_gstin(GSTIN)


def test_pan_ifsc_pincode():
    assert rules.valid_pan("AAACK1234F") and rules.valid_pan("ABCPK1234F")
    assert not rules.valid_pan("ABCDE1234F")  # 4th letter must be a holder type
    assert rules.pan_is_individual("ABCPK1234F") and not rules.pan_is_individual(PAN)
    assert rules.valid_ifsc("SBIN0001234") and not rules.valid_ifsc("SBIN1001234")
    assert rules.valid_pincode("522001") and rules.valid_pincode("500001") and not rules.valid_pincode("400001")


# ---------- Sign-up ----------


def test_signup_sends_a_verify_link_and_starts_a_draft(client, register, mail):
    _, session = register()
    assert session["user"]["roles"] == ["vendor_owner"]
    assert "vendor.kyc.submit" in session["user"]["permissions"]
    assert "kyc.documents.view" not in session["user"]["permissions"]
    vendor = client.get(f"{API}/vendor", headers=headers(session)).json()
    assert vendor["status"] == "draft" and vendor["editable"]
    assert vendor["trade_name"] == "Sri Lakshmi Agro"
    assert {m["code"] for m in vendor["missing"]} >= {"gstin", "pan", "capabilities", "service_areas", "bank_account"}


def test_signup_with_an_existing_email_looks_the_same(client, register, mail):
    register()
    body = {
        "email": "SHOP@vendor.test",
        "full_name": "Someone Else",
        "phone": "9876543211",
        "kind": "individual",
        "trade_name": "Another Shop",
    }
    res = client.post(f"{API}/vendors/register", json=body)
    assert res.status_code == 202
    assert "already have an account" in mail.sent[-1][1]


def test_vendor_cannot_use_admin_endpoints_and_staff_have_no_vendor(client, register, super_admin):
    _, vendor = register()
    assert client.get(f"{API}/users", headers=headers(vendor)).status_code == 403
    assert client.get(f"{API}/audit", headers=headers(vendor)).status_code == 403
    admin = super_admin.login()
    assert client.get(f"{API}/vendor", headers=headers(admin)).json()["error"]["code"] == "not_a_vendor"


# ---------- The application ----------


def test_complete_application_can_be_submitted_and_then_locks(client, register, mail):
    _, s = register()
    complete_application(client, s)
    vendor = client.get(f"{API}/vendor", headers=headers(s)).json()
    assert vendor["missing"] == []
    assert vendor["state"] == "AP"
    assert [c["code"] for c in vendor["capabilities"]] == ["drone_spraying", "seeds"]
    assert [a["name"] for a in vendor["service_areas"]] == ["Guntur", "Krishna"]
    assert vendor["bank_account"]["account_masked"] == "XXXXXX9012"
    assert vendor["bank_account"]["ifsc"] == "SBIN0001234"
    assert vendor["gst_certificate_document"]["kind"] == "gst_certificate"

    res = client.post(f"{API}/vendor/submit", headers=headers(s))
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "submitted" and not res.json()["editable"]
    assert "application received" in mail.sent[-1][1]
    # Locked while Annadata reviews it
    assert profile(client, s).json()["error"]["code"] == "application_locked"
    assert client.post(f"{API}/vendor/submit", headers=headers(s)).json()["error"]["code"] == "application_locked"
    # Attached documents can't be deleted any more
    doc_id = vendor["pan_card_document"]["id"]
    assert client.delete(f"{API}/documents/{doc_id}", headers=headers(s)).json()["error"]["code"] == "document_locked"


def test_incomplete_application_lists_what_is_missing(client, register):
    _, s = register()
    res = client.post(f"{API}/vendor/submit", headers=headers(s))
    assert res.json()["error"]["code"] == "application_incomplete"
    assert any(item["code"] == "pan" for item in res.json()["error"]["details"])


def test_each_offering_asks_for_its_own_licence(client, register):
    _, s = register()
    client.put(
        f"{API}/vendor/capabilities",
        headers=headers(s),
        json={"codes": ["pesticides", "labour"], "labour_team_size": 25},
    )
    missing = {m["code"] for m in client.get(f"{API}/vendor", headers=headers(s)).json()["missing"]}
    assert {"licence:pesticide_licence", "licence:contract_labour_licence"} <= missing
    assert "licence:seed_licence" not in missing
    # Licence without a copy is still missing its document
    licence(client, s, "pesticide_licence", with_document=False)
    missing = {m["code"] for m in client.get(f"{API}/vendor", headers=headers(s)).json()["missing"]}
    assert "licence:pesticide_licence" not in missing and "licence_document:pesticide_licence" in missing
    # Small labour team: no contract labour licence needed
    client.put(f"{API}/vendor/capabilities", headers=headers(s), json={"codes": ["labour"], "labour_team_size": 8})
    missing = {m["code"] for m in client.get(f"{API}/vendor", headers=headers(s)).json()["missing"]}
    assert "licence:contract_labour_licence" not in missing


@pytest.mark.parametrize(
    ("changes", "field"),
    [
        ({"gstin": GSTIN[:-1] + ("A" if GSTIN[-1] != "A" else "B")}, "gstin"),  # checksum wrong
        ({"gstin": "27" + GSTIN[2:14] + rules.gstin_checksum("27" + GSTIN[2:14])}, "gstin"),  # Maharashtra
        ({"pan": "AAACK9999F"}, "pan"),  # doesn't match the GSTIN
        ({"pan": "ABCDE1234F"}, "pan"),
        ({"pincode": "400001"}, "pincode"),
        ({"district_code": "ka-bengaluru"}, "district_code"),
        ({"kind": "individual"}, "gstin"),  # individuals have no GSTIN
        ({"kind": "individual", "gstin": None}, "pan"),  # and need a personal PAN
    ],
)
def test_profile_checks(client, register, changes, field):
    _, s = register()
    res = profile(client, s, **changes)
    assert res.status_code == 422, res.text
    assert field in res.json()["error"]["details"]


def test_individual_vendor_without_gstin(client, register):
    _, s = register(kind="individual", trade_name="Ramesh Tractor Services")
    res = profile(client, s, kind="individual", gstin=None, pan="ABCPK1234F", business_type=None)
    assert res.status_code == 200, res.text
    missing = {m["code"] for m in res.json()["missing"]}
    assert "gstin" not in missing and "gst_certificate" not in missing


def test_one_gstin_one_vendor(client, register):
    _, a = register("a@vendor.test")
    _, b = register("b@vendor.test")
    assert profile(client, a).status_code == 200
    assert profile(client, b).json()["error"]["code"] == "gstin_taken"


def test_bank_account_number_is_encrypted_and_never_shown(client, register, db_session):
    _, s = register()
    body = {"holder_name": "X Y", "ifsc": "SBIN0001234", "account_number": "123456789012"}
    res = client.put(f"{API}/vendor/bank-account", headers=headers(s), json=body)
    assert "123456789012" not in res.text
    with db_session() as db:
        stored = db.scalar(select(VendorBankAccount))
        assert "123456789012" not in stored.account_number_enc and stored.account_last4 == "9012"
    bad = client.put(f"{API}/vendor/bank-account", headers=headers(s), json=body | {"ifsc": "SBIN1001234"})
    assert "ifsc" in bad.json()["error"]["details"]


def test_licence_checks(client, register):
    _, s = register()
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    assert licence(client, s, "seed_licence", valid_until=yesterday).json()["error"]["code"] == "licence_expired"
    wrong_doc = upload(client, s, "pan_card")
    body = {"licence_type": "seed_licence", "number": "SL-1", "valid_until": NEXT_YEAR, "document_id": wrong_doc}
    assert (
        client.post(f"{API}/vendor/licences", headers=headers(s), json=body).json()["error"]["code"]
        == "wrong_document_kind"
    )
    lic = licence(client, s, "seed_licence").json()["licences"][0]
    assert lic["number"] == "LIC-001" and not lic["expired"]
    res = client.delete(f"{API}/vendor/licences/{lic['id']}", headers=headers(s))
    assert res.json()["licences"] == []


def test_documents_are_private_to_their_vendor(client, register, super_admin):
    _, a = register("a@vendor.test")
    _, b = register("b@vendor.test")
    doc_a = upload(client, a, "pan_card")
    # Vendor B can't attach (or see) vendor A's document
    res = profile(client, b, pan_card_document_id=doc_a, gstin=None, kind="business")
    assert res.json()["error"]["code"] == "document_not_found"
    profile(client, a, gstin=None, pan_card_document_id=doc_a)
    assert client.get(f"{API}/documents/{doc_a}", headers=headers(b)).status_code == 404
    # Vendor A's team and Super Admin can
    assert client.get(f"{API}/documents/{doc_a}", headers=headers(a)).status_code == 200
    admin = super_admin.login()
    assert client.post(f"{API}/documents/{doc_a}/view-link", headers=headers(admin)).status_code == 200


def test_options_for_the_form(client):
    options = client.get(f"{API}/vendor-options").json()
    codes = {c["code"] for c in options["capabilities"]}
    assert {"seeds", "labour", "drone_spraying", "animal_feed", "veterinary"} <= codes
    assert len(options["districts"]) == len(rules.DISTRICT_CODES) >= 60
    assert {"code": "tg-hyderabad", "name": "Hyderabad", "state": "TG"} in options["districts"]
