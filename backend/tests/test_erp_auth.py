import re
from datetime import timedelta

import pytest
from sqlalchemy import select

from app.core.security import utcnow
from app.jobs.create_erp_admin import create as create_super_admin
from app.modules.iam import service
from app.modules.iam.models import ErpSession
from tests.erp_helpers import API, PASSWORD, headers

# ---------- Login ----------


def test_first_login_sets_up_authenticator_then_asks_for_code(client, super_admin):
    res = client.post(f"{API}/auth/login", json={"email": super_admin.email, "password": PASSWORD})
    assert res.json()["stage"] == "mfa_setup"
    token = res.json()["mfa_token"]
    # No session without the authenticator app
    assert client.post(f"{API}/auth/mfa/verify", json={"mfa_token": token, "code": "123456"}).status_code == 409
    setup = client.post(f"{API}/auth/mfa/setup", json={"mfa_token": token}).json()
    assert setup["otpauth_uri"].startswith("otpauth://totp/Annadata%20360:root%40annadata.test")
    super_admin.secret = setup["secret"]
    assert client.post(f"{API}/auth/mfa/activate", json={"mfa_token": token, "code": "000000"}).status_code == 401
    res = client.post(f"{API}/auth/mfa/activate", json={"mfa_token": token, "code": super_admin.code()})
    assert res.status_code == 200
    body = res.json()
    assert len(body["backup_codes"]) == 10
    assert body["user"]["roles"] == ["super_admin"]
    assert "users.manage" in body["user"]["permissions"]

    me = client.get(f"{API}/me", headers=headers(body)).json()
    assert me["email"] == "root@annadata.test"
    # Next time: straight to the code
    res = client.post(f"{API}/auth/login", json={"email": super_admin.email, "password": PASSWORD})
    assert res.json()["stage"] == "mfa"


def test_authenticator_code_works_only_once(client, super_admin):
    super_admin.login()
    token = client.post(f"{API}/auth/login", json={"email": super_admin.email, "password": PASSWORD}).json()[
        "mfa_token"
    ]
    code = super_admin.code()
    assert client.post(f"{API}/auth/mfa/verify", json={"mfa_token": token, "code": code}).status_code == 200
    assert (
        client.post(f"{API}/auth/mfa/verify", json={"mfa_token": token, "code": code}).json()["error"]["code"]
        == "invalid_code"
    )


def test_backup_code_works_once(client, super_admin, mail):
    super_admin.login()
    backup = super_admin.backup_codes[0]
    for expected in (200, 401):
        token = client.post(f"{API}/auth/login", json={"email": super_admin.email, "password": PASSWORD}).json()[
            "mfa_token"
        ]
        assert client.post(f"{API}/auth/mfa/verify", json={"mfa_token": token, "code": backup}).status_code == expected


def test_wrong_password_and_unknown_email_look_the_same(client, super_admin):
    wrong = client.post(f"{API}/auth/login", json={"email": super_admin.email, "password": "nope-nope-nope"})
    unknown = client.post(f"{API}/auth/login", json={"email": "nobody@annadata.test", "password": PASSWORD})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()


def test_account_locks_after_five_wrong_passwords(client, super_admin):
    for _ in range(5):
        client.post(f"{API}/auth/login", json={"email": super_admin.email, "password": "wrong-password-1"})
    res = client.post(f"{API}/auth/login", json={"email": super_admin.email, "password": PASSWORD})
    assert res.status_code == 429
    assert res.json()["error"]["code"] == "too_many_attempts"


def test_wrong_codes_also_lock(client, super_admin):
    super_admin.login()
    token = client.post(f"{API}/auth/login", json={"email": super_admin.email, "password": PASSWORD}).json()[
        "mfa_token"
    ]
    for _ in range(5):
        client.post(f"{API}/auth/mfa/verify", json={"mfa_token": token, "code": "000000"})
    res = client.post(f"{API}/auth/mfa/verify", json={"mfa_token": token, "code": super_admin.code()})
    assert res.status_code == 429


