from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select

from app.api.deps import DbSession
from app.core.config import get_settings
from app.core.errors import AppError, not_found
from app.core.security import utcnow
from app.modules.audit.service import record
from app.modules.catalog import rules, service
from app.modules.catalog.media import LocalMedia, get_media, media_url
from app.modules.catalog.models import CatalogListing, CatalogListingArea
from app.modules.catalog.schemas import (
    AdminListingOut,
    ImageOut,
    ListingIn,
    ListingOut,
    RemoveIn,
    VariantOut,
)
from app.modules.iam.deps import Principal, require
from app.modules.iam.permissions import P
from app.modules.iam.router import Email
from app.modules.vendors.models import Vendor
from app.modules.vendors.review import owner_emails
from app.modules.vendors.rules import CAPABILITIES

router = APIRouter(tags=["erp-catalog"])

Seller = Annotated[Principal, Depends(require(P.VENDOR_CATALOG_EDIT))]
CatalogAdmin = Annotated[Principal, Depends(require(P.CATALOG_REVIEW))]
Media = Annotated[LocalMedia, Depends(get_media)]


def listing_out(vendor: Vendor, listing: CatalogListing) -> ListingOut:
    item_types = rules.ITEM_TYPES.get(listing.category, {})
    return ListingOut(
        id=listing.public_id,
        kind=listing.kind,
        category=listing.category,
        category_name=CAPABILITIES[listing.category].name,
        item_type=listing.item_type,
        item_type_name=item_types.get(listing.item_type) if listing.item_type else None,
        name=listing.name,
        description=listing.description or {},
        brand=listing.brand,
        attributes=listing.attributes or {},
        crop_codes=listing.crop_codes or [],
        district_codes=[a.district_code for a in listing.areas],
        images=[ImageOut(key=k, url=media_url(k)) for k in listing.image_keys or []],
        variants=[
            VariantOut(
                id=v.public_id,
                label=v.label,
                unit=v.unit,
                sku=v.sku,
                mrp_paise=v.mrp_paise,
                price_paise=v.price_paise,
                discount_percent=round((v.mrp_paise - v.price_paise) * 100 / v.mrp_paise)
                if v.mrp_paise and v.mrp_paise > v.price_paise
                else None,
                stock_qty=v.stock_qty,
                daily_capacity=v.daily_capacity,
            )
            for v in listing.variants
        ],
        enquiry_only=listing.enquiry_only,
        active=listing.active,
        approval_status=listing.approval_status,
        removed=listing.removed_at is not None,
        removed_reason=listing.removed_reason,
        visible_to_farmers=service.is_visible(vendor, listing),
        hidden_reason=service.hidden_reason(vendor, listing),
        created_at=listing.created_at,
        updated_at=listing.updated_at,
    )


def _saved(db, principal, vendor, listing, request, action: str) -> ListingOut:
    record(db, action, "catalog_listing", listing.id, actor_id=principal.user.id, request=request)
    db.commit()
    db.refresh(listing)
    return listing_out(vendor, listing)


# ---------- Vendor: my listings ----------


@router.get("/erp/catalog/options")
def options(principal: Seller, db: DbSession):
    """What this vendor may list, with the fields each category needs."""
    vendor = service.selling_vendor(db, principal)
    return {
        "categories": [
            {
                "code": code,
                "name": CAPABILITIES[code].name,
                "kind": rules.kind_for(code),
                "units": list(rules.UNITS[rules.kind_for(code)]),
                "item_types": rules.ITEM_TYPES.get(code, {}),
                "attributes": [a.__dict__ for a in rules.ATTRIBUTES.get(code, ())],
            }
            for code in service.approved_categories(vendor)
        ],
        "district_codes": [a.district_code for a in vendor.service_areas],
        "enquiry_above_paise": rules.ENQUIRY_ABOVE_PAISE,
        "requires_approval": get_settings().catalog_requires_approval,
    }


@router.get("/erp/catalog/listings", response_model=list[ListingOut])
def my_listings(
    principal: Seller,
    db: DbSession,
    category: Annotated[str | None, Query(max_length=30)] = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
):
    vendor = service.selling_vendor(db, principal)
    query = select(CatalogListing).where(CatalogListing.vendor_id == vendor.id, CatalogListing.deleted_at.is_(None))
    if category:
        query = query.where(CatalogListing.category == category)
    rows = db.scalars(query.order_by(CatalogListing.updated_at.desc(), CatalogListing.id.desc())).all()
    if q:  # names are JSON in several languages; filter here (a vendor has hundreds of listings, not millions)
        term = q.strip().lower()
        rows = [r for r in rows if any(term in n.lower() for n in r.name.values()) or term in (r.brand or "").lower()]
    return [listing_out(vendor, r) for r in rows]


