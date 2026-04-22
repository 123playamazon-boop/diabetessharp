/** Modes for the Growth Strategy AI SaaS module (DBX). */
export const GROWTH_STRATEGY_AI_MODES = ["growth_strategy", "sales_consultant"] as const;

export type GrowthStrategyAiMode = (typeof GROWTH_STRATEGY_AI_MODES)[number];

/** Single-shot strategic advisory (not conversational chat). */
export type GrowthStrategyAiResult = {
  /** What is actually broken or mis-prioritized beneath the surface question. */
  diagnosis: string;
  /** US market / channel mechanics explaining why outcomes look the way they do. */
  marketReality: string;
  /** Concrete execution steps, ordered. */
  actionSteps: string[];
  /** When relevant: how to scale without blowing margin or ops; empty string if N/A. */
  scalingStrategy: string;
  /** Dense operator voice — the main read (no markdown fences). */
  executiveMemo: string;
};

export function isGrowthStrategyAiMode(v: string): v is GrowthStrategyAiMode {
  return (GROWTH_STRATEGY_AI_MODES as readonly string[]).includes(v);
}

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

/** Structured demo when OpenAI is unavailable. Tone differs by mode. */
export function buildDemoGrowthStrategyAi(
  mode: GrowthStrategyAiMode,
  question: string,
  context?: string,
): GrowthStrategyAiResult {
  const q = clip(question, 200) || "your situation";
  const ctx = context?.trim() ? clip(context, 160) : "";

  if (mode === "sales_consultant") {
    return {
      diagnosis: `You are asking about «${q}», but the underlying issue is almost always capital velocity: either you are buying narrative instead of unit economics, or your bottleneck is execution cadence—not “more strategy.”${ctx ? ` Context you gave («${ctx}») maps to a margin-and-ops problem first, then growth.` : ""}`,
      marketReality:
        "US marketplaces reward operators who control inbound, listing quality, and replenishment discipline. Traffic is auction-priced; weak conversion or stockouts tax you twice. Wholesale and OA compress when fees, prep, and returns are modeled honestly—most “slow growth” is underpriced risk or overstated throughput.",
      actionSteps: [
        "Rebuild a 90-day P&L at SKU level: landed cost, fees, ads as % of revenue, return rate, and net per unit after prep.",
        "Pick one hero ASIN or category lane—kill or park everything that cannot clear a minimum net per unit after true costs.",
        "Fix listing and supply chain before scaling spend: main image + above-fold copy + inventory cover for lead time + 2 weeks buffer.",
        "If scaling: duplicate what already prints cash—same supplier reliability, same prep SOP, same listing template—before testing new categories.",
        "Schedule a weekly kill/adjust review: bids, coupons, dead inventory, and SKUs below target contribution after allocated overhead.",
      ],
      scalingStrategy:
        "Scaling is replication of a proven unit model, not more SKUs. Standardize sourcing checks, inbound dates, and listing QA; only then add capital. If you cannot state net margin and days-of-cover per SKU weekly, you are not scaling—you are gambling.",
      executiveMemo: `Read this as a memo from someone who has cleared eight figures in US e-commerce—not a chatbot.\n\nYour question centers on «${q}». Strip the story: what metric moved first—conversion, sessions, buy box, or inventory? Pick the leading indicator and fix it in that order. Generic “optimize listings” advice is useless without tying each change to contribution margin and inventory risk.\n\nWhat I need you to execute this week: one financial truth (real net per unit on your top 20% of revenue), one operational truth (prep + inbound reliability), one commercial truth (why you win or lose the click vs. the next listing). Until those three are written down, every “growth tactic” is noise. Move like you are undercapitalized even when you are not—because the market will humble you on fees and stockouts anyway.`,
    };
  }

  return {
    diagnosis: `The question «${q}» often masks a prioritization gap: teams confuse activity with leverage—more listings, more tools, more meetings—while the constraint is usually one of catalog focus, capital allocation, or operational throughput.${ctx ? ` With «${ctx}» in the picture, sequence matters: stabilize economics and fulfillment before pushing channel expansion.` : ""}`,
    marketReality:
      "In the US, Amazon and adjacent channels favor sellers with predictable inbound, compliant listings, and disciplined ad-to-margin ratios. Category dynamics shift with fee changes, inventory limits, and competitive density; growth plans that ignore working capital and return rates usually stall mid-quarter.",
    actionSteps: [
      "Document current state: top 15 SKUs by net profit (not gross sales), ad spend %, return %, and stockout events in the last 60 days.",
      "Define one primary objective for the next quarter (e.g. restore margin on core ASINs vs. launch one new line)—secondary goals become backlog.",
      "Align listing, pricing, and inventory policies to that objective; assign owners and weekly metrics.",
      "Run a lightweight risk review: compliance flags, hazmat, IP, and supplier concentration—address blockers before scaling media or catalog.",
      "Revisit channel mix quarterly; only add Walmart/TikTok/Shopify when Amazon unit economics and ops are stable.",
    ],
    scalingStrategy:
      "If fundamentals are sound, scale by tightening repeatability: templates for listing QA, supplier scorecards, and fixed reorder points. Add SKUs or spend only when contribution margin after allocated overhead stays above your hurdle rate for three consecutive weeks.",
    executiveMemo: `This is Growth Strategy AI — structured guidance, not a back-and-forth chat.\n\nFraming «${q}» for a US-focused seller: start from constraints (cash, lead times, listing quality, account health) before tactics. The market rewards clarity—buyers compare instantly; platforms penalize volatility. Your plan should read like an operator’s quarterly review: fewer initiatives, sharper metrics, explicit trade-offs.\n\nUse the diagnosis and action steps as your working agenda. Re-run this analysis when your top-line moves more than ~15% or when you change model (e.g. OA to PL)—static “strategy decks” expire fast in e-commerce.`,
  };
}
