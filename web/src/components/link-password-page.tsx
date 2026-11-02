"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";

import { SetPasswordForm } from "@/components/set-password-form";
import { Alert, Card, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

/**
 * Page opened from an emailed link (invite or password reset). Looks up which account the link is for first, so
 * the page can say so, a dead link is caught before anyone types a password, and the browser saves the new
 * password under the right email.
 */
export function LinkPasswordPage({
  purpose,
  title,
  intro,
  submitLabel,
  submitPath,
  againHref,
  againLabel,
}: {
  purpose: "invite" | "reset";
  title: string;
  intro: string;
  submitLabel: string;
  submitPath: string;
  againHref: string;
  againLabel: string;
}) {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const { data, error } = useSWR<{ email: string }>(
    token ? ["link", purpose, token] : null,
    () => api(`/auth/link?${new URLSearchParams({ token, purpose })}`),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  if (!token) {
    return (
      <Card>
        <Alert kind="error">This link is incomplete. Open it again from your email.</Alert>
      </Card>
    );
  }
  return (
    <Card>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-muted">{intro}</p>
      <div className="mt-6">
        {error && (
          <div className="space-y-4">
            <Alert kind="error">{error instanceof ApiError ? error.message : "Couldn't check this link."}</Alert>
            <Link href={againHref} className="text-sm text-brand-700 hover:underline">
              {againLabel}
            </Link>
          </div>
        )}
        {!data && !error && <Spinner label="Checking the link" />}
        {data && (
          <SetPasswordForm
            email={data.email}
            submitLabel={submitLabel}
            onSubmit={async (password) => {
              await api(submitPath, { body: { token, password } });
              router.push(`/login?reset=1&email=${encodeURIComponent(data.email)}`);
            }}
          />
        )}
      </div>
    </Card>
  );
}
