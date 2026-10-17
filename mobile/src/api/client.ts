import i18n from 'i18next';

import { API_BASE_URL, DEFAULT_TIMEOUT_MS } from './config';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens, TokenPair } from './tokens';

/**
 * Every backend error has the shape {"error": {"code", "message", "details"?}} (docs/api/README.md).
 * Branch on `code`; `message` is English, for logs only. Client-side failures use status 0 with
 * code "network_error" or "timeout".
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface RequestOptions {
  method?: Method;
  /** JSON-encoded, unless it's FormData (sent as multipart; fetch sets the boundary header). */
  body?: unknown;
  /** Send the bearer token (default true). */
  auth?: boolean;
  timeoutMs?: number;
}

/**
 * Multipart upload via XMLHttpRequest. Expo SDK 57 replaces global fetch with expo/fetch, which can't send
 * React Native file parts ({uri, name, type}); RN's XHR can. Returns a standard Response.
 */
function sendForm(url: string, method: Method, headers: Record<string, string>, body: FormData, timeoutMs: number) {
  return new Promise<Response>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.timeout = timeoutMs;
    xhr.onload = () => resolve(new Response(xhr.responseText, { status: xhr.status }));
    xhr.ontimeout = () => reject(new ApiError(0, 'timeout', `Request timed out: ${method} ${url}`));
    xhr.onerror = () => reject(new ApiError(0, 'network_error', `Network error: ${method} ${url}`));
    xhr.send(body);
  });
}

async function send(path: string, { method = 'GET', body, auth = true, timeoutMs = DEFAULT_TIMEOUT_MS }: RequestOptions) {
  // The server follows the language the screen is showing (content, scheme text, AI replies).
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-App-Language': i18n.language === 'te' ? 'te' : 'en',
    // Beta backend runs behind an ngrok tunnel; this skips ngrok's free-plan browser warning page.
    'ngrok-skip-browser-warning': '1',
  };
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (isForm) return sendForm(`${API_BASE_URL}${path}`, method, headers, body, timeoutMs);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    if (controller.signal.aborted) throw new ApiError(0, 'timeout', `Request timed out: ${method} ${path}`);
    throw new ApiError(0, 'network_error', `Network error: ${method} ${path}: ${String(e)}`);
  } finally {
    clearTimeout(timer);
  }
}

let refreshing: Promise<boolean> | null = null;

/** Swap the refresh token for a new pair. Concurrent 401s share one refresh. */
function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    const refresh_token = await getRefreshToken();
    if (!refresh_token) return false;
    const res = await send('/auth/refresh', { method: 'POST', body: { refresh_token }, auth: false });
    if (!res.ok) {
      await clearTokens(); // refresh token expired or revoked: the farmer must verify their phone again
      return false;
    }
    await saveTokens((await res.json()) as TokenPair);
    return true;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let res = await send(path, options);
  if (res.status === 401 && options.auth !== false && (await refreshSession())) {
    res = await send(path, options);
  }
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON body (e.g. a proxy error page); handled below.
  }
  if (!res.ok) {
    const err = data?.error;
    throw new ApiError(res.status, err?.code ?? 'http_error', err?.message ?? `HTTP ${res.status}`, err?.details);
  }
  return data as T;
}
