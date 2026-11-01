"use client";

import { Laptop, Smartphone } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

import { useMe } from "@/components/app-shell";
import { SetPasswordForm } from "@/components/set-password-form";
import { Alert, Button, Card, PageTitle, Spinner } from "@/components/ui";
import { api, fetcher, type Schemas } from "@/lib/api";

type Session = Schemas["SessionInfo"];

function device(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  const os = /Android/i.test(userAgent)
    ? "Android"
    : /iPhone|iPad/i.test(userAgent)
      ? "iPhone / iPad"
      : /Windows/i.test(userAgent)
        ? "Windows"
        : /Mac OS/i.test(userAgent)
          ? "Mac"
          : /Linux/i.test(userAgent)
            ? "Linux"
            : "Other";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "Browser";
  return `${browser} on ${os}`;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function Sessions() {
  const { data, error, mutate } = useSWR<Session[]>("/me/sessions", fetcher);
  const [busy, setBusy] = useState("");

  if (error) return <Alert kind="error">Couldn&apos;t load your devices.</Alert>;
  if (!data) return <Spinner />;
  return (
    <ul className="divide-y divide-line">
      {data.map((s) => {
        const phone = /Android|iPhone|iPad/i.test(s.user_agent ?? "");
        const Icon = phone ? Smartphone : Laptop;
        return (
          <li key={s.id} className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-start gap-3">
              <Icon className="mt-0.5 size-5 text-muted" aria-hidden />
              <div>
                <p className="text-sm font-medium">
                  {device(s.user_agent)} {s.current && <span className="ml-1 rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-800">This device</span>}
                </p>
                <p className="text-xs text-muted">
                  {s.ip ?? "Unknown address"} · active {when(s.last_seen_at)} · logged in {when(s.created_at)}
                </p>
              </div>
            </div>
            {!s.current && (
              <Button
                variant="secondary"
                loading={busy === s.id}
                onClick={async () => {
                  setBusy(s.id);
                  await api(`/me/sessions/${s.id}`, { method: "DELETE" }).catch(() => undefined);
                  await mutate();
                  setBusy("");
                }}
              >
                Log out
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function AccountPage() {
  const me = useMe();
  const [changed, setChanged] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [leaving, setLeaving] = useState(false);

  return (
    <>
      <PageTitle title="My account" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Profile</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-muted">Name</dt>
              <dd>{me.full_name}</dd>
            </div>
            <div>
              <dt className="text-muted">Email</dt>
              <dd>{me.email}</dd>
            </div>
            <div>
              <dt className="text-muted">Role</dt>
              <dd className="capitalize">{me.roles.map((r) => r.replace("_", " ")).join(", ")}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="font-semibold">Change password</h2>
          <p className="mt-1 text-sm text-muted">Your other devices will be logged out.</p>
          <div className="mt-4 space-y-4">
            {changed && <Alert kind="success">Password changed.</Alert>}
            <SetPasswordForm
              key={formKey}
              askCurrent
              email={me.email}
              submitLabel="Change password"
              onSubmit={async (password, current) => {
                setChanged(false);
                await api("/auth/password/change", { body: { current_password: current, new_password: password } });
                setChanged(true);
                setFormKey((k) => k + 1);
              }}
            />
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Where you&apos;re logged in</h2>
              <p className="mt-1 text-sm text-muted">If you see a device you don&apos;t recognise, log it out and change your password.</p>
            </div>
            <Button
              variant="danger"
              loading={leaving}
              onClick={async () => {
                setLeaving(true);
                try {
                  await fetch("/api/auth/logout?everywhere=1", { method: "POST" });
                } finally {
                  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload clears the previous user's data
                  window.location.assign("/login");
                }
              }}
            >
              Log out everywhere
            </Button>
          </div>
          <div className="mt-4">
            <Sessions />
          </div>
        </Card>
      </div>
    </>
  );
}
