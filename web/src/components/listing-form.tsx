"use client";

import { ImagePlus, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";

import { Alert, Button, Card, Field, SelectField, TextAreaField } from "@/components/ui";
import { api, ApiError, fetcher, type Schemas } from "@/lib/api";
import { type CatalogOptions, type Listing, UNIT_LABELS } from "@/lib/catalog";
import { mediaUrl, type VendorOptions } from "@/lib/vendor";

type VariantRow = { id?: string; label: string; unit: string; sku: string; mrp: string; price: string; stock: string; capacity: string };

const toRupees = (paise: number | null | undefined) => (paise == null ? "" : String(paise / 100));
const toPaise = (rupees: string) => (rupees.trim() === "" ? null : Math.round(parseFloat(rupees) * 100));

function emptyRow(unit: string): VariantRow {
  return { label: "", unit, sku: "", mrp: "", price: "", stock: "", capacity: "" };
}

export function ListingForm({ options, listing }: { options: CatalogOptions; listing?: Listing }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: vendorOptions } = useSWR<VendorOptions>("/vendor-options", fetcher, { revalidateOnFocus: false });
  const { data: crops } = useSWR<Schemas["CropOut"][]>("crops", () => fetch("/api/crops").then((r) => r.json()), { revalidateOnFocus: false });

  const [category, setCategory] = useState(listing?.category ?? options.categories[0]?.code ?? "");
  const cat = options.categories.find((c) => c.code === category);
  const [itemType, setItemType] = useState(listing?.item_type ?? "");
  const [name, setName] = useState({ en: listing?.name.en ?? "", te: listing?.name.te ?? "", hi: listing?.name.hi ?? "" });
  const [description, setDescription] = useState(listing?.description.en ?? "");
  const [brand, setBrand] = useState(listing?.brand ?? "");
  const [attrs, setAttrs] = useState<Record<string, string>>(listing?.attributes ?? {});
  const [cropCodes, setCropCodes] = useState<string[]>(listing?.crop_codes ?? []);
  const allDistricts = options.district_codes;
  const [everywhere, setEverywhere] = useState(!listing || listing.district_codes.length === allDistricts.length);
  const [districts, setDistricts] = useState<string[]>(listing?.district_codes ?? allDistricts);
  const [rows, setRows] = useState<VariantRow[]>(
    listing?.variants.map((v) => ({
      id: v.id,
      label: v.label,
      unit: v.unit,
      sku: v.sku ?? "",
      mrp: toRupees(v.mrp_paise),
      price: toRupees(v.price_paise),
      stock: v.stock_qty?.toString() ?? "",
      capacity: v.daily_capacity?.toString() ?? "",
    })) ?? [emptyRow(cat?.units[0] ?? "pack")],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const product = cat?.kind === "product";

  function changeCategory(code: string) {
    const next = options.categories.find((c) => c.code === code);
    setCategory(code);
    setItemType("");
    setAttrs({});
    setRows(rows.map((r) => ({ ...r, unit: next?.units.includes(r.unit) ? r.unit : next?.units[0] ?? "pack" })));
  }

  const setRow = (i: number, patch: Partial<VariantRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setFields({});
    setSaved(false);
    const body = {
      category,
      item_type: product ? null : itemType || null,
      name: { en: name.en, te: name.te || null, hi: name.hi || null },
      description: { en: description || null },
      brand: brand || null,
      attributes: Object.fromEntries(Object.entries(attrs).filter(([, v]) => v.trim())),
      crop_codes: cropCodes,
      district_codes: everywhere ? null : districts,
      variants: rows.map((r) => ({
        id: r.id ?? null,
        label: r.label,
        unit: r.unit,
        sku: r.sku || null,
        mrp_paise: product ? toPaise(r.mrp) : null,
        price_paise: toPaise(r.price),
        stock_qty: product ? (r.stock === "" ? null : Number(r.stock)) : null,
        daily_capacity: !product && r.capacity ? Number(r.capacity) : null,
      })),
    };
    try {
      const out = listing
        ? await api<Listing>(`/catalog/listings/${listing.id}`, { method: "PUT", body })
        : await api<Listing>("/catalog/listings", { body });
      if (listing) {
        setSaved(true);
        await mutate(`/catalog/listings/${listing.id}`, out, { revalidate: false });
        // New rows now have ids; keep them, so the next save updates these rows instead of recreating them.
        setRows((current) => current.map((r, i) => ({ ...r, id: out.variants[i]?.id ?? r.id })));
      } else {
        router.replace(`/vendor/listings/${out.id}?created=1`);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fields);
        setError(err.message);
      } else setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const districtName = (code: string) => vendorOptions?.districts.find((d) => d.code === code)?.name ?? code;

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      {error && <Alert kind="error">{error}</Alert>}
      {saved && <Alert kind="success">Saved.</Alert>}

      <Card className="space-y-4">
        <h2 className="font-semibold">What it is</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Category"
            value={category}
            onChange={(e) => changeCategory(e.target.value)}
            options={options.categories.map((c) => ({ value: c.code, label: c.name }))}
            disabled={!!listing}
            hint={listing ? "The category can't be changed. Create a new listing instead." : undefined}
          />
          {!product && cat && (
            <SelectField
              label="Type"
              value={itemType}
              onChange={(e) => setItemType(e.target.value)}
              placeholder="Choose…"
              options={Object.entries(cat.item_types).map(([value, label]) => ({ value, label }))}
              error={fields.item_type}
            />
          )}
          <Field label="Name (English)" placeholder={product ? "e.g. BPT 5204 Paddy Seed" : "e.g. Tractor ploughing"} value={name.en} onChange={(e) => setName({ ...name, en: e.target.value })} error={fields["name.en"]} />
          {product && <Field label="Brand (optional)" value={brand} onChange={(e) => setBrand(e.target.value)} />}
          <Field label="Name in Telugu (optional)" lang="te" value={name.te} onChange={(e) => setName({ ...name, te: e.target.value })} />
          <Field label="Name in Hindi (optional)" lang="hi" value={name.hi} onChange={(e) => setName({ ...name, hi: e.target.value })} />
        </div>
        <TextAreaField label="Description (optional)" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} hint="How to use, what's included, delivery area…" />
      </Card>

      {cat && cat.attributes.length > 0 && (
        <Card className="space-y-4">
          <h2 className="font-semibold">Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {cat.attributes.map((a) => (
              <Field
                key={a.key}
                label={`${a.label}${a.required ? "" : " (optional)"}`}
                value={attrs[a.key] ?? ""}
                onChange={(e) => setAttrs({ ...attrs, [a.key]: e.target.value })}
                error={fields[`attributes.${a.key}`]}
              />
            ))}
          </div>
        </Card>
      )}

      <Card className="space-y-4">
        <div>
          <h2 className="font-semibold">{product ? "Pack sizes and prices" : "Rates"}</h2>
          <p className="mt-1 text-sm text-muted">
            {product
              ? `Prices in rupees. The selling price can't be more than MRP. Over ₹${(options.enquiry_above_paise / 100).toLocaleString("en-IN")}, farmers send an enquiry instead of buying.`
              : "Prices in rupees."}
          </p>
        </div>
        {fields.variants && <Alert kind="error">{fields.variants}</Alert>}
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={r.id ?? i} className="grid gap-3 rounded-md border border-line p-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto] sm:items-start">
              <Field label={product ? "Pack size" : "Label"} placeholder={product ? "25 kg bag" : "Per acre"} value={r.label} onChange={(e) => setRow(i, { label: e.target.value })} error={fields[`variants.${i}.label`]} />
              {product ? (
                <>
                  <Field label="MRP ₹" inputMode="decimal" value={r.mrp} onChange={(e) => setRow(i, { mrp: e.target.value.replace(/[^\d.]/g, "") })} error={fields[`variants.${i}.mrp_paise`]} />
                  <Field label="Selling price ₹" inputMode="decimal" value={r.price} onChange={(e) => setRow(i, { price: e.target.value.replace(/[^\d.]/g, "") })} error={fields[`variants.${i}.price_paise`]} />
                  <Field label="In stock" inputMode="numeric" value={r.stock} onChange={(e) => setRow(i, { stock: e.target.value.replace(/\D/g, "") })} error={fields[`variants.${i}.stock_qty`]} />
                </>
              ) : (
                <>
                  <SelectField label="Unit" value={r.unit} onChange={(e) => setRow(i, { unit: e.target.value })} options={(cat?.units ?? []).map((u) => ({ value: u, label: UNIT_LABELS[u] ?? u }))} error={fields[`variants.${i}.unit`]} />
                  <Field label="Rate ₹" inputMode="decimal" value={r.price} onChange={(e) => setRow(i, { price: e.target.value.replace(/[^\d.]/g, "") })} error={fields[`variants.${i}.price_paise`]} />
                  <Field label="Per day (optional)" inputMode="numeric" hint="How many you can do daily" value={r.capacity} onChange={(e) => setRow(i, { capacity: e.target.value.replace(/\D/g, "") })} />
                </>
              )}
              <div className="sm:pt-7">
                <Button type="button" variant="ghost" className="h-10 px-2 text-danger" disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove this row">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        {rows.length < 10 && (
          <Button type="button" variant="secondary" onClick={() => setRows([...rows, emptyRow(cat?.units[0] ?? "pack")])}>
            <Plus className="size-4" /> {product ? "Add a pack size" : "Add a rate"}
          </Button>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">Where and for which crops</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-brand-600" checked={everywhere} onChange={(e) => setEverywhere(e.target.checked)} />
          All districts I serve ({allDistricts.length})
        </label>
        {!everywhere && (
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
            {allDistricts.map((code) => (
              <label key={code} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-canvas">
                <input
                  type="checkbox"
                  className="size-4 accent-brand-600"
                  checked={districts.includes(code)}
                  onChange={() => setDistricts(districts.includes(code) ? districts.filter((d) => d !== code) : [...districts, code])}
                />
                {districtName(code)}
              </label>
            ))}
          </div>
        )}
        {fields.district_codes && <p className="text-sm text-danger">{fields.district_codes}</p>}
        {crops && (
          <div>
            <p className="mb-1.5 text-sm font-medium">For crops (optional)</p>
            <div className="flex flex-wrap gap-1.5">
              {crops.map((c) => {
                const on = cropCodes.includes(c.code);
                return (
                  <button
                    key={c.code}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setCropCodes(on ? cropCodes.filter((x) => x !== c.code) : [...cropCodes, c.code])}
                    className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-brand-600 bg-brand-50 text-brand-800" : "border-line text-muted hover:bg-canvas"}`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-muted">Leave empty if it suits any crop.</p>
          </div>
        )}
      </Card>

      <div className="flex gap-3">
        <Button type="submit" loading={busy}>
          {listing ? "Save changes" : "Create listing"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/vendor/listings")}>
          {listing ? "Back to listings" : "Cancel"}
        </Button>
      </div>
    </form>
  );
}

/** Photos for a saved listing (public, so farmers can see them). */
export function ListingPhotos({ listing, onChange }: { listing: Listing; onChange: (l: Listing) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add(file: File | undefined) {
    if (!file) return;
    setError("");
    if (file.size > 5 * 1024 * 1024) {
      setError("Photo is larger than 5 MB.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      onChange(await api<Listing>(`/catalog/listings/${listing.id}/images`, { form }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(key: string) {
    setError("");
    try {
      onChange(await api<Listing>(`/catalog/listings/${listing.id}/images/${key}`, { method: "DELETE" }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove the photo.");
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-semibold">Photos</h2>
        <p className="mt-1 text-sm text-muted">Up to 8 photos (JPG, PNG or WebP, 5 MB each). The first one is shown in lists.</p>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      <div className="flex flex-wrap gap-3">
        {listing.images.map((img, i) => (
          <div key={img.key} className="relative size-28 overflow-hidden rounded-md border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element -- vendor photos served by our API */}
            <img src={mediaUrl(img.url)} alt={`Photo ${i + 1}`} className="size-full object-cover" />
            <button
              type="button"
              aria-label={`Remove photo ${i + 1}`}
              onClick={() => remove(img.key)}
              className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        {listing.images.length < 8 && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="flex size-28 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-line text-xs text-muted hover:bg-canvas disabled:opacity-60"
          >
            <ImagePlus className="size-5" aria-hidden />
            {busy ? "Uploading…" : "Add photo"}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => add(e.target.files?.[0])} />
    </Card>
  );
}
