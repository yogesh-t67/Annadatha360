import type { NextRequest } from "next/server";

import { backend, clearSession, COOKIE, forbiddenOrigin, json, readCookie, sameOrigin } from "@/lib/server/backend";

/** Ends this session on the backend (and every session with ?everywhere=1), then clears the cookies. */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return forbiddenOrigin();
  const access = await readCookie(COOKIE.access);
  const everywhere = request.nextUrl.searchParams.get("everywhere") === "1";
  if (access) {
    await backend(everywhere ? "/erp/auth/logout-all" : "/erp/auth/logout", { request, method: "POST", token: access });
  }
  await clearSession();
  return json({ ok: true });
}
