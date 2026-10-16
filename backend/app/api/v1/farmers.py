from fastapi import APIRouter

from app.api.deps import CurrentFarmer, DbSession, ensure_crop_exists
from app.schemas.farmer import FarmerOut, FarmerUpdate
from app.services.serializers import farmer_out

router = APIRouter(prefix="/farmers", tags=["farmers"])


@router.get("/me", response_model=FarmerOut)
def get_me(farmer: CurrentFarmer, db: DbSession):
    return farmer_out(db, farmer)


@router.patch("/me", response_model=FarmerOut)
def update_me(body: FarmerUpdate, farmer: CurrentFarmer, db: DbSession):
    changes = body.model_dump(exclude_unset=True)
    location = changes.pop("location", None)
    if "primary_crop_code" in changes:
        ensure_crop_exists(db, changes["primary_crop_code"])
    for key, value in changes.items():
        if key in ("name", "preferred_language") and value is None:
            continue  # not nullable once set
        setattr(farmer, key, value)
    if location:
        for key, value in location.items():
            setattr(farmer, key, value)
    db.commit()
    db.refresh(farmer)
    return farmer_out(db, farmer)
