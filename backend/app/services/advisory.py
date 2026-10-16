from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.i18n import resolve
from app.models import Advisory, Farmer, Field
from app.schemas.advisory import AdvisoryOut, AdvisorySummaryOut
from app.services.serializers import crop_ref

_RANK = {"your_field": 0, "your_crop": 1, "general": 2}


def farmer_targets(db: Session, farmer: Farmer) -> tuple[set[tuple[str, str]], set[str]]:
    """(crop, stage) pairs from the farmer's fields, and every crop they grow (fields + primary crop)."""
    pairs, crops = set(), set()
    for crop, stage in db.execute(select(Field.crop_code, Field.growth_stage).where(Field.farmer_id == farmer.id)):
        if crop:
            crops.add(crop)
            if stage:
                pairs.add((crop, stage))
    if farmer.primary_crop_code:
        crops.add(farmer.primary_crop_code)
    return pairs, crops


def relevance(a: Advisory, pairs: set[tuple[str, str]], crops: set[str]) -> str | None:
    """How an advisory relates to this farmer, or None if it's for crops/stages they don't have."""
    if a.crop_code is None:
        if a.growth_stage is None or any(stage == a.growth_stage for _, stage in pairs):
            return "general"
        return None
    if a.crop_code not in crops:
        return None
    if a.growth_stage is None:
        return "your_crop"
    return "your_field" if (a.crop_code, a.growth_stage) in pairs else None


def relevant_advisories(db: Session, farmer: Farmer, category: str | None = None) -> list[tuple[Advisory, str]]:
    pairs, crops = farmer_targets(db, farmer)
    q = select(Advisory).where(
        Advisory.published.is_(True), or_(Advisory.crop_code.is_(None), Advisory.crop_code.in_(crops or {""}))
    )
    if category:
        q = q.where(Advisory.category == category)
    scored = [(a, rel) for a in db.scalars(q) if (rel := relevance(a, pairs, crops))]
    scored.sort(key=lambda x: (_RANK[x[1]], -x[0].last_verified_on.toordinal(), x[0].slug))
    return scored


def summary_out(db: Session, a: Advisory, rel: str, lang: str) -> AdvisorySummaryOut:
    return AdvisorySummaryOut(
        slug=a.slug,
        crop=crop_ref(db, a.crop_code, lang),
        growth_stage=a.growth_stage,
        category=a.category,
        title=resolve(a.title, lang),
        last_verified_on=a.last_verified_on,
        relevance=rel,
    )


def detail_out(db: Session, a: Advisory, rel: str, lang: str) -> AdvisoryOut:
    return AdvisoryOut(
        **summary_out(db, a, rel, lang).model_dump(), body=resolve(a.body, lang), source_url=a.source_url
    )
