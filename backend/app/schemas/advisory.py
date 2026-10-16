from datetime import date

from pydantic import BaseModel

from app.schemas.farmer import CropRef, FarmerOut
from app.schemas.field import GrowthStage
from app.schemas.market import MarketPriceOut
from app.schemas.weather import DayForecast, WeatherAlert


class AdvisorySummaryOut(BaseModel):
    slug: str
    crop: CropRef | None
    growth_stage: GrowthStage | None
    category: str
    title: str
    last_verified_on: date
    relevance: str  # "your_field" | "your_crop" | "general"


class AdvisoryOut(AdvisorySummaryOut):
    body: str
    source_url: str


class HomeWeather(BaseModel):
    today: DayForecast | None
    alerts: list[WeatherAlert]


class HomeOut(BaseModel):
    farmer: FarmerOut
    weather: HomeWeather | None  # null: no location set, or the weather provider is down
    latest_advisory: AdvisorySummaryOut | None
    primary_crop_price: MarketPriceOut | None  # nearest market's latest price for the primary crop
    fields_count: int
