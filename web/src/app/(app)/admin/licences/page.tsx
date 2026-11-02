"use client";

import clsx from "clsx";
import { FileText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";

import { can, useMe } from "@/components/app-shell";
import { Dialog } from "@/components/dialog";
import { Alert, Badge, Button, Card, PageTitle, Spinner, TextAreaField } from "@/components/ui";
import { api, ApiError, fetcher, type Schemas } from "@/lib/api";
import { viewDocument } from "@/lib/vendor";

type Row = Schemas["LicenceRow"];
type Summary = { renewals_to_check: number; expiring_30_days: number; expired: number };

const TABS = [
  { key: "pending", label: "Renewals to check", count: "renewals_to_check" },
  { key: "expiring", label: "Expiring in 30 days", count: "expiring_30_days" },
  { key: "expired", label: "Expired", count: "expired" },
] as const;

const date = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function AdminLicencesPage() {
  const me = useMe();
  const reviewer = can(me, "vendors.review");
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("pending");
  const { data: summary, mutate: refreshSummary } = useSWR<Summary>("/admin/licences/summary", fetcher);
  const { data: rows, error, mutate } = useSWR<Row[]>(`/admin/licences?show=${tab}`, fetcher, { keepPreviousData: true });
  const [target, setTarget] = useState<{ row: Row; action: "approve" | "reject" } | null>(null);
  const [checked, setChecked] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  async function decide() {
    if (!target) return;
    setBusy(true);
    setProblem("");
    try {
      const body = target.action === "approve" ? { documents_checked: checked } : { reason };
      await api(`/admin/licences/${target.row.id}/${target.action}`, { body });
      await Promise.all([mutate(), refreshSummary()]);
      setTarget(null);
      setChecked(false);
      setReason("");
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : "Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle title="Licences" subtitle="Expired licences hide the listings that need them until a renewal is approved." />
      <div role="tablist" aria-label="Licences" className="mb-4 flex flex-wrap gap-1 border-b border-line">
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
            {summary && <span className="rounded-full bg-canvas px-1.5 text-xs">{summary[t.count]}</span>}
          </button>
        ))}
      </div>
      {problem && !target && (
        <div className="mb-4">
          <Alert kind="error">{problem}</Alert>
        </div>
      )}
      {error && <Alert kind="error">{error.message ?? "Couldn't load licences."}</Alert>}
      {!rows && !error && <Spinner />}
      {rows && rows.length === 0 && (
        <Card>
          <p className="text-sm text-muted">Nothing here.</p>
        </Card>
      )}
      {rows && rows.length > 0 && (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="text-sm">
                  <p className="font-medium">
                    <Link href={`/admin/vendors/${r.vendor_id}`} className="hover:underline">{r.vendor_name}</Link>
                    {r.vendor_status === "suspended" && <span className="ml-2"><Badge tone="danger">Suspended</Badge></span>}
                  </p>
                  <p className="text-muted">
                    {r.licence_name} · No. {r.number} · until {date(r.valid_until)}
                  </p>
                  <div className="mt-1.5">
                    {r.status === "pending_review" ? (
                      <Badge tone="brand">Renewal uploaded</Badge>
                    ) : r.days_left <= 0 ? (
                      <Badge tone="danger">Expired {-r.days_left === 0 ? "today" : `${-r.days_left} days ago`}</Badge>
                    ) : (
                      <Badge tone="warning">{r.days_left} days left</Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {r.document_id && can(me, "kyc.documents.view") && (
                    <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => viewDocument(r.document_id!).catch(() => setProblem("Couldn't open the file."))}>
                      <FileText className="size-3.5" /> View copy
                    </Button>
                  )}
                  {r.status === "pending_review" && reviewer && (
                    <>
                      <Button variant="secondary" className="h-8 text-xs" onClick={() => setTarget({ row: r, action: "reject" })}>
                        Reject
                      </Button>
                      <Button className="h-8 text-xs" onClick={() => setTarget({ row: r, action: "approve" })}>
                        Approve
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Dialog open={target !== null} onClose={() => setTarget(null)} title={target?.action === "approve" ? "Approve renewal" : "Reject renewal"}>
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {target?.row.vendor_name}: {target?.row.licence_name}, no. {target?.row.number}, valid until {target && date(target.row.valid_until)}.
          </p>
          {problem && <Alert kind="error">{problem}</Alert>}
          {target?.action === "approve" ? (
            <label className="flex items-start gap-2 rounded-md border border-line bg-canvas p-3 text-sm">
              <input type="checkbox" className="mt-0.5 size-4 accent-brand-600" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
              I opened the copy, and the number, name and dates match.
            </label>
          ) : (
            <TextAreaField label="What's wrong? (the vendor sees this)" required value={reason} onChange={(e) => setReason(e.target.value)} hint="At least 10 characters." />
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button
              variant={target?.action === "approve" ? "primary" : "danger"}
              loading={busy}
              disabled={target?.action === "approve" ? !checked : reason.trim().length < 10}
              onClick={decide}
            >
              {target?.action === "approve" ? "Approve" : "Reject"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
