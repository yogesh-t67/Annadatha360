"use client";

import { Eye, EyeOff, ImageOff, Pencil, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";

import { Dialog } from "@/components/dialog";
import { Alert, Badge, Button, Card, PageTitle, SelectField, Spinner } from "@/components/ui";
import { api, ApiError, fetcher } from "@/lib/api";
import { type CatalogOptions, KIND_LABELS, type Listing, priceRange, UNIT_LABELS } from "@/lib/catalog";
import { mediaUrl } from "@/lib/vendor";

export default function ListingsPage() {
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (q.trim()) params.set("q", q.trim());
  const { data: options, error: optionsError } = useSWR<CatalogOptions>("/catalog/options", fetcher);
  const { data: rows, error, mutate } = useSWR<Listing[]>(options ? `/catalog/listings?${params}` : null, fetcher, { keepPreviousData: true });
  const [deleting, setDeleting] = useState<Listing | null>(null);
  const [problem, setProblem] = useState("");

  if (optionsError instanceof ApiError && (optionsError.code === "vendor_not_approved" || optionsError.code === "not_a_vendor")) {
    return (
      <>
        <PageTitle title="Listings" />
        <Alert kind="info">
          You can add products and services once Annadata approves your application.{" "}
          <Link href="/vendor" className="underline">See your application status</Link>.
        </Alert>
      </>
    );
  }

  async function act(listing: Listing, action: "hide" | "show") {
    setProblem("");
    try {
      const updated = await api<Listing>(`/catalog/listings/${listing.id}/${action}`, { method: "POST" });
      mutate(rows?.map((r) => (r.id === updated.id ? updated : r)), { revalidate: false });
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : "Couldn't reach the server.");
    }
  }

  async function remove() {
    if (!deleting) return;
    try {
      await api(`/catalog/listings/${deleting.id}`, { method: "DELETE" });
      mutate(rows?.filter((r) => r.id !== deleting.id), { revalidate: false });
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : "Couldn't delete.");
    }
    setDeleting(null);
  }

  return (
    <>
      <PageTitle
        title="Listings"
        subtitle="Products and services farmers in your districts can see"
        actions={
          options && options.categories.length > 0 ? (
            <Link href="/vendor/listings/new" className="inline-flex h-10 items-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
              <Plus className="size-4" /> Add listing
            </Link>
          ) : null
        }
      />
      {options && options.requires_approval && (
        <div className="mb-4">
          <Alert kind="info">New and edited listings are checked by Annadata before farmers see them.</Alert>
        </div>
      )}
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_14rem]">
        <label className="relative block">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input className="h-10 w-full rounded-md border border-line bg-surface pl-9 pr-3 text-sm focus:border-brand-600" placeholder="Search name or brand" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <SelectField
          label="Category"
          className="[&_label]:sr-only"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="All categories"
          options={(options?.categories ?? []).map((c) => ({ value: c.code, label: c.name }))}
        />
      </div>
      {problem && (
        <div className="mb-4">
          <Alert kind="error">{problem}</Alert>
        </div>
      )}
      {(error || optionsError) && <Alert kind="error">{(error ?? optionsError).message ?? "Couldn't load listings."}</Alert>}
      {!rows && !error && !optionsError && <Spinner />}
      {rows && rows.length === 0 && (
        <Card>
          <p className="text-sm text-muted">No listings yet. Add your first product or service.</p>
        </Card>
      )}
      {rows && rows.length > 0 && (
        <ul className="grid gap-4 md:grid-cols-2">
          {rows.map((l) => (
            <li key={l.id}>
              <Card className="flex h-full gap-4 p-4">
                <div className="size-20 shrink-0 overflow-hidden rounded-md border border-line bg-canvas">
                  {l.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- vendor photos served by our API, already sized
                    <img src={mediaUrl(l.images[0].url)} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-muted">
                      <ImageOff className="size-5" aria-hidden />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{l.name.en}</p>
                  <p className="truncate text-xs text-muted">
                    {KIND_LABELS[l.kind]} · {l.item_type_name ?? l.category_name}
                    {l.brand && ` · ${l.brand}`}
                  </p>
                  <p className="mt-1 text-sm">
                    {l.enquiry_only ? "Send enquiry" : priceRange(l)}{" "}
                    <span className="text-xs text-muted">{UNIT_LABELS[l.variants[0]?.unit] ?? ""}</span>
                  </p>
                  {l.kind === "product" && (
                    <p className="text-xs text-muted">
                      Stock: {l.variants.map((v) => `${v.label} ${v.stock_qty ?? 0}`).join(" · ")}
                    </p>
                  )}
                  <div className="mt-2">
                    {l.visible_to_farmers ? <Badge tone="success">Visible to farmers</Badge> : <Badge tone={l.removed ? "danger" : "warning"}>Hidden</Badge>}
                  </div>
                  {l.hidden_reason && <p className="mt-1 text-xs text-muted">{l.hidden_reason}</p>}
                  <div className="mt-3 flex flex-wrap gap-1">
                    <Link href={`/vendor/listings/${l.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs font-medium hover:bg-canvas">
                      <Pencil className="size-3.5" /> Edit
                    </Link>
                    {l.active ? (
                      <Button variant="ghost" className="h-8 px-2.5 text-xs" onClick={() => act(l, "hide")}>
                        <EyeOff className="size-3.5" /> Hide
                      </Button>
                    ) : (
                      <Button variant="ghost" className="h-8 px-2.5 text-xs" onClick={() => act(l, "show")}>
                        <Eye className="size-3.5" /> Show
                      </Button>
                    )}
                    <Button variant="ghost" className="h-8 px-2.5 text-xs text-danger" onClick={() => setDeleting(l)}>
                      <Trash2 className="size-3.5" /> Delete
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} title="Delete listing?">
        <p className="text-sm text-muted">
          “{deleting?.name.en}” and its photos will be removed. This can&apos;t be undone. To take it off temporarily, use Hide instead.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={remove}>
            Delete
          </Button>
        </div>
      </Dialog>
    </>
  );
}
