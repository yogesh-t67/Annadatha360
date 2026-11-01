import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";

/** Everything behind the login: admin panel, vendor portal, my account. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
