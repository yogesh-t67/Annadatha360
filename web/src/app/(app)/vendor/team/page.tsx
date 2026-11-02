"use client";

import { UserPlus } from "lucide-react";
import { type FormEvent, useState } from "react";
import useSWR from "swr";

import { useMe } from "@/components/app-shell";
import { Dialog } from "@/components/dialog";
import { Alert, Badge, Button, Card, Field, PageTitle, Spinner, RequiredNote } from "@/components/ui";
import { api, ApiError, fetcher, type Schemas } from "@/lib/api";

type Member = Schemas["TeamMemberOut"];

export default function TeamPage() {
  const me = useMe();
  const { data: team, error, mutate } = useSWR<Member[]>("/vendor/team", fetcher);
  const [inviting, setInviting] = useState(false);
  const [form, setForm] = useState({ email: "", full_name: "", phone: "" });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState("");
  const [problem, setProblem] = useState("");
  const [invited, setInvited] = useState("");

  async function invite(e: FormEvent) {
    e.preventDefault();
    setBusy("invite");
    setFields({});
    setFormError("");
    try {
      mutate(await api<Member[]>("/vendor/team", { body: { ...form, phone: form.phone || null } }), { revalidate: false });
      setInvited(form.email);
      setInviting(false);
      setForm({ email: "", full_name: "", phone: "" });
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fields);
        setFormError(err.message);
      } else setFormError("Couldn't reach the server.");
    } finally {
      setBusy("");
    }
  }

  async function toggle(member: Member) {
    setBusy(member.id);
    setProblem("");
    try {
      const action = member.status === "disabled" ? "enable" : "disable";
      mutate(await api<Member[]>(`/vendor/team/${member.id}/${action}`, { method: "POST" }), { revalidate: false });
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : "Couldn't reach the server.");
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <PageTitle
        title="Team"
        subtitle="Staff can add and edit listings. They can't see KYC documents, bank details or this page."
        actions={
          <Button onClick={() => setInviting(true)}>
            <UserPlus className="size-4" /> Invite staff
          </Button>
        }
      />
      {invited && (
        <div className="mb-4">
          <Alert kind="success">Invite sent to {invited}. They set a password from the email, then set up their authenticator app.</Alert>
        </div>
      )}
      {problem && (
        <div className="mb-4">
          <Alert kind="error">{problem}</Alert>
        </div>
      )}
      {error && <Alert kind="error">{error.message ?? "Couldn't load your team."}</Alert>}
      {!team && !error && <Spinner />}
      {team && (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-line">
            {team.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="text-sm">
                  <p className="font-medium">
                    {m.full_name} {m.email === me.email && <span className="text-muted">(you)</span>}
                  </p>
                  <p className="text-muted">
                    {m.email}
                    {m.phone && ` · ${m.phone}`}
                  </p>
                  <div className="mt-1.5 flex gap-1.5">
                    <Badge tone={m.role === "vendor_owner" ? "brand" : "neutral"}>{m.role === "vendor_owner" ? "Owner" : "Staff"}</Badge>
                    {m.status === "invited" && <Badge tone="warning">Invite not accepted yet</Badge>}
                    {m.status === "disabled" && <Badge tone="danger">Disabled</Badge>}
                  </div>
                </div>
                {m.role === "vendor_staff" && (
                  <Button variant={m.status === "disabled" ? "secondary" : "ghost"} className="h-8 text-xs" loading={busy === m.id} onClick={() => toggle(m)}>
                    {m.status === "disabled" ? "Enable" : "Disable"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Dialog open={inviting} onClose={() => setInviting(false)} title="Invite a staff member">
        <form onSubmit={invite} className="space-y-4">
        <RequiredNote />
          {formError && <Alert kind="error">{formError}</Alert>}
          <Field label="Full name" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} error={fields.full_name} />
          <Field label="Email" required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={fields.email} hint="They log in with this email" />
          <Field label="Mobile" optional type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={fields.phone} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setInviting(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy === "invite"} disabled={!form.email || !form.full_name}>
              Send invite
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
