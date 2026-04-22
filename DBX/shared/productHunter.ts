import {
  buildDemoProductHunterSummary,
  getDemoProductHunterSeeds,
  normalizeProductHunterUiLocale,
  type ProductHunterUiLocale,
} from "./productHunterDemoLocales";

export type { ProductHunterUiLocale } from "./productHunterDemoLocales";
export { normalizeProductHunterUiLocale } from "./productHunterDemoLocales";

/** Marketplaces supported by Product Hunter AI (US-first). */
export const PRODUCT_HUNTER_MARKETPLACES = ["amazon_us", "walmart_us", "tiktok_shop_us", "shopify", "ebay_us"] as const;

export type ProductHunterMarketplaceId = (typeof PRODUCT_HUNTER_MARKETPLACES)[number];

export const PRODUCT_HUNTER_EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"] as const;

export type ProductHunterExperienceLevel = (typeof PRODUCT_HUNTER_EXPERIENCE_LEVELS)[number];

export type ProductHunterDemand = "high" | "medium" | "low";

export type ProductHunterCompetition = "high" | "medium" | "low";

/** One ranked product opportunity. */
export type ProductHunterIdea = {
  idea: string;
  demandLevel: ProductHunterDemand;
  competitionLevel: ProductHunterCompetition;
  estimatedProfitMargin: string;
  bestMarketplace: string;
  logisticsFeasibility: string;
  whyTrending: string;
  sellingStrategy: string;
  /** 0–100; higher = better opportunity blend for the seller profile. */
  opportunityScore: number;
};

export type ProductHunterResult = {
  products: ProductHunterIdea[];
  summary?: string;
};

export const PRODUCT_HUNTER_CANDIDATE_STATUSES = ["saved", "testing", "launched", "rejected"] as const;

export type ProductHunterCandidateStatus = (typeof PRODUCT_HUNTER_CANDIDATE_STATUSES)[number];

export const PRODUCT_HUNTER_CANDIDATE_SOURCES = ["hunter_run", "manual", "evidence_feed"] as const;

export type ProductHunterCandidateSource = (typeof PRODUCT_HUNTER_CANDIDATE_SOURCES)[number];

export const PRODUCT_HUNTER_BRIEF_SOURCES = ["reviews_real", "category_inference"] as const;

export type ProductHunterBriefSource = (typeof PRODUCT_HUNTER_BRIEF_SOURCES)[number];

export const PRODUCT_HUNTER_BRIEF_QUALITIES = ["full", "reduced"] as const;

export type ProductHunterBriefQuality = (typeof PRODUCT_HUNTER_BRIEF_QUALITIES)[number];

export const PRODUCT_HUNTER_PAIN_POINT_SEVERITIES = ["high", "medium", "low"] as const;

export type ProductHunterPainPointSeverity = (typeof PRODUCT_HUNTER_PAIN_POINT_SEVERITIES)[number];

export type ProductHunterBriefPainPoint = {
  point: string;
  mentionCount: number;
  severity: ProductHunterPainPointSeverity;
  quoteSample?: string;
};

export type ProductHunterBriefMarketingAngle = {
  angle: string;
  exploits: string;
};

export type ProductHunterBrief = {
  generatedAtIso: string;
  source: ProductHunterBriefSource;
  quality: ProductHunterBriefQuality;
  warnings: string[];
  competitorAsins: string[];
  reviewSampleSize: number;
  painPoints: ProductHunterBriefPainPoint[];
  productV2Improvements: string[];
  marketingAngles: ProductHunterBriefMarketingAngle[];
  differentiationSummary: string;
};

/** Opcional: alinha candidatos ao evidence feed / vizinhos BSR. */
export type ProductHunterCandidateContext = {
  seedAsin?: string;
  editionDate?: string;
  categoryLabel?: string;
};

export type ProductHunterCandidate = {
  id: string;
  suite: string;
  savedAtIso: string;
  updatedAtIso: string;
  source: ProductHunterCandidateSource;
  idea: ProductHunterIdea;
  status: ProductHunterCandidateStatus;
  notes?: string;
  hunterContext?: ProductHunterCandidateContext;
  brief?: ProductHunterBrief;
};

