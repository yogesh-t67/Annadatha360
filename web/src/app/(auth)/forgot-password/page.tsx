"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import { Alert, Button, Card, Field } from "@/components/ui";
import { ApiError, api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/auth/password/forgot", { body: { email } });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold">Forgot your password?</h1>
      {sent ? (
        <div className="mt-5 space-y-4">
          <Alert kind="success">
            If <strong>{email}</strong> has an account, we&apos;ve sent a link to reset the password. It works for 30
            minutes.
          </Alert>
          <Link href="/login" className="text-sm text-brand-700 hover:underline">
            Back to login
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">Enter your email and we&apos;ll send you a link to choose a new one.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            {error && <Alert kind="error">{error}</Alert>}
            <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit" loading={loading} disabled={!email} className="w-full">
              Send reset link
            </Button>
          </form>
          <p className="mt-5 text-sm">
            <Link href="/login" className="text-brand-700 hover:underline">Back to login</Link>
          </p>
        </>
      )}
    </Card>
  );
}
