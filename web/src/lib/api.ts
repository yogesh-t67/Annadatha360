"use client";

import type { components } from "./api-schema";

/** Shapes of the backend's responses, generated from its OpenAPI description (npm run api:types). */
export type Schemas = components["schemas"];

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }

  /** Field → message, when the backend says which fields need fixing. */
  get fields(): Record<string, string> {
    const d = this.details;
    if (d && typeof d === "object" && !Array.isArray(d)) return d as Record<string, string>;
    if (Array.isArray(d)) {
      return Object.fromEntries(
        d.filter((x) => x && typeof x === "object" && "field" in x).map((x) => [x.field, x.message]),
      );
    }
    return {};
  }
}

let renewing: Promise<boolean> | null = null;

/** Renews the login once for all requests waiting on it (several can expire at the same moment). */
function renewLogin(): Promise<boolean> {
  renewing ??= (async () => {
    try {
      const res = await fetch("/api/auth/refresh", { method: "POST" });
      if (res.status === 409) {
        await new Promise((r) => setTimeout(r, 300)); // another tab renewed it; its cookies are already here
        return true;
      }
      return res.ok;
    } finally {
      setTimeout(() => (renewing = null), 0);
    }
  })();
  return renewing;
}

function goToLogin() {
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload clears the expired session's data
  window.location.assign(`/login?next=${next}&expired=1`);
}

async function parse(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  const type = res.headers.get("content-type") ?? "";
  return type.includes("application/json") ? res.json() : res.text();
}

/**
 * Calls the backend through the web app's server: api("/me") → /api/erp/me.
 * Throws ApiError with the backend's code and message. On an expired login it renews once and retries.
 */
export async function api<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; form?: FormData; authRetry?: boolean } = {},
): Promise<T> {
  const { method = options.body || options.form ? "POST" : "GET", body, form, authRetry = true } = options;
  const init: RequestInit = { method, headers: {} };
  if (form) init.body = form;
  else if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
  }
  const res = await fetch(`/api/erp${path}`, init);
  const data = await parse(res);

  const err = (data as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
  // Only an expired or missing login is renewed; other 401s (a wrong current password) are real answers.
  if (res.status === 401 && authRetry && (err?.code === "unauthorized" || err?.code === "invalid_token")) {
    if (await renewLogin()) return api<T>(path, { ...options, authRetry: false });
    goToLogin();
  }
  if (!res.ok) {
    throw new ApiError(res.status, err?.code ?? "error", err?.message ?? "Something went wrong", err?.details);
  }
  return data as T;
}

/** For the login pages, which talk to /api/auth/* (they set and clear the login cookies). */
export async function auth<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/auth${path}`, {
    method: "POST",
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = (await parse(res)) as { error?: { code?: string; message?: string; details?: unknown } };
  if (!res.ok) {
    throw new ApiError(res.status, data?.error?.code ?? "error", data?.error?.message ?? "Something went wrong", data?.error?.details);
  }
  return data as T;
}

export const fetcher = <T,>(path: string) => api<T>(path);
