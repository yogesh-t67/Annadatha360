import type { NextRequest } from "next/server";

import { backend, clearSession, COOKIE, forbiddenOrigin, json, readCookie, sameOrigin, saveSession } from "@/lib/server/backend";

/**
 * Renews the login when the 10-minute access token has run out. The page calls this once and retries.
 * 409 refresh_superseded: another tab renewed at the same moment; its new cookies are already in the browser,
 * so the page simply retries (the session is not ended).
 */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return forbiddenOrigin();
  const refresh = await readCookie(COOKIE.refresh);
  if (!refresh) return json({ error: { code: "not_logged_in", message: "Log in again." } }, 401);
  const res = await backend("/erp/auth/refresh", {
    request,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  const body = await res.json();
  if (res.status === 409) return json(body, 409);
  if (!res.ok) {
    await clearSession();
    return json(body, res.status);
  }
  await saveSession(body);
  return json({ user: body.user });
}
