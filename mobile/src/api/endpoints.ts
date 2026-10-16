import { api } from './client';
import { AI_TIMEOUT_MS } from './config';
import { clearTokens, getRefreshToken, saveTokens } from './tokens';
import type { AskOut, Farmer, FarmerUpdate, FieldIn, FieldOut, LoginOut, OtpRequestOut } from './types';

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
export const createField = (field: FieldIn) => api<FieldOut>('/fields', { method: 'POST', body: field });
export const updateField = (id: number, patch: Partial<FieldIn>) =>
  api<FieldOut>(`/fields/${id}`, { method: 'PATCH', body: patch });

// ---- AI assistant (docs/api/assistant.md) ----

export function askAssistant(message: string, threadId?: number, fieldId?: number) {
  return api<AskOut>('/assistant/messages', {
    method: 'POST',
    body: { message, thread_id: threadId ?? null, field_id: threadId ? null : (fieldId ?? null) },
    timeoutMs: AI_TIMEOUT_MS,
  });
}
