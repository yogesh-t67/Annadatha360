import type { NextRequest } from "next/server";

import { backend, COOKIE, forbiddenOrigin, json, readCookie, sameOrigin } from "@/lib/server/backend";

/** First login: a new authenticator secret, shown as a QR code. */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return forbiddenOrigin();
  const mfaToken = await readCookie(COOKIE.mfa);
  if (!mfaToken) return json({ error: { code: "login_expired", message: "Login timed out. Enter your password again." } }, 401);
  const res = await backend("/erp/auth/mfa/setup", {
    request,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mfa_token: mfaToken }),
  });
  return json(await res.json(), res.status);
}
