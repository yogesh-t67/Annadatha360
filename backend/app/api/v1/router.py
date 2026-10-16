from fastapi import APIRouter

from app.api.v1 import assistant, auth, crops, diagnosis, farmers, fields, market, schemes, shop, weather

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(farmers.router)
api_router.include_router(fields.router)
api_router.include_router(crops.router)
api_router.include_router(weather.router)
api_router.include_router(market.router)
api_router.include_router(assistant.router)
api_router.include_router(diagnosis.router)
api_router.include_router(shop.router)
api_router.include_router(schemes.router)