export function isProductHunterCandidateStatus(v: unknown): v is ProductHunterCandidateStatus {
  return typeof v === "string" && (PRODUCT_HUNTER_CANDIDATE_STATUSES as readonly string[]).includes(v);
}

export function isProductHunterCandidateSource(v: unknown): v is ProductHunterCandidateSource {
  return typeof v === "string" && (PRODUCT_HUNTER_CANDIDATE_SOURCES as readonly string[]).includes(v);
}

export function isProductHunterBriefSource(v: unknown): v is ProductHunterBriefSource {
  return typeof v === "string" && (PRODUCT_HUNTER_BRIEF_SOURCES as readonly string[]).includes(v);
}

export function isProductHunterBriefQuality(v: unknown): v is ProductHunterBriefQuality {
  return typeof v === "string" && (PRODUCT_HUNTER_BRIEF_QUALITIES as readonly string[]).includes(v);
}

export function isProductHunterPainPointSeverity(v: unknown): v is ProductHunterPainPointSeverity {
  return typeof v === "string" && (PRODUCT_HUNTER_PAIN_POINT_SEVERITIES as readonly string[]).includes(v);
}

export function normalizeProductHunterCandidateContext(raw: unknown): ProductHunterCandidateContext | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const seedAsin = typeof o.seedAsin === "string" ? o.seedAsin.trim().toUpperCase() : undefined;
  const editionDate = typeof o.editionDate === "string" ? o.editionDate.trim() : undefined;
  const categoryLabel = typeof o.categoryLabel === "string" ? o.categoryLabel.trim() : undefined;
  if (!seedAsin && !editionDate && !categoryLabel) return undefined;
  const out: ProductHunterCandidateContext = {};
  if (seedAsin) out.seedAsin = seedAsin;
  if (editionDate && /^\d{4}-\d{2}-\d{2}$/.test(editionDate)) out.editionDate = editionDate;
  if (categoryLabel) out.categoryLabel = categoryLabel.slice(0, 200);
  return Object.keys(out).length ? out : undefined;
}

export function normalizeProductHunterBrief(raw: unknown): ProductHunterBrief | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const generatedAtIso = typeof r.generatedAtIso === "string" ? r.generatedAtIso.trim() : "";
  const source = isProductHunterBriefSource(r.source) ? r.source : null;
  const quality = isProductHunterBriefQuality(r.quality) ? r.quality : null;
  if (!generatedAtIso || !source || !quality) return null;
  const warnings: string[] = [];
  if (Array.isArray(r.warnings)) {
    for (const w of r.warnings) {
      if (typeof w === "string" && w.trim()) warnings.push(w.trim().slice(0, 500));
    }
  }
  const competitorAsins: string[] = [];
  if (Array.isArray(r.competitorAsins)) {
    for (const a of r.competitorAsins) {
      if (typeof a === "string" && /^B[A-Z0-9]{9}$/i.test(a.trim())) competitorAsins.push(a.trim().toUpperCase());
    }
  }
  const reviewSampleSize =
    typeof r.reviewSampleSize === "number" && Number.isFinite(r.reviewSampleSize) ? Math.max(0, Math.floor(r.reviewSampleSize)) : 0;
  const painPoints: ProductHunterBriefPainPoint[] = [];
  if (Array.isArray(r.painPoints)) {
    for (const p of r.painPoints) {
      if (!p || typeof p !== "object") continue;
      const o = p as Record<string, unknown>;
      const point = typeof o.point === "string" ? o.point.trim() : "";
      const mc = typeof o.mentionCount === "number" && Number.isFinite(o.mentionCount) ? Math.max(0, Math.floor(o.mentionCount)) : 0;
      const sev = isProductHunterPainPointSeverity(o.severity) ? o.severity : null;
      const quoteSample = typeof o.quoteSample === "string" ? o.quoteSample.trim().slice(0, 500) : undefined;
      if (!point || !sev) continue;
      painPoints.push({ point: point.slice(0, 500), mentionCount: mc, severity: sev, quoteSample });
    }
  }
  const productV2Improvements: string[] = [];
  if (Array.isArray(r.productV2Improvements)) {
    for (const x of r.productV2Improvements) {
      if (typeof x === "string" && x.trim()) productV2Improvements.push(x.trim().slice(0, 800));
    }
  }
  const marketingAngles: ProductHunterBriefMarketingAngle[] = [];
  if (Array.isArray(r.marketingAngles)) {
    for (const m of r.marketingAngles) {
      if (!m || typeof m !== "object") continue;
      const o = m as Record<string, unknown>;
      const angle = typeof o.angle === "string" ? o.angle.trim() : "";
      const exploits = typeof o.exploits === "string" ? o.exploits.trim() : "";
      if (!angle || !exploits) continue;
      marketingAngles.push({ angle: angle.slice(0, 500), exploits: exploits.slice(0, 800) });
    }
  }
  const differentiationSummary =
    typeof r.differentiationSummary === "string" ? r.differentiationSummary.trim().slice(0, 1200) : "";
  if (!differentiationSummary) return null;
  return {
    generatedAtIso,
    source,
    quality,
    warnings,
    competitorAsins,
    reviewSampleSize,
    painPoints: painPoints.slice(0, 24),
    productV2Improvements: productV2Improvements.slice(0, 24),
    marketingAngles: marketingAngles.slice(0, 16),
    differentiationSummary,
  };
}

