"""What a vendor can offer, what each offering needs, and format checks for Indian business identifiers."""

import re
from dataclasses import dataclass

from app.services.districts import DISTRICTS


@dataclass(frozen=True)
class Capability:
    code: str
    name: str
    group: str  # "products" (cart + orders) | "rental" | "services" | "labour" (bookings)
    licences: tuple[str, ...] = ()  # licence types that must be on file, valid, before approval


CAPABILITIES: dict[str, Capability] = {
    c.code: c
    for c in (
        Capability("seeds", "Seeds", "products", ("seed_licence",)),
        Capability("fertilizers", "Fertilizers", "products", ("fertilizer_licence",)),
        Capability("pesticides", "Pesticides", "products", ("pesticide_licence",)),
        Capability("tools", "Farm tools and sprayers", "products"),
        Capability("irrigation", "Irrigation (pumps, drip, pipes)", "products"),
        Capability("equipment_sale", "Farm equipment for sale", "products"),
        Capability("animal_feed", "Animal feed", "products"),
        Capability("veterinary", "Veterinary medicines", "products", ("veterinary_drug_licence",)),
        Capability("dairy", "Dairy equipment and supplies", "products"),
        Capability("equipment_rental", "Equipment rental (tractor, harvester…)", "rental"),
        Capability("farm_services", "Farm services (ploughing, soil testing, transport)", "services"),
        Capability("drone_spraying", "Drone spraying", "services", ("drone_pilot_certificate", "drone_uin")),
        Capability("labour", "Labour teams", "labour"),
    )
}

# Licence type → document kind that proves it (kinds.DOCUMENT_KINDS)
LICENCE_TYPES: dict[str, str] = {
    "seed_licence": "Seed dealer licence (Seeds Control Order 1983)",
    "fertilizer_licence": "Fertilizer dealer authorisation (FCO 1985)",
    "pesticide_licence": "Pesticide sale licence (Insecticides Act 1968)",
    "veterinary_drug_licence": "Drug licence for veterinary medicines",
    "drone_pilot_certificate": "DGCA remote pilot certificate",
    "drone_uin": "DGCA drone registration (UIN)",
    "contract_labour_licence": "Contract labour licence",
    "vehicle_rc": "Vehicle registration (RC)",
}

# A labour contractor with this many workers or more needs a contract labour licence.
CONTRACT_LABOUR_THRESHOLD = 20

BUSINESS_TYPES = ("proprietorship", "partnership", "llp", "private_limited", "public_limited", "cooperative", "other")

# Only vendors registered in Andhra Pradesh (37) and Telangana (36) for now.
GST_STATE_CODES = {"37": "AP", "36": "TG"}


def district_code(name: str, state: str) -> str:
    return f"{state.lower()}-" + re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


DISTRICT_CODES: dict[str, tuple[str, str]] = {
    district_code(name, state): (name, state) for name, state, _, _ in DISTRICTS
}


# ---------- Identifier checks ----------

_PAN = re.compile(r"^[A-Z]{3}[ABCFGHJLPT][A-Z]\d{4}[A-Z]$")
_GSTIN = re.compile(r"^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")
_IFSC = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")
_GST_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def valid_pan(pan: str) -> bool:
    return bool(_PAN.match(pan))


def pan_is_individual(pan: str) -> bool:
    return pan[3] == "P"  # 4th character: P = person, C = company, F = firm…


def gstin_checksum(first14: str) -> str:
    total = 0
    for i, ch in enumerate(first14):
        product = _GST_CHARS.index(ch) * (2 if i % 2 else 1)
        total += product // 36 + product % 36
    return _GST_CHARS[(36 - total % 36) % 36]


def valid_gstin(gstin: str) -> bool:
    return bool(_GSTIN.match(gstin)) and gstin_checksum(gstin[:14]) == gstin[14]


def valid_ifsc(ifsc: str) -> bool:
    return bool(_IFSC.match(ifsc))


def valid_account_number(number: str) -> bool:
    return number.isdigit() and 9 <= len(number) <= 18


def valid_pincode(pincode: str) -> bool:
    # AP and Telangana pincodes start 50–53. Not split by state: some AP mandals (moved from Khammam) still use 50x.
    return len(pincode) == 6 and pincode.isdigit() and pincode[:2] in {"50", "51", "52", "53"}
