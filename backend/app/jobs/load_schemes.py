"""Load or update government schemes from a JSON file, matched by `slug`.

    python -m app.jobs.load_schemes path/to/schemes.json

Every scheme needs `source_url` (the official page the text was taken from) and `last_verified_on`
(YYYY-MM-DD). Only `"published": true` schemes are shown in the app — publish after someone has checked
the content against the source.
"""

import json
import sys
from datetime import date

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import Scheme

REQUIRED = ("slug", "authority", "category", "name", "summary", "source_url", "last_verified_on")


def load(db, schemes: list[dict]) -> tuple[int, int]:
    inserted = updated = 0
    for raw in schemes:
        raw = dict(raw)
        missing = [k for k in REQUIRED if not raw.get(k)]
        if missing:
            raise ValueError(f"{raw.get('slug', '?')}: missing {missing}")
        if raw["authority"] not in ("central", "state"):
            raise ValueError(f"{raw['slug']}: authority must be central or state")
        if (raw["authority"] == "state") != (raw.get("state") in ("AP", "TG")):
            raise ValueError(f"{raw['slug']}: state schemes need state AP/TG; central schemes must not set one")
        if "en" not in raw["name"] or "en" not in raw["summary"]:
            raise ValueError(f"{raw['slug']}: name and summary need an English ('en') version")
        raw["last_verified_on"] = date.fromisoformat(raw["last_verified_on"])
        existing = db.scalar(select(Scheme).where(Scheme.slug == raw["slug"]))
        if existing is None:
            db.add(Scheme(**raw))
            inserted += 1
        else:
            for key, value in raw.items():
                setattr(existing, key, value)
            updated += 1
    db.commit()
    return inserted, updated


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    with open(sys.argv[1], encoding="utf-8") as f:
        schemes = json.load(f)
    with SessionLocal() as db:
        inserted, updated = load(db, schemes)
    print(f"inserted {inserted}, updated {updated}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
