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
