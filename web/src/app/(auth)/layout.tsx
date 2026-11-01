import type { ReactNode } from "react";

import { Logo } from "@/components/ui";

/** Centered card for login, invite, password reset and sign-up pages. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="mb-8">
        <Logo size="lg" />
      </div>
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-8 text-xs text-muted">Annadata 360 · Vendor portal and admin</p>
    </main>
  );
}
