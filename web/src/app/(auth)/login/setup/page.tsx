"use client";

import { Check, Copy, Download } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { type FormEvent, Suspense, useEffect, useState } from "react";

import { Alert, Button, Card, Field, Spinner } from "@/components/ui";
import { ApiError, auth } from "@/lib/api";
import { safeNext } from "@/lib/next-path";

type Setup = { secret: string; otpauth_uri: string };

/** First login: set up the authenticator app, prove it works, save the backup codes. */
function SetupFlow() {
  const params = useSearchParams();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    auth<Setup>("/mfa/setup")
      .then(async (s) => {
        setSetup(s);
        setQr(await QRCode.toDataURL(s.otpauth_uri, { width: 200, margin: 1 }));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't start the setup."));
  }, []);

  async function activate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await auth<{ backup_codes: string[] }>("/mfa/activate", { code });
      setBackupCodes(res.backup_codes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }

  if (backupCodes) {
    const text = `Annadata 360 backup codes (each works once)\n\n${backupCodes.join("\n")}\n`;
    return (
      <Card>
        <h1 className="text-xl font-semibold">Save your backup codes</h1>
        <p className="mt-1 text-sm text-muted">
          If you lose your phone, each of these codes lets you log in once. Keep them somewhere safe, not on the same
          phone. They won&apos;t be shown again.
        </p>
        <ol className="mt-5 grid grid-cols-2 gap-2 rounded-md border border-line bg-canvas p-4 font-mono text-sm">
          {backupCodes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ol>
        <div className="mt-3 flex gap-2">
          <Button
            variant="secondary"
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(text);
              setCopied(true);
            }}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy"}
          </Button>
          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              const a = document.createElement("a");
              a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
              a.download = "annadata360-backup-codes.txt";
              a.click();
            }}
          >
            <Download className="size-4" /> Download
          </Button>
        </div>
        <label className="mt-5 flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-brand-600" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
          I have saved these codes somewhere safe.
        </label>
        <Button className="mt-4 w-full" disabled={!saved} onClick={() => window.location.assign(safeNext(params.get("next")))}>
          Continue
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold">Set up your authenticator app</h1>
      <p className="mt-1 text-sm text-muted">Every login needs a code from your phone. This keeps your account safe even if someone learns your password.</p>
      {error && !setup && (
        <div className="mt-5 space-y-3">
          <Alert kind="error">{error}</Alert>
          <Link href="/login" className="text-sm text-brand-700 hover:underline">
            Back to login
          </Link>
        </div>
      )}
      {!setup && !error && (
        <div className="mt-6">
          <Spinner label="Preparing" />
        </div>
      )}
      {setup && (
        <ol className="mt-6 space-y-6 text-sm">
          <li>
            <p className="font-medium">1. Install an authenticator app</p>
            <p className="mt-1 text-muted">Google Authenticator or Microsoft Authenticator, free from the Play Store or App Store.</p>
          </li>
          <li>
            <p className="font-medium">2. Scan this QR code with the app</p>
            {qr && (
              // eslint-disable-next-line @next/next/no-img-element -- a generated data URL, nothing to optimise
              <img src={qr} alt="QR code for the authenticator app" width={200} height={200} className="mt-3 rounded border border-line" />
            )}
            <details className="mt-2 text-muted">
              <summary className="cursor-pointer">Can&apos;t scan? Type this key instead</summary>
              <code className="mt-2 block break-all rounded bg-canvas p-2 font-mono text-ink">{setup.secret}</code>
            </details>
          </li>
          <li>
            <p className="font-medium">3. Enter the 6-digit code the app shows</p>
            <form onSubmit={activate} className="mt-3 space-y-3">
              {error && <Alert kind="error">{error}</Alert>}
              <Field
                label="Code" required
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="[&_input]:text-center [&_input]:font-mono [&_input]:text-lg [&_input]:tracking-widest"
              />
              <Button type="submit" loading={loading} disabled={code.length !== 6} className="w-full">
                Turn on and continue
              </Button>
            </form>
          </li>
        </ol>
      )}
    </Card>
  );
}

export default function SetupPage() {
  return (
    <Suspense>
      <SetupFlow />
    </Suspense>
  );
}
