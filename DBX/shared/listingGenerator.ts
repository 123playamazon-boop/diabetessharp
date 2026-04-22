export const LISTING_PLATFORM_IDS = [
  "amazon_us",
  "tiktok_shop_us",
  "walmart_us",
  "mercado_livre_intl",
  "shopify",
] as const;

export type ListingPlatformId = (typeof LISTING_PLATFORM_IDS)[number];

export function isListingPlatformId(v: string): v is ListingPlatformId {
  return (LISTING_PLATFORM_IDS as readonly string[]).includes(v);
}

/** POST /api/client/listing-generator: create from scratch, improve from URL, or improve from pasted listing. */
export const LISTING_GENERATOR_OPERATIONS = ["generate", "improve_existing", "improve_pasted"] as const;

export type ListingGeneratorOperation = (typeof LISTING_GENERATOR_OPERATIONS)[number];

export function isListingGeneratorOperation(v: string): v is ListingGeneratorOperation {
  return (LISTING_GENERATOR_OPERATIONS as readonly string[]).includes(v);
}
