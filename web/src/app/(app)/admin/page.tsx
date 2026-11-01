"use client";

import { useMe } from "@/components/app-shell";
import { Card, PageTitle } from "@/components/ui";

export default function AdminHome() {
  const me = useMe();
  return (
    <>
      <PageTitle title={`Welcome, ${me.full_name.split(" ")[0]}`} subtitle="Annadata 360 admin panel" />
      <Card>
        <p className="text-sm text-muted">
          Signed in as <strong className="text-ink">{me.roles.map((r) => r.replace("_", " ")).join(", ")}</strong>. The
          dashboard, vendor review queue, listings, licences and staff users are being added next.
        </p>
      </Card>
    </>
  );
}
