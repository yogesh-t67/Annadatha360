from typing import Annotated, Literal

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.api.deps import CurrentFarmer, DbSession, ensure_crop_exists
from app.core.errors import AppError
from app.models import Crop
from app.schemas.market import MarketPriceOut, MarketPricesOut, PreviousPrice
from app.services.market import latest_with_trend
from app.services.serializers import crop_ref

router = APIRouter(prefix="/market", tags=["market"])

# Changes smaller than this (in %) count as "flat" — mandi prices wobble daily.
FLAT_THRESHOLD_PCT = 1.0


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

    pairs = latest_with_trend(db, codes, state=state, district=district)

    # Farmer's own district first, then nearest-in-time, then alphabetical.
    home = (farmer.district or "").lower()
    pairs.sort(key=lambda p: (p[0].district.lower() != home, -p[0].arrival_date.toordinal(), p[0].market))

    lang = farmer.preferred_language
    out = []
    for latest, prev in pairs[:limit]:
        change = change_pct = trend = None
        if prev is not None:
            change = latest.modal_price - prev.modal_price
            change_pct = round(float(change / prev.modal_price * 100), 2)
            trend = "flat" if abs(change_pct) < FLAT_THRESHOLD_PCT else ("up" if change > 0 else "down")
        out.append(
            MarketPriceOut(
                crop=crop_ref(db, latest.crop_code, lang),
                commodity=latest.commodity,
                variety=latest.variety,
                grade=latest.grade,
                market=latest.market,
                district=latest.district,
                state=latest.state,
                arrival_date=latest.arrival_date,
                min_price=latest.min_price,
                max_price=latest.max_price,
                modal_price=latest.modal_price,
                previous=PreviousPrice(arrival_date=prev.arrival_date, modal_price=prev.modal_price) if prev else None,
                change=change,
                change_pct=change_pct,
                trend=trend,
            )
        )
    as_of = max((p.arrival_date for p in out), default=None)
    return MarketPricesOut(as_of=as_of, prices=out)
