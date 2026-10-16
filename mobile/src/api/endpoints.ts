import { api } from './client';
import { AI_TIMEOUT_MS } from './config';
import { clearTokens, getRefreshToken, saveTokens } from './tokens';
import type {
  AskOut,
  Farmer,
  FarmerUpdate,
  FieldIn,
  FieldOut,
  ForecastOut,
  HomeOut,
  LoginOut,
  MarketPricesOut,
  OtpRequestOut,
  SchemeDetail,
  SchemeSummary,
} from './types';

// ---- Auth (docs/api/auth.md) ----

export function requestOtp(phone: string) {
  return api<OtpRequestOut>('/auth/otp/request', { method: 'POST', body: { phone }, auth: false });
}

export async function verifyOtp(phone: string, code: string): Promise<LoginOut> {
  const login = await api<LoginOut>('/auth/otp/verify', { method: 'POST', body: { phone, code }, auth: false });
  await saveTokens(login);
  return login;
}

export async function logout(): Promise<void> {
  const refresh_token = await getRefreshToken();
  if (refresh_token) {
    await api<void>('/auth/logout', { method: 'POST', body: { refresh_token }, auth: false }).catch(() => undefined);
  }
  await clearTokens();
}

// ---- Farmer & fields (docs/api/farmers.md, fields.md) ----

export const getMe = () => api<Farmer>('/farmers/me');
export const updateMe = (patch: FarmerUpdate) => api<Farmer>('/farmers/me', { method: 'PATCH', body: patch });
export const getFields = () => api<FieldOut[]>('/fields');
export const createField = (field: FieldIn) => api<FieldOut>('/fields', { method: 'POST', body: field });
export const updateField = (id: number, patch: Partial<FieldIn>) =>
  api<FieldOut>(`/fields/${id}`, { method: 'PATCH', body: patch });

// ---- Weather (docs/api/weather.md) ----

export interface WeatherLocationParams {
  lat?: number;
  lng?: number;
  fieldId?: number;
}

function locationQuery({ lat, lng, fieldId }: WeatherLocationParams): string {
  const params = new URLSearchParams();
  if (lat !== undefined && lng !== undefined) {
    params.set('lat', String(lat));
    params.set('lng', String(lng));
  } else if (fieldId !== undefined) {
    params.set('field_id', String(fieldId));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const getWeatherForecast = (loc: WeatherLocationParams = {}) =>
  api<ForecastOut>(`/weather/forecast${locationQuery(loc)}`);

// ---- Market prices (docs/api/market-prices.md) ----

export interface MarketPricesParams {
  crop?: string;
  category?: string;
  state?: 'AP' | 'TG';
  district?: string;
  limit?: number;
}

export function getMarketPrices(params: MarketPricesParams = {}) {
  const qs = new URLSearchParams();
  if (params.crop) qs.set('crop', params.crop);
  if (params.category) qs.set('category', params.category);
  if (params.state) qs.set('state', params.state);
  if (params.district) qs.set('district', params.district);
  if (params.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs}` : '';
  return api<MarketPricesOut>(`/market/prices${suffix}`);
}

// ---- Government schemes (docs/api/schemes.md) ----

export interface SchemesParams {
  authority?: 'central' | 'state';
  state?: 'AP' | 'TG';
  category?: string;
  q?: string;
}

export function getSchemes(params: SchemesParams = {}) {
  const qs = new URLSearchParams();
  if (params.authority) qs.set('authority', params.authority);
  if (params.state) qs.set('state', params.state);
  if (params.category) qs.set('category', params.category);
  if (params.q) qs.set('q', params.q);
  const suffix = qs.toString() ? `?${qs}` : '';
  return api<SchemeSummary[]>(`/schemes${suffix}`);
}

export const getScheme = (slug: string) => api<SchemeDetail>(`/schemes/${slug}`);

// ---- Home dashboard (docs/api/advisory.md) ----

export const getHome = () => api<HomeOut>('/home');

// ---- AI assistant (docs/api/assistant.md) ----

export function askAssistant(message: string, threadId?: number, fieldId?: number) {
  return api<AskOut>('/assistant/messages', {
    method: 'POST',
    body: { message, thread_id: threadId ?? null, field_id: threadId ? null : (fieldId ?? null) },
    timeoutMs: AI_TIMEOUT_MS,
  });
}
