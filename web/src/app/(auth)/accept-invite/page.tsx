"use client";

import { Suspense } from "react";

import { LinkPasswordPage } from "@/components/link-password-page";

/** From the invite / sign-up email: confirms the email address and sets the first password. */
export default function AcceptInvitePage() {
  return (
    <Suspense>
      <LinkPasswordPage
        purpose="invite"
        title="Set your password"
        intro="Your email is confirmed. Choose a password to finish setting up your account."
        submitLabel="Save password"
        submitPath="/auth/invite/accept"
        againHref="/login"
        againLabel="Already set it? Log in"
      />
    </Suspense>
  );
}
