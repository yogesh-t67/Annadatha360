from typing import Annotated, Literal

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.api.deps import CurrentFarmer, DbSession, ensure_crop_exists
from app.core.errors import AppError
from app.models import Crop
from app.schemas.market import MarketPricesOut
from app.services.market import price_rows

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/prices", response_model=MarketPricesOut)
def prices(
    farmer: CurrentFarmer,
    db: DbSession,
    crop: str | None = None,
    category: str | None = None,
    state: Literal["AP", "TG"] | None = None,
    district: Annotated[str | None, Query(max_length=80)] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
):
    if crop and category:
        raise AppError(422, "validation_error", "Send crop or category, not both")
    if category:
        codes = list(db.scalars(select(Crop.code).where(Crop.category == category)))
        if not codes:
            raise AppError(422, "unknown_category", f"Unknown crop category: {category}")
    else:
        code = crop or farmer.primary_crop_code
        if code is None:
            raise AppError(422, "crop_required", "Pass crop or category, or set the farmer's primary crop")
        ensure_crop_exists(db, code)
        codes = [code]

    out = price_rows(db, farmer, codes, state=state, district=district, limit=limit)
    as_of = max((p.arrival_date for p in out), default=None)
    return MarketPricesOut(as_of=as_of, prices=out)
