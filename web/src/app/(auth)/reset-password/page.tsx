"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { SetPasswordForm } from "@/components/set-password-form";
import { Alert, Card } from "@/components/ui";
import { api } from "@/lib/api";

/** From the "reset your password" email. */
function ResetPassword() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";

  if (!token) {
    return (
      <Card>
        <Alert kind="error">This link is incomplete. Open it again from your email.</Alert>
      </Card>
    );
  }
  return (
    <Card>
      <h1 className="text-xl font-semibold">Choose a new password</h1>
      <p className="mt-1 text-sm text-muted">You&apos;ll be logged out on every device. Your authenticator app stays the same.</p>
      <div className="mt-6">
        <SetPasswordForm
          submitLabel="Change password"
          onSubmit={async (password) => {
            await api("/auth/password/reset", { body: { token, password } });
            router.push("/login?reset=1");
          }}
        />
      </div>
      <p className="mt-5 text-sm text-muted">
        <Link href="/forgot-password" className="text-brand-700 hover:underline">Ask for a new link</Link>
      </p>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPassword />
    </Suspense>
  );
}
