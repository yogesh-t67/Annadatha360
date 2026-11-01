"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useState } from "react";

import { Alert, Button, Card, Field } from "@/components/ui";
import { ApiError, auth } from "@/lib/api";
import { safeNext } from "@/lib/next-path";

function CodeForm() {
  const params = useSearchParams();
  const [code, setCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await auth("/mfa/verify", { code });
      // Full page load, so the area's layout starts fresh with the new login.
      window.location.assign(safeNext(params.get("next")));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach the server. Check your connection.");
      if (err instanceof ApiError && err.code === "login_expired") setError("Login timed out. Start again.");
      setLoading(false);
    }
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold">{useBackup ? "Enter a backup code" : "Enter your 6-digit code"}</h1>
      <p className="mt-1 text-sm text-muted">
        {useBackup
          ? "Use one of the 10 backup codes you saved. Each works once."
          : "Open your authenticator app (Google Authenticator, Microsoft Authenticator…) and type the code for Annadata 360."}
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {error && <Alert kind="error">{error}</Alert>}
        <Field
          label={useBackup ? "Backup code" : "Code"}
          inputMode={useBackup ? "text" : "numeric"}
          autoComplete="one-time-code"
          autoFocus
          maxLength={useBackup ? 11 : 6}
          placeholder={useBackup ? "a1b2c-3d4e5" : "123456"}
          value={code}
          onChange={(e) => setCode(useBackup ? e.target.value : e.target.value.replace(/\D/g, ""))}
          className="[&_input]:text-center [&_input]:font-mono [&_input]:text-lg [&_input]:tracking-widest"
        />
        <Button type="submit" loading={loading} disabled={useBackup ? code.length < 10 : code.length !== 6} className="w-full">
          Log in
        </Button>
      </form>
      <div className="mt-5 flex items-center justify-between text-sm">
        <button
          type="button"
          className="text-brand-700 hover:underline"
          onClick={() => {
            setUseBackup(!useBackup);
            setCode("");
            setError("");
          }}
        >
          {useBackup ? "Use the authenticator app" : "Lost your phone? Use a backup code"}
        </button>
        <Link href="/login" className="text-muted hover:underline">
          Start again
        </Link>
      </div>
    </Card>
  );
}

export default function CodePage() {
  return (
    <Suspense>
      <CodeForm />
    </Suspense>
  );
}
