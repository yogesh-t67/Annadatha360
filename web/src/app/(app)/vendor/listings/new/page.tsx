"use client";

import Link from "next/link";
import useSWR from "swr";

import { ListingForm } from "@/components/listing-form";
import { Alert, PageTitle, Spinner } from "@/components/ui";
import { fetcher } from "@/lib/api";
import type { CatalogOptions } from "@/lib/catalog";

export default function NewListingPage() {
  const { data: options, error } = useSWR<CatalogOptions>("/catalog/options", fetcher, { revalidateOnFocus: false });
  return (
    <>
      <Link href="/vendor/listings" className="mb-4 inline-block text-sm text-muted hover:text-ink">← Listings</Link>
      <PageTitle title="Add listing" subtitle="Photos can be added after saving." />
      {error && <Alert kind="error">{error.message ?? "Couldn't load the form."}</Alert>}
      {!options && !error && <Spinner />}
      {options && <ListingForm options={options} />}
    </>
  );
}
