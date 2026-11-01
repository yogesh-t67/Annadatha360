"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { SetPasswordForm } from "@/components/set-password-form";
import { Alert, Card } from "@/components/ui";
import { api } from "@/lib/api";

/** From the invite / sign-up email: confirms the email address and sets the first password. */
function AcceptInvite() {
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
      <h1 className="text-xl font-semibold">Set your password</h1>
      <p className="mt-1 text-sm text-muted">Your email is confirmed. Choose a password to finish setting up your account.</p>
      <div className="mt-6">
        <SetPasswordForm
          submitLabel="Save password"
          onSubmit={async (password) => {
            await api("/auth/invite/accept", { body: { token, password } });
            router.push("/login?reset=1");
          }}
        />
      </div>
      <p className="mt-5 text-sm text-muted">
        Already set it? <Link href="/login" className="text-brand-700 hover:underline">Log in</Link>
      </p>
    </Card>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense>
      <AcceptInvite />
    </Suspense>
  );
}
