from datetime import datetime, timedelta
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, Request, Response, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import DbSession
from app.core.config import get_settings
from app.core.security import utcnow
from app.modules.audit.service import record
from app.modules.documents import service
from app.modules.documents.kinds import DOCUMENT_KINDS, FILE_TYPES
from app.modules.documents.models import ErpDocument
from app.modules.documents.storage import DocumentStorage, get_document_storage
from app.modules.iam.deps import CurrentPrincipal

router = APIRouter(prefix="/erp", tags=["erp-documents"])
Storage = Annotated[DocumentStorage, Depends(get_document_storage)]


class DocumentOut(BaseModel):
    id: str
    kind: str
    kind_label: str
    filename: str
    content_type: str
    size_bytes: int
    sha256: str
    uploaded_at: datetime
    attached: bool  # part of a vendor's application (can no longer be deleted)


class ViewLinkOut(BaseModel):
    url: str  # relative to the API base, e.g. /api/v1/erp/files/<token>
    expires_at: datetime


def document_out(doc: ErpDocument) -> DocumentOut:
    return DocumentOut(
        id=doc.public_id,
        kind=doc.kind,
        kind_label=DOCUMENT_KINDS.get(doc.kind, doc.kind),
        filename=doc.original_filename,
        content_type=doc.content_type,
        size_bytes=doc.size_bytes,
        sha256=doc.sha256,
        uploaded_at=doc.created_at,
        attached=doc.owner_type != "erp_user",
    )


@router.get("/documents/kinds")
def document_kinds(_: CurrentPrincipal):
    return {"kinds": DOCUMENT_KINDS, "file_types": sorted(FILE_TYPES), "max_mb": get_settings().document_max_mb}


@router.post("/documents", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def upload(
    principal: CurrentPrincipal,
    db: DbSession,
    storage: Storage,
    request: Request,
    kind: Annotated[str, Form(max_length=40)],
    file: Annotated[UploadFile, File(description="PDF, JPG, PNG or WebP, up to DOCUMENT_MAX_MB")],
):
    limit = get_settings().document_max_mb * 1024 * 1024
    data = file.file.read(limit + 1)  # one byte past the limit is enough to know it's too big
    doc = service.save(db, storage, principal.user, kind, file.filename, data)
    record(db, "erp.document.upload", "erp_document", doc.id, actor_id=principal.user.id, request=request, kind=kind)
    db.commit()
    return document_out(doc)


@router.get("/documents", response_model=list[DocumentOut])
def my_documents(principal: CurrentPrincipal, db: DbSession):
    """Documents I uploaded that aren't attached to an application yet."""
    rows = db.scalars(
        select(ErpDocument)
        .where(
            ErpDocument.owner_type == "erp_user",
            ErpDocument.owner_id == principal.user.id,
            ErpDocument.deleted_at.is_(None),
        )
        .order_by(ErpDocument.created_at.desc(), ErpDocument.id.desc())
    )
    return [document_out(d) for d in rows]


@router.get("/documents/{document_id}", response_model=DocumentOut)
def get_document(document_id: str, principal: CurrentPrincipal, db: DbSession):
    return document_out(service.get_visible(db, principal, document_id))


@router.post("/documents/{document_id}/view-link", response_model=ViewLinkOut)
def view_link(document_id: str, principal: CurrentPrincipal, db: DbSession, request: Request):
    doc = service.get_visible(db, principal, document_id)
    token, ttl = service.create_view_token(doc, principal.user)
    record(db, "erp.document.view", "erp_document", doc.id, actor_id=principal.user.id, request=request, kind=doc.kind)
    db.commit()
    return ViewLinkOut(url=f"/api/v1/erp/files/{token}", expires_at=utcnow() + timedelta(seconds=ttl))


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: str, principal: CurrentPrincipal, db: DbSession, storage: Storage, request: Request):
    doc = service.get_visible(db, principal, document_id)
    service.mark_deleted(principal, doc)
    record(db, "erp.document.delete", "erp_document", doc.id, actor_id=principal.user.id, request=request)
    db.commit()
    storage.delete(doc.storage_key)


@router.get("/files/{token}", include_in_schema=False)
def open_file(token: str, db: DbSession, storage: Storage, download: bool = False):
    """The signed link itself. No login header: the short-lived token in the URL is the permission."""
    doc = service.document_from_view_token(db, token)
    disposition = "attachment" if download else "inline"
    web = get_settings().erp_web_base_url.rstrip("/")
    return Response(
        content=storage.get(doc.storage_key),
        media_type=doc.content_type,
        headers={
            "Content-Disposition": f"{disposition}; filename*=UTF-8''{quote(doc.original_filename)}",
            "Cache-Control": "no-store, private",
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "no-referrer",
            # Only the ERP web app may show it inside a frame (the document viewer).
            "Content-Security-Policy": f"frame-ancestors 'self' {web}",
        },
    )
