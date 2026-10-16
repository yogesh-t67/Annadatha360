"""Grant or revoke staff access for an account (the person must have logged in once).

python -m app.jobs.grant_staff 9876543210 admin     # or: ops
python -m app.jobs.grant_staff 9876543210 revoke
"""

import sys

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import Farmer, Staff
from app.schemas.common import normalize_indian_mobile


def grant(db, phone: str, role: str) -> str:
    phone = normalize_indian_mobile(phone)
    farmer = db.scalar(select(Farmer).where(Farmer.phone == phone))
    if farmer is None:
        raise ValueError(f"No account for {phone} — log in with the app once first")
    staff = db.scalar(select(Staff).where(Staff.farmer_id == farmer.id))
    if role == "revoke":
        if staff is not None:
            staff.active = False
        db.commit()
        return f"{phone}: staff access revoked"
    if role not in ("ops", "admin"):
        raise ValueError("role must be ops, admin or revoke")
    if staff is None:
        db.add(Staff(farmer_id=farmer.id, role=role, active=True))
    else:
        staff.role, staff.active = role, True
    db.commit()
    return f"{phone}: {role}"


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    with SessionLocal() as db:
        try:
            print(grant(db, sys.argv[1], sys.argv[2]))
        except ValueError as exc:
            print(f"error: {exc}")
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
