import type { KeepaProduct } from "./keepa.js";
import { getMonthlySold, isAmazonBuyBoxSeller, sumNewOffers } from "./keepa.js";

export type LeadRules = {
  minMonthlySold: number;
  minNewOffersTotal: number;
  excludeAmazonBuyBox: boolean;
};

export function passesLeadRules(p: KeepaProduct, rules: LeadRules): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const ms = getMonthlySold(p);
  if (ms == null || ms < rules.minMonthlySold) {
    reasons.push(`monthlySold<${rules.minMonthlySold} (${ms ?? "n/d"})`);
  }
  const offers = sumNewOffers(p);
  if (offers < rules.minNewOffersTotal) {
    reasons.push(`newOffers<${rules.minNewOffersTotal} (${offers})`);
  }
  if (rules.excludeAmazonBuyBox && isAmazonBuyBoxSeller(p)) {
    reasons.push("buyBoxAmazon");
  }
  return { ok: reasons.length === 0, reasons };
}