export function isProductHunterMarketplaceId(v: string): v is ProductHunterMarketplaceId {
  return (PRODUCT_HUNTER_MARKETPLACES as readonly string[]).includes(v);
}

export function isProductHunterExperienceLevel(v: string): v is ProductHunterExperienceLevel {
  return (PRODUCT_HUNTER_EXPERIENCE_LEVELS as readonly string[]).includes(v);
}

function labelMarketplace(id: ProductHunterMarketplaceId): string {
  switch (id) {
    case "amazon_us":
      return "Amazon USA";
    case "walmart_us":
      return "Walmart USA";
    case "tiktok_shop_us":
      return "TikTok Shop USA";
    case "shopify":
      return "Shopify (DTC)";
    case "ebay_us":
      return "eBay USA";
    default:
      return id;
  }
}

function expBias(experience: ProductHunterExperienceLevel): number {
  if (experience === "beginner") return -4;
  if (experience === "advanced") return 6;
  return 0;
}

/** Deterministic demo ideas when OpenAI is unavailable (textos por `locale` de UI). */
export function buildDemoProductHunter(
  budget: string,
  marketplace: ProductHunterMarketplaceId,
  experience: ProductHunterExperienceLevel,
  locale: ProductHunterUiLocale = "pt-BR",
): ProductHunterResult {
  const localeNorm = normalizeProductHunterUiLocale(locale);
  const bias = expBias(experience);
  const mp = labelMarketplace(marketplace);
  const bNote =
    budget.trim().slice(0, 80) ||
    (localeNorm === "pt-BR" ? "orçamento não indicado" : localeNorm === "es" ? "presupuesto no indicado" : "unspecified budget");

  const baseSeeds = getDemoProductHunterSeeds(localeNorm);
  const seeds: Omit<ProductHunterIdea, "opportunityScore">[] = baseSeeds.map((s, i) => {
    const o = { ...s };
    if (i === 0) {
      o.bestMarketplace = marketplace === "tiktok_shop_us" ? "TikTok Shop USA" : "Amazon USA";
    } else if (i === 1) {
      o.bestMarketplace = "Amazon USA + Shopify landing for LTV";
    } else if (i === 2) {
      o.bestMarketplace = marketplace === "walmart_us" ? "Walmart USA" : mp;
    } else if (i === 3) {
      o.bestMarketplace =
        marketplace === "ebay_us" ? "eBay USA (velocity + auction tests)" : marketplace === "tiktok_shop_us" ? "TikTok Shop USA" : "TikTok Shop USA";
    } else {
      o.bestMarketplace = marketplace === "shopify" ? "Shopify (DTC + subscriptions)" : "Amazon USA";
    }
    return o;
  });

  const products: ProductHunterIdea[] = seeds.map((s, i) => {
    const base = 58 + i * 7 + bias;
    const opportunityScore = Math.max(35, Math.min(96, base + (marketplace === "amazon_us" ? 3 : 0)));
    return { ...s, opportunityScore };
  });

  products.sort((a, b) => b.opportunityScore - a.opportunityScore);

  return {
    products,
    summary: buildDemoProductHunterSummary(localeNorm, bNote, mp, experience),
  };
}
