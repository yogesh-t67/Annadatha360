"use client";

import clsx from "clsx";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";

import { DocumentField } from "@/components/document-field";
import { Alert, Badge, Button, Field, SelectField, RequiredNote } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import {
  BUSINESS_TYPE_LABELS,
  type DocumentRef,
  GROUP_LABELS,
  type Licence,
  STATE_NAMES,
  type Vendor,
  type VendorOptions,
} from "@/lib/vendor";

export type StepProps = {
  vendor: Vendor;
  options: VendorOptions;
  onSaved: (v: Vendor) => void;
  locked: boolean;
};

/** Shared save behaviour: busy state, field errors from the backend, a "Saved" note. */
function useSave(onSaved: (v: Vendor) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  async function run(call: () => Promise<Vendor>) {
    setBusy(true);
    setError("");
    setFields({});
    setSaved(false);
    try {
      onSaved(await call());
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fields);
        setError(err.message);
      } else setError("Couldn't reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, fields, saved, run };
}

function SaveBar({ busy, saved, locked, label = "Save" }: { busy: boolean; saved: boolean; locked: boolean; label?: string }) {
  if (locked) return null;
  return (
    <div className="flex items-center gap-3 border-t border-line pt-4">
      <Button type="submit" loading={busy}>
        {label}
      </Button>
      {saved && !busy && <span className="text-sm text-success">Saved</span>}
    </div>
  );
}

function Section({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {intro && <p className="mt-1 text-sm text-muted">{intro}</p>}
      </div>
      {children}
    </div>
  );
}

// ---------- 1. Business details ----------

export function BusinessStep({ vendor, options, onSaved, locked }: StepProps) {
  const [f, setF] = useState({
    kind: vendor.kind,
    trade_name: vendor.trade_name,
    legal_name: vendor.legal_name ?? "",
    business_type: vendor.business_type && vendor.business_type !== "individual" ? vendor.business_type : "",
    gstin: vendor.gstin ?? "",
    pan: vendor.pan ?? "",
    address_line: vendor.address_line ?? "",
    district_code: vendor.district_code ?? "",
    pincode: vendor.pincode ?? "",
    contact_phone: vendor.contact_phone ?? "",
    contact_email: vendor.contact_email ?? "",
  });
  const [gstDoc, setGstDoc] = useState<DocumentRef | null>(vendor.gst_certificate_document ?? null);
  const [panDoc, setPanDoc] = useState<DocumentRef | null>(vendor.pan_card_document ?? null);
  const { busy, error, fields, saved, run } = useSave(onSaved);
  const business = f.kind === "business";
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const blank = (v: string) => (v.trim() ? v.trim() : null);

  function submit(e: FormEvent) {
    e.preventDefault();
    run(() =>
      api<Vendor>("/vendor/profile", {
        method: "PUT",
        body: {
          kind: f.kind,
          trade_name: f.trade_name,
          legal_name: blank(f.legal_name),
          business_type: business ? blank(f.business_type) : null,
          gstin: business ? blank(f.gstin) : null,
          pan: blank(f.pan),
          address_line: blank(f.address_line),
          district_code: blank(f.district_code),
          pincode: blank(f.pincode),
          contact_phone: blank(f.contact_phone),
          contact_email: blank(f.contact_email),
          // Only send documents that changed; the backend keeps the attached one otherwise.
          gst_certificate_document_id: business && gstDoc && gstDoc.id !== vendor.gst_certificate_document?.id ? gstDoc.id : null,
          pan_card_document_id: panDoc && panDoc.id !== vendor.pan_card_document?.id ? panDoc.id : null,
        },
      }),
    );
  }

  const districtOptions = (["AP", "TG"] as const).flatMap((s) =>
    options.districts.filter((d) => d.state === s).map((d) => ({ value: d.code, label: `${d.name} (${STATE_NAMES[s]})` })),
  );

  return (
    <Section title="Business details" intro="As shown on your PAN card and GST certificate.">
        <RequiredNote />
      <form onSubmit={submit} className="space-y-5" noValidate>
        {error && <Alert kind="error">{error}</Alert>}
        <fieldset disabled={locked} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Type" required
              value={f.kind}
              onChange={set("kind")}
              options={[
                { value: "business", label: "Business (has GSTIN)" },
                { value: "individual", label: "Individual (PAN only)" },
              ]}
            />
            {business && (
              <SelectField
                label="Business type" required
                value={f.business_type}
                onChange={set("business_type")}
                placeholder="Choose…"
                options={options.business_types.map((t) => ({ value: t, label: BUSINESS_TYPE_LABELS[t] ?? t }))}
                error={fields.business_type}
              />
            )}
            <Field label="Shop / business name (shown to farmers)" required value={f.trade_name} onChange={set("trade_name")} error={fields.trade_name} />
            <Field required label={business ? "Legal name (as on GST certificate)" : "Name as on PAN card"} value={f.legal_name} onChange={set("legal_name")} error={fields.legal_name} />
            {business && (
              <Field label="GSTIN" required placeholder="37ABCDE1234F1Z5" maxLength={15} value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} error={fields.gstin} />
            )}
            <Field label="PAN" required placeholder="ABCDE1234F" maxLength={10} value={f.pan} onChange={(e) => setF({ ...f, pan: e.target.value.toUpperCase() })} error={fields.pan} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Address" required className="sm:col-span-2" value={f.address_line} onChange={set("address_line")} error={fields.address_line} />
            <SelectField label="District" required value={f.district_code} onChange={set("district_code")} placeholder="Choose…" options={districtOptions} error={fields.district_code} />
            <Field
              label="Pincode" required
              inputMode="numeric"
              maxLength={6}
              value={f.pincode}
              onChange={(e) => setF({ ...f, pincode: e.target.value.replace(/\D/g, "") })}
              error={fields.pincode}
              hint={vendor.postal_district && f.pincode === vendor.pincode ? `Post office district: ${vendor.postal_district}` : undefined}
            />
            <Field label="Contact phone" required type="tel" value={f.contact_phone} onChange={set("contact_phone")} error={fields.contact_phone} />
            <Field label="Contact email" optional type="email" value={f.contact_email} onChange={set("contact_email")} error={fields.contact_email} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {business && <DocumentField required label="GST registration certificate" kind="gst_certificate" value={gstDoc} onChange={setGstDoc} disabled={locked} />}
            <DocumentField required label="PAN card" kind="pan_card" value={panDoc} onChange={setPanDoc} disabled={locked} />
          </div>
        </fieldset>
        <SaveBar busy={busy} saved={saved} locked={locked} />
      </form>
    </Section>
  );
}

