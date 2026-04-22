/**
 * Evidence-based Product Hunter: filter/score real Amazon lead rows, optional LLM narratives.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ProductHunterCompetition, ProductHunterDemand, ProductHunterExperienceLevel, ProductHunterIdea } from "../shared/productHunter";
import type { AmazonLeadTableRow } from "./keepaAmazonLeads";
import { enrichLeadRowCalculations } from "./keepaAmazonLeads";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_CACHE_FILE = path.join(__dirname, "data", "product-hunter-evidence-cache.json");

function resolveCacheFile(): string {
  const o = process.env.PRODUCT_HUNTER_EVIDENCE_CACHE_FILE?.trim();
  if (o) return path.isAbsolute(o) ? o : path.resolve(process.cwd(), o);
  return DEFAULT_CACHE_FILE;
}

const CACHE_FILE = resolveCacheFile();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const STOP_TITLE_WORDS = new Set(
  [
    "premium",
    "best",
    "new",
    "official",
    "authentic",
    "genuine",
    "deluxe",
    "ultra",
    "super",
    "professional",
    "quality",
    "original",
    "amazing",
    "pack",
    "set",
    "pcs",
    "pc",
    "count",
  ].map((s) => s.toLowerCase()),
);

export type EvidenceWinnerFilters = {
  priceMinUsd: number;
  priceMaxUsd: number;
  minMonthlySold: number;
  maxNewOffersTotal: number;
  minNewOffersTotal: number;
  minRoiPct: number;
  /** Lower BSR = stronger sales rank in category. */
  bsrMin: number;
  /** Upper BSR bound (category-blind band — see NOTE at defaults). */
  bsrMax: number;
};

export const DEFAULT_EVIDENCE_WINNER_FILTERS: EvidenceWinnerFilters = {
  priceMinUsd: 15,
  priceMaxUsd: 80,
  minMonthlySold: 150,
  maxNewOffersTotal: 25,
  minNewOffersTotal: 2,
  minRoiPct: 25,
  /**
   * NOTE: BSR range is category-blind. v2 should normalize by category
   *       (e.g. top 5% of BSR per rootCategory). For MVP, a single band
   *       works well enough for generalist discovery.
   */
  bsrMin: 800,
  bsrMax: 120_000,
};

export type EvidenceFeedMeta = {
  editionDate: string | null;
  rowCount: number;
  asins: string[];
};

