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

export type ProductHunterCandidate = {
  id: string;
  suite: string;
  savedAtIso: string;
  updatedAtIso: string;
  source: "hunter_run" | "manual";
  idea: ProductHunterIdea;
  status: ProductHunterCandidateStatus;
  notes?: string;
};

export function isProductHunterCandidateStatus(v: unknown): v is ProductHunterCandidateStatus {
  return typeof v === "string" && (PRODUCT_HUNTER_CANDIDATE_STATUSES as readonly string[]).includes(v);
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
