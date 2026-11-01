import "server-only";

import type { NextRequest } from "next/server";

import { backend, COOKIE, forbiddenOrigin, json, readCookie, sameOrigin, saveSession } from "./backend";

/** Step 2 (code from the authenticator app, or a backup code). On success the session cookies are set. */
export async function finishLogin(request: NextRequest, path: "/erp/auth/mfa/verify" | "/erp/auth/mfa/activate") {
  if (!sameOrigin(request)) return forbiddenOrigin();
  const mfaToken = await readCookie(COOKIE.mfa);
  if (!mfaToken) return json({ error: { code: "login_expired", message: "Login timed out. Enter your password again." } }, 401);
  const { code } = (await request.json()) as { code?: string };
  const res = await backend(path, {
    request,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mfa_token: mfaToken, code: (code ?? "").replace(/\s/g, "") }),
  });
  const body = await res.json();
  if (!res.ok) return json(body, res.status);
  await saveSession(body);
  // Tokens stay on the server side; the page gets the user and (first login only) the backup codes.
  return json({ user: body.user, backup_codes: body.backup_codes });
}
