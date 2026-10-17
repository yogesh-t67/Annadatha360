/** Response shapes from docs/api/*.md. Only the endpoints the app calls so far. */

export type Language = 'en' | 'te' | 'hi' | 'ta' | 'kn' | 'mr' | 'gu';

export interface CropRef {
  code: string;
  name: string;
}

export interface Farmer {
  id: number;
  phone: string;
  name: string | null;
  preferred_language: Language;
  location: {
    state: 'AP' | 'TG' | null;
    district: string | null;
    mandal: string | null;
    village: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  primary_crop: CropRef | null;
  profile_complete: boolean;
  created_at: string;
}

export interface FarmerUpdate {
  name?: string;
  preferred_language?: Language;
  primary_crop_code?: string | null;
  location?: Partial<Farmer['location']>;
}

export interface OtpRequestOut {
  phone: string;
  expires_in: number;
  resend_after: number;
}

export interface LoginOut {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  expires_in: number;
  is_new_user: boolean;
  farmer: Farmer;
}

export type GrowthStage =
  | 'land_preparation'
  | 'sowing'
  | 'germination'
  | 'vegetative'
  | 'flowering'
  | 'fruiting'
  | 'maturity'
  | 'harvested';

export interface FieldIn {
  name: string;
  crop_code?: string | null;
  acreage: number;
  growth_stage?: GrowthStage | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface FieldOut extends Omit<FieldIn, 'crop_code'> {
  id: number;
  crop: CropRef | null;
}

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface ChatThread {
  id: number;
  title: string;
  field_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface AskOut {
  thread: ChatThread;
  message: ChatMessage;
  reply: ChatMessage;
}

// ---- Weather (docs/api/weather.md) ----

export type WeatherCondition =
  | 'clear'
  | 'partly_cloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'heavy_rain'
  | 'snow'
  | 'thunderstorm'
  | 'unknown';

export interface WeatherAlert {
  type: 'heavy_rain' | 'heat' | 'strong_wind' | 'thunderstorm';
  severity: 'advisory' | 'watch' | 'warning';
  date: string;
  value: number | null;
  unit: string | null;
}

export interface DayForecast {
  date: string;
  condition: WeatherCondition;
  weather_code: number;
  temp_max_c: number | null;
  temp_min_c: number | null;
  precipitation_mm: number | null;
  precipitation_probability: number | null;
  wind_max_kmh: number | null;
  humidity_mean: number | null;
  good_for_spraying: boolean;
}

// ---- Crop diagnosis (docs/api/diagnosis.md) ----

export type IssueCategory =
  | 'disease'
  | 'pest'
  | 'nutrient_deficiency'
  | 'water_stress'
  | 'weather_damage'
  | 'weed'
  | 'other'
  | 'none';

export type ActionType = 'cultural' | 'organic' | 'chemical' | 'monitor';

/** Free-text fields are in the farmer's language; enums are codes the app translates. */
export interface DiagnosisResult {
  is_plant_image: boolean;
  image_quality: 'good' | 'poor';
  crop_identified: string;
  matches_expected_crop: boolean;
  health_status: 'healthy' | 'problem_found' | 'uncertain';
  issue: { name: string; category: IssueCategory; confidence: 'low' | 'medium' | 'high' };
  symptoms: string[];
  actions: { step: string; type: ActionType }[];
  prevention: string[];
  consult_expert: boolean;
  summary: string;
}

export interface DiagnosisOut {
  id: number;
  field_id: number | null;
  crop: CropRef | null;
  language: string;
  notes: string | null;
  result: DiagnosisResult;
  created_at: string;
}

export interface ForecastOut {
  latitude: number;
  longitude: number;
  days: DayForecast[];
  alerts: WeatherAlert[];
}

// ---- Market prices (docs/api/market-prices.md) ----

export interface MarketPrice {
  crop: CropRef;
  commodity: string;
  variety: string;
  grade: string;
  market: string;
  district: string;
  state: 'AP' | 'TG';
  arrival_date: string;
  unit: string;
  currency: string;
  min_price: number | null;
  max_price: number | null;
  modal_price: number;
  previous: { arrival_date: string; modal_price: number } | null;
  change: number | null;
  change_pct: number | null;
  trend: 'up' | 'down' | 'flat' | null;
}

export interface MarketPricesOut {
  as_of: string | null;
  prices: MarketPrice[];
}

// ---- Government schemes (docs/api/schemes.md) ----

export interface SchemeSummary {
  id: number;
  slug: string;
  authority: 'central' | 'state';
  state: 'AP' | 'TG' | null;
  category: 'income_support' | 'insurance' | 'credit' | 'subsidy' | 'soil' | 'irrigation' | 'other';
  name: string;
  summary: string;
  possibly_eligible: boolean | null;
  last_verified_on: string;
}

export interface SchemeDetail extends SchemeSummary {
  benefits: string | null;
  eligibility: string[];
  documents: string[];
  steps: string[];
  application_url: string | null;
  source_url: string;
}

// ---- Home (docs/api/advisory.md) ----

export interface AdvisorySummary {
  slug: string;
  crop: CropRef | null;
  growth_stage: GrowthStage | null;
  category: 'nutrition' | 'pest_disease' | 'irrigation' | 'weed' | 'harvest' | 'weather' | 'general';
  title: string;
  last_verified_on: string;
  relevance: 'your_field' | 'your_crop' | 'general';
}

export interface HomeOut {
  farmer: Farmer;
  weather: { today: DayForecast; alerts: WeatherAlert[] } | null;
  latest_advisory: AdvisorySummary | null;
  primary_crop_price: MarketPrice | null;
  fields_count: number;
}
