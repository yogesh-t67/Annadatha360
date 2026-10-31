"""Vendors creating and editing listings. No approval by default: listings go live at once (see
CATALOG_REQUIRES_APPROVAL); Annadata can take one down afterwards."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError, not_found
from app.core.security import utcnow
from app.models import Crop
from app.modules.catalog import rules
from app.modules.catalog.models import CatalogListing, CatalogListingArea, CatalogVariant
from app.modules.catalog.schemas import ListingIn
from app.modules.iam.deps import Principal
from app.modules.vendors.licences import expired_licences_for
from app.modules.vendors.models import Vendor
from app.modules.vendors.rules import CAPABILITIES, LICENCE_TYPES


def selling_vendor(db: Session, principal: Principal) -> Vendor:
    """The logged-in person's vendor, which must be approved to list anything."""
    vendor = db.get(Vendor, principal.vendor_id) if principal.vendor_id is not None else None
    if vendor is None or vendor.deleted_at is not None:
        raise AppError(403, "not_a_vendor", "This account doesn't belong to a vendor")
    if vendor.status != "approved":
        raise AppError(403, "vendor_not_approved", "You can add listings once Annadata approves your application")
    return vendor


def approved_categories(vendor: Vendor) -> list[str]:
    return [c.code for c in vendor.capabilities if c.status == "approved"]


def get_own_listing(db: Session, vendor: Vendor, public_id: str) -> CatalogListing:
    listing = db.scalar(
        select(CatalogListing).where(
            CatalogListing.public_id == public_id,
            CatalogListing.vendor_id == vendor.id,
            CatalogListing.deleted_at.is_(None),
        )
    )
    if listing is None:
        raise not_found("listing")
    return listing


def _check(db: Session, vendor: Vendor, body: ListingIn) -> tuple[str, list[str]]:
    """Validates the form; returns (kind, district codes)."""
    errors: dict[str, str] = {}
    if body.category not in approved_categories(vendor):
        name = CAPABILITIES[body.category].name if body.category in CAPABILITIES else body.category
        raise AppError(403, "category_not_approved", f"Your account isn't approved to list {name}")
    kind = rules.kind_for(body.category)

    if kind == "product":
        if body.item_type is not None:
            errors["item_type"] = "Products don't have an item type"
    elif body.item_type not in rules.ITEM_TYPES.get(body.category, {}):
        errors["item_type"] = "Choose what you are offering"

    allowed = {a.key: a for a in rules.ATTRIBUTES.get(body.category, ())}
    for key in body.attributes:
        if key not in allowed:
            errors[f"attributes.{key}"] = "Not a detail for this category"
        elif len(body.attributes[key]) > 200:
            errors[f"attributes.{key}"] = "Too long"
    for attr in allowed.values():
        if attr.required and not (body.attributes.get(attr.key) or "").strip():
            errors[f"attributes.{attr.key}"] = f"{attr.label} is required"

    for i, v in enumerate(body.variants):
        if v.unit not in rules.UNITS[kind]:
            errors[f"variants.{i}.unit"] = f"Use one of: {', '.join(rules.UNITS[kind])}"
        if kind == "product":
            if v.mrp_paise is None:
                errors[f"variants.{i}.mrp_paise"] = "MRP is required"
            elif v.price_paise > v.mrp_paise:
                errors[f"variants.{i}.price_paise"] = "Selling price can't be more than MRP"
            if v.stock_qty is None:
                errors[f"variants.{i}.stock_qty"] = "Stock is required"
    labels = [v.label.strip().lower() for v in body.variants]
    if len(set(labels)) != len(labels):
        errors["variants"] = "Two pack sizes or rates have the same label"

    served = {a.district_code for a in vendor.service_areas}
    districts = sorted(served) if body.district_codes is None else sorted(set(body.district_codes))
    outside = [d for d in districts if d not in served]
    if outside:
        errors["district_codes"] = f"You don't serve: {', '.join(outside)}. Add them to your service areas first."
    if not districts:
        errors["district_codes"] = "Choose at least one district"

    if body.crop_codes:
        known = set(db.scalars(select(Crop.code).where(Crop.code.in_(body.crop_codes))))
        unknown = [c for c in body.crop_codes if c not in known]
        if unknown:
            errors["crop_codes"] = f"Unknown crop: {', '.join(unknown)}"
    if errors:
        raise AppError(422, "invalid_listing", "Some details need fixing", errors)
    return kind, districts


