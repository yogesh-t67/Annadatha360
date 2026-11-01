"use client";

import clsx from "clsx";
import { CheckCircle2, Circle } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

import { Alert, Badge, Card, PageTitle, Spinner } from "@/components/ui";
import { fetcher } from "@/lib/api";
import { STATUS_LABELS, stepOf, type Vendor, type VendorOptions } from "@/lib/vendor";

import { AreasStep, BankStep, BusinessStep, LicencesStep, OfferingsStep, SubmitStep } from "./steps";

const STEPS = [
  { key: "business", label: "Business details" },
  { key: "offerings", label: "What you offer" },
  { key: "areas", label: "Districts" },
  { key: "bank", label: "Bank account" },
  { key: "licences", label: "Licences" },
  { key: "submit", label: "Review and submit" },
] as const;

export default function ApplicationPage() {
  const { data: vendor, error, mutate } = useSWR<Vendor>("/vendor", fetcher);
  const { data: options } = useSWR<VendorOptions>("/vendor-options", fetcher, { revalidateOnFocus: false });
  const [step, setStep] = useState<string>("business");

  if (error) return <Alert kind="error">{error.message ?? "Couldn't load your application."}</Alert>;
  if (!vendor || !options) return <Spinner />;

  const locked = !vendor.editable;
  const openSteps = new Set(vendor.missing.map((m) => stepOf(m.code)));
  const doneCount = STEPS.filter((s) => s.key !== "submit" && !openSteps.has(s.key)).length;
  const status = STATUS_LABELS[vendor.status] ?? { label: vendor.status, tone: "neutral" as const };
  const props = { vendor, options, locked, onSaved: (v: Vendor) => mutate(v, { revalidate: false }) };

  return (
    <>
      <PageTitle
        title="Application"
        subtitle={vendor.trade_name}
        actions={<Badge tone={status.tone}>{status.label}</Badge>}
      />

      {vendor.status === "rejected" && vendor.rejection_reason && (
        <div className="mb-6">
          <Alert kind="warning">
            <p className="font-medium">Annadata asked for changes:</p>
            <p className="mt-1 whitespace-pre-line">{vendor.rejection_reason}</p>
            <p className="mt-2">Fix these and submit again.</p>
          </Alert>
        </div>
      )}
      {(vendor.status === "submitted" || vendor.status === "under_review") && (
        <div className="mb-6">
          <Alert kind="info">Your application is with Annadata for review. You&apos;ll get an email when it&apos;s decided.</Alert>
        </div>
      )}
      {vendor.status === "approved" && (
        <div className="mb-6">
          <Alert kind="success">Your application is approved. To change these details, contact Annadata support.</Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Application steps" className="space-y-1">
          <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-muted">
            {doneCount} of {STEPS.length - 1} done
          </p>
          {STEPS.map((s, i) => {
            const done = s.key === "submit" ? locked : !openSteps.has(s.key);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setStep(s.key)}
                aria-current={step === s.key ? "step" : undefined}
                className={clsx(
                  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm",
                  step === s.key ? "bg-brand-50 font-medium text-brand-800" : "text-muted hover:bg-canvas hover:text-ink",
                )}
              >
                {done ? <CheckCircle2 className="size-4 text-success" aria-label="done" /> : <Circle className="size-4" aria-label="not done" />}
                {i + 1}. {s.label}
              </button>
            );
          })}
        </nav>
        <Card>
          {step === "business" && <BusinessStep {...props} />}
          {step === "offerings" && <OfferingsStep {...props} />}
          {step === "areas" && <AreasStep {...props} />}
          {step === "bank" && <BankStep {...props} />}
          {step === "licences" && <LicencesStep {...props} />}
          {step === "submit" && <SubmitStep {...props} goTo={(_, code) => setStep(stepOf(code))} />}
        </Card>
      </div>
    </>
  );
}
