import "server-only";

import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

/**
 * The web app's server talks to the FastAPI backend; the browser never does, and never sees a login token.
 * Tokens live in httpOnly cookies that page scripts can't read.
 */

export const API_URL = (process.env.ERP_API_URL ?? "http://localhost:8010/api/v1").replace(/\/$/, "");

export const COOKIE = {
  access: "a360_at",
  refresh: "a360_rt",
  mfa: "a360_mfa", // short-lived, between the password step and the code step
  userType: "a360_ut", // "platform" | "vendor": lets the proxy send people to the right area
} as const;

const secure = process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false";
const base = { httpOnly: true, secure, sameSite: "strict" as const, path: "/" };

export type SessionOut = {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  user: { user_type: string } & Record<string, unknown>;
};

/** Headers that tell the backend who the real visitor is (rate limits and the audit log need their address). */
export function forwardHeaders(request: NextRequest): Record<string, string> {
  const ip =
    request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const headers: Record<string, string> = {};
  if (ip) headers["X-Real-IP"] = ip;
  const ua = request.headers.get("user-agent");
  if (ua) headers["User-Agent"] = ua;
  return headers;
}

export async function backend(
  path: string,
  init: RequestInit & { request: NextRequest; token?: string | null },
): Promise<Response> {
  const { request, token, ...rest } = init;
  const headers = new Headers(rest.headers);
  for (const [k, v] of Object.entries(forwardHeaders(request))) headers.set(k, v);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API_URL}${path}`, { ...rest, headers, cache: "no-store", redirect: "manual" });
}

export async function saveSession(session: SessionOut) {
  const jar = await cookies();
  jar.set(COOKIE.access, session.access_token, { ...base, maxAge: session.expires_in });
  // The backend ends sessions after 12 hours (and 30 idle minutes); the cookie needn't outlive that.
  jar.set(COOKIE.refresh, session.refresh_token, { ...base, maxAge: 12 * 60 * 60 });
  jar.set(COOKIE.userType, session.user.user_type, { ...base, maxAge: 12 * 60 * 60 });
  jar.delete(COOKIE.mfa);
}

export async function clearSession() {
  const jar = await cookies();
  for (const name of Object.values(COOKIE)) jar.delete(name);
}

export async function setMfaToken(token: string) {
  (await cookies()).set(COOKIE.mfa, token, { ...base, maxAge: 5 * 60 });
}

export async function readCookie(name: string): Promise<string | undefined> {
  return (await cookies()).get(name)?.value;
}

/** State-changing requests must come from our own pages (on top of SameSite=strict cookies). */
export function sameOrigin(request: NextRequest): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  // Compare with the address the browser used (nginx passes it on), not the server's own idea of its address.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function forbiddenOrigin() {
  return json({ error: { code: "bad_origin", message: "Request must come from the ERP itself" } }, 403);
}
