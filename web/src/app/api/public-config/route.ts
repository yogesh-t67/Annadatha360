import { json } from "@/lib/server/backend";

/**
 * Settings the browser may know, read from the server's environment when the app runs (not baked in at build),
 * so the same image works on every server and keys can change without a rebuild.
 */
export function GET() {
  return json({ turnstile_site_key: process.env.TURNSTILE_SITE_KEY ?? "" });
}
