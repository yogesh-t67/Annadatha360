"use client";

import clsx from "clsx";
import { ArrowLeft, ExternalLink, FileText, Lock } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";
import useSWR from "swr";

import { can, useMe } from "@/components/app-shell";
import { Dialog } from "@/components/dialog";
import { Alert, Badge, Button, Card, Spinner, TextAreaField } from "@/components/ui";
import { api, ApiError, fetcher, type Schemas } from "@/lib/api";
import { BUSINESS_TYPE_LABELS, STATE_NAMES, STATUS_LABELS, type VendorOptions } from "@/lib/vendor";

type AdminVendor = Schemas["AdminVendorOut"];
type Doc = { id: string; label: string; filename: string };

const date = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children ?? <span className="text-muted">Not given</span>}</dd>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </Card>
  );
}

// ---------- Document viewer ----------

function DocumentViewer({ docs, allowed }: { docs: Doc[]; allowed: boolean }) {
  const [selected, setSelected] = useState<string | null>(docs[0]?.id ?? null);
  // Each view asks for a fresh 5-minute link (and is audited); don't refetch on focus.
  const { data: src, error: linkError } = useSWR(
    allowed && selected ? ["view-link", selected] : null,
    async ([, id]) => {
      const { url } = await api<{ url: string }>(`/documents/${id}/view-link`, { method: "POST" });
      return url.replace(/^\/api\/v1\/erp\//, "/api/erp/");
    },
    { revalidateOnFocus: false, revalidateIfStale: false },
  );
  const error = linkError ? (linkError instanceof ApiError ? linkError.message : "Couldn't open the document.") : "";

  if (!allowed) {
    return (
      <Card>
        <div className="flex gap-2 text-sm text-muted">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden /> KYC documents can only be opened by a Super Admin.
        </div>
      </Card>
    );
  }
  if (docs.length === 0) {
    return (
      <Card>
        <p className="text-sm text-muted">No documents uploaded.</p>
      </Card>
    );
  }
  return (
    <Card className="p-0">
      <div className="flex flex-wrap gap-1 border-b border-line p-2">
        {docs.map((d) => (
          <button
            key={d.id}
            onClick={() => setSelected(d.id)}
            className={clsx(
              "flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium",
              selected === d.id ? "bg-brand-50 text-brand-800" : "text-muted hover:bg-canvas",
            )}
          >
            <FileText className="size-3.5" aria-hidden /> {d.label}
          </button>
        ))}
      </div>
      <div className="relative h-[70vh] bg-canvas">
        {error && (
          <div className="p-4">
            <Alert kind="error">{error}</Alert>
          </div>
        )}
        {!src && !error && (
          <div className="p-4">
            <Spinner label="Opening" />
          </div>
        )}
        {src && <iframe key={src} src={src} title="Document" className="size-full" />}
      </div>
      {src && (
        <div className="flex items-center justify-between border-t border-line px-3 py-2 text-xs text-muted">
          <span className="truncate">{docs.find((d) => d.id === selected)?.filename}</span>
          <a href={src} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand-700 hover:underline">
            Open in new tab <ExternalLink className="size-3" />
          </a>
        </div>
      )}
    </Card>
  );
}

// ---------- Decisions ----------

type Action = "approve" | "reject" | "suspend" | "reinstate" | null;

function DecisionDialog({
  action,
  vendor,
  options,
  onClose,
  onDone,
}: {
  action: Action;
  vendor: AdminVendor;
  options: VendorOptions | undefined;
  onClose: () => void;
  onDone: (v: AdminVendor) => void;
}) {
  const [caps, setCaps] = useState<string[]>(vendor.capabilities.map((c) => c.code));
  const [docsChecked, setDocsChecked] = useState(false);
  const [gstChecked, setGstChecked] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const business = vendor.kind === "business";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const path = `/admin/vendors/${vendor.id}/${action}`;
      const body =
        action === "approve"
          ? { capabilities: caps, documents_checked: docsChecked, gstin_checked: gstChecked, note: text || null }
          : action === "reinstate"
            ? { text }
            : { reason: text };
      onDone(await api<AdminVendor>(path, { body }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach the server.");
      if (err instanceof ApiError && Array.isArray(err.details)) {
        setError(`${err.message}: ${(err.details as { message: string }[]).map((m) => m.message).join("; ")}`);
      }
    } finally {
      setBusy(false);
    }
  }

  const titles = { approve: "Approve vendor", reject: "Ask for changes", suspend: "Suspend vendor", reinstate: "Reinstate vendor" };
  const capName = (code: string) => options?.capabilities.find((c) => c.code === code)?.name ?? code;

  return (
    <Dialog open={action !== null} onClose={onClose} title={action ? titles[action] : ""}>
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert kind="error">{error}</Alert>}
        {action === "approve" && (
          <>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Approve for</legend>
              <div className="space-y-1.5">
                {vendor.capabilities.map((c) => (
                  <label key={c.code} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-brand-600"
                      checked={caps.includes(c.code)}
                      onChange={() => setCaps(caps.includes(c.code) ? caps.filter((x) => x !== c.code) : [...caps, c.code])}
                    />
                    {capName(c.code)}
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted">Unticked offerings are marked not approved; the vendor is told.</p>
            </fieldset>
            <div className="space-y-2 rounded-md border border-line bg-canvas p-3 text-sm">
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-0.5 size-4 accent-brand-600" checked={docsChecked} onChange={(e) => setDocsChecked(e.target.checked)} />
                I opened and checked every uploaded document.
              </label>
              {business && (
                <label className="flex items-start gap-2">
                  <input type="checkbox" className="mt-0.5 size-4 accent-brand-600" checked={gstChecked} onChange={(e) => setGstChecked(e.target.checked)} />
                  <span>
                    I checked GSTIN <strong className="font-mono">{vendor.gstin}</strong> on the{" "}
                    <a href="https://services.gst.gov.in/services/searchtp" target="_blank" rel="noreferrer" className="text-brand-700 underline">
                      GST portal
                    </a>{" "}
                    (active, name matches).
                  </span>
                </label>
              )}
            </div>
            <TextAreaField label="Note (internal)" optional rows={2} value={text} onChange={(e) => setText(e.target.value)} />
          </>
        )}
        {(action === "reject" || action === "suspend") && (
          <TextAreaField
            required
            label={action === "reject" ? "What needs to change? (the vendor sees this)" : "Reason (the vendor sees this)"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            hint="At least 10 characters. Be specific, e.g. “PAN card copy is blurry, upload a clear scan.”"
          />
        )}
        {action === "reinstate" && <TextAreaField label="Note (why it's resolved)" required rows={2} value={text} onChange={(e) => setText(e.target.value)} />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={action === "suspend" ? "danger" : "primary"}
            loading={busy}
            disabled={
              action === "approve"
                ? caps.length === 0 || !docsChecked || (business && !gstChecked)
                : action === "reinstate"
                  ? !text.trim()
                  : text.trim().length < 10
            }
          >
            {action ? titles[action] : ""}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ---------- Page ----------

export default function VendorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const { data: v, error, mutate } = useSWR<AdminVendor>(`/admin/vendors/${id}`, fetcher);
  const { data: options } = useSWR<VendorOptions>("/vendor-options", fetcher, { revalidateOnFocus: false });
  const [action, setAction] = useState<Action>(null);
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  if (error) return <Alert kind="error">{error.message ?? "Couldn't load this vendor."}</Alert>;
  if (!v) return <Spinner />;

  const reviewer = can(me, "vendors.review");
  const status = STATUS_LABELS[v.status] ?? { label: v.status, tone: "neutral" as const };
  const capName = (code: string) => options?.capabilities.find((c) => c.code === code)?.name ?? code;
  const docs: Doc[] = [
    v.gst_certificate_document && { id: v.gst_certificate_document.id, label: "GST certificate", filename: v.gst_certificate_document.filename },
    v.pan_card_document && { id: v.pan_card_document.id, label: "PAN card", filename: v.pan_card_document.filename },
    v.bank_account?.cheque_document && { id: v.bank_account.cheque_document.id, label: "Cheque", filename: v.bank_account.cheque_document.filename },
    ...v.licences.filter((l) => l.document).map((l) => ({ id: l.document!.id, label: l.licence_name.split(" (")[0], filename: l.document!.filename })),
  ].filter(Boolean) as Doc[];

  async function startReview() {
    setBusy(true);
    setProblem("");
    try {
      await mutate(await api<AdminVendor>(`/admin/vendors/${id}/start-review`, { method: "POST" }), { revalidate: false });
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : "Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function addNote(e: FormEvent) {
    e.preventDefault();
    setSavingNote(true);
    try {
      await mutate(await api<AdminVendor>(`/admin/vendors/${id}/notes`, { body: { text: note } }), { revalidate: false });
      setNote("");
    } finally {
      setSavingNote(false);
    }
  }

  const inReview = v.status === "submitted" || v.status === "under_review";

  return (
    <>
      <Link href="/admin/vendors" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Vendors
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{v.trade_name}</h1>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            {v.kind === "business" ? "Business" : "Individual"}
            {v.submitted_at && ` · submitted ${dateTime(v.submitted_at)}`}
          </p>
        </div>
        {reviewer && (
          <div className="flex flex-wrap gap-2">
            {v.status === "submitted" && (
              <Button variant="secondary" loading={busy} onClick={startReview}>
                Start review
              </Button>
            )}
            {inReview && (
              <>
                <Button variant="secondary" onClick={() => setAction("reject")}>
                  Ask for changes
                </Button>
                <Button onClick={() => setAction("approve")}>Approve</Button>
              </>
            )}
            {v.status === "approved" && (
              <Button variant="danger" onClick={() => setAction("suspend")}>
                Suspend
              </Button>
            )}
            {v.status === "suspended" && <Button onClick={() => setAction("reinstate")}>Reinstate</Button>}
          </div>
        )}
      </div>
      {problem && (
        <div className="mb-4">
          <Alert kind="error">{problem}</Alert>
        </div>
      )}
      {v.status === "suspended" && v.history.at(-1)?.reason && (
        <div className="mb-4">
          <Alert kind="warning">Suspended: {v.history.at(-1)?.reason}</Alert>
        </div>
      )}
      {v.missing.length > 0 && inReview && (
        <div className="mb-4">
          <Alert kind="warning">Missing since submission: {v.missing.map((m) => m.message).join("; ")}</Alert>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_28rem]">
        <div className="space-y-6">
          <Block title="Business">
            <dl>
              <Row label="Legal name">{v.legal_name}</Row>
              {v.kind === "business" && <Row label="Business type">{v.business_type ? BUSINESS_TYPE_LABELS[v.business_type] ?? v.business_type : null}</Row>}
              {v.kind === "business" && (
                <Row label="GSTIN">
                  {v.gstin && (
                    <span className="font-mono">
                      {v.gstin} {v.gstin_verified && <Badge tone="success">Checked</Badge>}
                    </span>
                  )}
                </Row>
              )}
              <Row label="PAN">{v.pan && <span className="font-mono">{v.pan}</span>}</Row>
              <Row label="Address">
                {v.address_line &&
                  `${v.address_line}, ${options?.districts.find((d) => d.code === v.district_code)?.name ?? ""} ${v.state ? STATE_NAMES[v.state as "AP" | "TG"] : ""} ${v.pincode ?? ""}`}
              </Row>
              <Row label="Post office says">{v.postal_district && `${v.postal_district} district`}</Row>
              <Row label="Contact">{[v.contact_phone, v.contact_email].filter(Boolean).join(" · ") || null}</Row>
            </dl>
          </Block>

          <Block title="Offerings and districts">
            <div className="flex flex-wrap gap-2">
              {v.capabilities.map((c) => (
                <Badge key={c.code} tone={c.status === "approved" ? "success" : c.status === "rejected" ? "danger" : "neutral"}>
                  {capName(c.code)}
                  {c.status !== "pending" && ` · ${c.status}`}
                </Badge>
              ))}
              {v.capabilities.length === 0 && <span className="text-sm text-muted">None</span>}
            </div>
            {v.labour_team_size && <p className="mt-2 text-sm text-muted">Labour team: {v.labour_team_size} workers</p>}
            <p className="mt-4 text-sm">
              <span className="text-muted">Serves {v.service_areas.length} districts: </span>
              {v.service_areas.map((a) => a.name).join(", ") || "none"}
            </p>
          </Block>

          <Block title="Bank account">
            {v.bank_account ? (
              <dl>
                <Row label="Holder">{v.bank_account.holder_name}</Row>
                <Row label="Account">
                  <span className="font-mono">{v.bank_account.account_masked}</span>
                </Row>
                <Row label="IFSC">
                  <span className="font-mono">{v.bank_account.ifsc}</span>
                </Row>
                <Row label="Bank">{v.bank_account.bank_name ? `${v.bank_account.bank_name}, ${v.bank_account.branch}` : null}</Row>
              </dl>
            ) : (
              <p className="text-sm text-muted">Not added</p>
            )}
          </Block>

          <Block title="Licences">
            {v.licences.length === 0 && <p className="text-sm text-muted">None</p>}
            <ul className="divide-y divide-line">
              {v.licences.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <p className="font-medium">{l.licence_name}</p>
                    <p className="text-muted">
                      No. {l.number}
                      {l.issuing_authority && ` · ${l.issuing_authority}`} · until {date(l.valid_until)}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    {l.status !== "valid" && <Badge tone="neutral">{l.status.replace("_", " ")}</Badge>}
                    {l.expired ? <Badge tone="danger">Expired</Badge> : l.days_left <= 30 ? <Badge tone="warning">{l.days_left} days left</Badge> : <Badge tone="success">Valid</Badge>}
                    {!l.document && <Badge tone="warning">No copy</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          </Block>

          <Block title="Automatic checks">
            {v.kyc_provider === "manual" ? (
              <p className="text-sm text-muted">
                No KYC provider connected: check the GSTIN on the GST portal and the documents yourself before approving.
              </p>
            ) : v.checks.length === 0 ? (
              <p className="text-sm text-muted">No checks run yet.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {v.checks.map((c) => (
                  <li key={c.check} className="flex items-center gap-2">
                    <Badge tone={c.status === "verified" ? "success" : c.status === "error" ? "neutral" : "danger"}>{c.check.replace("_", " ")}</Badge>
                    {c.summary}
                  </li>
                ))}
              </ul>
            )}
          </Block>

          <Block title="People">
            <ul className="space-y-2 text-sm">
              {v.members.map((m) => (
                <li key={m.email}>
                  <span className="font-medium">{m.full_name}</span> <span className="text-muted">({m.role.replace("vendor_", "")})</span>
                  <br />
                  <span className="text-muted">
                    {m.email}
                    {m.phone && ` · ${m.phone}`}
                    {m.status !== "active" && ` · ${m.status}`}
                  </span>
                </li>
              ))}
            </ul>
          </Block>

          <Block title="History and internal notes">
            <ol className="space-y-3 border-l border-line pl-4 text-sm">
              {[
                ...v.history.map((h) => ({ at: h.at, kind: "history" as const, h })),
                ...v.notes.map((n) => ({ at: n.at, kind: "note" as const, n })),
              ]
                .sort((a, b) => a.at.localeCompare(b.at))
                .map((item, i) =>
                  item.kind === "history" ? (
                    <li key={`h${i}`}>
                      <p>
                        <span className="font-medium">{STATUS_LABELS[item.h.to_status]?.label ?? item.h.to_status}</span>
                        <span className="text-muted"> · {dateTime(item.h.at)}{item.h.by && ` · ${item.h.by}`}</span>
                      </p>
                      {item.h.reason && <p className="mt-0.5 whitespace-pre-line text-muted">{item.h.reason}</p>}
                    </li>
                  ) : (
                    <li key={`n${i}`} className="rounded-md bg-warning-bg/60 p-2">
                      <p className="text-xs text-muted">
                        Note · {dateTime(item.n.at)}
                        {item.n.by && ` · ${item.n.by}`}
                      </p>
                      <p className="mt-0.5 whitespace-pre-line">{item.n.text}</p>
                    </li>
                  ),
                )}
            </ol>
            <form onSubmit={addNote} className="mt-4 space-y-2">
              <TextAreaField label="Add an internal note (never shown to the vendor)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              <Button type="submit" variant="secondary" loading={savingNote} disabled={!note.trim()}>
                Add note
              </Button>
            </form>
          </Block>
        </div>

        <div className="xl:sticky xl:top-6 xl:self-start">
          <DocumentViewer docs={docs} allowed={can(me, "kyc.documents.view")} />
        </div>
      </div>

      <DecisionDialog
        key={action ?? "none"}
        action={action}
        vendor={v}
        options={options}
        onClose={() => setAction(null)}
        onDone={(updated) => {
          setAction(null);
          mutate(updated, { revalidate: false });
        }}
      />
    </>
  );
}
