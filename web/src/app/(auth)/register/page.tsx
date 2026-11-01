"use client";

import clsx from "clsx";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useCallback, useState } from "react";

import { Turnstile, useTurnstileSiteKey } from "@/components/turnstile";
import { Alert, Button, Card, Field } from "@/components/ui";
import { ApiError, api } from "@/lib/api";

const KINDS = [
  { value: "business", title: "Business", text: "Shop, dealer or company with a GSTIN" },
  { value: "individual", title: "Individual", text: "Tractor owner, labour contractor… PAN only" },
] as const;

export default function RegisterPage() {
  const [form, setForm] = useState({ email: "", full_name: "", phone: "", trade_name: "", kind: "business" });
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [resetCaptcha, setResetCaptcha] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const onToken = useCallback((t: string | null) => setCaptcha(t), []);
  const siteKey = useTurnstileSiteKey();
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setErrors({});
    setLoading(true);
    try {
      await api("/vendors/register", { body: { ...form, captcha_token: captcha } });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setError(err.code === "validation_error" ? "Some details need fixing." : err.message);
      } else setError("Couldn't reach the server. Check your connection.");
      setResetCaptcha((n) => n + 1);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <Card className="text-center">
        <MailCheck className="mx-auto size-10 text-brand-600" aria-hidden />
        <h1 className="mt-3 text-xl font-semibold">Check your email</h1>
        <p className="mt-2 text-sm text-muted">
          We sent a link to <strong className="text-ink">{form.email}</strong>. Open it to confirm your email and set your
          password. Then log in and fill in your application.
        </p>
        <Link href="/login" className="mt-5 inline-block text-sm text-brand-700 hover:underline">
          Go to login
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold">Register as a vendor</h1>
      <p className="mt-1 text-sm text-muted">Sell seeds, fertilizer and farm products, or offer rental, services and labour to farmers in Andhra Pradesh and Telangana.</p>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        {error && <Alert kind="error">{error}</Alert>}
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">You are a</legend>
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map((k) => (
              <label
                key={k.value}
                className={clsx(
                  "cursor-pointer rounded-md border p-3 text-sm",
                  form.kind === k.value ? "border-brand-600 bg-brand-50" : "border-line hover:bg-canvas",
                )}
              >
                <input type="radio" name="kind" value={k.value} checked={form.kind === k.value} onChange={set("kind")} className="sr-only" />
                <span className="block font-medium">{k.title}</span>
                <span className="mt-0.5 block text-xs text-muted">{k.text}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Shop or business name" hint="Farmers will see this name" value={form.trade_name} onChange={set("trade_name")} error={errors.trade_name} />
        <Field label="Your full name" autoComplete="name" value={form.full_name} onChange={set("full_name")} error={errors.full_name} />
        <Field label="Mobile number" type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={form.phone} onChange={set("phone")} error={errors.phone} />
        <Field label="Email" type="email" autoComplete="email" hint="You'll log in with this email" value={form.email} onChange={set("email")} error={errors.email} />
        {siteKey && <Turnstile siteKey={siteKey} onToken={onToken} resetKey={resetCaptcha} />}
        <Button
          type="submit"
          loading={loading}
          disabled={!form.email || !form.full_name || !form.phone || !form.trade_name || siteKey === undefined || (!!siteKey && !captcha)}
          className="w-full"
        >
          Register
        </Button>
      </form>
      <p className="mt-5 text-sm text-muted">
        Already registered? <Link href="/login" className="text-brand-700 hover:underline">Log in</Link>
      </p>
    </Card>
  );
}
