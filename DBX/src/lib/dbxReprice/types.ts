/** Modelo de dados do módulo «DBX Reprice» — inspirado em fluxos comuns de repricing / OA (dados demo). */

export type RepriceSupplierId = "walmart" | "sams" | "other";

export type RepriceListingRow = {
  id: string;
  title: string;
  imageUrl?: string;
  sku: string;
  asin: string;
  supplier: RepriceSupplierId;
  supplierLabel: string;
  supplierProductUrl?: string;
  supplierPrice: number;
  supplierShipping: number;
  bundleQty: number;
  qty: number;
  amazonPrice: number;
  lowestPrice: number;
  buyBoxPrice: number;
  buyBoxEligible: "yes" | "no" | "na";
  minPrice: number;
  maxPrice: number;
  profit: number;
  strategyId: string | null;
  strategyLabel: string;
  orderCount: number;
};

export type RepriceOrderStatus =
  | "pending"
  | "shipped"
  | "canceled"
  | "ordered"
  | "fulfillment_error"
  | "out_of_stock"
  | "refunded"
  | "return_requested";

export type RepriceOrderRow = {
  id: string;
  purchaseAtIso: string;
  status: RepriceOrderStatus;
  title: string;
  imageUrl?: string;
  sku: string;
  asin: string;
  amazonOrderId: string;
  supplier: RepriceSupplierId;
  supplierLabel: string;
  amazonPrice: number;
  amazonFee: number;
  amazonShipping: number;
  qtySold: number;
  supplierPrice: number;
  supplierTax: number;
  supplierDiscount: number;
  supplierShipping: number;
  profit: number;
  profitMarginPct: number;
  note?: string;
};

export type RepriceCompetitionMode = "match" | "below";

export type RepriceStrategyTarget = "buy_box" | "lowest";

export type RepriceWhenAlone = "no_change" | "lowest";

export type RepriceStrategyRow = {
  id: string;
  name: string;
  competitionMode: RepriceCompetitionMode;
  strategyTarget: RepriceStrategyTarget;
  whenNoCompetition: RepriceWhenAlone;
  sellerRatingMin: number | null;
  amountValue: number;
  amountUnit: "pct" | "usd";
  minProfitPct: number;
  maxProfitPct: number;
  listingsAssigned: number | null;
};

export type RepriceTemplateRow = {
  id: string;
  name: string;
  profitPct: number;
  amazonFeePct: number;
  supplierShippingUsd: number;
  supplierTaxPct: number;
  supplierDiscountPct: number;
  bundleQty: number;
  handlingDays: number;
  defaultQty: number;
  restockQty: boolean;
  repriceOnAmazon: boolean;
  oosZeroQty: boolean;
};

export type RepriceDashboardDay = {
  day: string;
  revenue: number;
  sales: number;
  buyBoxPct: number;
  profitMarginPct: number;
  profit: number;
};

export type RepriceDashboardSummary = {
  revenueUsd: number;
  salesCount: number;
  buyBoxPct: number;
  profitUsd: number;
  activeListings: number;
  outOfStockListings: number;
  inBuyBox: number;
  competitionBelowMin: number;
  supplierMix: { supplier: RepriceSupplierId; label: string; count: number }[];
};
