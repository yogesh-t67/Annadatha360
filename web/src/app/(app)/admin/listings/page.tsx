"use client";

import { ImageOff, RotateCcw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";

import { Dialog } from "@/components/dialog";
import { Alert, Badge, Button, Card, PageTitle, SelectField, Spinner, TextAreaField } from "@/components/ui";
import { api, ApiError, fetcher } from "@/lib/api";
import { type AdminListing, KIND_LABELS, priceRange, UNIT_LABELS } from "@/lib/catalog";
import { mediaUrl, type VendorOptions } from "@/lib/vendor";

/** Every vendor listing; take down anything wrong or misleading (no approval queue by default). */
export default function AdminListingsPage() {
  const [category, setCategory] = useState("");
  const [district, setDistrict] = useState("");
  const [show, setShow] = useState<"all" | "removed" | "pending">("all");
  const params = new URLSearchParams({ limit: "200" });
  if (category) params.set("category", category);
  if (district) params.set("district", district);
  if (show === "removed") params.set("removed", "true");
  if (show === "pending") params.set("pending", "true");
  const { data: options } = useSWR<VendorOptions>("/vendor-options", fetcher, { revalidateOnFocus: false });
  const { data: rows, error, mutate } = useSWR<AdminListing[]>(`/admin/catalog/listings?${params}`, fetcher, { keepPreviousData: true });
  const [target, setTarget] = useState<AdminListing | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  const replace = (updated: AdminListing) => mutate(rows?.map((r) => (r.id === updated.id ? updated : r)), { revalidate: false });

  async function takeDown() {
    if (!target) return;
    setBusy(true);
    setProblem("");
    try {
      replace(await api<AdminListing>(`/admin/catalog/listings/${target.id}/remove`, { body: { reason } }));
      setTarget(null);
      setReason("");
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : "Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function act(listing: AdminListing, action: "restore" | "approve") {
    setProblem("");
    try {
      replace(await api<AdminListing>(`/admin/catalog/listings/${listing.id}/${action}`, { method: "POST" }));
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : "Couldn't reach the server.");
    }
  }

  return (
    <>
      <PageTitle title="Listings" subtitle="All products and services vendors have listed. Take down anything wrong or misleading." />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <SelectField
          label="Show"
          className="[&_label]:sr-only"
          value={show}
          onChange={(e) => setShow(e.target.value as typeof show)}
          options={[
            { value: "all", label: "All listings" },
            { value: "removed", label: "Taken down" },
            { value: "pending", label: "Waiting for approval" },
          ]}
        />
        <SelectField
          label="Category"
          className="[&_label]:sr-only"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="All categories"
          options={(options?.capabilities ?? []).map((c) => ({ value: c.code, label: c.name }))}
        />
        <SelectField
          label="District"
          className="[&_label]:sr-only"
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          placeholder="All districts"
          options={(options?.districts ?? []).map((d) => ({ value: d.code, label: `${d.name} (${d.state})` }))}
        />
      </div>
      {problem && (
        <div className="mb-4">
          <Alert kind="error">{problem}</Alert>
        </div>
      )}
      {error && <Alert kind="error">{error.message ?? "Couldn't load listings."}</Alert>}
      {!rows && !error && <Spinner />}
      {rows && rows.length === 0 && (
        <Card>
          <p className="text-sm text-muted">No listings here.</p>
        </Card>
      )}
      {rows && rows.length > 0 && (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-line">
            {rows.map((l) => (
              <li key={l.id} className="flex gap-4 px-5 py-4">
                <div className="size-14 shrink-0 overflow-hidden rounded-md border border-line bg-canvas">
                  {l.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- vendor photos served by our API
                    <img src={mediaUrl(l.images[0].url)} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-muted">
                      <ImageOff className="size-4" aria-hidden />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{l.name.en}</p>
                    {l.visible_to_farmers ? <Badge tone="success">Visible</Badge> : <Badge tone={l.removed ? "danger" : "warning"}>{l.removed ? "Taken down" : "Hidden"}</Badge>}
                  </div>
                  <p className="text-xs text-muted">
                    <Link href={`/admin/vendors/${l.vendor_id}`} className="hover:underline">{l.vendor_name}</Link>
                    {" · "}
                    {KIND_LABELS[l.kind]} · {l.item_type_name ?? l.category_name}
                    {l.brand && ` · ${l.brand}`}
                  </p>
                  <p className="mt-0.5 text-sm">
                    {l.enquiry_only ? "Enquiry only" : priceRange(l)} <span className="text-xs text-muted">{UNIT_LABELS[l.variants[0]?.unit] ?? ""}</span>
                  </p>
                  {Object.keys(l.attributes).length > 0 && (
                    <p className="mt-0.5 text-xs text-muted">
                      {Object.entries(l.attributes).map(([k, v]) => `${k.replaceAll("_", " ")}: ${v}`).join(" · ")}
                    </p>
                  )}
                  {l.hidden_reason && !l.visible_to_farmers && <p className="mt-1 text-xs text-muted">{l.hidden_reason}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {l.removed ? (
                    <Button variant="secondary" className="h-8 text-xs" onClick={() => act(l, "restore")}>
                      <RotateCcw className="size-3.5" /> Restore
                    </Button>
                  ) : (
                    <Button variant="secondary" className="h-8 text-xs text-danger" onClick={() => setTarget(l)}>
                      <ShieldAlert className="size-3.5" /> Take down
                    </Button>
                  )}
                  {l.approval_status === "pending" && (
                    <Button className="h-8 text-xs" onClick={() => act(l, "approve")}>
                      Approve
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Dialog open={target !== null} onClose={() => setTarget(null)} title="Take down listing">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            “{target?.name.en}” by {target?.vendor_name} will be hidden from farmers. The vendor is emailed the reason and
            can&apos;t bring it back themselves.
          </p>
          <TextAreaField
            label="Reason (the vendor sees this)" required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            hint="At least 10 characters, e.g. “Photo shows a different brand.”"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} disabled={reason.trim().length < 10} onClick={takeDown}>
              Take down
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
