"use client";

import { Suspense } from "react";

import { LinkPasswordPage } from "@/components/link-password-page";

/** From the "reset your password" email. */
export default function ResetPasswordPage() {
  return (
    <Suspense>
      <LinkPasswordPage
        purpose="reset"
        title="Choose a new password"
        intro="You'll be logged out on every device."
        submitLabel="Change password"
        submitPath="/auth/password/reset"
        againHref="/forgot-password"
        againLabel="Ask for a new link"
      />
    </Suspense>
  );
}
