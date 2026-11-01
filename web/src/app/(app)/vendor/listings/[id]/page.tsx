"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import useSWR from "swr";

import { ListingForm, ListingPhotos } from "@/components/listing-form";
import { Alert, Badge, PageTitle, Spinner } from "@/components/ui";
import { fetcher } from "@/lib/api";
import type { CatalogOptions, Listing } from "@/lib/catalog";

function EditListing() {
  const { id } = useParams<{ id: string }>();
  const created = useSearchParams().get("created");
  const { data: options, error: optionsError } = useSWR<CatalogOptions>("/catalog/options", fetcher, { revalidateOnFocus: false });
  const { data: listing, error, mutate } = useSWR<Listing>(`/catalog/listings/${id}`, fetcher, { revalidateOnFocus: false });
  const failed = error ?? optionsError;

  return (
    <>
      <Link href="/vendor/listings" className="mb-4 inline-block text-sm text-muted hover:text-ink">← Listings</Link>
      {failed && <Alert kind="error">{failed.message ?? "Couldn't load this listing."}</Alert>}
      {(!listing || !options) && !failed && <Spinner />}
      {listing && options && (
        <>
          <PageTitle
            title={listing.name.en}
            subtitle={listing.category_name}
            actions={listing.visible_to_farmers ? <Badge tone="success">Visible to farmers</Badge> : <Badge tone="warning">Hidden</Badge>}
          />
          <div className="space-y-6">
            {created && <Alert kind="success">Listing created. Add some photos so farmers can see it.</Alert>}
            {listing.hidden_reason && <Alert kind={listing.removed ? "error" : "warning"}>{listing.hidden_reason}</Alert>}
            <ListingPhotos listing={listing} onChange={(l) => mutate(l, { revalidate: false })} />
            <ListingForm key={listing.id} options={options} listing={listing} />
          </div>
        </>
      )}
    </>
  );
}

export default function EditListingPage() {
  return (
    <Suspense>
      <EditListing />
    </Suspense>
  );
}
