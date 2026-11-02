"use client";

import { ArrowRight, ClipboardList } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";

import { useMe } from "@/components/app-shell";
import { Alert, Badge, Card, PageTitle, Spinner } from "@/components/ui";
import { fetcher } from "@/lib/api";
import { STATUS_LABELS, type Vendor } from "@/lib/vendor";

const NEXT_STEP: Record<string, string> = {
  draft: "Fill in your application and submit it. Once approved, you can list your products and services.",
  rejected: "Annadata asked for some changes. Fix them and submit again.",
  submitted: "Your application is waiting for review. We'll email you when it's decided.",
  under_review: "Annadata is reviewing your application. We'll email you when it's decided.",
  approved: "You're approved. Add your products and services under Listings.",
  suspended: "Your account is suspended and hidden from farmers. Contact Annadata support.",
};

export default function VendorHome() {
  const me = useMe();
  const { data: vendor, error } = useSWR<Vendor>("/vendor", fetcher);

  return (
    <>
      <PageTitle title={`Welcome, ${me.full_name.split(" ")[0]}`} subtitle={vendor?.trade_name ?? "Vendor portal"} />
      {error && <Alert kind="error">{error.message ?? "Couldn't load your business."}</Alert>}
      {!vendor && !error && <Spinner />}
      {vendor && (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex gap-3">
              <ClipboardList className="mt-0.5 size-5 text-brand-600" aria-hidden />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">Application</h2>
                  <Badge tone={STATUS_LABELS[vendor.status]?.tone ?? "neutral"}>{STATUS_LABELS[vendor.status]?.label ?? vendor.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted">{NEXT_STEP[vendor.status]}</p>
                {vendor.editable && vendor.missing.length > 0 && (
                  <p className="mt-1 text-sm text-muted">{vendor.missing.length} item(s) still to fill in.</p>
                )}
              </div>
            </div>
            <Link
              href="/vendor/application"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
            >
              {vendor.editable ? "Continue application" : "View application"} <ArrowRight className="size-4" />
            </Link>
          </div>
        </Card>
      )}
    </>
  );
}
