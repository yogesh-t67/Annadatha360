from fastapi import APIRouter

from app.api.v1 import (
    admin,
    advisory,
    assistant,
    auth,
    crops,
    diagnosis,
    farm,
    farmers,
    fields,
    market,
    schemes,
    services,
    shop,
    tts,
    weather,
)
from app.modules.audit import router as erp_audit
from app.modules.catalog import router as erp_catalog
from app.modules.documents import router as erp_documents
from app.modules.iam import router as erp_iam
from app.modules.vendors import admin_router as erp_admin_vendors
from app.modules.vendors import licences_router as erp_licences
from app.modules.vendors import router as erp_vendors
from app.modules.vendors import team as erp_vendor_team

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(farmers.router)
api_router.include_router(fields.router)
api_router.include_router(crops.router)
api_router.include_router(weather.router)
api_router.include_router(market.router)
api_router.include_router(assistant.router)
api_router.include_router(tts.router)
api_router.include_router(diagnosis.router)
api_router.include_router(shop.router)
api_router.include_router(schemes.router)
api_router.include_router(services.router)
api_router.include_router(farm.router)
api_router.include_router(advisory.router)
api_router.include_router(admin.router)
# ERP (vendor portal + admin web app)
api_router.include_router(erp_iam.router)
api_router.include_router(erp_audit.router)
api_router.include_router(erp_documents.router)
api_router.include_router(erp_vendors.router)
api_router.include_router(erp_admin_vendors.router)
api_router.include_router(erp_vendor_team.router)
api_router.include_router(erp_licences.router)
api_router.include_router(erp_catalog.router)