export type EvidenceFeedResult = {
  products: ProductHunterIdea[];
  summary?: string;
  meta: EvidenceFeedMeta;
  deterministicByAsin: Map<string, number>;
  /** True when OpenAI returned aligned narrative items for the batch. */
  llmNarrativeOk: boolean;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function normLinear(x: number, lo: number, hi: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return 0;
  return clamp((x - lo) / (hi - lo), 0, 1);
}

export function parseUsdFromCell(raw: string | undefined): number | null {
  if (raw == null || !String(raw).trim()) return null;
  const n = Number.parseFloat(String(raw).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseBsrFromCell(raw: string | undefined): number | null {
  if (raw == null || !String(raw).trim()) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function pickBsr(row: AmazonLeadTableRow): number | null {
  const a90 = parseBsrFromCell(row.bsrAvg90);
  const cur = parseBsrFromCell(row.bsrCurrent);
  return a90 ?? cur ?? null;
}

/** Human-readable tail for concept line (Keepa often stores numeric root category). */
function formatCategoryTail(categoryLabel: string): string {
  const t = categoryLabel.trim();
  if (!t) return "Amazon US";
  if (/^\d+$/.test(t)) return `Category ${t}`;
  return t.slice(0, 80);
}

/** Drops trailing title words duplicated in the category phrase (e.g. "Kitchen" in "Home & Kitchen"). */
function trimTokensOverlappingCategory(tokens: string[], categoryLabel: string): string[] {
  const catParts = categoryLabel
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);
  const catSet = new Set(catParts);
  const out = [...tokens];
  while (out.length > 0) {
    const last = out[out.length - 1].toLowerCase().replace(/[^a-z0-9]/g, "");
    if (last && catSet.has(last)) out.pop();
    else break;
  }
  return out;
}

/**
 * Derives a short concept/angle from listing title + category (not raw branded title).
 */
export function extractConceptFromListing(title: string, categoryLabel: string): string {
  const raw = title.replace(/[®™]/g, " ").replace(/\s+/g, " ").trim();
  if (!raw) return "Product opportunity — Amazon US";
  const noBy = raw.replace(/\bby\s+[A-Za-z0-9][A-Za-z0-9\s'-]{0,40}\b/gi, " ");
  const tokens = noBy.split(/[\s|,/]+/).map((w) => w.replace(/^[^\w]+|[^\w]+$/g, "")).filter(Boolean);
  const kept: string[] = [];
  for (const tok of tokens) {
    const letters = tok.replace(/[^A-Za-z]/g, "");
    if (letters.length >= 2 && letters === letters.toUpperCase() && /^[A-Z0-9]+$/.test(letters)) continue;
    const low = tok.toLowerCase();
    if (STOP_TITLE_WORDS.has(low)) continue;
    kept.push(tok);
    if (kept.length >= 8) break;
  }
  const trimmed = trimTokensOverlappingCategory(kept, categoryLabel);
  const core = trimmed.join(" ").replace(/\s+/g, " ").trim();
  const cat = formatCategoryTail(categoryLabel);
  const line = core ? `${core} — ${cat}` : `${raw.slice(0, 120).trim()} — ${cat}`;
  return line.length > 500 ? line.slice(0, 500) : line;
}

export function demandLevelFromEms(ems: number | null): ProductHunterDemand {
  if (ems == null || !Number.isFinite(ems)) return "low";
  if (ems >= 400) return "high";
  if (ems >= 150) return "medium";
  return "low";
}

export function competitionLevelFromOffers(n: number): ProductHunterCompetition {
  if (!Number.isFinite(n)) return "medium";
  if (n <= 8) return "low";
  if (n <= 16) return "medium";
  return "high";
}

export function marginLabelFromRow(row: AmazonLeadTableRow): string {
  const r = enrichLeadRowCalculations({ ...row });
  if (r.roiPct != null && Number.isFinite(r.roiPct)) {
    return `${Math.round(r.roiPct)}% est. ROI (Amazon − loja; sem taxas FBA)`;
  }
  return "Margin n/d (preencha preço loja para ROI)";
}

/** Deterministic 0–100 before LLM blend. */
export function scoreEvidenceRow(row: AmazonLeadTableRow, f: EvidenceWinnerFilters): number {
  const r = enrichLeadRowCalculations({ ...row });
  const ems = r.emsMonthly ?? 0;
  const bsr = pickBsr(r) ?? f.bsrMax;
  const offers = r.newOffersTotal;
  const roi = r.roiPct != null && Number.isFinite(r.roiPct) ? r.roiPct : f.minRoiPct;

  const demand = 0.5 * normLinear(Math.log1p(ems), Math.log1p(50), Math.log1p(4000)) + 0.5 * normLinear(1 / Math.log1p(bsr), 1 / Math.log1p(f.bsrMax), 1 / Math.log1p(f.bsrMin));

  const comp = 1 - normLinear(offers, f.minNewOffersTotal, f.maxNewOffersTotal);

  const margin = normLinear(roi, f.minRoiPct, 120);

  const s = 100 * (0.4 * demand + 0.3 * comp + 0.3 * margin);
  return clamp(Math.round(s), 0, 100);
}

export function passesWinnerFilters(row: AmazonLeadTableRow, f: EvidenceWinnerFilters): boolean {
  const r = enrichLeadRowCalculations({ ...row });
  const price = parseUsdFromCell(r.usdAmazon);
  if (price == null || price < f.priceMinUsd || price > f.priceMaxUsd) return false;
  const ems = r.emsMonthly;
  if (ems == null || !Number.isFinite(ems) || ems < f.minMonthlySold) return false;
  const offers = r.newOffersTotal;
  if (!Number.isFinite(offers) || offers < f.minNewOffersTotal || offers > f.maxNewOffersTotal) return false;
  const bsr = pickBsr(r);
  if (bsr == null || bsr < f.bsrMin || bsr > f.bsrMax) return false;
  if (r.roiPct == null || !Number.isFinite(r.roiPct) || r.roiPct < f.minRoiPct) return false;
  return true;
}

export function mergeEvidenceFilters(partial: Partial<EvidenceWinnerFilters> | undefined): EvidenceWinnerFilters {
  const b = { ...DEFAULT_EVIDENCE_WINNER_FILTERS };
  if (!partial || typeof partial !== "object") return b;
  const n = (x: unknown, d: number): number =>
    typeof x === "number" && Number.isFinite(x) ? x : d;
  let priceMinUsd = n(partial.priceMinUsd, b.priceMinUsd);
  let priceMaxUsd = n(partial.priceMaxUsd, b.priceMaxUsd);
  if (priceMaxUsd < priceMinUsd) {
    const t = priceMinUsd;
    priceMinUsd = priceMaxUsd;
    priceMaxUsd = t;
  }
  let bsrMin = Math.max(1, Math.floor(n(partial.bsrMin, b.bsrMin)));
  let bsrMax = Math.max(1, Math.floor(n(partial.bsrMax, b.bsrMax)));
  if (bsrMax < bsrMin) {
    const t = bsrMin;
    bsrMin = bsrMax;
    bsrMax = t;
  }
  return {
    priceMinUsd,
    priceMaxUsd,
    minMonthlySold: Math.max(0, Math.floor(n(partial.minMonthlySold, b.minMonthlySold))),
    maxNewOffersTotal: Math.max(1, Math.floor(n(partial.maxNewOffersTotal, b.maxNewOffersTotal))),
    minNewOffersTotal: Math.max(1, Math.floor(n(partial.minNewOffersTotal, b.minNewOffersTotal))),
    minRoiPct: n(partial.minRoiPct, b.minRoiPct),
    bsrMin,
    bsrMax,
  };
}

export type EvidenceRowScored = { row: AmazonLeadTableRow; deterministicScore: number };

export function filterAndScoreRows(rows: AmazonLeadTableRow[], f: EvidenceWinnerFilters): EvidenceRowScored[] {
  const out: EvidenceRowScored[] = [];
  for (const row of rows) {
    const r = enrichLeadRowCalculations({ ...row });
    if (!passesWinnerFilters(r, f)) continue;
    out.push({ row: r, deterministicScore: scoreEvidenceRow(r, f) });
  }
  out.sort((a, b) => b.deterministicScore - a.deterministicScore);
  return out;
}

export function buildDeterministicIdea(row: AmazonLeadTableRow, detScore: number): ProductHunterIdea {
  const r = enrichLeadRowCalculations({ ...row });
  const idea = extractConceptFromListing(r.title, r.categoryLabel);
  return {
    idea,
    demandLevel: demandLevelFromEms(r.emsMonthly),
    competitionLevel: competitionLevelFromOffers(r.newOffersTotal),
    estimatedProfitMargin: marginLabelFromRow(r).slice(0, 80),
    bestMarketplace: "Amazon USA",
    logisticsFeasibility: "Awaiting narrative pass: typical FBA parcel assumptions only — verify weight/dims on the listing before inbound.",
    whyTrending: "Awaiting narrative pass: metrics-only read will be filled from EMS/BSR/offer data.",
    sellingStrategy: "Awaiting narrative pass: strategy will be aligned to seller experience and budget text.",
    opportunityScore: detScore,
  };
}

type LlmNarrativeItem = {
  asin: string;
  logisticsFeasibility: string;
  whyTrending: string;
  sellingStrategy: string;
  opportunityScore: number;
};

const EVIDENCE_LLM_SYSTEM = `You are a US Amazon FBA analyst for Direct Box USA.

You receive JSON with budget (free text), experienceLevel (beginner|intermediate|advanced), and an array "items" of at most 10 products. Each item has: asin, title, categoryLabel, usdAmazon, emsMonthly, newOffersTotal, fbaOfferCount, bsrAvg90, bsrCurrent, roiPct.

Output ONLY valid JSON:
{ "items": [ { "asin": "string (must match input)", "logisticsFeasibility": "2-4 sentences English", "whyTrending": "2-4 sentences English grounded ONLY in the numeric signals provided (EMS, BSR, offers, price)", "sellingStrategy": "3-5 sentences English tailored to experienceLevel", "opportunityScore": integer 0-100 reflecting niche fit to the seller profile } ] }

Rules:
- Same length and order as input items; one object per ASIN.
- Do not invent sales numbers; refer to "signals suggest" / "metrics indicate" when needed.
- No markdown fences.`;

function parseLlmNarrativesJson(raw: string, expectedAsins: string[]): Map<string, LlmNarrativeItem> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const root = parsed as Record<string, unknown>;
  const arr = root.items;
  if (!Array.isArray(arr)) return null;
  const byAsin = new Map<string, LlmNarrativeItem>();
  for (let i = 0; i < arr.length; i++) {
    const it = arr[i];
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const asin = typeof o.asin === "string" ? o.asin.trim().toUpperCase() : expectedAsins[i] ?? "";
    const logisticsFeasibility = typeof o.logisticsFeasibility === "string" ? o.logisticsFeasibility.trim() : "";
    const whyTrending = typeof o.whyTrending === "string" ? o.whyTrending.trim() : "";
    const sellingStrategy = typeof o.sellingStrategy === "string" ? o.sellingStrategy.trim() : "";
    const sc = typeof o.opportunityScore === "number" ? o.opportunityScore : Number(o.opportunityScore);
    const opportunityScore = Number.isFinite(sc) ? clamp(Math.round(sc), 0, 100) : 50;
    if (!asin || !logisticsFeasibility || !whyTrending || !sellingStrategy) continue;
    byAsin.set(asin, {
      asin,
      logisticsFeasibility: logisticsFeasibility.slice(0, 1200),
      whyTrending: whyTrending.slice(0, 1200),
      sellingStrategy: sellingStrategy.slice(0, 1200),
      opportunityScore,
    });
  }
  for (const a of expectedAsins) {
    if (!byAsin.has(a)) return null;
  }
  return byAsin;
}

export async function callOpenAiEvidenceNarratives(params: {
  budget: string;
  experience: ProductHunterExperienceLevel;
  top: EvidenceRowScored[];
}): Promise<Map<string, LlmNarrativeItem> | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const items = params.top.map(({ row: r, deterministicScore: _d }) => ({
    asin: r.asin,
    title: r.title.slice(0, 300),
    categoryLabel: r.categoryLabel,
    usdAmazon: r.usdAmazon,
    emsMonthly: r.emsMonthly,
    newOffersTotal: r.newOffersTotal,
    fbaOfferCount: r.fbaOfferCount ?? null,
    bsrAvg90: r.bsrAvg90,
    bsrCurrent: r.bsrCurrent,
    roiPct: r.roiPct ?? null,
  }));
  const userPayload = {
    budget: params.budget.slice(0, 200),
    experienceLevel: params.experience,
    items,
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: EVIDENCE_LLM_SYSTEM },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) return null;
  const asins = params.top.map((t) => t.row.asin.toUpperCase());
  return parseLlmNarrativesJson(raw, asins);
}

/** Exported for tests; production uses `runEvidenceFeedPipeline`. */
export async function buildEvidenceProductIdeasForTests(
  rows: AmazonLeadTableRow[],
  f: EvidenceWinnerFilters,
  budget: string,
  experience: ProductHunterExperienceLevel,
  options?: { disableLlm?: boolean },
): Promise<EvidenceFeedResult> {
  const tryLlm = !options?.disableLlm;
  return buildEvidenceProductIdeasInner(rows, f, budget, experience, tryLlm);
}

export function mergeIdeasWithNarratives(
  base: ProductHunterIdea[],
  detScores: number[],
  narrativeByAsin: Map<string, LlmNarrativeItem> | null,
  asins: string[],
): { products: ProductHunterIdea[]; llmNarrativeOk: boolean } {
  const llmNarrativeOk = Boolean(narrativeByAsin && asins.length > 0 && asins.every((a) => narrativeByAsin!.has(a.toUpperCase())));
  const products = base.map((idea, i) => {
    const det = detScores[i] ?? idea.opportunityScore;
    const asin = asins[i]?.toUpperCase() ?? "";
    const n = narrativeByAsin?.get(asin);
    if (!n) {
      return {
        ...idea,
        logisticsFeasibility:
          "No LLM narrative available. Use listing data: verify dimensions/weight and hazmat before FBA inbound; returns risk depends on category.",
        whyTrending:
          "Signals only: EMS, BSR and offer counts indicate relative demand vs competition — validate on Amazon before sourcing.",
        sellingStrategy:
          "Start with tight inventory and PPC caps; improve listing creative from competitor gaps; align MOQ to budget and experience level.",
        opportunityScore: det,
      };
    }
    const blended = Math.round(0.6 * det + 0.4 * n.opportunityScore);
    return {
      ...idea,
      logisticsFeasibility: n.logisticsFeasibility,
      whyTrending: n.whyTrending,
      sellingStrategy: n.sellingStrategy,
      opportunityScore: clamp(blended, 0, 100),
    };
  });
  return { products, llmNarrativeOk };
}

async function buildEvidenceProductIdeasInner(
  rows: AmazonLeadTableRow[],
  f: EvidenceWinnerFilters,
  budget: string,
  experience: ProductHunterExperienceLevel,
  tryLlm: boolean,
): Promise<EvidenceFeedResult> {
  const scored = filterAndScoreRows(rows, f);
  const top = scored.slice(0, 10);
  const deterministicByAsin = new Map<string, number>();
  const baseIdeas: ProductHunterIdea[] = [];
  const detScores: number[] = [];
  const asins: string[] = [];
  for (const t of top) {
    deterministicByAsin.set(t.row.asin.toUpperCase(), t.deterministicScore);
    baseIdeas.push(buildDeterministicIdea(t.row, t.deterministicScore));
    detScores.push(t.deterministicScore);
    asins.push(t.row.asin.toUpperCase());
  }
  let narrativeByAsin: Map<string, LlmNarrativeItem> | null = null;
  if (tryLlm && top.length > 0) {
    try {
      narrativeByAsin = await callOpenAiEvidenceNarratives({ budget, experience, top });
    } catch {
      narrativeByAsin = null;
    }
  }
  const { products: merged, llmNarrativeOk } = mergeIdeasWithNarratives(baseIdeas, detScores, narrativeByAsin, asins);
  merged.sort((a, b) => b.opportunityScore - a.opportunityScore);
  const summary =
    top.length === 0
      ? "No listings in this edition passed the evidence filters. Try relaxing thresholds or publish a fresher Amazon Leads edition."
      : `Evidence-ranked picks from published Amazon lead data (${top.length} analysed with deterministic + optional LLM blend).`;
  return {
    products: merged,
    summary,
    meta: {
      editionDate: null,
      rowCount: rows.length,
      asins: top.map((t) => t.row.asin),
    },
    deterministicByAsin,
    llmNarrativeOk,
  };
}

export type EvidenceCachePayload = {
  ok: true;
  mode: "evidence" | "evidence_demo";
  products: ProductHunterIdea[];
  summary?: string;
  meta: EvidenceFeedMeta;
};

type CacheBucket = Record<string, { savedAtIso: string; payload: EvidenceCachePayload }>;

function readCache(): CacheBucket {
  try {
    const raw = fs.readFileSync(CACHE_FILE, "utf8");
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return {};
    return j as CacheBucket;
  } catch {
    return {};
  }
}

function writeCache(bucket: CacheBucket): void {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(bucket, null, 2), "utf8");
}

export function evidenceCacheKey(parts: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export function getCachedEvidenceFeed(key: string): EvidenceCachePayload | null {
  const bucket = readCache();
  const hit = bucket[key];
  if (!hit) return null;
  const age = Date.now() - Date.parse(hit.savedAtIso);
  if (!Number.isFinite(age) || age > CACHE_TTL_MS) return null;
  return hit.payload;
}

export function setCachedEvidenceFeed(key: string, payload: EvidenceCachePayload): void {
  const bucket = readCache();
  bucket[key] = { savedAtIso: new Date().toISOString(), payload };
  writeCache(bucket);
}

export async function runEvidenceFeedPipeline(params: {
  rows: AmazonLeadTableRow[];
  filters: EvidenceWinnerFilters;
  budget: string;
  experience: ProductHunterExperienceLevel;
  editionDate: string | null;
  suite: string;
  useCache: boolean;
  cacheKeyExtra: Record<string, unknown>;
}): Promise<{ result: EvidenceFeedResult; mode: "evidence" | "evidence_demo"; fromCache: boolean }> {
  const key = evidenceCacheKey({
    suite: params.suite,
    editionDate: params.editionDate,
    filters: params.filters,
    budget: params.budget.slice(0, 200),
    experience: params.experience,
    ...params.cacheKeyExtra,
  });
  if (params.useCache) {
    const hit = getCachedEvidenceFeed(key);
    if (hit) {
      return {
        result: {
          products: hit.products,
          summary: hit.summary,
          meta: hit.meta,
          deterministicByAsin: new Map(),
          llmNarrativeOk: hit.mode === "evidence",
        },
        mode: hit.mode,
        fromCache: true,
      };
    }
  }
  const hasKey = Boolean(process.env.OPENAI_API_KEY?.trim());
  const inner = await buildEvidenceProductIdeasInner(params.rows, params.filters, params.budget, params.experience, hasKey);
  const mode: "evidence" | "evidence_demo" = inner.llmNarrativeOk ? "evidence" : "evidence_demo";
  const result: EvidenceFeedResult = {
    ...inner,
    meta: { ...inner.meta, editionDate: params.editionDate },
  };
  if (params.useCache && result.products.length > 0) {
    const payload: EvidenceCachePayload = {
      ok: true,
      mode,
      products: result.products,
      summary: result.summary,
      meta: result.meta,
    };
    setCachedEvidenceFeed(key, payload);
  }
  return { result, mode, fromCache: false };
}
