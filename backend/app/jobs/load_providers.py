"""Load or update labour / farm-service providers and their offerings from JSON, matched by provider `code`.

    python -m app.jobs.load_providers path/to/providers.json

Provider: code, kind (labour|farm_service), name, phone, state (AP|TG), district, optional mandal,
latitude, longitude, description {en, te}, rating, rating_count, verified, active, and
offerings: [{service_type, rate_paise, daily_capacity, active}]. A provider's offerings are replaced
by the file's list (bookings keep pointing at old offerings, which are deactivated, not deleted).
"""

import json
import sys

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import ServiceOffering, ServiceProvider
from app.models.services import SERVICE_TYPES
from app.schemas.common import normalize_indian_mobile

REQUIRED = ("code", "kind", "name", "phone", "state", "district", "offerings")


def load(db, providers: list[dict]) -> tuple[int, int]:
    inserted = updated = 0
    for raw in providers:
        raw = dict(raw)
        missing = [k for k in REQUIRED if k not in raw]
        if missing:
            raise ValueError(f"{raw.get('code', '?')}: missing {missing}")
        if raw["state"] not in ("AP", "TG"):
            raise ValueError(f"{raw['code']}: state must be AP or TG")
        raw["phone"] = normalize_indian_mobile(raw["phone"])
        offerings = raw.pop("offerings")
        for o in offerings:
            kind_unit = SERVICE_TYPES.get(o["service_type"])
            if kind_unit is None:
                raise ValueError(f"{raw['code']}: unknown service type {o['service_type']}")
            if kind_unit[0] != raw["kind"]:
                raise ValueError(f"{raw['code']}: {o['service_type']} is not a {raw['kind']} service")

        provider = db.scalar(select(ServiceProvider).where(ServiceProvider.code == raw["code"]))
        if provider is None:
            provider = ServiceProvider(**raw)
            db.add(provider)
            inserted += 1
        else:
            for key, value in raw.items():
                setattr(provider, key, value)
            for old in provider.offerings:
                old.active = False
            updated += 1
        db.flush()

        existing = {o.service_type: o for o in provider.offerings}
        for o in offerings:
            unit = SERVICE_TYPES[o["service_type"]][1]
            row = existing.get(o["service_type"])
            if row is None:
                db.add(ServiceOffering(provider_id=provider.id, unit=unit, **{"active": True, **o}))
            else:
                row.rate_paise, row.daily_capacity = o["rate_paise"], o["daily_capacity"]
                row.unit, row.active = unit, o.get("active", True)
    db.commit()
    return inserted, updated


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    with open(sys.argv[1], encoding="utf-8") as f:
        providers = json.load(f)
    with SessionLocal() as db:
        inserted, updated = load(db, providers)
    print(f"inserted {inserted}, updated {updated}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