@router.post("/erp/catalog/listings", response_model=ListingOut, status_code=status.HTTP_201_CREATED)
def create_listing(body: ListingIn, principal: Seller, db: DbSession, request: Request):
    vendor = service.selling_vendor(db, principal)
    listing = service.save(db, principal, vendor, body)
    db.flush()
    return _saved(db, principal, vendor, listing, request, "erp.catalog.create")


@router.get("/erp/catalog/listings/{listing_id}", response_model=ListingOut)
def get_listing(listing_id: str, principal: Seller, db: DbSession):
    vendor = service.selling_vendor(db, principal)
    return listing_out(vendor, service.get_own_listing(db, vendor, listing_id))


@router.put("/erp/catalog/listings/{listing_id}", response_model=ListingOut)
def update_listing(listing_id: str, body: ListingIn, principal: Seller, db: DbSession, request: Request):
    vendor = service.selling_vendor(db, principal)
    listing = service.save(db, principal, vendor, body, service.get_own_listing(db, vendor, listing_id))
    return _saved(db, principal, vendor, listing, request, "erp.catalog.update")


@router.post("/erp/catalog/listings/{listing_id}/hide", response_model=ListingOut)
def hide_listing(listing_id: str, principal: Seller, db: DbSession, request: Request):
    vendor = service.selling_vendor(db, principal)
    listing = service.get_own_listing(db, vendor, listing_id)
    listing.active = False
    return _saved(db, principal, vendor, listing, request, "erp.catalog.hide")


@router.post("/erp/catalog/listings/{listing_id}/show", response_model=ListingOut)
def show_listing(listing_id: str, principal: Seller, db: DbSession, request: Request):
    vendor = service.selling_vendor(db, principal)
    listing = service.get_own_listing(db, vendor, listing_id)
    listing.active = True
    return _saved(db, principal, vendor, listing, request, "erp.catalog.show")


