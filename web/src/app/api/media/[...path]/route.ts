import type { NextRequest } from "next/server";

import { backend } from "@/lib/server/backend";

/** Public product photos: /api/media/catalog/<name> → backend /media/catalog/<name>. Cached by browsers for a year. */
export async function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const path = (await ctx.params).path.map(encodeURIComponent).join("/");
  const res = await backend(`/media/${path}`, { request, method: "GET" });
  const headers = new Headers();
  for (const name of ["content-type", "cache-control", "x-content-type-options"]) {
    const value = res.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(res.ok ? await res.arrayBuffer() : null, { status: res.status, headers });
}
