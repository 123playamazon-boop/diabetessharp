import { apiUrl } from "./apiUrl";
import { jsonUserHeaders } from "./authHeaders";
import type { ProductHunterIdea, ProductHunterMarketplaceId, ProductHunterResult } from "../../shared/productHunter";

function isDemand(v: unknown): v is ProductHunterIdea["demandLevel"] {
  return v === "high" || v === "medium" || v === "low";
}

function isCompetition(v: unknown): v is ProductHunterIdea["competitionLevel"] {
  return v === "high" || v === "medium" || v === "low";
}

function coerceProduct(raw: unknown): ProductHunterIdea | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const idea = typeof o.idea === "string" ? o.idea.trim() : "";
  const estimatedProfitMargin = typeof o.estimatedProfitMargin === "string" ? o.estimatedProfitMargin.trim() : "";
  const bestMarketplace = typeof o.bestMarketplace === "string" ? o.bestMarketplace.trim() : "";
  const logisticsFeasibility = typeof o.logisticsFeasibility === "string" ? o.logisticsFeasibility.trim() : "";
  const whyTrending = typeof o.whyTrending === "string" ? o.whyTrending.trim() : "";
  const sellingStrategy = typeof o.sellingStrategy === "string" ? o.sellingStrategy.trim() : "";
  const score = typeof o.opportunityScore === "number" ? o.opportunityScore : Number(o.opportunityScore);
  if (
    !idea ||
    !estimatedProfitMargin ||
    !bestMarketplace ||
    !logisticsFeasibility ||
    !whyTrending ||
    !sellingStrategy ||
    !Number.isFinite(score)
  ) {
    return null;
  }
  if (!isDemand(o.demandLevel) || !isCompetition(o.competitionLevel)) return null;
  return {
    idea,
    demandLevel: o.demandLevel,
    competitionLevel: o.competitionLevel,
    estimatedProfitMargin,
    bestMarketplace,
    logisticsFeasibility,
    whyTrending,
    sellingStrategy,
    opportunityScore: Math.max(0, Math.min(100, Math.round(score))),
  };
}

function parseHunter(data: Record<string, unknown>): ProductHunterResult | null {
  const h = data.hunter;
  if (!h || typeof h !== "object") return null;
  const root = h as Record<string, unknown>;
  const arr = root.products;
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const products: ProductHunterIdea[] = [];
  for (const item of arr) {
    const p = coerceProduct(item);
    if (p) products.push(p);
  }
  if (products.length === 0) return null;
  const summary = typeof root.summary === "string" ? root.summary.trim() : undefined;
  return { products, summary: summary || undefined };
}

export type ProductHunterResponse =
  | { ok: true; mode: "live" | "demo"; hunter: ProductHunterResult; warn?: string }
  | { ok: false; error: string };

export async function postProductHunter(payload: {
  budget: string;
  marketplace: ProductHunterMarketplaceId;
  experienceLevel: "beginner" | "intermediate" | "advanced";
}): Promise<ProductHunterResponse> {
  const res = await fetch(apiUrl("/api/client/product-hunter"), {
    method: "POST",
    headers: jsonUserHeaders(),
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = typeof data.error === "string" ? data.error : `HTTP ${res.status}`;
    return { ok: false, error: err };
  }
  const hunter = parseHunter(data);
  if (!hunter) {
    return { ok: false, error: "Resposta inválida do servidor." };
  }
  const mode = data.mode === "live" ? "live" : "demo";
  const warn = typeof data.warn === "string" ? data.warn : undefined;
  return { ok: true, mode, hunter, warn };
}
