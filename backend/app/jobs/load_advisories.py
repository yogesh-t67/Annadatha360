"""Load or update crop advisories from JSON, matched by `slug`.

    python -m app.jobs.load_advisories path/to/advisories.json

Each advisory: slug, category, title {en, te}, body {en, te}, source_url, last_verified_on (YYYY-MM-DD),
optional crop_code (null = any crop), growth_stage (null = any stage), published (default false).
Advice should come from an agricultural university, ICAR, or the state agriculture department —
put that page in source_url — and be reviewed before publishing.
"""

import json
import sys
from datetime import date

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import Advisory, Crop

REQUIRED = ("slug", "category", "title", "body", "source_url", "last_verified_on")
CATEGORIES = {"nutrition", "pest_disease", "irrigation", "weed", "harvest", "weather", "general"}
STAGES = {
    "land_preparation",
    "sowing",
    "germination",
    "vegetative",
    "flowering",
    "fruiting",
    "maturity",
    "harvested",
}


def load(db, advisories: list[dict]) -> tuple[int, int]:
    crops = set(db.scalars(select(Crop.code)))
    inserted = updated = 0
    for raw in advisories:
        raw = dict(raw)
        missing = [k for k in REQUIRED if not raw.get(k)]
        if missing:
            raise ValueError(f"{raw.get('slug', '?')}: missing {missing}")
        if raw["category"] not in CATEGORIES:
            raise ValueError(f"{raw['slug']}: unknown category {raw['category']}")
        if raw.get("crop_code") is not None and raw["crop_code"] not in crops:
            raise ValueError(f"{raw['slug']}: unknown crop {raw['crop_code']}")
        if raw.get("growth_stage") is not None and raw["growth_stage"] not in STAGES:
            raise ValueError(f"{raw['slug']}: unknown growth stage {raw['growth_stage']}")
        if "en" not in raw["title"] or "en" not in raw["body"]:
            raise ValueError(f"{raw['slug']}: title and body need an English ('en') version")
        raw["last_verified_on"] = date.fromisoformat(raw["last_verified_on"])
        existing = db.scalar(select(Advisory).where(Advisory.slug == raw["slug"]))
        if existing is None:
            db.add(Advisory(**raw))
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
        advisories = json.load(f)
    with SessionLocal() as db:
        inserted, updated = load(db, advisories)
    print(f"inserted {inserted}, updated {updated}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
