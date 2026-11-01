"use client";

import { api, type Schemas } from "./api";

export type Vendor = Schemas["VendorOut"];
export type DocumentRef = Schemas["DocumentRef"];
export type Licence = Schemas["LicenceOut"];

/** What the registration and application forms can choose from (GET /erp/vendor-options). */
export type VendorOptions = {
  capabilities: { code: string; name: string; group: string; licences: string[] }[];
  licence_types: Record<string, string>;
  contract_labour_threshold: number;
  business_types: string[];
  districts: { code: string; name: string; state: "AP" | "TG" }[];
};

export const STATE_NAMES = { AP: "Andhra Pradesh", TG: "Telangana" } as const;

export const BUSINESS_TYPE_LABELS: Record<string, string> = {
  proprietorship: "Proprietorship",
  partnership: "Partnership",
  llp: "LLP",
  private_limited: "Private limited company",
  public_limited: "Public limited company",
  cooperative: "Cooperative society",
  other: "Other",
};

export const GROUP_LABELS: Record<string, string> = {
  products: "Products to sell",
  rental: "Equipment rental",
  services: "Farm services",
  labour: "Labour",
};

export const STATUS_LABELS: Record<string, { label: string; tone: "neutral" | "success" | "warning" | "danger" | "brand" }> = {
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "Submitted", tone: "brand" },
  under_review: { label: "Under review", tone: "brand" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Needs changes", tone: "warning" },
  suspended: { label: "Suspended", tone: "danger" },
};

/** Opens a private document in a new tab through a short-lived link. */
export async function viewDocument(documentId: string) {
  const tab = window.open("", "_blank"); // opened right away, so pop-up blockers allow it
  try {
    const { url } = await api<{ url: string }>(`/documents/${documentId}/view-link`, { method: "POST" });
    const path = url.replace(/^\/api\/v1\/erp\//, "/api/erp/");
    if (tab) tab.location.href = path;
    else window.location.assign(path);
  } catch (err) {
    tab?.close();
    throw err;
  }
}

export async function uploadDocument(kind: string, file: File): Promise<DocumentRef> {
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", file);
  const doc = await api<Schemas["DocumentOut"]>("/documents", { form });
  return { id: doc.id, kind: doc.kind, filename: doc.filename };
}

/** Which application step each checklist item belongs to. */
export function stepOf(code: string): string {
  if (code === "capabilities" || code === "labour_team_size") return "offerings";
  if (code === "service_areas") return "areas";
  if (code === "bank_account" || code === "cancelled_cheque") return "bank";
  if (code.startsWith("licence")) return "licences";
  return "business";
}
