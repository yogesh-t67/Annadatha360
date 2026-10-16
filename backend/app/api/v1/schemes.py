from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Query
from sqlalchemy import func, or_, select

from app.api.deps import CurrentFarmer, DbSession
from app.core.errors import not_found
from app.core.i18n import resolve
from app.models import Farmer, Field, Scheme
from app.schemas.scheme import SchemeOut, SchemeSummaryOut

router = APIRouter(prefix="/schemes", tags=["schemes"])


def _farmer_facts(db, farmer: Farmer) -> tuple[Decimal | None, set[str]]:
    acres = db.scalar(select(func.sum(Field.acreage)).where(Field.farmer_id == farmer.id))
    crops = set(db.scalars(select(Field.crop_code).where(Field.farmer_id == farmer.id, Field.crop_code.is_not(None))))
    if farmer.primary_crop_code:
        crops.add(farmer.primary_crop_code)
    return (Decimal(str(acres)) if acres is not None else None), crops


def _possibly_eligible(s: Scheme, acres: Decimal | None, crops: set[str]) -> bool | None:
    """Rough hint from land size and crops only. Never a promise — the eligibility text is what counts."""
    unknown = False
    if s.max_land_acres is not None:
        if acres is None:
            unknown = True
        elif acres > s.max_land_acres:
            return False
    if s.crop_codes:
        if not crops:
            unknown = True
        elif not crops & set(s.crop_codes):
            return False
    return None if unknown else True


def _summary(s: Scheme, lang: str, acres, crops) -> dict:
    return {
        "id": s.id,
        "slug": s.slug,
        "authority": s.authority,
        "state": s.state,
        "category": s.category,
        "name": resolve(s.name, lang),
        "summary": resolve(s.summary, lang),
        "possibly_eligible": _possibly_eligible(s, acres, crops),
        "last_verified_on": s.last_verified_on,
    }


@router.get("", response_model=list[SchemeSummaryOut])
def list_schemes(
    farmer: CurrentFarmer,
    db: DbSession,
    authority: Literal["central", "state"] | None = None,
    state: Literal["AP", "TG"] | None = None,
    category: str | None = None,
    q: Annotated[str | None, Query(max_length=80)] = None,
):
    query = select(Scheme).where(Scheme.published.is_(True))
    if authority:
        query = query.where(Scheme.authority == authority)
    # State schemes: the requested state, else the farmer's state, else both.
    state = state or farmer.state
    if state:
        query = query.where(or_(Scheme.state.is_(None), Scheme.state == state))
    if category:
        query = query.where(Scheme.category == category)
    rows = list(db.scalars(query.order_by(Scheme.authority, Scheme.slug)))
    if q:
        needle = q.strip().lower()
        rows = [s for s in rows if any(needle in v.lower() for t in (s.name, s.summary) for v in (t or {}).values())]

    lang = farmer.preferred_language
    acres, crops = _farmer_facts(db, farmer)
    out = [_summary(s, lang, acres, crops) for s in rows]
    out.sort(key=lambda s: s["possibly_eligible"] is False)  # likely-ineligible last, otherwise stable
    return out


@router.get("/{slug}", response_model=SchemeOut)
def get_scheme(slug: str, farmer: CurrentFarmer, db: DbSession):
    s = db.scalar(select(Scheme).where(Scheme.slug == slug, Scheme.published.is_(True)))
    if s is None:
        raise not_found("scheme")
    lang = farmer.preferred_language
    acres, crops = _farmer_facts(db, farmer)
    return SchemeOut(
        **_summary(s, lang, acres, crops),
        benefits=resolve(s.benefits, lang),
        eligibility=[resolve(t, lang) for t in s.eligibility or []],
        documents=[resolve(t, lang) for t in s.documents or []],
        steps=[resolve(t, lang) for t in s.steps or []],
        application_url=s.application_url,
        source_url=s.source_url,
    )
