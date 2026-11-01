"use client";

import clsx from "clsx";
import { ClipboardList, LayoutDashboard, LogOut, Menu, Package, Store, UserCog, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, type ReactNode, useContext, useState } from "react";
import useSWR from "swr";

import { Logo, Spinner } from "@/components/ui";
import { fetcher, type Schemas } from "@/lib/api";

export type Me = Schemas["MeOut"];

type NavItem = { href: string; label: string; icon: LucideIcon; permission?: string };

// Menu items are added here as each part of the ERP is built.
const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/vendors", label: "Vendors", icon: Store, permission: "vendors.view" },
  { href: "/admin/listings", label: "Listings", icon: Package, permission: "catalog.review" },
];
const VENDOR_NAV: NavItem[] = [
  { href: "/vendor", label: "Overview", icon: LayoutDashboard },
  { href: "/vendor/application", label: "Application", icon: ClipboardList, permission: "vendor.profile.edit" },
  { href: "/vendor/listings", label: "Listings", icon: Package, permission: "vendor.catalog.edit" },
];
const COMMON_NAV: NavItem[] = [{ href: "/account", label: "My account", icon: UserCog }];

const MeContext = createContext<Me | null>(null);

/** The logged-in person, for any page inside the app shell. */
export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe must be used inside AppShell");
  return me;
}

export function can(me: Me, permission?: string) {
  return !permission || me.permissions.includes(permission);
}

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload clears the previous user's data
  window.location.assign("/login");
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { data: me, error } = useSWR<Me>("/me", fetcher, { revalidateOnFocus: false });

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted">
        Couldn&apos;t load your account. <button className="ml-1 text-brand-700 underline" onClick={() => location.reload()}>Try again</button>
      </div>
    );
  }
  if (!me) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const area = me.user_type === "platform" ? ADMIN_NAV : VENDOR_NAV;
  const nav = [...area, ...COMMON_NAV].filter((item) => can(me, item.permission));
  const isActive = (href: string) => pathname === href || (href !== "/admin" && href !== "/vendor" && pathname.startsWith(href));

  const sidebar = (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-1 p-3">
      {nav.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          aria-current={isActive(href) ? "page" : undefined}
          className={clsx(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
            isActive(href) ? "bg-brand-50 text-brand-800" : "text-muted hover:bg-canvas hover:text-ink",
          )}
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );

  const footer = (
    <div className="border-t border-line p-3">
      <p className="truncate px-3 text-sm font-medium">{me.full_name}</p>
      <p className="truncate px-3 text-xs text-muted">{me.email}</p>
      <button
        onClick={logout}
        className="mt-2 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted hover:bg-canvas hover:text-ink"
      >
        <LogOut className="size-4" aria-hidden /> Log out
      </button>
    </div>
  );

  return (
    <MeContext value={me}>
      <div className="flex min-h-screen flex-1">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
          <div className="flex h-16 items-center gap-2 border-b border-line px-6">
            <Logo />
            <span className="rounded bg-canvas px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">
              {me.user_type === "platform" ? "Admin" : "Vendor"}
            </span>
          </div>
          {sidebar}
          {footer}
        </aside>

        {/* Phone: top bar + slide-in menu */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b border-line bg-surface px-4 md:hidden">
            <Logo />
            <button aria-label="Open menu" onClick={() => setOpen(true)} className="rounded p-2 hover:bg-canvas">
              <Menu className="size-5" />
            </button>
          </header>
          {open && (
            <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
              <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
              <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-surface shadow-lg">
                <div className="flex h-14 items-center justify-between border-b border-line px-4">
                  <Logo />
                  <button aria-label="Close menu" onClick={() => setOpen(false)} className="rounded p-2 hover:bg-canvas">
                    <X className="size-5" />
                  </button>
                </div>
                {sidebar}
                {footer}
              </aside>
            </div>
          )}
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </MeContext>
  );
}
