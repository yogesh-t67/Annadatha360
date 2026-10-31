"""Checking vendor details against outside sources.

Free lookups (always on):
- IFSC → bank and branch, from Razorpay's public IFSC directory.
- Pincode → state and postal district, from India Post data (api.postalpincode.in).
If a lookup service is down, the answer is "unknown" and the vendor is not blocked.

Paid verification (GSTIN active + legal name, PAN, bank account by penny drop) sits behind `KycVerifier`.
KYC_PROVIDER=manual (the default) means none is connected: the Super Admin checks by hand at approval.
To connect a provider, write one class with the three methods and return it from get_kyc_verifier().
"""

import logging
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Protocol

import httpx

from app.core.config import get_settings

log = logging.getLogger("annadata.kyc")

STATE_NAMES = {"Andhra Pradesh": "AP", "Telangana": "TG"}


@dataclass(frozen=True)
class IfscInfo:
    bank: str
    branch: str
    city: str | None = None
    state: str | None = None


@dataclass(frozen=True)
class PincodeInfo:
    state: str | None  # "AP" | "TG" | None (another state)
    state_name: str
    districts: tuple[str, ...]  # postal districts (may still use pre-2022 district names)


class Lookups(Protocol):
    def ifsc(self, code: str) -> IfscInfo | None | bool: ...
    def pincode(self, code: str) -> PincodeInfo | None | bool: ...


# Return values: the info when found; None when the code does not exist; False when the service couldn't answer.


class PublicLookups:
    def __init__(self, http: httpx.Client | None = None):
        settings = get_settings()
        self.http = http or httpx.Client(timeout=settings.lookup_timeout_seconds)
        self.ifsc_url = settings.ifsc_lookup_url.rstrip("/")
        self.pincode_url = settings.pincode_lookup_url.rstrip("/")

    def ifsc(self, code: str) -> IfscInfo | None | bool:
        try:
            res = self.http.get(f"{self.ifsc_url}/{code}")
            if res.status_code == 404:
                return None
            res.raise_for_status()
            data = res.json()
            return IfscInfo(
                bank=data.get("BANK") or "",
                branch=data.get("BRANCH") or "",
                city=data.get("CITY"),
                state=data.get("STATE"),
            )
        except (httpx.HTTPError, ValueError) as exc:
            log.warning("IFSC lookup failed for %s: %s", code, exc)
            return False

    def pincode(self, code: str) -> PincodeInfo | None | bool:
        try:
            res = self.http.get(f"{self.pincode_url}/pincode/{code}")
            res.raise_for_status()
            data = res.json()
            entry = data[0] if isinstance(data, list) and data else {}
            offices = entry.get("PostOffice") or []
            if entry.get("Status") != "Success" or not offices:
                return None
            state_name = offices[0].get("State") or ""
            districts = tuple(sorted({o.get("District") for o in offices if o.get("District")}))
            return PincodeInfo(state=STATE_NAMES.get(state_name), state_name=state_name, districts=districts)
        except (httpx.HTTPError, ValueError, AttributeError) as exc:
            log.warning("Pincode lookup failed for %s: %s", code, exc)
            return False


@lru_cache
def get_lookups() -> Lookups:
    return PublicLookups()


# ---------- Paid KYC verification (not connected yet) ----------


@dataclass
class CheckResult:
    check: str  # "gstin" | "pan" | "bank_account"
    status: str  # "verified" | "mismatch" | "invalid" | "error"
    summary: str  # one line for the admin, e.g. "Active · legal name matches"
    details: dict = field(default_factory=dict)  # provider's answer, minus anything secret


class KycVerifier(Protocol):
    name: str

    def verify_gstin(self, gstin: str, legal_name: str | None) -> CheckResult | None: ...
    def verify_pan(self, pan: str, name: str | None) -> CheckResult | None: ...
    def verify_bank_account(self, account_number: str, ifsc: str, holder_name: str) -> CheckResult | None: ...


class ManualVerifier:
    """No provider connected: every method returns None ("not checked automatically")."""

    name = "manual"

    def verify_gstin(self, gstin: str, legal_name: str | None) -> CheckResult | None:
        return None

    def verify_pan(self, pan: str, name: str | None) -> CheckResult | None:
        return None

    def verify_bank_account(self, account_number: str, ifsc: str, holder_name: str) -> CheckResult | None:
        return None


def get_kyc_verifier() -> KycVerifier:
    provider = get_settings().kyc_provider
    if provider == "manual":
        return ManualVerifier()
    raise RuntimeError(f"Unknown KYC_PROVIDER: {provider}")
