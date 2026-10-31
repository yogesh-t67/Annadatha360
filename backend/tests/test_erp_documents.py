import pytest

from app.core.config import get_settings
from app.main import app
from app.modules.documents.service import safe_filename
from app.modules.documents.storage import LocalEncryptedStorage, get_document_storage
from tests.erp_helpers import API, headers

PDF = b"%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


@pytest.fixture
def storage(client, tmp_path):
    s = LocalEncryptedStorage(tmp_path)
    app.dependency_overrides[get_document_storage] = lambda: s
    return s


@pytest.fixture
def settings(monkeypatch):
    s = get_settings()

    def _set(**values):
        for k, v in values.items():
            monkeypatch.setattr(s, k, v)

    return _set


def upload(client, session, data=PDF, name="gst.pdf", kind="gst_certificate"):
    return client.post(
        f"{API}/documents", headers=headers(session), data={"kind": kind}, files={"file": (name, data, "x/anything")}
    )


def open_link(client, session, doc_id):
    link = client.post(f"{API}/documents/{doc_id}/view-link", headers=headers(session))
    assert link.status_code == 200, link.text
    return client.get(link.json()["url"])


def test_upload_is_encrypted_on_disk_and_opens_through_a_signed_link(client, super_admin, storage, tmp_path):
    admin = super_admin.login()
    res = upload(client, admin)
    assert res.status_code == 201, res.text
    doc = res.json()
    assert doc["content_type"] == "application/pdf"  # from the bytes, not the "x/anything" the browser sent
    assert doc["filename"] == "gst.pdf" and doc["size_bytes"] == len(PDF) and not doc["attached"]

    stored = list(tmp_path.rglob("*.enc"))
    assert len(stored) == 1
    assert b"%PDF" not in stored[0].read_bytes()  # encrypted at rest

    file = open_link(client, admin, doc["id"])
    assert file.status_code == 200
    assert file.content == PDF
    assert file.headers["content-type"] == "application/pdf"
    assert file.headers["x-content-type-options"] == "nosniff"
    assert "no-store" in file.headers["cache-control"]
    assert file.headers["content-disposition"].startswith("inline")

    audit = client.get(f"{API}/audit", headers=headers(admin), params={"action": "erp.document"}).json()
    assert {e["action"] for e in audit} == {"erp.document.upload", "erp.document.view"}


@pytest.mark.parametrize(
    ("data", "code"),
    [
        (b"MZ\x90\x00 this is an .exe", "unsupported_file_type"),
        (b"<html><script>alert(1)</script>", "unsupported_file_type"),
        (b"", "empty_file"),
    ],
)
def test_only_real_pdf_and_image_files_are_accepted(client, super_admin, storage, data, code):
    admin = super_admin.login()
    assert upload(client, admin, data=data, name="looks-fine.pdf").json()["error"]["code"] == code


def test_size_kind_and_daily_limits(client, super_admin, storage, settings):
    admin = super_admin.login()
    settings(document_max_mb=1)
    assert upload(client, admin, data=PDF + b"0" * 1024 * 1024).json()["error"]["code"] == "file_too_large"
    assert upload(client, admin, kind="selfie").json()["error"]["code"] == "unknown_document_kind"
    settings(document_daily_upload_limit=2)
    assert upload(client, admin).status_code == 201
    assert upload(client, admin, data=PNG, name="shop.png", kind="shop_photo").status_code == 201
    assert upload(client, admin).json()["error"]["code"] == "upload_limit"


def test_others_cannot_see_a_document_but_super_admin_can(client, super_admin, invite, storage):
    admin = super_admin.login()
    ops1 = invite(admin, "ops1@annadata.test").login()
    ops2 = invite(admin, "ops2@annadata.test").login()
    doc_id = upload(client, ops1).json()["id"]

    # Another account gets "not found" (not "forbidden", which would confirm the document exists)
    assert client.get(f"{API}/documents/{doc_id}", headers=headers(ops2)).status_code == 404
    assert client.post(f"{API}/documents/{doc_id}/view-link", headers=headers(ops2)).status_code == 404
    assert client.get(f"{API}/documents", headers=headers(ops2)).json() == []
    # Super Admin may view KYC documents; ops may not view each other's
    assert open_link(client, admin, doc_id).content == PDF
    assert client.get(f"{API}/documents/{doc_id}", headers={}).status_code == 401


def test_view_link_expires_and_cannot_be_forged(client, super_admin, storage, settings):
    admin = super_admin.login()
    doc_id = upload(client, admin).json()["id"]
    url = client.post(f"{API}/documents/{doc_id}/view-link", headers=headers(admin)).json()["url"]
    assert client.get(url[:-3] + "abc").json()["error"]["code"] == "link_expired"
    # The login token is not a file link either
    assert client.get(f"{API}/files/{admin['access_token']}").status_code == 404
    settings(document_link_ttl_seconds=-1)
    old = client.post(f"{API}/documents/{doc_id}/view-link", headers=headers(admin)).json()["url"]
    assert client.get(old).json()["error"]["code"] == "link_expired"


def test_link_stops_working_when_the_viewer_is_disabled(client, super_admin, invite, storage):
    admin = super_admin.login()
    ops = invite(admin, "ops@annadata.test").login()
    doc_id = upload(client, ops).json()["id"]
    url = client.post(f"{API}/documents/{doc_id}/view-link", headers=headers(ops)).json()["url"]
    client.post(f"{API}/users/{ops['user']['id']}/disable", headers=headers(admin))
    assert client.get(url).status_code == 404


def test_uploader_can_delete_an_unattached_document(client, super_admin, invite, storage, tmp_path):
    admin = super_admin.login()
    ops = invite(admin, "ops@annadata.test").login()
    doc_id = upload(client, ops).json()["id"]
    url = client.post(f"{API}/documents/{doc_id}/view-link", headers=headers(ops)).json()["url"]
    # Super Admin can view it, but only the uploader can delete it
    assert client.delete(f"{API}/documents/{doc_id}", headers=headers(admin)).status_code == 409
    assert client.delete(f"{API}/documents/{doc_id}", headers=headers(ops)).status_code == 204
    assert list(tmp_path.rglob("*.enc")) == []  # the file is gone
    assert client.get(f"{API}/documents/{doc_id}", headers=headers(ops)).status_code == 404
    assert client.get(url).status_code == 404


def test_filename_is_only_a_display_name():
    assert safe_filename("../../etc/passwd.pdf") == "passwd.pdf"
    assert safe_filename("C:\\Users\\x\\GST cert (2026).pdf") == "GST cert (2026).pdf"
    assert safe_filename('a<b>"c".pdf') == "a_b__c_.pdf"
    assert safe_filename(None) == "document"
    assert safe_filename("..") == "document"


def test_storage_refuses_keys_it_did_not_make(tmp_path):
    s = LocalEncryptedStorage(tmp_path)
    with pytest.raises(ValueError):
        s.get("../../.env")
