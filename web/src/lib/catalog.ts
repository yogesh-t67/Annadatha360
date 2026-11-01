"use client";

import type { Schemas } from "./api";

export type Listing = Schemas["ListingOut"];
export type AdminListing = Schemas["AdminListingOut"];

/** What this vendor may list (GET /erp/catalog/options). */
export type CatalogOptions = {
  categories: {
    code: string;
    name: string;
    kind: "product" | "rental" | "service" | "labour";
    units: string[];
    item_types: Record<string, string>;
    attributes: { key: string; label: string; required: boolean }[];
  }[];
  district_codes: string[];
  enquiry_above_paise: number;
  requires_approval: boolean;
};

export const UNIT_LABELS: Record<string, string> = {
  pack: "per pack",
  hour: "per hour",
  day: "per day",
  acre: "per acre",
  sample: "per sample",
  trip: "per trip",
  worker_day: "per worker per day",
};

export const KIND_LABELS: Record<string, string> = {
  product: "Product",
  rental: "Rental",
  service: "Service",
  labour: "Labour",
};

/** "₹990 – ₹2,400" for a listing's pack sizes or rates. */
export function priceRange(listing: Listing): string {
  const prices = listing.variants.map((v) => v.price_paise);
  if (!prices.length) return "";
  const fmt = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  const [lo, hi] = [Math.min(...prices), Math.max(...prices)];
  return lo === hi ? fmt(lo) : `${fmt(lo)} – ${fmt(hi)}`;
}
