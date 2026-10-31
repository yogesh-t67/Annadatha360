"""Shared by the ERP tests. The fixtures that use these (mail, clock, super_admin, invite) are in conftest.py."""

import re
from datetime import date, timedelta

import pyotp

from app.modules.vendors import rules
from app.modules.vendors.verification import IfscInfo, PincodeInfo

PASSWORD = "Kh@rif-season-2026"
API = "/api/v1/erp"


class FakeEmail:
    def __init__(self):
        self.sent: list[tuple[str, str, str]] = []

    def send(self, to: str, subject: str, body: str) -> None:
        self.sent.append((to, subject, body))

    def last_token(self, to: str) -> str:
        body = next(b for t, _, b in reversed(self.sent) if t == to)
        return re.search(r"token=([\w-]+)", body).group(1)


class Account:
    """An ERP account that can log in (sets up the authenticator app on its first login)."""

    def __init__(self, client, clock, email):
        self.client, self.clock, self.email = client, clock, email
        self.secret: str | None = None
        self.backup_codes: list[str] = []

    def code(self) -> str:
        self.clock["t"] += 30
        return pyotp.TOTP(self.secret).at(self.clock["t"])

    def login(self, ip: str = "10.0.0.1") -> dict:
        res = self.client.post(
            f"{API}/auth/login", json={"email": self.email, "password": PASSWORD}, headers={"X-Real-IP": ip}
        )
        assert res.status_code == 200, res.text
        token = res.json()["mfa_token"]
        if res.json()["stage"] == "mfa_setup":
            self.secret = self.client.post(f"{API}/auth/mfa/setup", json={"mfa_token": token}).json()["secret"]
            res = self.client.post(
                f"{API}/auth/mfa/activate", json={"mfa_token": token, "code": self.code()}, headers={"X-Real-IP": ip}
            )
            self.backup_codes = res.json()["backup_codes"]
        else:
            res = self.client.post(
                f"{API}/auth/mfa/verify", json={"mfa_token": token, "code": self.code()}, headers={"X-Real-IP": ip}
            )
        assert res.status_code == 200, res.text
        return res.json()


def headers(session: dict) -> dict:
    return {"Authorization": f"Bearer {session['access_token']}"}


class FakeLookups:
    """IFSC and pincode answers for tests. Defaults: every IFSC is an SBI Guntur branch; pincodes starting 50 are in
    Hyderabad (Telangana), others in Guntur (AP). Set answers to None ("doesn't exist") or False ("service down")."""

    def __init__(self):
        self.ifsc_answers: dict = {}
        self.pincode_answers: dict = {}
        self.calls: list[tuple[str, str]] = []

    def ifsc(self, code: str):
        self.calls.append(("ifsc", code))
        if code in self.ifsc_answers:
            return self.ifsc_answers[code]
        return IfscInfo(bank="State Bank of India", branch="Guntur Main")

    def pincode(self, code: str):
        self.calls.append(("pincode", code))
        if code in self.pincode_answers:
            return self.pincode_answers[code]
        if code.startswith("50"):
            return PincodeInfo(state="TG", state_name="Telangana", districts=("Hyderabad",))
        return PincodeInfo(state="AP", state_name="Andhra Pradesh", districts=("Guntur",))


# ---------- Vendor application (used by the vendor, review, catalog and licence tests) ----------

PDF = b"%PDF-1.7\n%%EOF\n"
PAN = "AAACK1234F"  # company PAN (4th letter C)
GSTIN = "37" + PAN + "1Z" + rules.gstin_checksum("37" + PAN + "1Z")  # Andhra Pradesh
NEXT_YEAR = (date.today() + timedelta(days=365)).isoformat()


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