def test_mfa_token_is_not_an_access_token(client, super_admin):
    token = client.post(f"{API}/auth/login", json={"email": super_admin.email, "password": PASSWORD}).json()[
        "mfa_token"
    ]
    assert client.get(f"{API}/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_farmer_and_erp_tokens_are_not_interchangeable(client, super_admin, login):
    farmer_headers, _ = login()
    erp = super_admin.login()
    assert client.get(f"{API}/me", headers=farmer_headers).status_code == 401
    assert client.get("/api/v1/farmers/me", headers=headers(erp)).status_code == 401


# ---------- Invites and passwords ----------


def test_weak_password_is_refused(client, db_session, mail):
    with db_session() as db:
        token = re.search(r"token=([\w-]+)", create_super_admin(db, "weak@annadata.test", "Weak")).group(1)
    for bad in ("short1!", "aaaaaaaaaaaaaaaa", "Password1234", "weak-and-long-2026"):
        res = client.post(f"{API}/auth/invite/accept", json={"token": token, "password": bad})
        assert res.json()["error"]["code"] == "weak_password", bad
    assert client.post(f"{API}/auth/invite/accept", json={"token": token, "password": PASSWORD}).status_code == 204


def test_invite_link_works_once(client, db_session):
    with db_session() as db:
        token = re.search(r"token=([\w-]+)", create_super_admin(db, "once@annadata.test", "Once")).group(1)
    assert client.post(f"{API}/auth/invite/accept", json={"token": token, "password": PASSWORD}).status_code == 204
    res = client.post(f"{API}/auth/invite/accept", json={"token": token, "password": PASSWORD})
    assert res.json()["error"]["code"] == "invalid_invite"


def test_change_password_ends_other_sessions(client, super_admin):
    laptop = super_admin.login()
    phone = super_admin.login()
    res = client.post(
        f"{API}/auth/password/change",
        headers=headers(laptop),
        json={"current_password": PASSWORD, "new_password": "Rabi-season-2027!"},
    )
    assert res.status_code == 204
    assert client.get(f"{API}/me", headers=headers(laptop)).status_code == 200
    assert client.get(f"{API}/me", headers=headers(phone)).status_code == 401


# ---------- Sessions ----------


def test_refresh_rotates_and_a_reused_refresh_token_ends_the_session(client, super_admin, db_session):
    first = super_admin.login()
    second = client.post(f"{API}/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert second.status_code == 200
    # Right after the rotation, the old token is a race between two tabs: refused, session kept.
    race = client.post(f"{API}/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert race.status_code == 409 and race.json()["error"]["code"] == "refresh_superseded"
    assert client.get(f"{API}/me", headers=headers(second.json())).status_code == 200
    # A minute later the old token shows up again: someone copied it. End the session for both.
    with db_session() as db:
        for s in db.scalars(select(ErpSession)):
            s.refreshed_at = utcnow() - timedelta(seconds=61)
        db.commit()
    assert client.post(f"{API}/auth/refresh", json={"refresh_token": first["refresh_token"]}).status_code == 401
    assert client.post(f"{API}/auth/refresh", json={"refresh_token": second.json()["refresh_token"]}).status_code == 401
    assert client.get(f"{API}/me", headers=headers(second.json())).status_code == 401


def test_logout_all_ends_every_session_at_once(client, super_admin):
    a, b = super_admin.login(), super_admin.login()
    assert client.post(f"{API}/auth/logout-all", headers=headers(a)).status_code == 204
    assert client.get(f"{API}/me", headers=headers(a)).status_code == 401
    assert client.get(f"{API}/me", headers=headers(b)).status_code == 401


def test_idle_session_is_logged_out(client, super_admin, db_session):
    session = super_admin.login()
    with db_session() as db:
        for s in db.scalars(select(ErpSession)):
            s.last_seen_at = utcnow() - timedelta(minutes=31)
        db.commit()
    assert client.get(f"{API}/me", headers=headers(session)).status_code == 401
    assert client.post(f"{API}/auth/refresh", json={"refresh_token": session["refresh_token"]}).status_code == 401


def test_list_and_end_own_sessions(client, super_admin):
    a, b = super_admin.login(), super_admin.login()
    sessions = client.get(f"{API}/me/sessions", headers=headers(a)).json()
    assert len(sessions) == 2
    other = next(s for s in sessions if not s["current"])
    assert client.delete(f"{API}/me/sessions/{other['id']}", headers=headers(a)).status_code == 204
    assert client.get(f"{API}/me", headers=headers(b)).status_code == 401


def test_new_login_address_sends_an_email(client, super_admin, mail):
    super_admin.login(ip="10.0.0.1")
    super_admin.login(ip="10.0.0.1")
    assert not any("New login" in subject for _, subject, _ in mail.sent)
    super_admin.login(ip="203.0.113.9")
    assert any(to == super_admin.email and "New login" in subject for to, subject, _ in mail.sent)


# ---------- Users and permissions ----------


def test_ops_cannot_manage_users_or_read_audit(client, super_admin, invite):
    admin = super_admin.login()
    ops = invite(admin, "ops@annadata.test").login()
    assert ops["user"]["roles"] == ["ops"]
    assert "kyc.documents.view" not in ops["user"]["permissions"]
    assert client.get(f"{API}/users", headers=headers(ops)).status_code == 403
    assert client.get(f"{API}/audit", headers=headers(ops)).status_code == 403
    assert client.get(f"{API}/users", headers=headers(admin)).status_code == 200


def test_disable_user_ends_their_sessions(client, super_admin, invite):
    admin = super_admin.login()
    ops_account = invite(admin, "ops@annadata.test")
    ops = ops_account.login()
    user_id = ops["user"]["id"]
    assert client.post(f"{API}/users/{user_id}/disable", headers=headers(admin)).json()["status"] == "disabled"
    assert client.get(f"{API}/me", headers=headers(ops)).status_code == 401
    res = client.post(f"{API}/auth/login", json={"email": ops_account.email, "password": PASSWORD})
    assert res.json()["error"]["code"] == "account_disabled"


def test_cannot_disable_self_or_last_super_admin(client, super_admin, invite):
    admin = super_admin.login()
    me = admin["user"]["id"]
    assert (
        client.post(f"{API}/users/{me}/disable", headers=headers(admin)).json()["error"]["code"]
        == "cannot_disable_self"
    )
    second = invite(admin, "root2@annadata.test", role="super_admin").login()
    assert client.post(f"{API}/users/{me}/disable", headers=headers(second)).status_code == 200
    # `second` is now the only active Super Admin; nobody else can disable them, and they can't disable themselves.


def test_reset_mfa_makes_the_user_set_up_the_app_again(client, super_admin, invite):
    admin = super_admin.login()
    ops_account = invite(admin, "ops@annadata.test")
    ops = ops_account.login()
    assert client.post(f"{API}/users/{ops['user']['id']}/reset-mfa", headers=headers(admin)).status_code == 200
    assert client.get(f"{API}/me", headers=headers(ops)).status_code == 401
    res = client.post(f"{API}/auth/login", json={"email": ops_account.email, "password": PASSWORD})
    assert res.json()["stage"] == "mfa_setup"


def test_duplicate_email_is_refused(client, super_admin, invite):
    admin = super_admin.login()
    invite(admin, "ops@annadata.test")
    res = client.post(
        f"{API}/users", headers=headers(admin), json={"email": "OPS@annadata.test", "full_name": "Again", "role": "ops"}
    )
    assert res.json()["error"]["code"] == "email_taken"


def test_audit_log_records_who_did_what(client, super_admin, invite):
    admin = super_admin.login(ip="10.0.0.7")
    invite(admin, "ops@annadata.test")
    entries = client.get(f"{API}/audit", headers=headers(admin), params={"action": "erp."}).json()
    actions = [e["action"] for e in entries]
    assert {
        "erp.user.create_super_admin",
        "erp.invite.accept",
        "erp.mfa.enable",
        "erp.login",
        "erp.user.invite",
    } <= set(actions)
    invite_entry = next(e for e in entries if e["action"] == "erp.user.invite")
    assert invite_entry["actor_email"] == "root@annadata.test"
    assert invite_entry["ip"]
    login_entry = next(e for e in entries if e["action"] == "erp.login")
    assert login_entry["ip"] == "10.0.0.7"
    assert invite_entry["detail"] == {"role": "ops"}


# ---------- Password strength ----------


@pytest.mark.parametrize(
    ("password", "expected"),
    [
        ("Rice#7", "weak"),  # too short
        ("12345678", "weak"),  # counting run
        ("abcdefgh", "weak"),
        ("qwertyui", "weak"),  # keyboard run
        ("11111111", "weak"),  # too few different characters
        ("9876543210", "weak"),
        ("9440123456", "weak"),  # only numbers (a phone number)
        ("Password@123", "weak"),  # common word + numbers
        ("Annadata@2026", "weak"),
        ("kisanmitra", "medium"),  # any 8+ characters are fine; no mix needed
        ("amrutha2026", "medium"),
        ("Rice#Crop9", "strong"),  # 8+ with 3 kinds
        ("ricecropfield", "strong"),  # 12+ characters
        ("Kh@rif-season-2026", "strong"),
    ],
)
def test_password_strength(password, expected):
    assert service.password_strength(password, "someone@annadata.test")[0] == expected


def test_weak_password_error_says_what_is_missing(client, db_session):
    with db_session() as db:
        token = re.search(r"token=([\w-]+)", create_super_admin(db, "x@annadata.test", "X")).group(1)
    err = client.post(f"{API}/auth/invite/accept", json={"token": token, "password": "rice"}).json()["error"]
    assert err["details"]["strength"] == "weak"
    assert "at least 8 characters" in err["details"]["missing"]
    assert client.post(f"{API}/auth/invite/accept", json={"token": token, "password": "Rice#Crop9"}).status_code == 204


# ---------- Forgot password ----------


def test_forgot_password_resets_and_logs_out_everywhere(client, super_admin, mail):
    old = super_admin.login()
    res = client.post(f"{API}/auth/password/forgot", json={"email": "ROOT@annadata.test"})
    assert res.status_code == 202
    token = mail.last_token(super_admin.email)
    assert client.post(f"{API}/auth/password/reset", json={"token": token, "password": "rice"}).status_code == 422
    new_password = "Rabi-season-2027!"
    assert client.post(f"{API}/auth/password/reset", json={"token": token, "password": new_password}).status_code == 204
    assert "password was changed" in mail.sent[-1][1]
    assert client.get(f"{API}/me", headers=headers(old)).status_code == 401
    # Link works once
    res = client.post(f"{API}/auth/password/reset", json={"token": token, "password": new_password})
    assert res.json()["error"]["code"] == "invalid_reset_link"
    # Old password no longer works; new one still needs the authenticator code
    assert client.post(f"{API}/auth/login", json={"email": super_admin.email, "password": PASSWORD}).status_code == 401
    res = client.post(f"{API}/auth/login", json={"email": super_admin.email, "password": new_password})
    assert res.json()["stage"] == "mfa"


def test_forgot_password_does_not_reveal_accounts(client, super_admin, mail):
    known = client.post(f"{API}/auth/password/forgot", json={"email": super_admin.email})
    unknown = client.post(f"{API}/auth/password/forgot", json={"email": "nobody@annadata.test"})
    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()
    assert [to for to, _, _ in mail.sent] == [super_admin.email]


def test_forgot_password_sends_at_most_three_emails_an_hour(client, super_admin, mail):
    for _ in range(5):
        client.post(f"{API}/auth/password/forgot", json={"email": super_admin.email})
    assert len(mail.sent) == 3


def test_entering_the_password_again_does_not_reset_wrong_code_count(client, super_admin):
    super_admin.login()
    for _ in range(5):
        token = client.post(f"{API}/auth/login", json={"email": super_admin.email, "password": PASSWORD}).json()[
            "mfa_token"
        ]
        client.post(f"{API}/auth/mfa/verify", json={"mfa_token": token, "code": "000000"})
    res = client.post(f"{API}/auth/login", json={"email": super_admin.email, "password": PASSWORD})
    assert res.status_code == 429


# ---------- Authenticator switched off (testing) ----------


@pytest.fixture
def mfa_off(monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "erp_mfa_required", False)


def test_password_alone_logs_in_when_the_authenticator_is_off(client, super_admin, mfa_off):
    res = client.post(f"{API}/auth/login", json={"email": super_admin.email, "password": PASSWORD})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["stage"] == "done" and body["mfa_token"] is None
    assert client.get(f"{API}/me", headers=headers(body["session"])).json()["email"] == super_admin.email
    wrong = client.post(f"{API}/auth/login", json={"email": super_admin.email, "password": "wrong-password-1"})
    assert wrong.status_code == 401  # the password is still checked, and lockout still applies


def test_accounts_with_the_app_set_up_still_need_their_code(client, super_admin, monkeypatch):
    super_admin.login()  # sets up the authenticator while it's required
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "erp_mfa_required", False)
    res = client.post(f"{API}/auth/login", json={"email": super_admin.email, "password": PASSWORD})
    assert res.json()["stage"] == "mfa"


def test_production_refuses_to_start_without_the_authenticator(monkeypatch):
    from app.core.config import Settings, get_settings

    monkeypatch.setattr(
        "app.core.config.Settings",
        lambda: Settings(
            app_env="production",
            jwt_secret="x" * 40,
            field_encryption_key="k",
            turnstile_secret_key="t",
            ai_provider="anthropic",
            erp_mfa_required=False,
        ),
    )
    get_settings.cache_clear()
    try:
        with pytest.raises(RuntimeError, match="ERP_MFA_REQUIRED"):
            get_settings()
    finally:
        monkeypatch.undo()
        get_settings.cache_clear()


def test_a_link_tells_which_account_it_is_for_without_being_used(client, db_session, mail):
    with db_session() as db:
        token = re.search(r"token=([\w-]+)", create_super_admin(db, "Link@Annadata.test", "Link")).group(1)
    res = client.get(f"{API}/auth/link", params={"token": token, "purpose": "invite"})
    assert res.json() == {"email": "link@annadata.test"}
    # Still works afterwards
    assert client.post(f"{API}/auth/invite/accept", json={"token": token, "password": PASSWORD}).status_code == 204
    used = client.get(f"{API}/auth/link", params={"token": token, "purpose": "invite"})
    assert used.json()["error"]["code"] == "invalid_link"
    # An invite token is not a reset token
    assert client.get(f"{API}/auth/link", params={"token": token, "purpose": "reset"}).status_code == 400
    client.post(f"{API}/auth/password/forgot", json={"email": "link@annadata.test"})
    reset = mail.last_token("link@annadata.test")
    assert client.get(f"{API}/auth/link", params={"token": reset, "purpose": "reset"}).json() == {
        "email": "link@annadata.test"
    }


def test_production_refuses_to_start_with_vendor_auto_approval(monkeypatch):
    from app.core.config import Settings, get_settings

    monkeypatch.setattr(
        "app.core.config.Settings",
        lambda: Settings(
            app_env="production",
            jwt_secret="x" * 40,
            field_encryption_key="k",
            turnstile_secret_key="t",
            ai_provider="anthropic",
            erp_mfa_required=True,
            vendor_auto_approve=True,
        ),
    )
    get_settings.cache_clear()
    try:
        with pytest.raises(RuntimeError, match="VENDOR_AUTO_APPROVE"):
            get_settings()
    finally:
        monkeypatch.undo()
        get_settings.cache_clear()
