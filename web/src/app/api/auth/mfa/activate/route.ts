import type { NextRequest } from "next/server";

import { finishLogin } from "@/lib/server/mfa";

/** First login: confirms the authenticator app works, and returns the one-time backup codes. */
export async function POST(request: NextRequest) {
  return finishLogin(request, "/erp/auth/mfa/activate");
}
