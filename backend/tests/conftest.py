import os

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
from app.main import app
from app.models import Crop, ProductCategory
from app.services.sms import get_sms_sender


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
def client(db_session, sms):
    def _get_db():
        db = db_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_sms_sender] = lambda: sms
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