@router.delete("/erp/catalog/listings/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_listing(listing_id: str, principal: Seller, db: DbSession, media: Media, request: Request):
    vendor = service.selling_vendor(db, principal)
    listing = service.get_own_listing(db, vendor, listing_id)
    keys, listing.image_keys = list(listing.image_keys or []), []
    listing.deleted_at = utcnow()
    record(db, "erp.catalog.delete", "catalog_listing", listing.id, actor_id=principal.user.id, request=request)
    db.commit()
    for key in keys:
        media.delete(key)


@router.post(
    "/erp/catalog/listings/{listing_id}/images", response_model=ListingOut, status_code=status.HTTP_201_CREATED
)
def add_image(
    listing_id: str,
    principal: Seller,
    db: DbSession,
    media: Media,
    request: Request,
    file: Annotated[UploadFile, File(description="JPG, PNG or WebP photo")],
):
    vendor = service.selling_vendor(db, principal)
    listing = service.get_own_listing(db, vendor, listing_id)
    if len(listing.image_keys or []) >= rules.MAX_IMAGES:
        raise AppError(422, "too_many_images", f"Up to {rules.MAX_IMAGES} photos per listing")
    key = media.save_image(file.file.read(get_settings().media_max_mb * 1024 * 1024 + 1))
    listing.image_keys = [*(listing.image_keys or []), key]
    return _saved(db, principal, vendor, listing, request, "erp.catalog.image_add")


@router.delete("/erp/catalog/listings/{listing_id}/images/{key}", response_model=ListingOut)
def delete_image(listing_id: str, key: str, principal: Seller, db: DbSession, media: Media, request: Request):
    vendor = service.selling_vendor(db, principal)
    listing = service.get_own_listing(db, vendor, listing_id)
    if key not in (listing.image_keys or []):
        raise not_found("image")
    listing.image_keys = [k for k in listing.image_keys if k != key]
    out = _saved(db, principal, vendor, listing, request, "erp.catalog.image_delete")
    media.delete(key)
    return out


# ---------- Public photos ----------


@router.get("/media/catalog/{name}", include_in_schema=False)
def catalog_image(name: str, media: Media):
    try:
        path = media.path(name)
    except ValueError:
        raise not_found("image") from None
    if not path.is_file():
        raise not_found("image")
    # Names never change content (a new photo gets a new name), so browsers and CDNs can keep them for a year.
    return FileResponse(
        path, headers={"Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff"}
    )


# ---------- Annadata: look at any listing, take one down ----------


def _admin_out(db, listing: CatalogListing) -> AdminListingOut:
    vendor = db.get(Vendor, listing.vendor_id)
    return AdminListingOut(
        **listing_out(vendor, listing).model_dump(),
        vendor_id=vendor.public_id,
        vendor_name=vendor.trade_name,
        vendor_status=vendor.status,
    )


def _admin_listing(db, public_id: str) -> CatalogListing:
    listing = db.scalar(
        select(CatalogListing).where(CatalogListing.public_id == public_id, CatalogListing.deleted_at.is_(None))
    )
    if listing is None:
        raise not_found("listing")
    return listing


@router.get("/erp/admin/catalog/listings", response_model=list[AdminListingOut])
def admin_listings(
    _: CatalogAdmin,
    db: DbSession,
    vendor: Annotated[str | None, Query(max_length=36, description="Vendor id")] = None,
    category: Annotated[str | None, Query(max_length=30)] = None,
    district: Annotated[str | None, Query(max_length=60)] = None,
    removed: bool | None = None,
    pending: bool | None = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
):
    query = select(CatalogListing).where(CatalogListing.deleted_at.is_(None))
    if vendor:
        query = query.join(Vendor, Vendor.id == CatalogListing.vendor_id).where(Vendor.public_id == vendor)
    if category:
        query = query.where(CatalogListing.category == category)
    if district:
        query = query.where(
            CatalogListing.id.in_(
                select(CatalogListingArea.listing_id).where(CatalogListingArea.district_code == district)
            )
        )
    if removed is not None:
        query = query.where(CatalogListing.removed_at.is_not(None) if removed else CatalogListing.removed_at.is_(None))
    if pending:
        query = query.where(CatalogListing.approval_status == "pending")
    rows = db.scalars(
        query.order_by(CatalogListing.updated_at.desc(), CatalogListing.id.desc()).offset(offset).limit(limit)
    )
    return [_admin_out(db, r) for r in rows]


@router.post("/erp/admin/catalog/listings/{listing_id}/remove", response_model=AdminListingOut)
def remove_listing(
    listing_id: str, body: RemoveIn, principal: CatalogAdmin, db: DbSession, request: Request, mail: Email
):
    listing = _admin_listing(db, listing_id)
    service.remove(listing, principal.user.id, body.reason.strip())
    record(db, "erp.catalog.remove", "catalog_listing", listing.id, actor_id=principal.user.id, request=request)
    db.commit()
    vendor = db.get(Vendor, listing.vendor_id)
    for email in owner_emails(db, vendor):
        mail.send(
            email,
            "Annadata 360: a listing was taken down",
            f"'{listing.name.get('en')}' is no longer shown to farmers.\n\nReason: {listing.removed_reason}\n\n"
            "Fix it and contact Annadata support to have it restored.",
        )
    return _admin_out(db, listing)


@router.post("/erp/admin/catalog/listings/{listing_id}/restore", response_model=AdminListingOut)
def restore_listing(listing_id: str, principal: CatalogAdmin, db: DbSession, request: Request):
    listing = _admin_listing(db, listing_id)
    service.restore(listing)
    record(db, "erp.catalog.restore", "catalog_listing", listing.id, actor_id=principal.user.id, request=request)
    db.commit()
    return _admin_out(db, listing)


@router.post("/erp/admin/catalog/listings/{listing_id}/approve", response_model=AdminListingOut)
def approve_listing(listing_id: str, principal: CatalogAdmin, db: DbSession, request: Request):
    """Only used when CATALOG_REQUIRES_APPROVAL is switched on."""
    listing = _admin_listing(db, listing_id)
    if listing.approval_status != "pending":
        raise AppError(409, "not_pending", "This listing isn't waiting for approval")
    listing.approval_status = "live"
    record(db, "erp.catalog.approve", "catalog_listing", listing.id, actor_id=principal.user.id, request=request)
    db.commit()
    return _admin_out(db, listing)
