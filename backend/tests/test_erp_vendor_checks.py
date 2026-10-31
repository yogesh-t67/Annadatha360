import httpx
import pytest

from app.main import app
from app.modules.vendors.verification import (
    CheckResult,
    IfscInfo,
    PincodeInfo,
    PublicLookups,
    get_kyc_verifier,
)
from tests.erp_helpers import API, headers
from tests.test_erp_vendors import complete_application, profile

BANK = {"holder_name": "Sri Lakshmi Agro", "ifsc": "SBIN0001234", "account_number": "123456789012"}


@pytest.fixture(autouse=True)
def _documents(storage):
    """Every test here uploads documents."""


# ---------- The public lookups themselves ----------


def _public(handler) -> PublicLookups:
    return PublicLookups(http=httpx.Client(transport=httpx.MockTransport(handler)))


def test_ifsc_lookup_reads_razorpay_directory():
    def handler(request):
        if request.url.path == "/SBIN0001234":
            return httpx.Response(200, json={"BANK": "State Bank of India", "BRANCH": "Guntur Main", "CITY": "GUNTUR"})
        if request.url.path == "/SBIN0009999":
            return httpx.Response(404, json="Not Found")
        return httpx.Response(503)

    lookups = _public(handler)
    assert lookups.ifsc("SBIN0001234") == IfscInfo(bank="State Bank of India", branch="Guntur Main", city="GUNTUR")
    assert lookups.ifsc("SBIN0009999") is None  # doesn't exist
    assert lookups.ifsc("HDFC0000001") is False  # service trouble: unknown


def test_pincode_lookup_reads_india_post_data():
    def handler(request):
        pin = request.url.path.rsplit("/", 1)[-1]
        if pin == "522001":
            offices = [
                {"District": "Guntur", "State": "Andhra Pradesh"},
                {"District": "Guntur", "State": "Andhra Pradesh"},
            ]
            return httpx.Response(200, json=[{"Status": "Success", "PostOffice": offices}])
        if pin == "560001":
            return httpx.Response(
                200, json=[{"Status": "Success", "PostOffice": [{"District": "Bangalore", "State": "Karnataka"}]}]
            )
        if pin == "529999":
            return httpx.Response(200, json=[{"Status": "Error", "PostOffice": None}])
        raise httpx.ConnectError("down")

    lookups = _public(handler)
    assert lookups.pincode("522001") == PincodeInfo(state="AP", state_name="Andhra Pradesh", districts=("Guntur",))
    assert lookups.pincode("560001").state is None
    assert lookups.pincode("529999") is None
    assert lookups.pincode("500001") is False


# ---------- IFSC when saving the bank account ----------


def test_bank_shows_bank_and_branch(client, register):
    _, s = register()
    bank = client.put(f"{API}/vendor/bank-account", headers=headers(s), json=BANK).json()["bank_account"]
    assert (bank["bank_name"], bank["branch"]) == ("State Bank of India", "Guntur Main")


def test_unknown_ifsc_is_refused(client, register, lookups):
    _, s = register()
    lookups.ifsc_answers["SBIN0001234"] = None
    res = client.put(f"{API}/vendor/bank-account", headers=headers(s), json=BANK)
    assert res.status_code == 422 and "ifsc" in res.json()["error"]["details"]


def test_ifsc_directory_down_does_not_block(client, register, lookups):
    _, s = register()
    lookups.ifsc_answers["SBIN0001234"] = False
    res = client.put(f"{API}/vendor/bank-account", headers=headers(s), json=BANK)
    assert res.status_code == 200 and res.json()["bank_account"]["bank_name"] is None


# ---------- Pincode when saving the address ----------


def test_pincode_gives_postal_district_and_is_looked_up_only_when_changed(client, register, lookups):
    _, s = register()
    assert profile(client, s).json()["postal_district"] == "Guntur"
    profile(client, s, legal_name="Another Legal Name Pvt Ltd")
    assert [c for c in lookups.calls if c[0] == "pincode"] == [("pincode", "522001")]


@pytest.mark.parametrize(
    ("answer", "message"),
    [
        (None, "doesn't exist"),
        (PincodeInfo(state=None, state_name="Karnataka", districts=("Bangalore",)), "Karnataka"),
        (PincodeInfo(state="TG", state_name="Telangana", districts=("Khammam",)), "district you chose"),
    ],
)
def test_bad_pincodes_are_refused(client, register, lookups, answer, message):
    _, s = register()
    lookups.pincode_answers["522001"] = answer
    res = profile(client, s)  # district: Guntur (AP)
    assert res.status_code == 422
    assert message in res.json()["error"]["details"]["pincode"]


def test_pincode_service_down_does_not_block(client, register, lookups):
    _, s = register()
    lookups.pincode_answers["522001"] = False
    res = profile(client, s)
    assert res.status_code == 200 and res.json()["postal_district"] is None


# ---------- Paid KYC connector ----------


class FakeVerifier:
    name = "fakekyc"

    def verify_gstin(self, gstin, legal_name):
        return CheckResult("gstin", "verified", "Active · legal name matches", {"status": "Active"})

    def verify_pan(self, pan, name):
        raise TimeoutError("provider slow")

    def verify_bank_account(self, account_number, ifsc, holder_name):
        assert account_number == "123456789012"  # the real number reaches the provider, nowhere else
        return CheckResult("bank_account", "mismatch", "Holder name at bank: S LAKSHMI TRADERS")


def _submit(client, register, super_admin):
    admin = super_admin.login()
    _, s = register()
    complete_application(client, s)
    assert client.post(f"{API}/vendor/submit", headers=headers(s)).status_code == 200
    vendor_id = client.get(f"{API}/vendor", headers=headers(s)).json()["id"]
    return client.get(f"{API}/admin/vendors/{vendor_id}", headers=headers(admin)).json()


def test_manual_mode_checks_nothing_automatically(client, register, super_admin):
    detail = _submit(client, register, super_admin)
    assert detail["kyc_provider"] == "manual" and detail["checks"] == []


def test_connected_provider_results_show_to_the_reviewer(client, register, super_admin):
    app.dependency_overrides[get_kyc_verifier] = lambda: FakeVerifier()
    detail = _submit(client, register, super_admin)
    checks = {c["check"]: (c["status"], c["summary"]) for c in detail["checks"]}
    assert checks == {
        "gstin": ("verified", "Active · legal name matches"),
        "pan": ("error", "Check failed: TimeoutError"),  # provider trouble never blocks the vendor
        "bank_account": ("mismatch", "Holder name at bank: S LAKSHMI TRADERS"),
    }
    assert {c["provider"] for c in detail["checks"]} == {"fakekyc"}
