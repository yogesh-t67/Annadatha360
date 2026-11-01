import type { NextRequest } from "next/server";

import { backend, forbiddenOrigin, json, sameOrigin, setMfaToken } from "@/lib/server/backend";

/** Step 1: email + password. The short-lived token for step 2 goes into a cookie, never to the page. */
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
  await setMfaToken(body.mfa_token);
  return json({ stage: body.stage });
}
