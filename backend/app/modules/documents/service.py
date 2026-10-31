"""Upload, view and delete private documents.

Viewing works through a signed link that expires after a few minutes (like an S3 pre-signed URL), so the web app
can open a file in a new tab or an <iframe> without putting the login token in the URL. Creating a link is the
access that gets audited.
"""

import hashlib
import re
import unicodedata
import uuid
from datetime import timedelta

import jwt
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError, not_found
from app.core.security import utcnow
from app.modules.documents.kinds import DOCUMENT_KINDS, sniff_content_type
from app.modules.documents.models import ErpDocument
from app.modules.documents.storage import DocumentStorage
from app.modules.iam.deps import Principal
from app.modules.iam.models import ErpUser
from app.modules.iam.permissions import P

AUDIENCE = "erp"


def safe_filename(name: str | None) -> str:
    """Display name only (never used as a path): plain characters, no folders, at most 120 characters."""
    name = unicodedata.normalize("NFKC", (name or "").replace("\\", "/").split("/")[-1])
    name = re.sub(r"[^\w.\- ()]", "_", name).strip(" .")
    return name[-120:] or "document"


def save(
    db: Session, storage: DocumentStorage, uploader: ErpUser, kind: str, filename: str | None, data: bytes
) -> ErpDocument:
    settings = get_settings()
    if kind not in DOCUMENT_KINDS:
        raise AppError(422, "unknown_document_kind", f"Unknown document kind: {kind}")
    max_bytes = settings.document_max_mb * 1024 * 1024
    if not data:
        raise AppError(422, "empty_file", "The file is empty")
    if len(data) > max_bytes:
        raise AppError(413, "file_too_large", f"File is larger than {settings.document_max_mb} MB")
    content_type = sniff_content_type(data)
    if content_type is None:
        raise AppError(415, "unsupported_file_type", "Only PDF, JPG, PNG or WebP files can be uploaded")
    day_ago = utcnow() - timedelta(days=1)
    today = db.scalar(
        select(func.count()).where(ErpDocument.uploaded_by_id == uploader.id, ErpDocument.created_at >= day_ago)
    )
    if today >= settings.document_daily_upload_limit:
        raise AppError(429, "upload_limit", "Too many uploads today. Try again tomorrow or contact support.")

    now = utcnow()
    key = f"{now:%Y/%m}/{uuid.uuid4()}"
    storage.put(key, data)
    doc = ErpDocument(
        kind=kind,
        owner_type="erp_user",
        owner_id=uploader.id,
        storage_key=key,
        original_filename=safe_filename(filename),
        content_type=content_type,
        size_bytes=len(data),
        sha256=hashlib.sha256(data).hexdigest(),
        uploaded_by_id=uploader.id,
        created_at=now,
    )
    db.add(doc)
    db.flush()
    return doc


def get_visible(db: Session, principal: Principal, public_id: str) -> ErpDocument:
    """The document, if this person may see it. Otherwise "not found" (never "forbidden", which would confirm it
    exists)."""
    doc = db.scalar(select(ErpDocument).where(ErpDocument.public_id == public_id, ErpDocument.deleted_at.is_(None)))
    if doc is None or not can_view(principal, doc):
        raise not_found("document")
    return doc


def can_view(principal: Principal, doc: ErpDocument) -> bool:
    if principal.has(P.KYC_DOCUMENTS_VIEW):  # Super Admin
        return True
    if doc.owner_type == "erp_user":
        return doc.owner_id == principal.user.id
    if doc.owner_type == "vendor":  # the vendor's own team
        return principal.vendor_id is not None and doc.owner_id == principal.vendor_id
    return False


def attach_to_vendor(db: Session, principal: Principal, public_id: str, kind: str, vendor_id: int) -> ErpDocument:
    """Moves a document the user uploaded into the vendor's application. Re-attaching one that is already the
    vendor's is allowed (saving the same form twice)."""
    doc = db.scalar(select(ErpDocument).where(ErpDocument.public_id == public_id, ErpDocument.deleted_at.is_(None)))
    mine = doc is not None and doc.owner_type == "erp_user" and doc.owner_id == principal.user.id
    already = doc is not None and doc.owner_type == "vendor" and doc.owner_id == vendor_id
    if not (mine or already):
        raise AppError(422, "document_not_found", "Document not found. Upload it again.", {"document_id": public_id})
    if doc.kind != kind:
        raise AppError(
            422,
            "wrong_document_kind",
            f"Expected a {DOCUMENT_KINDS[kind]}, got a {DOCUMENT_KINDS.get(doc.kind, doc.kind)}",
            {"document_id": public_id},
        )
    doc.owner_type, doc.owner_id = "vendor", vendor_id
    return doc


def mark_deleted(principal: Principal, doc: ErpDocument) -> None:
    """Only the uploader, and only before the document is attached to a vendor's KYC. The row stays (with its
    hash) for the audit trail; the caller removes the file once this is saved."""
    if doc.owner_type != "erp_user" or doc.owner_id != principal.user.id:
        raise AppError(409, "document_locked", "This document is part of a submitted application and can't be deleted")
    doc.deleted_at = utcnow()
    doc.deleted_by_id = principal.user.id


# ---------- Signed view links ----------


def create_view_token(doc: ErpDocument, viewer: ErpUser) -> tuple[str, int]:
    settings = get_settings()
    ttl = settings.document_link_ttl_seconds
    now = utcnow()
    payload = {
        "sub": doc.public_id,
        "uid": viewer.public_id,
        "aud": AUDIENCE,
        "typ": "erp_file",
        "iat": now,
        "exp": now + timedelta(seconds=ttl),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm), ttl


def document_from_view_token(db: Session, token: str) -> ErpDocument:
    settings = get_settings()
    gone = AppError(404, "link_expired", "This link has expired. Open the document again from the ERP.")
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm], audience=AUDIENCE)
    except jwt.PyJWTError:
        raise gone from None
    if payload.get("typ") != "erp_file":
        raise gone
    viewer = db.scalar(select(ErpUser).where(ErpUser.public_id == payload.get("uid")))
    if viewer is None or viewer.status != "active" or viewer.deleted_at is not None:
        raise gone
    doc = db.scalar(
        select(ErpDocument).where(ErpDocument.public_id == payload["sub"], ErpDocument.deleted_at.is_(None))
    )
    if doc is None:
        raise gone
    return doc
