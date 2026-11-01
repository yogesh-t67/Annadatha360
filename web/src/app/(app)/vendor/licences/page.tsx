"use client";

import { FileText, RefreshCw } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import useSWR from "swr";

import { Dialog } from "@/components/dialog";
import { DocumentField } from "@/components/document-field";
import { Alert, Badge, Button, Card, Field, PageTitle, Spinner } from "@/components/ui";
import { api, ApiError, fetcher } from "@/lib/api";
import { type DocumentRef, type Licence, type Vendor, viewDocument } from "@/lib/vendor";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function StatusBadge({ l }: { l: Licence }) {
  if (l.status === "pending_review") return <Badge tone="brand">Renewal being checked</Badge>;
  if (l.status === "rejected") return <Badge tone="danger">Renewal not accepted</Badge>;
  if (l.status === "superseded") return <Badge>Replaced by renewal</Badge>;
  if (l.expired) return <Badge tone="danger">Expired</Badge>;
  if (l.days_left <= 30) return <Badge tone="warning">{l.days_left} days left</Badge>;
  return <Badge tone="success">Valid</Badge>;
}

function RenewDialog({ licence, onClose, onDone }: { licence: Licence | null; onClose: () => void; onDone: (v: Vendor) => void }) {
  const [f, setF] = useState({ number: "", issuing_authority: licence?.issuing_authority ?? "", valid_from: "", valid_until: "" });
  const [doc, setDoc] = useState<DocumentRef | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!licence || !doc) return;
    setBusy(true);
    setError("");
    try {
      onDone(
        await api<Vendor>("/vendor/licences/renewals", {
          body: {
            licence_type: licence.licence_type,
            number: f.number,
            issuing_authority: f.issuing_authority || null,
            valid_from: f.valid_from || null,
            valid_until: f.valid_until,
            document_id: doc.id,
          },
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={licence !== null} onClose={onClose} title={`Renew: ${licence?.licence_name.split(" (")[0] ?? ""}`}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted">Annadata checks the new copy. Your listings stay as they are until it&apos;s approved.</p>
        {error && <Alert kind="error">{error}</Alert>}
        <Field label="New licence number" value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} />
        <Field label="Issued by (optional)" value={f.issuing_authority} onChange={(e) => setF({ ...f, issuing_authority: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valid from" type="date" value={f.valid_from} onChange={(e) => setF({ ...f, valid_from: e.target.value })} />
          <Field label="Valid until" type="date" value={f.valid_until} onChange={(e) => setF({ ...f, valid_until: e.target.value })} />
        </div>
        {licence && <DocumentField label="Copy of the renewed licence" kind={licence.licence_type} value={doc} onChange={setDoc} />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={!f.number || !f.valid_until || !doc}>
            Send for checking
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export default function VendorLicencesPage() {
  const { data: vendor, error, mutate } = useSWR<Vendor>("/vendor", fetcher);
  const [renewing, setRenewing] = useState<Licence | null>(null);
  const [problem, setProblem] = useState("");

  if (error) return <Alert kind="error">{error.message ?? "Couldn't load your licences."}</Alert>;
  if (!vendor) return <Spinner />;

  const approved = vendor.status === "approved" || vendor.status === "suspended";
  // Newest first within each licence type; renewals and their history stay visible.
  const licences = [...vendor.licences].sort((a, b) => a.licence_type.localeCompare(b.licence_type) || b.valid_until.localeCompare(a.valid_until));
  const pendingTypes = new Set(vendor.licences.filter((l) => l.status === "pending_review").map((l) => l.licence_type));

  return (
    <>
      <PageTitle title="Licences" subtitle="We email you 30, 15, 7 and 1 day before a licence expires." />
      {!approved && (
        <div className="mb-4">
          <Alert kind="info">
            While your application is open, add or change licences in the <Link href="/vendor/application" className="underline">application form</Link>.
          </Alert>
        </div>
      )}
      {approved && vendor.licences.some((l) => l.status === "valid" && (l.expired || l.days_left <= 30)) && (
        <div className="mb-4">
          <Alert kind="warning">A licence is expiring or has expired. When it expires, listings that need it are hidden from farmers until a renewal is approved.</Alert>
        </div>
      )}
      {problem && (
        <div className="mb-4">
          <Alert kind="error">{problem}</Alert>
        </div>
      )}
      {licences.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">No licences on file.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-line">
            {licences.map((l) => (
              <li key={l.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div className="text-sm">
                  <p className="font-medium">{l.licence_name}</p>
                  <p className="text-muted">
                    No. {l.number} · valid until {date(l.valid_until)}
                  </p>
                  <div className="mt-1.5">
                    <StatusBadge l={l} />
                  </div>
                  {l.status === "rejected" && l.review_reason && <p className="mt-1.5 text-sm text-danger">{l.review_reason}</p>}
                </div>
                <div className="flex gap-2">
                  {l.document && (
                    <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => viewDocument(l.document!.id).catch(() => setProblem("Couldn't open the file."))}>
                      <FileText className="size-3.5" /> View copy
                    </Button>
                  )}
                  {approved && l.status === "valid" && !pendingTypes.has(l.licence_type) && (
                    <Button variant={l.expired || l.days_left <= 30 ? "primary" : "secondary"} className="h-8 text-xs" onClick={() => setRenewing(l)}>
                      <RefreshCw className="size-3.5" /> Upload renewal
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <RenewDialog
        key={renewing?.id ?? "none"}
        licence={renewing}
        onClose={() => setRenewing(null)}
        onDone={(v) => {
          setRenewing(null);
          mutate(v, { revalidate: false });
        }}
      />
    </>
  );
}
