"use client";

import { type FormEvent, useState } from "react";

import { isAllowed, PasswordMeter } from "@/components/password-meter";
import { Alert, Button, Field } from "@/components/ui";
import { ApiError } from "@/lib/api";

/** New password + confirm, with the strength meter. Used by invite, password reset and change password. */
export function SetPasswordForm({
  onSubmit,
  submitLabel,
  email,
  askCurrent = false,
}: {
  onSubmit: (password: string, current: string) => Promise<void>;
  submitLabel: string;
  email?: string;
  askCurrent?: boolean;
}) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const mismatch = confirm.length > 0 && confirm !== password;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onSubmit(password, current);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && <Alert kind="error">{error}</Alert>}
      {askCurrent && (
        <Field
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      )}
      <div className="space-y-2">
        <Field
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordMeter password={password} email={email} />
      </div>
      <Field
        label="Type it again"
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={mismatch ? "The two passwords don't match" : undefined}
      />
      <Button
        type="submit"
        loading={loading}
        disabled={!isAllowed(password, email) || confirm !== password || (askCurrent && !current)}
        className="w-full"
      >
        {submitLabel}
      </Button>
    </form>
  );
}
