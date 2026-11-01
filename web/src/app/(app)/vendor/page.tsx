"use client";

import { useMe } from "@/components/app-shell";
import { Card, PageTitle } from "@/components/ui";

export default function VendorHome() {
  const me = useMe();
  return (
    <>
      <PageTitle title={`Welcome, ${me.full_name.split(" ")[0]}`} subtitle="Annadata 360 vendor portal" />
      <Card>
        <p className="text-sm text-muted">
          Your application form, listings, licences and team are being added next.
        </p>
      </Card>
    </>
  );
}
