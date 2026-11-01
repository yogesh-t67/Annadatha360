import type { NextRequest } from "next/server";

import { backend, COOKIE, forbiddenOrigin, json, readCookie, sameOrigin } from "@/lib/server/backend";

/**
 * Pages call /api/erp/<path>; this forwards to the backend's /erp/<path> with the login from the cookie.
 * The browser never holds a token. Endpoints that hand out tokens go through /api/auth/* instead.
 */

const TOKEN_ENDPOINTS = /^auth\/(login|mfa\/|refresh|logout)/;
const PASS_HEADERS = [
  "content-type",
  "content-disposition",
  "cache-control",
  "content-security-policy",
  "x-content-type-options",
  "referrer-policy",
];

async function forward(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (!sameOrigin(request)) return forbiddenOrigin();
  const path = (await ctx.params).path.map(encodeURIComponent).join("/");
  if (TOKEN_ENDPOINTS.test(path)) return json({ error: { code: "not_found", message: "Not found" } }, 404);

  const headers: Record<string, string> = {};
  const contentType = request.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType; // keeps the multipart boundary for uploads
  const hasBody = !["GET", "HEAD"].includes(request.method);

  const res = await backend(`/erp/${path}${request.nextUrl.search}`, {
    request,
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    token: await readCookie(COOKIE.access),
  });

  const out = new Headers();
  for (const name of PASS_HEADERS) {
    const value = res.headers.get(name);
    if (value) out.set(name, value);
  }
  if (!out.has("cache-control")) out.set("cache-control", "no-store");
  return new Response(res.status === 204 ? null : await res.arrayBuffer(), { status: res.status, headers: out });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
