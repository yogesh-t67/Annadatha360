from collections import defaultdict
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, status
from sqlalchemy import select

from app.api.deps import CurrentFarmer, DbSession, ensure_crop_exists
from app.core.errors import AppError, not_found
from app.models import CropPlan, Field, HarvestRecord, PlanTask
from app.schemas.farm import (
    HarvestIn,
    HarvestOut,
    HarvestUpdate,
    PlanIn,
    PlanOut,
    PlanSummary,
    PlanUpdate,
    TaskIn,
    TaskOut,
    TaskUpdate,
)
from app.services.serializers import crop_ref

router = APIRouter(tags=["farm-management"])


def _paise(rupees: float | None) -> int | None:
    return None if rupees is None else round(rupees * 100)


def _rupees(paise: int | None) -> float | None:
    return None if paise is None else paise / 100


def _owned_field(db, farmer, field_id: int) -> Field:
    f = db.get(Field, field_id)
    if f is None or f.farmer_id != farmer.id:
        raise not_found("field")
    return f


def _owned_plan(db, farmer, plan_id: int) -> CropPlan:
    p = db.get(CropPlan, plan_id)
    if p is None or p.farmer_id != farmer.id:
        raise not_found("plan")
    return p


def _owned_harvest(db, farmer, harvest_id: int) -> HarvestRecord:
    h = db.get(HarvestRecord, harvest_id)
    if h is None or h.farmer_id != farmer.id:
        raise not_found("harvest")
    return h


def _harvest_revenue_paise(h: HarvestRecord) -> int | None:
    if h.sold_quantity is None or h.price_per_unit_paise is None:
        return None
    return round(h.sold_quantity * h.price_per_unit_paise)


def _task_out(t: PlanTask) -> TaskOut:
    return TaskOut(id=t.id, category=t.category, title=t.title, due_date=t.due_date, done=t.done, cost=_rupees(t.cost_paise))