// ---------- 2. What you offer ----------

export function OfferingsStep({ vendor, options, onSaved, locked }: StepProps) {
  const [codes, setCodes] = useState<string[]>(vendor.capabilities.map((c) => c.code));
  const [team, setTeam] = useState(vendor.labour_team_size?.toString() ?? "");
  const { busy, error, fields, saved, run } = useSave(onSaved);
  const groups = useMemo(() => {
    const out: Record<string, VendorOptions["capabilities"]> = {};
    for (const c of options.capabilities) (out[c.group] ??= []).push(c);
    return out;
  }, [options.capabilities]);
  const toggle = (code: string) => setCodes(codes.includes(code) ? codes.filter((c) => c !== code) : [...codes, code]);

  function submit(e: FormEvent) {
    e.preventDefault();
    run(() =>
      api<Vendor>("/vendor/capabilities", {
        method: "PUT",
        body: { codes, labour_team_size: codes.includes("labour") && team ? Number(team) : null },
      }),
    );
  }

  return (
    <Section title="What you offer" intro="Tick everything you sell or provide. Some need a licence; we'll ask for it in the Licences step.">
      <form onSubmit={submit} className="space-y-6" noValidate>
        {error && <Alert kind="error">{error}</Alert>}
        <fieldset disabled={locked} className="space-y-6">
          {Object.entries(groups).map(([group, caps]) => (
            <div key={group}>
              <h3 className="mb-2 text-sm font-semibold text-muted">{GROUP_LABELS[group] ?? group}</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {caps.map((c) => (
                  <label
                    key={c.code}
                    className={clsx(
                      "flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm",
                      codes.includes(c.code) ? "border-brand-600 bg-brand-50" : "border-line hover:bg-canvas",
                    )}
                  >
                    <input type="checkbox" className="mt-0.5 size-4 accent-brand-600" checked={codes.includes(c.code)} onChange={() => toggle(c.code)} />
                    <span>
                      <span className="block font-medium">{c.name}</span>
                      {c.licences.length > 0 && (
                        <span className="text-xs text-muted">Needs: {c.licences.map((l) => options.licence_types[l]).join(", ")}</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          {codes.includes("labour") && (
            <Field
              label="How many workers are in your labour team?" required
              inputMode="numeric"
              className="max-w-xs"
              value={team}
              onChange={(e) => setTeam(e.target.value.replace(/\D/g, ""))}
              error={fields.labour_team_size}
              hint={`${options.contract_labour_threshold} or more workers needs a contract labour licence.`}
            />
          )}
        </fieldset>
        <SaveBar busy={busy} saved={saved} locked={locked} />
      </form>
    </Section>
  );
}

// ---------- 3. Districts ----------

export function AreasStep({ vendor, options, onSaved, locked }: StepProps) {
  const [chosen, setChosen] = useState<string[]>(vendor.service_areas.map((a) => a.code));
  const [search, setSearch] = useState("");
  const { busy, error, saved, run } = useSave(onSaved);
  const toggle = (code: string) => setChosen(chosen.includes(code) ? chosen.filter((c) => c !== code) : [...chosen, code]);

  function submit(e: FormEvent) {
    e.preventDefault();
    run(() => api<Vendor>("/vendor/service-areas", { method: "PUT", body: { district_codes: chosen } }));
  }

  return (
    <Section title="Districts you serve" intro="Farmers in these districts will see you. You can deliver or work in more than your own district.">
      <form onSubmit={submit} className="space-y-5" noValidate>
        {error && <Alert kind="error">{error}</Alert>}
        <fieldset disabled={locked} className="space-y-5">
          <Field label="Search" placeholder="Type a district name" value={search} onChange={(e) => setSearch(e.target.value)} />
          {(["AP", "TG"] as const).map((state) => {
            const list = options.districts.filter((d) => d.state === state && d.name.toLowerCase().includes(search.trim().toLowerCase()));
            if (!list.length) return null;
            const allOn = list.every((d) => chosen.includes(d.code));
            return (
              <div key={state}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted">
                    {STATE_NAMES[state]} <span className="font-normal">({list.filter((d) => chosen.includes(d.code)).length} chosen)</span>
                  </h3>
                  {!locked && (
                    <button
                      type="button"
                      className="text-sm text-brand-700 hover:underline"
                      onClick={() =>
                        setChosen(allOn ? chosen.filter((c) => !list.some((d) => d.code === c)) : [...new Set([...chosen, ...list.map((d) => d.code)])])
                      }
                    >
                      {allOn ? "Clear these" : "Select all shown"}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                  {list.map((d) => (
                    <label key={d.code} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-canvas">
                      <input type="checkbox" className="size-4 accent-brand-600" checked={chosen.includes(d.code)} onChange={() => toggle(d.code)} />
                      {d.name}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </fieldset>
        <SaveBar busy={busy} saved={saved} locked={locked} label={`Save (${chosen.length} districts)`} />
      </form>
    </Section>
  );
}

// ---------- 4. Bank account ----------

export function BankStep({ vendor, onSaved, locked }: StepProps) {
  const bank = vendor.bank_account;
  const [f, setF] = useState({ holder_name: bank?.holder_name ?? "", ifsc: bank?.ifsc ?? "", account_number: "", confirm: "" });
  const [cheque, setCheque] = useState<DocumentRef | null>(bank?.cheque_document ?? null);
  const { busy, error, fields, saved, run } = useSave(onSaved);
  const [editing, setEditing] = useState(!bank);
  const mismatch = f.confirm.length > 0 && f.confirm !== f.account_number;

  function submit(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      const v = await api<Vendor>("/vendor/bank-account", {
        method: "PUT",
        body: {
          holder_name: f.holder_name,
          ifsc: f.ifsc,
          account_number: f.account_number,
          cheque_document_id: cheque && cheque.id !== bank?.cheque_document?.id ? cheque.id : null,
        },
      });
      setEditing(false);
      setF({ ...f, account_number: "", confirm: "" });
      return v;
    });
  }

  return (
    <Section title="Bank account" intro="Payments for your orders go here. The account number is stored encrypted; only the last 4 digits are ever shown.">
      {bank && !editing && (
        <div className="space-y-4">
          {saved && <Alert kind="success">Bank account saved.</Alert>}
          <dl className="grid gap-4 rounded-md border border-line p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Account holder</dt>
              <dd className="font-medium">{bank.holder_name}</dd>
            </div>
            <div>
              <dt className="text-muted">Account number</dt>
              <dd className="font-mono">{bank.account_masked}</dd>
            </div>
            <div>
              <dt className="text-muted">IFSC</dt>
              <dd className="font-mono">{bank.ifsc}</dd>
            </div>
            <div>
              <dt className="text-muted">Bank and branch</dt>
              <dd>{bank.bank_name ? `${bank.bank_name}, ${bank.branch}` : "Couldn't look up (checked later)"}</dd>
            </div>
          </dl>
          <DocumentField label="Cancelled cheque or bank passbook" kind="cancelled_cheque" value={bank.cheque_document ?? null} onChange={() => undefined} disabled />
          {!locked && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil className="size-4" /> Change bank account
            </Button>
          )}
        </div>
      )}
      {editing && !locked && (
        <form onSubmit={submit} className="space-y-5" noValidate>
        <RequiredNote />
          {error && <Alert kind="error">{error}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Account holder name" required value={f.holder_name} onChange={(e) => setF({ ...f, holder_name: e.target.value })} error={fields.holder_name} />
            <Field label="IFSC" required placeholder="SBIN0001234" maxLength={11} value={f.ifsc} onChange={(e) => setF({ ...f, ifsc: e.target.value.toUpperCase() })} error={fields.ifsc} hint="On your cheque book or passbook" />
            <Field label="Account number" required inputMode="numeric" autoComplete="off" value={f.account_number} onChange={(e) => setF({ ...f, account_number: e.target.value.replace(/\D/g, "") })} error={fields.account_number} />
            <Field
              label="Account number again" required
              inputMode="numeric"
              autoComplete="off"
              value={f.confirm}
              onChange={(e) => setF({ ...f, confirm: e.target.value.replace(/\D/g, "") })}
              error={mismatch ? "The two numbers don't match" : undefined}
            />
          </div>
          <DocumentField required label="Cancelled cheque or bank passbook" kind="cancelled_cheque" value={cheque} onChange={setCheque} />
          <div className="flex items-center gap-3 border-t border-line pt-4">
            <Button type="submit" loading={busy} disabled={!f.holder_name || !f.ifsc || !f.account_number || f.confirm !== f.account_number}>
              Save bank account
            </Button>
            {bank && (
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}
      {!bank && locked && <p className="text-sm text-muted">No bank account added.</p>}
    </Section>
  );
}

// ---------- 5. Licences ----------

function LicenceForm({
  options,
  initial,
  onDone,
  onCancel,
  allowedTypes,
  presetType,
}: {
  options: VendorOptions;
  initial?: Licence;
  onDone: (v: Vendor) => void;
  onCancel: () => void;
  allowedTypes: string[];
  presetType?: string;
}) {
  const [f, setF] = useState({
    licence_type: initial?.licence_type ?? presetType ?? allowedTypes[0] ?? "",
    number: initial?.number ?? "",
    issuing_authority: initial?.issuing_authority ?? "",
    valid_from: initial?.valid_from ?? "",
    valid_until: initial?.valid_until ?? "",
  });
  const [doc, setDoc] = useState<DocumentRef | null>(initial?.document ?? null);
  const { busy, error, fields, run } = useSave(onDone);

  function submit(e: FormEvent) {
    e.preventDefault();
    const body = {
      ...f,
      issuing_authority: f.issuing_authority || null,
      valid_from: f.valid_from || null,
      document_id: doc && doc.id !== initial?.document?.id ? doc.id : null,
    };
    run(() =>
      initial
        ? api<Vendor>(`/vendor/licences/${initial.id}`, { method: "PUT", body })
        : api<Vendor>("/vendor/licences", { method: "POST", body }),
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-md border border-line bg-canvas p-4" noValidate>
        <RequiredNote />
      {error && <Alert kind="error">{error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Licence" required
          value={f.licence_type}
          onChange={(e) => {
            setF({ ...f, licence_type: e.target.value });
            setDoc(null); // a copy belongs to one licence type
          }}
          options={allowedTypes.map((t) => ({ value: t, label: options.licence_types[t] }))}
        />
        <Field label="Licence number" required value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} error={fields.number} />
        <Field label="Issued by" optional placeholder="e.g. Joint Director of Agriculture, Guntur" value={f.issuing_authority} onChange={(e) => setF({ ...f, issuing_authority: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valid from" optional type="date" value={f.valid_from} onChange={(e) => setF({ ...f, valid_from: e.target.value })} />
          <Field label="Valid until" required type="date" value={f.valid_until} onChange={(e) => setF({ ...f, valid_until: e.target.value })} error={fields.valid_until} />
        </div>
      </div>
      <DocumentField required label="Copy of the licence" kind={f.licence_type} value={doc} onChange={setDoc} />
      <div className="flex gap-2">
        <Button type="submit" loading={busy} disabled={!f.licence_type || !f.number || !f.valid_until}>
          {initial ? "Save licence" : "Add licence"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function LicencesStep({ vendor, options, onSaved, locked }: StepProps) {
  const [adding, setAdding] = useState<string | false>(false); // false, or the licence type being added ("" = any)
  const [editing, setEditing] = useState<string | null>(null);
  const [problem, setProblem] = useState("");
  const needed = vendor.missing.filter((m) => m.code.startsWith("licence"));
  const allTypes = Object.keys(options.licence_types);

  async function remove(id: string) {
    setProblem("");
    try {
      onSaved(await api<Vendor>(`/vendor/licences/${id}`, { method: "DELETE" }));
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : "Couldn't delete.");
    }
  }

  return (
    <Section title="Licences" intro="Licences needed for what you offer, with expiry dates. We remind you before they expire.">
      {needed.length > 0 && (
        <Alert kind="warning">
          <p className="font-medium">Still needed:</p>
          <ul className="mt-2 space-y-2">
            {needed.map((m) => {
              const type = m.code.split(":")[1];
              const missingLicence = m.code.startsWith("licence:");
              const existing = vendor.licences.find((l) => l.licence_type === type);
              return (
                <li key={m.code} className="flex flex-wrap items-center justify-between gap-2">
                  <span>{m.message}</span>
                  {!locked && (
                    <Button
                      variant="secondary"
                      className="h-8 text-xs"
                      onClick={() => (missingLicence || !existing ? setAdding(type) : setEditing(existing.id))}
                    >
                      {missingLicence || !existing ? <><Plus className="size-3.5" /> Add this licence</> : <><Pencil className="size-3.5" /> Add the copy</>}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </Alert>
      )}
      {problem && <Alert kind="error">{problem}</Alert>}
      {vendor.licences.length === 0 && adding === false && <p className="text-sm text-muted">No licences added yet.</p>}
      <ul className="space-y-3">
        {vendor.licences.map((l) =>
          editing === l.id ? (
            <li key={l.id}>
              <LicenceForm
                options={options}
                initial={l}
                allowedTypes={allTypes}
                onCancel={() => setEditing(null)}
                onDone={(v) => {
                  setEditing(null);
                  onSaved(v);
                }}
              />
            </li>
          ) : (
            <li key={l.id} className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-line p-4">
              <div className="text-sm">
                <p className="font-medium">{l.licence_name}</p>
                <p className="text-muted">
                  No. {l.number} · valid until {new Date(l.valid_until).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
                <div className="mt-1.5 flex gap-2">
                  {l.expired ? <Badge tone="danger">Expired</Badge> : l.days_left <= 30 ? <Badge tone="warning">{l.days_left} days left</Badge> : <Badge tone="success">Valid</Badge>}
                  {!l.document && <Badge tone="warning">Copy missing</Badge>}
                </div>
              </div>
              {!locked && (
                <div className="flex gap-1">
                  <Button variant="ghost" className="h-8 px-2" onClick={() => setEditing(l.id)} aria-label={`Edit ${l.licence_name}`}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" className="h-8 px-2 text-danger" onClick={() => remove(l.id)} aria-label={`Delete ${l.licence_name}`}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )}
            </li>
          ),
        )}
      </ul>
      {!locked &&
        (adding !== false ? (
          <LicenceForm
            key={adding}
            options={options}
            allowedTypes={allTypes}
            presetType={adding || undefined}
            onCancel={() => setAdding(false)}
            onDone={(v) => {
              setAdding(false);
              onSaved(v);
            }}
          />
        ) : (
          <Button variant="secondary" onClick={() => setAdding("")}>
            <Plus className="size-4" /> Add another licence
          </Button>
        ))}
    </Section>
  );
}

// ---------- 6. Review and submit ----------

export function SubmitStep({ vendor, onSaved, locked, goTo }: StepProps & { goTo: (step: string, code: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      onSaved(await api<Vendor>("/vendor/submit", { method: "POST" }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (locked) {
    return vendor.status === "approved" ? (
      <Section title="Approved">
        <Alert kind="success">
          Your application is approved. <Link href="/vendor/listings" className="underline">Add your products and services</Link>.
        </Alert>
      </Section>
    ) : (
      <Section title="Submitted">
        <Alert kind="info">Your application is with Annadata. We&apos;ll email you when it&apos;s reviewed.</Alert>
      </Section>
    );
  }
  return (
    <Section title="Review and submit" intro="Once submitted, the application is locked while Annadata reviews it.">
      {vendor.missing.length > 0 ? (
        <Alert kind="warning">
          <p className="font-medium">Before you can submit, add:</p>
          <ul className="mt-1 space-y-1">
            {vendor.missing.map((m) => (
              <li key={m.code}>
                <button type="button" className="text-left underline hover:no-underline" onClick={() => goTo("", m.code)}>
                  {m.message}
                </button>
              </li>
            ))}
          </ul>
        </Alert>
      ) : (
        <div className="space-y-4">
          <Alert kind="success">Everything is filled in.</Alert>
          {error && <Alert kind="error">{error}</Alert>}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 accent-brand-600" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            I confirm the details and documents are true and belong to my business. I agree that Annadata may check them.
          </label>
          <Button onClick={submit} loading={busy} disabled={!confirmed}>
            Submit application
          </Button>
        </div>
      )}
    </Section>
  );
}
