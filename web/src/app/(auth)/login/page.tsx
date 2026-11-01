"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useState } from "react";

import { Alert, Button, Card, Field } from "@/components/ui";
import { ApiError, auth } from "@/lib/api";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { stage } = await auth<{ stage: "mfa" | "mfa_setup" }>("/login", { email, password });
      const q = next ? `?next=${encodeURIComponent(next)}` : "";
      router.push(stage === "mfa" ? `/login/code${q}` : `/login/setup${q}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach the server. Check your connection.");
      setLoading(false);
    }
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold">Log in</h1>
      <p className="mt-1 text-sm text-muted">Vendors and Annadata staff.</p>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        {params.get("expired") && !error && <Alert kind="info">Your session ended. Please log in again.</Alert>}
        {params.get("reset") && !error && <Alert kind="success">Password changed. Log in with the new one.</Alert>}
        {error && <Alert kind="error">{error}</Alert>}
        <Field
          label="Email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" loading={loading} disabled={!email || !password} className="w-full">
          Continue
        </Button>
      </form>
      <div className="mt-5 flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-brand-700 hover:underline">
          Forgot password?
        </Link>
        <Link href="/register" className="text-brand-700 hover:underline">
          New vendor? Register
        </Link>
      </div>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
