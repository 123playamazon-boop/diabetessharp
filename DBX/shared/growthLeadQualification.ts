/** Canonical slugs for Growth Program lead qualification (server + client). */

export const GROWTH_BUSINESS_MODELS = ["online_arbitrage", "wholesale", "private_label", "dropshipping"] as const;
export type GrowthBusinessModelSlug = (typeof GROWTH_BUSINESS_MODELS)[number];

export const GROWTH_REVENUE_BANDS = ["under_5k", "5k_25k", "25k_100k", "100k_500k", "over_500k", "prefer_not"] as const;
export type GrowthRevenueBandSlug = (typeof GROWTH_REVENUE_BANDS)[number];

export const GROWTH_PRODUCT_COUNT_BANDS = ["1_10", "11_50", "51_200", "201_plus"] as const;
export type GrowthProductCountBandSlug = (typeof GROWTH_PRODUCT_COUNT_BANDS)[number];

export const GROWTH_PREP_CENTER_USAGE = ["yes_active", "yes_sometimes", "no_looking", "no_not_needed"] as const;
export type GrowthPrepCenterUsageSlug = (typeof GROWTH_PREP_CENTER_USAGE)[number];

export const GROWTH_INVESTMENT_READINESS = ["ready_now", "within_30_days", "exploring", "not_ready"] as const;
export type GrowthInvestmentReadinessSlug = (typeof GROWTH_INVESTMENT_READINESS)[number];

export function isOneOf<T extends readonly string[]>(val: string, allowed: T): val is T[number] {
  return (allowed as readonly string[]).includes(val);
}
