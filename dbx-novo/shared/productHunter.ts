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

/** Deterministic demo ideas when OpenAI is unavailable. */
export function buildDemoProductHunter(
  budget: string,
  marketplace: ProductHunterMarketplaceId,
  experience: ProductHunterExperienceLevel,
): ProductHunterResult {
  const bias = expBias(experience);
  const mp = labelMarketplace(marketplace);
  const bNote = budget.trim().slice(0, 80) || "unspecified budget";

  const seeds: Omit<ProductHunterIdea, "opportunityScore">[] = [
    {
      idea: "Problem-solving kitchen gadget bundle (narrow SKU, clear use case)",
      demandLevel: "high",
      competitionLevel: "medium",
      estimatedProfitMargin: "22–35%",
      bestMarketplace: marketplace === "tiktok_shop_us" ? "TikTok Shop USA" : "Amazon USA",
      logisticsFeasibility:
        "Small parcel, sub-2 lb — FBA-friendly if inbound discipline is tight; avoid oversized during first PO.",
      whyTrending:
        "Search volume up on “time saved / counter clutter” queries; short-form demos convert impulse buyers when the hook is visual proof in 3 seconds.",
      sellingStrategy:
        "Lead with a single hero SKU + variation matrix after proof; use A+ comparison table vs generic alternatives; tighten COGS before scaling ads.",
    },
    {
      idea: "Pet accessory with replaceable consumable (subscription tail)",
      demandLevel: "high",
      competitionLevel: "high",
      estimatedProfitMargin: "15–24%",
      bestMarketplace: "Amazon USA + Shopify landing for LTV",
      logisticsFeasibility:
        "Moderate — packaging dims matter; bundle inserts for repurchase; watch hazmat flags if any liquid.",
      whyTrending:
        "Pet spend holds in soft consumer cycles; “refill” framing increases repeat purchase rate vs one-off novelty.",
      sellingStrategy:
        "Anchor price to cost-per-use; Subscribe & Save where eligible; collect emails on insert for DTC second purchase.",
    },
    {
      idea: "Industrial-adjacent home office SKU (B2B-lite demand on consumer channels)",
      demandLevel: "medium",
      competitionLevel: "low",
      estimatedProfitMargin: "28–40%",
      bestMarketplace: marketplace === "walmart_us" ? "Walmart USA" : mp,
      logisticsFeasibility:
        "Strong — dense SKU, palletizable; fewer returns if spec sheet is explicit; watch MAP policies if brand gated.",
      whyTrending:
        "Hybrid work stabilized baseline category demand; fewer trendy spikes but steadier sell-through for operators who like inventory predictability.",
      sellingStrategy:
        "Spec-forward listing, compatibility callouts, B2B keywords where allowed; avoid hype; win on trust and measurable outcomes.",
    },
    {
      idea: "Seasonal outdoor micro-category (6–10 week sprint window)",
      demandLevel: "medium",
      competitionLevel: "medium",
      estimatedProfitMargin: "18–30%",
      bestMarketplace: marketplace === "ebay_us" ? "eBay USA (velocity + auction tests)" : "TikTok Shop USA",
      logisticsFeasibility:
        "Timing risk — inbound must clear before demand peak; air vs ocean tradeoff; keep MOQ tight until sell-through proves.",
      whyTrending:
        "Short-window categories reward operators who can read search lift early; losers overbuy after the spike.",
      sellingStrategy:
        "Pre-launch content bank; kill losers fast with inventory caps; use bundles to lift AOV without doubling logistics SKUs.",
    },
    {
      idea: "Health-adjacent consumable with clear dosage ritual (compliance-forward copy)",
      demandLevel: "medium",
      competitionLevel: "high",
      estimatedProfitMargin: "12–22%",
      bestMarketplace: marketplace === "shopify" ? "Shopify (DTC + subscriptions)" : "Amazon USA",
      logisticsFeasibility:
        "Labeling and claims discipline required; avoid medical positioning; consider lot tracking if multi-batch.",
      whyTrending:
        "Wellness routines stay sticky; winners differentiate on transparency and third-party testing messaging where appropriate.",
      sellingStrategy:
        "Education-first landing; comparison to alternatives on spec not hype; tighten refund policy to protect margin on opened units.",
    },
  ];

  const products: ProductHunterIdea[] = seeds.map((s, i) => {
    const base = 58 + i * 7 + bias;
    const opportunityScore = Math.max(35, Math.min(96, base + (marketplace === "amazon_us" ? 3 : 0)));
    return { ...s, opportunityScore };
  });

  products.sort((a, b) => b.opportunityScore - a.opportunityScore);

  return {
    products,
    summary: `Demo mode: five structured opportunities tuned to budget "${bNote}", primary channel bias ${mp}, and ${experience} seller profile. With OPENAI_API_KEY, the server generates a bespoke ranked set from your inputs.`,
  };
}
