"""Every ERP permission, and what each built-in role gets.

Roles live in code (reviewed in git, the same on every server); the database only stores who has which role.
The server checks a permission on every request — the web app hiding a button is never the protection.
"""

from dataclasses import dataclass
from enum import StrEnum


class P(StrEnum):
    # Platform (Annadata staff)
    USERS_MANAGE = "users.manage"
    AUDIT_VIEW = "audit.view"
    VENDORS_VIEW = "vendors.view"
    VENDORS_REVIEW = "vendors.review"
    KYC_DOCUMENTS_VIEW = "kyc.documents.view"
    CATALOG_REVIEW = "catalog.review"
    # Vendor portal
    VENDOR_PROFILE_EDIT = "vendor.profile.edit"
    VENDOR_KYC_SUBMIT = "vendor.kyc.submit"
    VENDOR_TEAM_MANAGE = "vendor.team.manage"
    VENDOR_CATALOG_EDIT = "vendor.catalog.edit"


@dataclass(frozen=True)
class Role:
    code: str
    scope: str  # "platform" (Annadata staff) | "vendor" (a vendor's own people)
    name: str
    permissions: frozenset[P]


_PLATFORM = frozenset(p for p in P if not p.startswith("vendor."))

ROLES: dict[str, Role] = {
    r.code: r
    for r in (
        Role("super_admin", "platform", "Super Admin", _PLATFORM),
        # Ops can see vendors and approve products, but not KYC documents or vendor approval (Super Admin only).
        Role("ops", "platform", "Operations", frozenset({P.VENDORS_VIEW, P.CATALOG_REVIEW})),
        Role(
            "vendor_owner",
            "vendor",
            "Vendor owner",
            frozenset({P.VENDOR_PROFILE_EDIT, P.VENDOR_KYC_SUBMIT, P.VENDOR_TEAM_MANAGE, P.VENDOR_CATALOG_EDIT}),
        ),
        Role("vendor_staff", "vendor", "Vendor staff", frozenset({P.VENDOR_CATALOG_EDIT})),
    )
}

PLATFORM_ROLES = tuple(code for code, r in ROLES.items() if r.scope == "platform")


def permissions_for(role_codes: list[str]) -> set[P]:
    return {p for code in role_codes if code in ROLES for p in ROLES[code].permissions}
