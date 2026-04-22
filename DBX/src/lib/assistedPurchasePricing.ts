/** Mirrors server policy for client-side previews (server remains source of truth). */
export const ASSISTED_PURCHASE_PLATFORM_FEE_RATE = 0.1;
export const ASSISTED_PURCHASE_FLORIDA_TAX_RATE = 0.07;

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function previewAssistedPurchaseTotals(unitPriceUsd: number, quantity: number) {
  const q = Math.max(1, Math.floor(quantity));
  const sub = r2(unitPriceUsd * q);
  const platform = r2(sub * ASSISTED_PURCHASE_PLATFORM_FEE_RATE);
  const florida = r2(sub * ASSISTED_PURCHASE_FLORIDA_TAX_RATE);
  const total = r2(sub + platform + florida);
  return { quantity: q, subtotalUsd: sub, platformFeeUsd: platform, floridaTaxUsd: florida, totalUsd: total };
}

export function isScrapedUnitAboveRegisteredDto(ap: {
  estimatedUnitPriceUsd: number;
  registeredUnitPriceUsd?: number;
  linkScrapeUnitPriceUsd?: number;
}): boolean {
  const reg = typeof ap.registeredUnitPriceUsd === "number" ? ap.registeredUnitPriceUsd : ap.estimatedUnitPriceUsd;
  const s = ap.linkScrapeUnitPriceUsd;
  if (typeof s !== "number" || !Number.isFinite(s) || typeof reg !== "number" || !Number.isFinite(reg)) return false;
  return s > reg + 0.02;
}
