"""Load or update the Agri Mart catalogue from a JSON file (list of products), matched by `sku`.

    python -m app.jobs.load_products path/to/products.json

Each product: sku, category_code, name {en, te, ...}, description {..}, brand, pack_size,
price_paise, mrp_paise, stock, image_urls [..], crop_codes [..], active (default true).
Products missing from the file are left alone (deactivate them with "active": false).
"""

import json
import sys

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import Product, ProductCategory

REQUIRED = ("sku", "category_code", "name", "pack_size", "price_paise", "mrp_paise", "stock")


def load(db, products: list[dict]) -> tuple[int, int]:
    categories = set(db.scalars(select(ProductCategory.code)))
    inserted = updated = 0
    for raw in products:
        missing = [k for k in REQUIRED if k not in raw]
        if missing:
            raise ValueError(f"{raw.get('sku', '?')}: missing {missing}")
        if raw["category_code"] not in categories:
            raise ValueError(f"{raw['sku']}: unknown category {raw['category_code']}")
        if raw["price_paise"] > raw["mrp_paise"]:
            raise ValueError(f"{raw['sku']}: price above MRP")
        existing = db.scalar(select(Product).where(Product.sku == raw["sku"]))
        if existing is None:
            db.add(Product(**raw))
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
        products = json.load(f)
    with SessionLocal() as db:
        inserted, updated = load(db, products)
    print(f"inserted {inserted}, updated {updated}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
