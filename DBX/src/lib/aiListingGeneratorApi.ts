import { apiUrl } from "./apiUrl";
import { jsonUserHeaders } from "./authHeaders";
import type { ListingGeneratorOperation, ListingPlatformId } from "../../shared/listingGenerator";

export type GeneratedListing = {
  title: string;
  /** TikTok Shop USA: scroll-stopping opening line (separate from title). */
  hook?: string;
  /** Shopify DTC: line under the hero headline. */
  subheadline?: string;
  /** Shopify DTC: primary button-style action line. */
  callToAction?: string;
  bulletPoints: string[];
  description: string;
  keywords: string;
};

export type ListingGeneratorResponse =
  | { ok: true; mode: "live" | "demo"; listing: GeneratedListing; listingOperation?: ListingGeneratorOperation; warn?: string }
  | { ok: false; error: string };

export type ListingGeneratorPayload = {
  productName: string;
  productUrl: string;
  productDescription: string;
  platform: ListingPlatformId;
  targetAudience: string;
  mainBenefit: string;
  productDifferentiation: string;
  brandOwner: boolean;
  internationalProduct: boolean;
  operation?: ListingGeneratorOperation;
  existingListing?: string;
  /** Modo improve_pasted: listagem actual em campos separados. */
  listingTitle?: string;
  listingBullets?: string;
  listingDescription?: string;
};

export async function postListingGenerator(payload: ListingGeneratorPayload): Promise<ListingGeneratorResponse> {
  const res = await fetch(apiUrl("/api/client/listing-generator"), {
    method: "POST",
    headers: jsonUserHeaders(),
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = typeof data.error === "string" ? data.error : `HTTP ${res.status}`;
    return { ok: false, error: err };
  }
  const listing = data.listing as GeneratedListing | undefined;
  if (!listing || typeof listing.title !== "string" || !Array.isArray(listing.bulletPoints)) {
    return { ok: false, error: "Resposta inválida do servidor." };
  }
  const mode = data.mode === "live" ? "live" : "demo";
  const warn = typeof data.warn === "string" ? data.warn : undefined;
  const listingOperation =
    data.listingOperation === "improve_existing" ||
    data.listingOperation === "improve_pasted" ||
    data.listingOperation === "generate"
      ? data.listingOperation
      : undefined;
  return { ok: true, mode, listing, listingOperation, warn };
}
