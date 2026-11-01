import type { NextRequest } from "next/server";

import { finishLogin } from "@/lib/server/mfa";

export async function POST(request: NextRequest) {
  return finishLogin(request, "/erp/auth/mfa/verify");
}
