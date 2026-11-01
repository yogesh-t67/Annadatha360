"use client";

import { useState } from "react";
import useSWRInfinite from "swr/infinite";

import { Alert, Button, Card, PageTitle, SelectField, Spinner } from "@/components/ui";
import { fetcher, type Schemas } from "@/lib/api";

type Entry = Schemas["AuditEntry"];

const PAGE = 100;
const AREAS = [
  { value: "erp.", label: "Everything in the ERP" },
  { value: "erp.login", label: "Logins" },
  { value: "erp.user", label: "Staff users" },
  { value: "erp.vendor", label: "Vendors (applications, decisions, team)" },
  { value: "erp.licence", label: "Licence renewals" },
  { value: "erp.catalog", label: "Listings" },
  { value: "erp.document", label: "Documents (uploads and views)" },
  { value: "erp.password", label: "Passwords" },
  { value: "", label: "Everything (including the farmer app admin)" },
];

/** Plain-language names for audit actions; anything unknown is shown as recorded. */
const ACTION_LABELS: Record<string, string> = {
  "erp.login": "Logged in",
  "erp.logout": "Logged out",
  "erp.logout_all": "Logged out everywhere",
  "erp.mfa.enable": "Set up authenticator",
  "erp.invite.accept": "Accepted invite",
  "erp.password.change": "Changed password",
  "erp.password.reset_request": "Asked for a password reset",
  "erp.password.reset": "Reset password",
  "erp.session.end": "Ended a session",
  "erp.user.invite": "Invited a staff user",
  "erp.user.create_super_admin": "Super Admin created (server command)",
  "erp.user.disable": "Disabled a user",
  "erp.user.enable": "Enabled a user",
  "erp.user.reset_mfa": "Reset a user's authenticator",
  "erp.user.resend_invite": "Sent an invite again",
  "erp.vendor.register": "Vendor signed up",
  "erp.vendor.submit": "Vendor submitted application",
  "erp.vendor.start_review": "Started review",
  "erp.vendor.approve": "Approved vendor",
  "erp.vendor.reject": "Asked vendor for changes",
  "erp.vendor.suspend": "Suspended vendor",
  "erp.vendor.reinstate": "Reinstated vendor",
  "erp.vendor.note": "Added internal note",
  "erp.document.upload": "Uploaded a document",
  "erp.document.view": "Opened a document",
  "erp.document.delete": "Deleted a document",
  "erp.catalog.remove": "Took down a listing",
  "erp.catalog.restore": "Restored a listing",
  "erp.licence.approve": "Approved licence renewal",
  "erp.licence.reject": "Rejected licence renewal",
};

export default function AuditPage() {
  const [area, setArea] = useState("erp.");
  const { data, error, size, setSize, isValidating } = useSWRInfinite<Entry[]>(
    (index, previous: Entry[] | null) => {
      if (previous && previous.length < PAGE) return null; // reached the oldest entry
      const params = new URLSearchParams({ limit: String(PAGE) });
      if (area) params.set("action", area);
      if (previous?.length) params.set("before_id", String(previous[previous.length - 1].id));
      return `/audit?${params}`;
    },
    fetcher,
    { revalidateFirstPage: false },
  );
  const entries = data?.flat() ?? [];
  const more = data && data[data.length - 1]?.length === PAGE;

  return (
    <>
      <PageTitle title="Audit log" subtitle="Who did what, and when. Entries can't be changed or deleted." />
      <div className="mb-4 max-w-sm">
        <SelectField label="Show" className="[&_label]:sr-only" value={area} onChange={(e) => setArea(e.target.value)} options={AREAS} />
      </div>
      {error && <Alert kind="error">{error.message ?? "Couldn't load the audit log."}</Alert>}
      {!data && !error && <Spinner />}
      {data && entries.length === 0 && (
        <Card>
          <p className="text-sm text-muted">No entries.</p>
        </Card>
      )}
      {entries.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">When</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Who</th>
                <th scope="col" className="px-4 py-2.5 font-medium">What</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Details</th>
                <th scope="col" className="px-4 py-2.5 font-medium">From</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {entries.map((e) => (
                <tr key={e.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                    {new Date(e.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", second: "2-digit" })}
                  </td>
                  <td className="px-4 py-2.5">{e.actor_email ?? (e.staff_farmer_id ? `App staff #${e.staff_farmer_id}` : <span className="text-muted">System</span>)}</td>
                  <td className="px-4 py-2.5">
                    {ACTION_LABELS[e.action] ?? e.action}
                    <span className="block text-xs text-muted">
                      {e.target_type.replaceAll("_", " ")}
                      {e.target_id != null && ` #${e.target_id}`}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted">
                    {Object.entries(e.detail)
                      .map(([k, v]) => `${k.replaceAll("_", " ")}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
                      .join(" · ")}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-muted">{e.ip ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {more && (
        <div className="mt-4">
          <Button variant="secondary" loading={isValidating} onClick={() => setSize(size + 1)}>
            Load older entries
          </Button>
        </div>
      )}
    </>
  );
}
