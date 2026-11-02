"use client";

import clsx from "clsx";
import {
  ArrowRight,
  BadgeCheck,
  ClipboardList,
  EyeOff,
  Landmark,
  MapPin,
  Package,
  PackagePlus,
  RefreshCw,
  ShoppingCart,
  TriangleAlert,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import useSWR from "swr";

import { can, useMe } from "@/components/app-shell";
import { Alert, Badge, Spinner } from "@/components/ui";
import { fetcher, type Schemas } from "@/lib/api";
import type { Listing } from "@/lib/catalog";
import { mediaUrl, STATUS_LABELS, stepOf, type Vendor } from "@/lib/vendor";

/** Stock at or below this shows in "Running low". */
const LOW_STOCK = 10;
const APPLICATION_STEPS = ["business", "offerings", "areas", "bank", "licences"];

type Tint = "leaf" | "sky" | "sun" | "clay" | "stone" | "water";
const TINT: Record<Tint, string> = {
  leaf: "bg-tint-leaf-bg border-tint-leaf-border text-brand-800",
  sky: "bg-tint-sky-bg border-tint-sky-border text-info",
  sun: "bg-tint-sun-bg border-tint-sun-border text-warning",
  clay: "bg-tint-clay-bg border-tint-clay-border text-danger",
  stone: "bg-tint-stone-bg border-tint-stone-border text-ink",
  water: "bg-tint-water-bg border-tint-water-border text-brand-800",
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Panel({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("rounded-lg border border-line bg-surface p-5 shadow-sm", className)}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-display text-h2 font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Stat({ icon: Icon, label, value, note, tint, href }: { icon: LucideIcon; label: string; value: ReactNode; note?: ReactNode; tint: Tint; href?: string }) {
  const body = (
    <div className="flex h-full items-start gap-3 rounded-lg border border-line bg-surface p-4 shadow-sm transition-colors hover:border-brand-600">
      <span className={clsx("flex size-11 shrink-0 items-center justify-center rounded-md border", TINT[tint])}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-caption text-muted">{label}</p>
        <p className="font-display text-display font-bold leading-tight tabular-nums">{value}</p>
        {note && <p className="mt-0.5 truncate text-micro text-muted">{note}</p>}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-md border border-line px-3 py-2.5 text-sm font-medium hover:border-brand-600 hover:bg-brand-50">
      <Icon className="size-4 text-brand-700" aria-hidden />
      {label}
      <ArrowRight className="ml-auto size-4 text-muted" aria-hidden />
    </Link>
  );
}

/** Green → amber (30 days) → red (expired), filled by how much of a year is left. */
function LicenceBar({ daysLeft }: { daysLeft: number }) {
  const pct = Math.max(4, Math.min(100, (daysLeft / 365) * 100));
  const tone = daysLeft <= 0 ? "bg-danger" : daysLeft <= 30 ? "bg-accent" : "bg-brand-600";
  return (
    <div className="h-1.5 w-full rounded-full bg-gray100" aria-hidden>
      <div className={clsx("h-1.5 rounded-full", tone)} style={{ width: `${daysLeft <= 0 ? 100 : pct}%` }} />
    </div>
  );
}

export default function VendorHome() {
  const me = useMe();
  const { data: vendor, error } = useSWR<Vendor>("/vendor", fetcher);
  const approved = vendor?.status === "approved";
  const { data: listings } = useSWR<Listing[]>(approved ? "/catalog/listings" : null, fetcher);
  const owner = can(me, "vendor.team.manage");
  const { data: team } = useSWR<Schemas["TeamMemberOut"][]>(owner ? "/vendor/team" : null, fetcher);

  if (error) return <Alert kind="error">{error.message ?? "Couldn't load your business."}</Alert>;
  if (!vendor) return <Spinner />;

  const status = STATUS_LABELS[vendor.status] ?? { label: vendor.status, tone: "neutral" as const };
  const openSteps = new Set(vendor.missing.map((m) => stepOf(m.code)));
  const stepsDone = APPLICATION_STEPS.filter((s) => !openSteps.has(s)).length;

  const live = listings?.filter((l) => l.visible_to_farmers) ?? [];
  const hidden = listings?.filter((l) => !l.visible_to_farmers) ?? [];
  const lowStock = (listings ?? [])
    .flatMap((l) => l.variants.filter((v) => v.stock_qty !== null && v.stock_qty <= LOW_STOCK).map((v) => ({ l, v })))
    .sort((a, b) => (a.v.stock_qty ?? 0) - (b.v.stock_qty ?? 0));
  const byCategory = Object.entries(
    (listings ?? []).reduce<Record<string, number>>((acc, l) => ({ ...acc, [l.category_name]: (acc[l.category_name] ?? 0) + 1 }), {}),
  ).sort((a, b) => b[1] - a[1]);
  const maxCategory = Math.max(1, ...byCategory.map(([, n]) => n));

  const licences = vendor.licences.filter((l) => l.status === "valid").sort((a, b) => a.days_left - b.days_left);
  const expiring = licences.filter((l) => l.days_left <= 30);
  const pendingRenewals = vendor.licences.filter((l) => l.status === "pending_review").length;

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-caption text-muted">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
          <h1 className="font-display text-h1 font-bold">
            {greeting()}, {me.full_name.split(" ")[0]}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="font-medium text-ink">{vendor.trade_name}</span>
            <Badge tone={status.tone}>{status.label}</Badge>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {vendor.service_areas.length} district{vendor.service_areas.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        {approved && (
          <Link href="/vendor/listings/new" className="inline-flex h-10 items-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
            <PackagePlus className="size-4" /> Add listing
          </Link>
        )}
      </div>

      {/* Setup banner until approved */}
      {!approved && (
        <section className="mb-6 overflow-hidden rounded-lg border border-tint-leaf-border bg-tint-leaf-bg">
          <div className="flex flex-wrap items-center gap-5 p-5">
            <span className="flex size-12 items-center justify-center rounded-full bg-surface text-brand-700 shadow-sm">
              <ClipboardList className="size-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-h2 font-bold text-brand-800">
                {vendor.status === "rejected"
                  ? "Annadata asked for some changes"
                  : vendor.status === "suspended"
                    ? "Your account is suspended"
                    : vendor.editable
                      ? "Finish setting up your business"
                      : "Your application is being reviewed"}
              </h2>
              <p className="text-sm text-muted">
                {vendor.editable
                  ? vendor.missing.length === 0
                    ? "Everything is filled in. Submit your application to start listing."
                    : `${stepsDone} of ${APPLICATION_STEPS.length} steps done. Complete the rest, then submit.`
                  : vendor.status === "suspended"
                    ? "You're hidden from farmers. Contact Annadata support."
                    : "We'll email you when it's decided."}
              </p>
              {vendor.editable && (
                <div className="mt-3 h-2 w-full max-w-md rounded-full bg-surface" aria-label={`${stepsDone} of ${APPLICATION_STEPS.length} steps done`}>
                  <div className="h-2 rounded-full bg-brand-600" style={{ width: `${(stepsDone / APPLICATION_STEPS.length) * 100}%` }} />
                </div>
              )}
            </div>
            <Link
              href={vendor.editable && vendor.missing.length === 0 ? "/vendor/application?step=submit" : "/vendor/application"}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
            >
              {vendor.editable ? (vendor.missing.length === 0 ? "Submit application" : "Continue application") : "View application"}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      )}

      {/* Stat cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat icon={Package} tint="leaf" label="Live listings" value={approved ? live.length : "–"} note={approved ? "Visible to farmers" : "After approval"} href="/vendor/listings" />
        <Stat icon={EyeOff} tint="stone" label="Hidden listings" value={approved ? hidden.length : "–"} note="Hidden by you or Annadata" href="/vendor/listings" />
        <Stat
          icon={BadgeCheck}
          tint={expiring.length ? "sun" : "sky"}
          label="Licences"
          value={licences.length}
          note={expiring.length ? `${expiring.length} expiring soon` : pendingRenewals ? `${pendingRenewals} renewal being checked` : "All valid"}
          href="/vendor/licences"
        />
        <Stat icon={MapPin} tint="water" label="Districts served" value={vendor.service_areas.length} note={vendor.service_areas.slice(0, 2).map((a) => a.name).join(", ") || "None yet"} />
        {owner ? (
          <Stat icon={Users} tint="clay" label="Team" value={team?.length ?? "–"} note="People on your account" href="/vendor/team" />
        ) : (
          <Stat icon={Users} tint="clay" label="Your role" value="Staff" note="Listings only" />
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Left: listings */}
        <div className="space-y-6 xl:col-span-2">
          <Panel
            title="Listings by category"
            action={
              approved && (
                <Link href="/vendor/listings" className="text-sm text-brand-700 hover:underline">
                  Manage listings
                </Link>
              )
            }
          >
            {!approved ? (
              <p className="text-sm text-muted">Your products and services will show here once your application is approved.</p>
            ) : !listings ? (
              <Spinner />
            ) : byCategory.length === 0 ? (
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-muted">No listings yet. Add your first product or service so farmers can find you.</p>
                <QuickAction href="/vendor/listings/new" icon={PackagePlus} label="Add your first listing" />
              </div>
            ) : (
              <ul className="space-y-3">
                {byCategory.map(([name, n]) => (
                  <li key={name}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{name}</span>
                      <span className="font-medium tabular-nums">{n}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-gray100" aria-hidden>
                      <div className="h-2.5 rounded-full bg-brand-600" style={{ width: `${(n / maxCategory) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {approved && (
            <Panel title="Running low on stock" action={<span className="text-micro text-muted">{LOW_STOCK} or fewer left</span>}>
              {lowStock.length === 0 ? (
                <p className="text-sm text-muted">All pack sizes have more than {LOW_STOCK} in stock.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {lowStock.slice(0, 6).map(({ l, v }) => (
                    <li key={v.id} className="flex items-center gap-3 py-2.5">
                      <div className="size-10 shrink-0 overflow-hidden rounded-md border border-line bg-canvas">
                        {l.images[0] && (
                          // eslint-disable-next-line @next/next/no-img-element -- vendor photos served by our API
                          <img src={mediaUrl(l.images[0].url)} alt="" className="size-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{l.name.en}</p>
                        <p className="text-micro text-muted">{v.label}</p>
                      </div>
                      <Badge tone={v.stock_qty === 0 ? "danger" : "warning"}>{v.stock_qty === 0 ? "Out of stock" : `${v.stock_qty} left`}</Badge>
                      <Link href={`/vendor/listings/${l.id}`} className="text-sm text-brand-700 hover:underline">
                        Update
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          <Panel title="Orders and payments">
            <div className="flex items-center gap-4 rounded-md border border-dashed border-line p-4">
              <ShoppingCart className="size-8 text-gray400" aria-hidden />
              <div>
                <p className="text-sm font-medium">Coming soon</p>
                <p className="text-sm text-muted">When farmers can order from you, your orders, bookings and earnings will appear here.</p>
              </div>
            </div>
          </Panel>
        </div>

        {/* Right: licences, profile, actions */}
        <div className="space-y-6">
          <Panel
            title="Licences"
            action={
              <Link href="/vendor/licences" className="text-sm text-brand-700 hover:underline">
                View all
              </Link>
            }
          >
            {licences.length === 0 ? (
              <p className="text-sm text-muted">No licences on file.</p>
            ) : (
              <ul className="space-y-4">
                {licences.slice(0, 4).map((l) => (
                  <li key={l.id}>
                    <div className="mb-1.5 flex items-start justify-between gap-2 text-sm">
                      <span className="font-medium">{l.licence_name.split(" (")[0]}</span>
                      <span className={clsx("shrink-0 text-micro", l.days_left <= 0 ? "text-danger" : l.days_left <= 30 ? "text-warning" : "text-muted")}>
                        {l.days_left <= 0
                          ? "Expired"
                          : l.days_left <= 30
                            ? `${l.days_left} days left`
                            : `until ${new Date(l.valid_until).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`}
                      </span>
                    </div>
                    <LicenceBar daysLeft={l.days_left} />
                  </li>
                ))}
              </ul>
            )}
            {expiring.length > 0 && (
              <div className="mt-4 flex items-start gap-2 rounded-md bg-warning-bg p-2.5 text-sm text-warning">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                Upload renewals before they expire, or listings that need them are hidden from farmers.
              </div>
            )}
          </Panel>

          <Panel title="Business profile">
            <dl className="space-y-2.5 text-sm">
              {vendor.gstin && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">GSTIN</dt>
                  <dd className="font-mono">{vendor.gstin}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Main district</dt>
                <dd>{vendor.service_areas.find((a) => a.code === vendor.district_code)?.name ?? vendor.district_code ?? "–"}</dd>
              </div>
              {vendor.bank_account && (
                <div className="flex justify-between gap-3">
                  <dt className="flex items-center gap-1 text-muted">
                    <Landmark className="size-3.5" aria-hidden /> Bank
                  </dt>
                  <dd className="text-right">
                    <span className="font-mono">{vendor.bank_account.account_masked}</span>
                    {vendor.bank_account.bank_name && <span className="block text-micro text-muted">{vendor.bank_account.bank_name}</span>}
                  </dd>
                </div>
              )}
            </dl>
            {vendor.capabilities.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {vendor.capabilities.map((c) => (
                  <Badge key={c.code} tone={c.status === "approved" ? "brand" : "neutral"}>
                    {c.name}
                  </Badge>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Quick actions">
            <div className="space-y-2">
              {approved && <QuickAction href="/vendor/listings/new" icon={PackagePlus} label="Add a listing" />}
              {can(me, "vendor.profile.edit") && <QuickAction href="/vendor/licences" icon={RefreshCw} label="Upload a licence renewal" />}
              {owner && <QuickAction href="/vendor/team" icon={UserPlus} label="Invite a team member" />}
              {can(me, "vendor.profile.edit") && <QuickAction href="/vendor/application" icon={ClipboardList} label="View application" />}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
