import type { NextRequest } from "next/server";

import { backend, forbiddenOrigin, json, sameOrigin, saveSession, setMfaToken } from "@/lib/server/backend";

/**
 * Step 1: email + password. The short-lived token for step 2 goes into a cookie, never to the page.
 * When the backend doesn't ask for the authenticator code (stage "done"), the session cookies are set right here.
 */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return forbiddenOrigin();
  const res = await backend("/erp/auth/login", {
    request,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
  });
  const body = await res.json();
  if (!res.ok) return json(body, res.status);
  if (body.stage === "done") {
    await saveSession(body.session);
    return json({ stage: "done" });
  }
  await setMfaToken(body.mfa_token);
  return json({ stage: body.stage });
}