def _text(value) -> dict[str, str]:
    return {k: v.strip() for k, v in value.model_dump().items() if v and v.strip()}


def save(
    db: Session, principal: Principal, vendor: Vendor, body: ListingIn, listing: CatalogListing | None = None
) -> CatalogListing:
    kind, districts = _check(db, vendor, body)
    if listing is None:
        listing = CatalogListing(vendor_id=vendor.id, created_by_id=principal.user.id, image_keys=[])
        db.add(listing)
    listing.kind = kind
    listing.category = body.category
    listing.item_type = body.item_type
    listing.name = _text(body.name)
    listing.description = _text(body.description)
    listing.brand = (body.brand or "").strip() or None
    listing.attributes = {k: v.strip() for k, v in body.attributes.items() if v.strip()}
    listing.crop_codes = sorted(set(body.crop_codes))
    listing.enquiry_only = kind == "product" and max(v.price_paise for v in body.variants) > rules.ENQUIRY_ABOVE_PAISE
    listing.approval_status = "pending" if get_settings().catalog_requires_approval else "live"
    listing.updated_by_id = principal.user.id

    existing = {v.public_id: v for v in listing.variants}
    variants = []
    for i, v in enumerate(body.variants):
        row = existing.get(v.id) if v.id else None
        row = row or CatalogVariant()
        row.label, row.unit, row.sku = v.label.strip(), v.unit, (v.sku or "").strip() or None
        row.mrp_paise = v.mrp_paise if kind == "product" else None
        row.price_paise = v.price_paise
        row.stock_qty = v.stock_qty if kind == "product" else None
        row.daily_capacity = v.daily_capacity if kind != "product" else None
        row.sort_order = i
        variants.append(row)
    listing.variants = variants  # variants left out are removed (past orders keep their own copy, Phase 3)

    have = {a.district_code: a for a in listing.areas}
    listing.areas = [have.get(d) or CatalogListingArea(district_code=d) for d in districts]
    return listing


def hidden_reason(vendor: Vendor, listing: CatalogListing) -> str | None:
    """Why farmers can't see this listing, or None when they can. Licences are checked every time, so a listing
    hides itself the day a licence expires and comes back as soon as a renewal is approved."""
    if listing.deleted_at is not None:
        return "Deleted"
    if listing.removed_at is not None:
        return f"Taken down by Annadata: {listing.removed_reason}"
    if vendor.status != "approved":
        return "Your account is suspended" if vendor.status == "suspended" else "Your account isn't approved"
    if listing.category not in approved_categories(vendor):
        return "Your account isn't approved for this category"
    expired = expired_licences_for(vendor, listing.category)
    if expired:
        return "Licence expired or missing: " + ", ".join(LICENCE_TYPES[t] for t in expired) + ". Upload the renewal."
    if listing.approval_status != "live":
        return "Waiting for Annadata's approval"
    if not listing.active:
        return "Hidden by you"
    return None


def is_visible(vendor: Vendor, listing: CatalogListing) -> bool:
    return hidden_reason(vendor, listing) is None


def remove(listing: CatalogListing, actor_id: int, reason: str) -> None:
    if listing.removed_at is not None:
        raise AppError(409, "already_removed", "This listing is already taken down")
    listing.removed_at, listing.removed_reason, listing.removed_by_id = utcnow(), reason, actor_id


def restore(listing: CatalogListing) -> None:
    if listing.removed_at is None:
        raise AppError(409, "not_removed", "This listing is not taken down")
    listing.removed_at = listing.removed_reason = listing.removed_by_id = None
