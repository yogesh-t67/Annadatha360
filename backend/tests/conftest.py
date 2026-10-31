import os
import re

os.environ["ANNADATA_ENV_FILE"] = ""  # never read a developer's backend/.env during tests
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "test-secret-that-is-at-least-32-bytes-long")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.seed_crops import CROPS
from app.db.seed_shop import CATEGORIES
from app.db.session import get_db
from app.jobs.create_erp_admin import create as create_super_admin
from app.main import app
from app.models import Crop, ProductCategory
from app.modules.documents.storage import LocalEncryptedStorage, get_document_storage
from app.modules.iam import service as iam_service
from app.modules.vendors.verification import get_lookups
from app.services.email import get_email_sender
from app.services.sms import get_sms_sender
from tests.erp_helpers import API, PASSWORD, Account, FakeEmail, FakeLookups, headers


class FakeSms:
    def __init__(self):
        self.sent: dict[str, str] = {}

    def send_otp(self, phone: str, code: str) -> None:
        self.sent[phone] = code


@pytest.fixture
def sms():
    return FakeSms()


@pytest.fixture
def db_session():
    # Default: in-memory SQLite. Set TEST_DATABASE_URL to run against a real (throwaway!) Postgres;
    # every table in it is dropped after each test.
    url = os.environ.get("TEST_DATABASE_URL")
    if url:
        engine = create_engine(url)
    else:
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    with Session() as s:
        s.add_all(Crop(**c) for c in CROPS)
        s.add_all(ProductCategory(**c) for c in CATEGORIES)
        s.commit()
    yield Session
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture
def lookups():
    """Stands in for the public IFSC and pincode services: tests never go to the internet."""
    return FakeLookups()


@pytest.fixture
def client(db_session, sms, lookups):
    def _get_db():
        db = db_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_sms_sender] = lambda: sms
    app.dependency_overrides[get_lookups] = lambda: lookups
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def login(client, sms):
    """Logs a farmer in via OTP and returns (auth headers, login response body)."""

    def _login(phone: str = "9876543210"):
        assert client.post("/api/v1/auth/otp/request", json={"phone": phone}).status_code == 200
        normalized = "+91" + phone[-10:]
        res = client.post("/api/v1/auth/otp/verify", json={"phone": phone, "code": sms.sent[normalized]})
        assert res.status_code == 200, res.text
        body = res.json()
        return {"Authorization": f"Bearer {body['access_token']}"}, body

    return _login


# ---------- ERP (vendor portal + admin) ----------


@pytest.fixture
def mail(client):
    m = FakeEmail()
    app.dependency_overrides[get_email_sender] = lambda: m
    return m


@pytest.fixture
def clock(monkeypatch):
    """Authenticator codes depend on time; tests move this clock 30 s forward to get a fresh code."""
    state = {"t": 1_800_000_000.0}
    monkeypatch.setattr(iam_service, "_now_ts", lambda: state["t"])
    return state


@pytest.fixture
def super_admin(client, db_session, clock, mail):
    """The first Super Admin, with a password set (logs in with .login())."""
    with db_session() as db:
        link = create_super_admin(db, "Root@Annadata.test", "Root Admin")
    token = re.search(r"token=([\w-]+)", link).group(1)
    assert client.post(f"{API}/auth/invite/accept", json={"token": token, "password": PASSWORD}).status_code == 204
    return Account(client, clock, "root@annadata.test")


@pytest.fixture
def invite(client, mail, clock):
    """Super Admin invites someone, who sets a password. Returns their Account (not logged in yet)."""

    def _invite(admin_session: dict, email: str, role: str = "ops") -> Account:
        res = client.post(
            f"{API}/users",
            headers=headers(admin_session),
            json={"email": email, "full_name": "Ops Person", "role": role},
        )
        assert res.status_code == 201, res.text
        token = mail.last_token(email)
        assert client.post(f"{API}/auth/invite/accept", json={"token": token, "password": PASSWORD}).status_code == 204
        return Account(client, clock, email)

    return _invite


@pytest.fixture
def storage(client, tmp_path):
    """Document storage in a temporary folder."""
    s = LocalEncryptedStorage(tmp_path)
    app.dependency_overrides[get_document_storage] = lambda: s
    return s


@pytest.fixture
def register(client, mail, clock):
    """Signs a vendor up, follows the email link to set a password, logs in. Returns (Account, session)."""

    def _register(email="shop@vendor.test", kind="business", trade_name="Sri Lakshmi Agro"):
        body = {
            "email": email,
            "full_name": "Ravi Kumar",
            "phone": "9876543210",
            "kind": kind,
            "trade_name": trade_name,
        }
        assert client.post(f"{API}/vendors/register", json=body).status_code == 202
        token = mail.last_token(email)
        assert client.post(f"{API}/auth/invite/accept", json={"token": token, "password": PASSWORD}).status_code == 204
        account = Account(client, clock, email)
        return account, account.login()

    return _register
