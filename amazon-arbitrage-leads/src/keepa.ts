/**
 * Cliente mínimo para https://api.keepa.com/product
 * Documentação: https://keepa.com/#!api (Product Request)
 */

export type KeepaProduct = Record<string, unknown>;

export type KeepaProductResponse = {
  tokensLeft?: number;
  refillIn?: number;
  products?: KeepaProduct[];
};

const AMAZON_RETAIL_US = "ATVPDKIKX0DER";

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function str(v: unknown): string | null {
  if (typeof v === "string") return v;
  return null;
}

/** Soma ofertas «New» FBA + FBM elegíveis para buy box (índices 0 e 1). */
export function sumNewOffers(p: KeepaProduct): number {
  const arr = p.buyBoxEligibleOfferCounts;
  if (!Array.isArray(arr) || arr.length < 2) return 0;
  const fba = num(arr[0]) ?? 0;
  const fbm = num(arr[1]) ?? 0;
  return Math.max(0, fba) + Math.max(0, fbm);
}

export function getMonthlySold(p: KeepaProduct): number | null {
  const v = num(p.monthlySold);
  if (v == null || v <= 0) return null;
  return v;
}

/** Último vendedor conhecido do buy box (histórico Keepa). */
export function getLastBuyBoxSellerId(p: KeepaProduct): string | null {
  const h = p.buyBoxSellerIdHistory;
  if (!Array.isArray(h) || h.length === 0) return null;
  const last = h[h.length - 1];
  return str(last);
}

export function isAmazonBuyBoxSeller(p: KeepaProduct): boolean {
  const id = getLastBuyBoxSellerId(p);
  if (!id) return false;
  return id === AMAZON_RETAIL_US;
}

/** Preço «novo» mais baixo entre ofertas Keepa (centavos USD se domain=1). Requer offers=N na query. */
export function lowestNewOfferPriceCents(p: KeepaProduct): number | null {
  const offers = p.offers;
  if (!Array.isArray(offers)) return null;
  let min: number | null = null;
  for (const o of offers) {
    if (!o || typeof o !== "object") continue;
    const row = o as Record<string, unknown>;
    const cond = num(row.condition);
    const price = num(row.price);
    if (price == null || price <= 0) continue;
    if (cond != null && cond !== 1 && cond !== 0) continue;
    min = min == null ? price : Math.min(min, price);
  }
  return min;
}

export function centsToUsd(cents: number | null): string {
  if (cents == null || cents <= 0) return "";
  return (cents / 100).toFixed(2);
}

export async function fetchKeepaProducts(params: {
  key: string;
  domain: number;
  asins: string[];
  stats: number;
  offers: number;
}): Promise<KeepaProductResponse> {
  const asinParam = params.asins.map((a) => a.trim().toUpperCase()).filter(Boolean).join(",");
  if (!asinParam) return { products: [] };
  const u = new URL("https://api.keepa.com/product");
  u.searchParams.set("key", params.key);
  u.searchParams.set("domain", String(params.domain));
  u.searchParams.set("asin", asinParam);
  u.searchParams.set("stats", String(params.stats));
  if (params.offers > 0) u.searchParams.set("offers", String(params.offers));

  const res = await fetch(u.toString(), { headers: { Accept: "application/json" } });
  const text = await res.text();
  let j: unknown;
  try {
    j = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Keepa: resposta não-JSON (${res.status}).`);
  }
  if (!res.ok) {
    const err = typeof j === "object" && j && "error" in j ? String((j as { error: unknown }).error) : text;
    throw new Error(`Keepa API ${res.status}: ${err}`);
  }
  return j as KeepaProductResponse;
}

export function amazonProductUrl(asin: string): string {
  return `https://www.amazon.com/dp/${encodeURIComponent(asin)}`;
}

export { AMAZON_RETAIL_US };
