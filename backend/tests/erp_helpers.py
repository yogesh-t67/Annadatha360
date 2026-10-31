"""Shared by the ERP tests. The fixtures that use these (mail, clock, super_admin, invite) are in conftest.py."""

import re

import pyotp

PASSWORD = "Kh@rif-season-2026"
API = "/api/v1/erp"


class FakeEmail:
    def __init__(self):
        self.sent: list[tuple[str, str, str]] = []

    def send(self, to: str, subject: str, body: str) -> None:
        self.sent.append((to, subject, body))

    def last_token(self, to: str) -> str:
        body = next(b for t, _, b in reversed(self.sent) if t == to)
        return re.search(r"token=([\w-]+)", body).group(1)


class Account:
    """An ERP account that can log in (sets up the authenticator app on its first login)."""

    def __init__(self, client, clock, email):
        self.client, self.clock, self.email = client, clock, email
        self.secret: str | None = None
        self.backup_codes: list[str] = []

    def code(self) -> str:
        self.clock["t"] += 30
        return pyotp.TOTP(self.secret).at(self.clock["t"])

    def login(self, ip: str = "10.0.0.1") -> dict:
        res = self.client.post(
            f"{API}/auth/login", json={"email": self.email, "password": PASSWORD}, headers={"X-Real-IP": ip}
        )
        assert res.status_code == 200, res.text
        token = res.json()["mfa_token"]
        if res.json()["stage"] == "mfa_setup":
            self.secret = self.client.post(f"{API}/auth/mfa/setup", json={"mfa_token": token}).json()["secret"]
            res = self.client.post(
                f"{API}/auth/mfa/activate", json={"mfa_token": token, "code": self.code()}, headers={"X-Real-IP": ip}
            )
            self.backup_codes = res.json()["backup_codes"]
        else:
            res = self.client.post(
                f"{API}/auth/mfa/verify", json={"mfa_token": token, "code": self.code()}, headers={"X-Real-IP": ip}
            )
        assert res.status_code == 200, res.text
        return res.json()


def headers(session: dict) -> dict:
    return {"Authorization": f"Bearer {session['access_token']}"}
