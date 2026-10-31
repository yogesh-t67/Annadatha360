"""Create the first ERP Super Admin (after that, Super Admins invite others from the web app).

python -m app.jobs.create_erp_admin admin@example.com "Full Name"

Prints a one-time link to set the password; the authenticator app is set up at first login.
"""

import sys

from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.modules.audit.service import record
from app.modules.iam.models import ErpUser, ErpUserRole
from app.modules.iam.schemas import normalize_email
from app.modules.iam.service import create_invite, invite_link


def create(db, email: str, full_name: str) -> str:
    email = normalize_email(email)
    if db.scalar(select(ErpUser.id).where(ErpUser.email == email)) is not None:
        raise ValueError(f"{email} already has an account")
    user = ErpUser(email=email, full_name=full_name.strip(), user_type="platform", status="invited")
    user.roles.append(ErpUserRole(role_code="super_admin"))
    db.add(user)
    db.flush()
    token = create_invite(db, user)
    record(db, "erp.user.create_super_admin", "erp_user", user.id, source="cli")
    db.commit()
    return invite_link(token)


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    with SessionLocal() as db:
        try:
            link = create(db, sys.argv[1], sys.argv[2])
        except ValueError as exc:
            print(f"error: {exc}")
            return 1
    hours = get_settings().erp_invite_ttl_hours
    print(f"Super Admin created. Open this link within {hours} hours to set the password (works once):\n{link}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
