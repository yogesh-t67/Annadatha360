"use client";

import clsx from "clsx";
import Link from "next/link";
import useSWR from "swr";

import { can, useMe } from "@/components/app-shell";
import { Card, PageTitle } from "@/components/ui";
import { fetcher } from "@/lib/api";

function Stat({ label, value, href, highlight }: { label: string; value: number | undefined; href: string; highlight?: boolean }) {
  return (
    <Link href={href} className="block">
      <Card className={clsx("transition-colors hover:border-brand-600", highlight && value ? "border-brand-600" : "")}>
        <p className="text-sm text-muted">{label}</p>
        <p className={clsx("mt-1 text-3xl font-semibold tabular-nums", highlight && value ? "text-brand-700" : "")}>{value ?? "–"}</p>
      </Card>
    </Link>
  );
}

export default function AdminHome() {
  const me = useMe();
  const { data: counts } = useSWR<Record<string, number>>(can(me, "vendors.view") ? "/admin/vendors/counts" : null, fetcher);
  const waiting = counts ? counts.submitted + counts.under_review : undefined;

  return (
    <>
      <PageTitle title={`Welcome, ${me.full_name.split(" ")[0]}`} subtitle="Annadata 360 admin panel" />
      {can(me, "vendors.view") && (
        <section aria-labelledby="vendors-heading">
          <h2 id="vendors-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Vendors
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Waiting for review" value={waiting} href="/admin/vendors" highlight />
            <Stat label="Approved" value={counts?.approved} href="/admin/vendors" />
            <Stat label="Drafts (not submitted)" value={counts?.draft} href="/admin/vendors" />
            <Stat label="Suspended" value={counts?.suspended} href="/admin/vendors" />
          </div>
        </section>
      )}
    </>
  );
}
