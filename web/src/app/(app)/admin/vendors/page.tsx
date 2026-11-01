"use client";

import clsx from "clsx";
import { ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";

import { Alert, Badge, Card, PageTitle, SelectField, Spinner } from "@/components/ui";
import { fetcher, type Schemas } from "@/lib/api";
import { STATE_NAMES, STATUS_LABELS, type VendorOptions } from "@/lib/vendor";

type Row = Schemas["VendorSummary"];

const TABS = [
  { key: "queue", label: "Review queue", statuses: "submitted,under_review" },
  { key: "draft", label: "Drafts", statuses: "draft" },
  { key: "approved", label: "Approved", statuses: "approved" },
  { key: "rejected", label: "Needs changes", statuses: "rejected" },
  { key: "suspended", label: "Suspended", statuses: "suspended" },
] as const;

const days = (iso: string | null | undefined) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 864e5) : null);

export default function VendorsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("queue");
  const [q, setQ] = useState("");
  const [district, setDistrict] = useState("");
  const [capability, setCapability] = useState("");
  const statuses = TABS.find((t) => t.key === tab)!.statuses;
  const params = new URLSearchParams({ status: statuses, limit: "200" });
  if (q.trim()) params.set("q", q.trim());
  if (district) params.set("district", district);
  if (capability) params.set("capability", capability);

  const { data: counts } = useSWR<Record<string, number>>("/admin/vendors/counts", fetcher);
  const { data: options } = useSWR<VendorOptions>("/vendor-options", fetcher, { revalidateOnFocus: false });
  const { data: rows, error } = useSWR<Row[]>(`/admin/vendors?${params}`, fetcher, { keepPreviousData: true });
  const count = (statusList: string) => statusList.split(",").reduce((n, s) => n + (counts?.[s] ?? 0), 0);
  const capName = (code: string) => options?.capabilities.find((c) => c.code === code)?.name ?? code;

  return (
    <>
      <PageTitle title="Vendors" subtitle="Applications to review, and every vendor on Annadata 360" />

      <div role="tablist" aria-label="Status" className="mb-4 flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              "-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium",
              tab === t.key ? "border-brand-600 text-brand-800" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
            {counts && <span className="rounded-full bg-canvas px-1.5 text-xs">{count(t.statuses)}</span>}
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_12rem_12rem]">
        <label className="relative block">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            className="h-10 w-full rounded-md border border-line bg-surface pl-9 pr-3 text-sm focus:border-brand-600"
            placeholder="Search name, GSTIN or PAN"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <SelectField
          label="District"
          className="[&_label]:sr-only"
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          placeholder="All districts"
          options={(options?.districts ?? []).map((d) => ({ value: d.code, label: `${d.name} (${d.state})` }))}
        />
        <SelectField
          label="Offering"
          className="[&_label]:sr-only"
          value={capability}
          onChange={(e) => setCapability(e.target.value)}
          placeholder="All offerings"
          options={(options?.capabilities ?? []).map((c) => ({ value: c.code, label: c.name }))}
        />
      </div>

      {error && <Alert kind="error">{error.message ?? "Couldn't load vendors."}</Alert>}
      {!rows && !error && <Spinner />}
      {rows && rows.length === 0 && (
        <Card>
          <p className="text-sm text-muted">{tab === "queue" ? "Nothing waiting for review." : "No vendors here."}</p>
        </Card>
      )}
      {rows && rows.length > 0 && (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-line">
            {rows.map((v) => {
              const waited = days(v.submitted_at);
              const status = STATUS_LABELS[v.status] ?? { label: v.status, tone: "neutral" as const };
              return (
                <li key={v.id}>
                  <Link href={`/admin/vendors/${v.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-canvas">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{v.trade_name}</p>
                        <Badge tone={status.tone}>{status.label}</Badge>
                        <Badge>{v.kind === "business" ? "Business" : "Individual"}</Badge>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted">
                        {[v.legal_name, v.district && `${v.district}${v.state ? `, ${STATE_NAMES[v.state as "AP" | "TG"] ?? v.state}` : ""}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted">{v.capabilities.map(capName).join(", ") || "No offerings yet"}</p>
                    </div>
                    {waited !== null && (tab === "queue" || tab === "rejected") && (
                      <span className={clsx("shrink-0 text-xs", waited >= 3 ? "font-medium text-warning" : "text-muted")}>
                        {waited === 0 ? "today" : `${waited} day${waited === 1 ? "" : "s"} ago`}
                      </span>
                    )}
                    <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