def _plan_out(db, p: CropPlan, lang: str) -> PlanOut:
    cost = sum(t.cost_paise or 0 for t in p.tasks)
    revenue = sum(_harvest_revenue_paise(h) or 0 for h in p.harvests)
    harvested: dict[str, Decimal] = defaultdict(Decimal)
    for h in p.harvests:
        harvested[h.unit] += h.quantity
    return PlanOut(
        id=p.id,
        field_id=p.field_id,
        crop=crop_ref(db, p.crop_code, lang),
        season=p.season,
        year=p.year,
        sowing_date=p.sowing_date,
        expected_harvest_date=p.expected_harvest_date,
        days_since_sowing=(date.today() - p.sowing_date).days if p.sowing_date and p.sowing_date <= date.today() else None,
        status=p.status,
        notes=p.notes,
        tasks=[_task_out(t) for t in p.tasks],
        summary=PlanSummary(
            total_cost=cost / 100,
            revenue=revenue / 100,
            profit=(revenue - cost) / 100,
            harvested={unit: float(q) for unit, q in harvested.items()},
            tasks_done=sum(1 for t in p.tasks if t.done),
            tasks_total=len(p.tasks),
        ),
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


def _harvest_out(db, h: HarvestRecord, lang: str) -> HarvestOut:
    return HarvestOut(
        id=h.id,
        field_id=h.field_id,
        plan_id=h.plan_id,
        crop=crop_ref(db, h.crop_code, lang),
        harvest_date=h.harvest_date,
        quantity=float(h.quantity),
        unit=h.unit,
        sold_quantity=float(h.sold_quantity) if h.sold_quantity is not None else None,
        price_per_unit=_rupees(h.price_per_unit_paise),
        revenue=_rupees(_harvest_revenue_paise(h)),
        buyer=h.buyer,
        notes=h.notes,
        created_at=h.created_at,
    )


# ---------- Crop plans ----------


@router.get("/plans", response_model=list[PlanOut])
def list_plans(farmer: CurrentFarmer, db: DbSession, field_id: int | None = None, status: str | None = None):
    q = select(CropPlan).where(CropPlan.farmer_id == farmer.id)
    if field_id is not None:
        q = q.where(CropPlan.field_id == field_id)
    if status:
        q = q.where(CropPlan.status == status)
    rows = db.scalars(q.order_by(CropPlan.year.desc(), CropPlan.id.desc()))
    return [_plan_out(db, p, farmer.preferred_language) for p in rows]


@router.post("/fields/{field_id}/plans", response_model=PlanOut, status_code=status.HTTP_201_CREATED)
def create_plan(field_id: int, body: PlanIn, farmer: CurrentFarmer, db: DbSession):
    _owned_field(db, farmer, field_id)
    ensure_crop_exists(db, body.crop_code)
    plan = CropPlan(farmer_id=farmer.id, field_id=field_id, **body.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return _plan_out(db, plan, farmer.preferred_language)


@router.get("/plans/{plan_id}", response_model=PlanOut)
def get_plan(plan_id: int, farmer: CurrentFarmer, db: DbSession):
    return _plan_out(db, _owned_plan(db, farmer, plan_id), farmer.preferred_language)


@router.patch("/plans/{plan_id}", response_model=PlanOut)
def update_plan(plan_id: int, body: PlanUpdate, farmer: CurrentFarmer, db: DbSession):
    plan = _owned_plan(db, farmer, plan_id)
    changes = body.model_dump(exclude_unset=True)
    for key in ("crop_code", "season", "year", "status"):
        if key in changes and changes[key] is None:
            raise AppError(422, "validation_error", f"{key} cannot be null")
    if "crop_code" in changes:
        ensure_crop_exists(db, changes["crop_code"])
    sowing = changes.get("sowing_date", plan.sowing_date)
    harvest = changes.get("expected_harvest_date", plan.expected_harvest_date)
    if sowing and harvest and harvest < sowing:
        raise AppError(422, "validation_error", "expected_harvest_date can't be before sowing_date")
    for key, value in changes.items():
        setattr(plan, key, value)
    db.commit()
    db.refresh(plan)
    return _plan_out(db, plan, farmer.preferred_language)


@router.delete("/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plan(plan_id: int, farmer: CurrentFarmer, db: DbSession):
    db.delete(_owned_plan(db, farmer, plan_id))  # harvests keep their record, unlinked from the plan
    db.commit()


# ---------- Tasks ----------


def _owned_task(db, farmer, plan_id: int, task_id: int) -> PlanTask:
    _owned_plan(db, farmer, plan_id)
    t = db.get(PlanTask, task_id)
    if t is None or t.plan_id != plan_id:
        raise not_found("task")
    return t


@router.post("/plans/{plan_id}/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def add_task(plan_id: int, body: TaskIn, farmer: CurrentFarmer, db: DbSession):
    _owned_plan(db, farmer, plan_id)
    data = body.model_dump()
    task = PlanTask(plan_id=plan_id, cost_paise=_paise(data.pop("cost")), **data)
    db.add(task)
    db.commit()
    db.refresh(task)
    return _task_out(task)


@router.patch("/plans/{plan_id}/tasks/{task_id}", response_model=TaskOut)
def update_task(plan_id: int, task_id: int, body: TaskUpdate, farmer: CurrentFarmer, db: DbSession):
    task = _owned_task(db, farmer, plan_id, task_id)
    changes = body.model_dump(exclude_unset=True)
    for key in ("category", "title", "done"):
        if key in changes and changes[key] is None:
            raise AppError(422, "validation_error", f"{key} cannot be null")
    if "cost" in changes:
        task.cost_paise = _paise(changes.pop("cost"))
    for key, value in changes.items():
        setattr(task, key, value)
    db.commit()
    db.refresh(task)
    return _task_out(task)


@router.delete("/plans/{plan_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(plan_id: int, task_id: int, farmer: CurrentFarmer, db: DbSession):
    db.delete(_owned_task(db, farmer, plan_id, task_id))
    db.commit()


# ---------- Harvests ----------


@router.get("/harvests", response_model=list[HarvestOut])
def list_harvests(farmer: CurrentFarmer, db: DbSession, field_id: int | None = None, plan_id: int | None = None):
    q = select(HarvestRecord).where(HarvestRecord.farmer_id == farmer.id)
    if field_id is not None:
        q = q.where(HarvestRecord.field_id == field_id)
    if plan_id is not None:
        q = q.where(HarvestRecord.plan_id == plan_id)
    rows = db.scalars(q.order_by(HarvestRecord.harvest_date.desc(), HarvestRecord.id.desc()))
    return [_harvest_out(db, h, farmer.preferred_language) for h in rows]


@router.post("/harvests", response_model=HarvestOut, status_code=status.HTTP_201_CREATED)
def add_harvest(body: HarvestIn, farmer: CurrentFarmer, db: DbSession):
    field = _owned_field(db, farmer, body.field_id)
    plan = None
    if body.plan_id is not None:
        plan = _owned_plan(db, farmer, body.plan_id)
        if plan.field_id != field.id:
            raise AppError(422, "plan_field_mismatch", "That plan belongs to a different field")
    crop_code = body.crop_code or (plan.crop_code if plan else None) or field.crop_code
    if crop_code is None:
        raise AppError(422, "crop_required", "Pass crop_code: the field has no crop set")
    ensure_crop_exists(db, crop_code)
    data = body.model_dump(exclude={"crop_code", "price_per_unit"})
    h = HarvestRecord(farmer_id=farmer.id, crop_code=crop_code, price_per_unit_paise=_paise(body.price_per_unit), **data)
    db.add(h)
    db.commit()
    db.refresh(h)
    return _harvest_out(db, h, farmer.preferred_language)


@router.patch("/harvests/{harvest_id}", response_model=HarvestOut)
def update_harvest(harvest_id: int, body: HarvestUpdate, farmer: CurrentFarmer, db: DbSession):
    h = _owned_harvest(db, farmer, harvest_id)
    changes = body.model_dump(exclude_unset=True)
    for key in ("harvest_date", "quantity", "unit"):
        if key in changes and changes[key] is None:
            raise AppError(422, "validation_error", f"{key} cannot be null")
    if "price_per_unit" in changes:
        h.price_per_unit_paise = _paise(changes.pop("price_per_unit"))
    quantity = changes.get("quantity", h.quantity)
    sold = changes.get("sold_quantity", h.sold_quantity)
    if sold is not None and sold > quantity:
        raise AppError(422, "validation_error", "sold_quantity can't exceed quantity")
    for key, value in changes.items():
        setattr(h, key, value)
    db.commit()
    db.refresh(h)
    return _harvest_out(db, h, farmer.preferred_language)


@router.delete("/harvests/{harvest_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_harvest(harvest_id: int, farmer: CurrentFarmer, db: DbSession):
    db.delete(_owned_harvest(db, farmer, harvest_id))
    db.commit()
