import type { NextRequest } from "next/server";

import { backend, json } from "@/lib/server/backend";

/** The crop list (public on the backend), for "which crops is this for" pickers. */
export async function GET(request: NextRequest) {
  const res = await backend("/crops?lang=en", { request, method: "GET" });
  return json(await res.json(), res.status);
}
