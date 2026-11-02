"use client";

import { MoreHorizontal, UserPlus } from "lucide-react";
import { type FormEvent, useState } from "react";
import useSWR from "swr";

import { useMe } from "@/components/app-shell";
import { Dialog } from "@/components/dialog";
import { Alert, Badge, Button, Card, Field, PageTitle, SelectField, Spinner, RequiredNote } from "@/components/ui";
import { api, ApiError, fetcher, type Schemas } from "@/lib/api";

type User = Schemas["UserOut"];
type Confirm = { user: User; action: "disable" | "enable" | "reset-mfa" | "resend-invite" } | null;

const ROLE_LABELS: Record<string, string> = { super_admin: "Super Admin", ops: "Operations" };
const CONFIRM_TEXT = {
  disable: { title: "Disable account", body: "They're logged out everywhere and can't log in until enabled again.", button: "Disable" },
  enable: { title: "Enable account", body: "They can log in again.", button: "Enable" },
  "reset-mfa": {
    title: "Reset authenticator",
    body: "Use this when someone lost their phone. First confirm it's really them (call them on their known number). They're logged out and set up the app again at next login.",
    button: "Reset authenticator",
  },
  "resend-invite": { title: "Send invite again", body: "A new set-password link is emailed; the old one stops working.", button: "Send again" },
};

export default function UsersPage() {
  const me = useMe();
  const { data: users, error, mutate } = useSWR<User[]>("/users", fetcher);
  const [inviting, setInviting] = useState(false);
  const [form, setForm] = useState({ email: "", full_name: "", phone: "", role: "ops" });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [notice, setNotice] = useState("");

  async function invite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFields({});
    setFormError("");
    try {
      await api("/users", { body: { ...form, phone: form.phone || null } });
      await mutate();
      setNotice(`Invite sent to ${form.email}.`);
      setInviting(false);
      setForm({ email: "", full_name: "", phone: "", role: "ops" });
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fields);
        setFormError(err.message);
      } else setFormError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    if (!confirm) return;
    setBusy(true);
    setProblem("");
    try {
      await api(`/users/${confirm.user.id}/${confirm.action}`, { method: "POST" });
      await mutate();
      setNotice(confirm.action === "resend-invite" ? `Invite sent again to ${confirm.user.email}.` : "");
      setConfirm(null);
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : "Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle
        title="Staff users"
        subtitle="Annadata people who use this admin panel. Every account needs an authenticator app."
        actions={
          <Button onClick={() => setInviting(true)}>
            <UserPlus className="size-4" /> Invite
          </Button>
        }
      />
      {notice && (
        <div className="mb-4">
          <Alert kind="success">{notice}</Alert>
        </div>
      )}
      {error && <Alert kind="error">{error.message ?? "Couldn't load users."}</Alert>}
      {!users && !error && <Spinner />}
      {users && (
        <Card className="overflow-visible p-0">
          <ul className="divide-y divide-line">
            {users.map((u) => {
              const self = u.email === me.email;
              const actions = [
                u.status === "invited" && ("resend-invite" as const),
                u.mfa_enabled && ("reset-mfa" as const),
                !self && u.status !== "disabled" && ("disable" as const),
                u.status === "disabled" && ("enable" as const),
              ].filter(Boolean) as NonNullable<Confirm>["action"][];
              return (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="text-sm">
                    <p className="font-medium">
                      {u.full_name} {self && <span className="text-muted">(you)</span>}
                    </p>
                    <p className="text-muted">
                      {u.email}
                      {u.last_login_at && ` · last login ${new Date(u.last_login_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {u.roles.map((r) => (
                        <Badge key={r} tone={r === "super_admin" ? "brand" : "neutral"}>{ROLE_LABELS[r] ?? r}</Badge>
                      ))}
                      {u.status === "invited" && <Badge tone="warning">Invite not accepted</Badge>}
                      {u.status === "disabled" && <Badge tone="danger">Disabled</Badge>}
                      {u.status === "active" && !u.mfa_enabled && <Badge tone="warning">Authenticator not set up</Badge>}
                    </div>
                  </div>
                  {actions.length > 0 && (
                    <div className="relative">
                      <Button variant="ghost" className="h-8 px-2" aria-label={`Actions for ${u.full_name}`} aria-expanded={menu === u.id} onClick={() => setMenu(menu === u.id ? null : u.id)}>
                        <MoreHorizontal className="size-4" />
                      </Button>
                      {menu === u.id && (
                        <div role="menu" className="absolute right-0 z-10 mt-1 w-52 rounded-md border border-line bg-surface py-1 shadow-lg">
                          {actions.map((a) => (
                            <button
                              key={a}
                              role="menuitem"
                              className={`block w-full px-3 py-2 text-left text-sm hover:bg-canvas ${a === "disable" ? "text-danger" : ""}`}
                              onClick={() => {
                                setMenu(null);
                                setProblem("");
                                setConfirm({ user: u, action: a });
                              }}
                            >
                              {CONFIRM_TEXT[a].title}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Dialog open={inviting} onClose={() => setInviting(false)} title="Invite a staff user">
        <form onSubmit={invite} className="space-y-4">
        <RequiredNote />
          {formError && <Alert kind="error">{formError}</Alert>}
          <Field label="Full name" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} error={fields.full_name} />
          <Field label="Work email" required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={fields.email} />
          <Field label="Mobile" optional type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={fields.phone} />
          <SelectField
            label="Role" required
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            options={[
              { value: "ops", label: "Operations: vendors and listings, no KYC documents" },
              { value: "super_admin", label: "Super Admin: everything" },
            ]}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setInviting(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={!form.email || !form.full_name}>
              Send invite
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} title={confirm ? CONFIRM_TEXT[confirm.action].title : ""}>
        <div className="space-y-4">
          <p className="text-sm">
            <strong>{confirm?.user.full_name}</strong> ({confirm?.user.email})
          </p>
          <p className="text-sm text-muted">{confirm && CONFIRM_TEXT[confirm.action].body}</p>
          {problem && <Alert kind="error">{problem}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button variant={confirm?.action === "disable" ? "danger" : "primary"} loading={busy} onClick={run}>
              {confirm && CONFIRM_TEXT[confirm.action].button}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
