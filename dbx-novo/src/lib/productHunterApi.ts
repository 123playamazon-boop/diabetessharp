import { apiUrl } from "./apiUrl";
import { jsonUserHeaders } from "./authHeaders";
import type {
  ProductHunterBrief,
  ProductHunterCandidate,
  ProductHunterCandidateContext,
  ProductHunterCandidateSource,
  ProductHunterCandidateStatus,
  ProductHunterIdea,
  ProductHunterMarketplaceId,
  ProductHunterResult,
} from "../../shared/productHunter";
import {
  isProductHunterCandidateSource,
  isProductHunterCandidateStatus,
  normalizeProductHunterBrief,
  normalizeProductHunterCandidateContext,
} from "../../shared/productHunter";
import type { AppLocale } from "../i18n/catalog";

function isDemand(v: unknown): v is ProductHunterIdea["demandLevel"] {
  return v === "high" || v === "medium" || v === "low";
}

function isCompetition(v: unknown): v is ProductHunterIdea["competitionLevel"] {
  return v === "high" || v === "medium" || v === "low";
}

export function coerceProductHunterIdea(raw: unknown): ProductHunterIdea | null {
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
    const p = coerceProductHunterIdea(item);
    if (p) products.push(p);
  }
  if (products.length === 0) return null;
  const summary = typeof root.summary === "string" ? root.summary.trim() : undefined;
  return { products, summary: summary || undefined };
}

/** Evidence feed pode devolver `products: []` com resumo explicativo. Exportado para testes unitários. */
export function parseEvidenceHunter(data: Record<string, unknown>): ProductHunterResult | null {
  const h = data.hunter;
  if (!h || typeof h !== "object") return null;
  const root = h as Record<string, unknown>;
  const arr = root.products;
  if (!Array.isArray(arr)) return null;
  const products: ProductHunterIdea[] = [];
  for (const item of arr) {
    const p = coerceProductHunterIdea(item);
    if (p) products.push(p);
  }
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
  locale?: AppLocale;
}): Promise<ProductHunterResponse> {
  const { locale = "pt-BR", ...rest } = payload;
  const res = await fetch(apiUrl("/api/client/product-hunter"), {
    method: "POST",
    headers: jsonUserHeaders(),
    body: JSON.stringify({ ...rest, locale }),
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

export type EvidenceWinnerFiltersPayload = {
  priceMinUsd?: number;
  priceMaxUsd?: number;
  minMonthlySold?: number;
  maxNewOffersTotal?: number;
  minNewOffersTotal?: number;
  minRoiPct?: number;
  bsrMin?: number;
  bsrMax?: number;
};

export type ProductHunterEvidenceFeedResponse =
  | {
      ok: true;
      mode: "evidence" | "evidence_demo";
      fromCache: boolean;
      hunter: ProductHunterResult;
      meta: { editionDate: string | null; rowCount: number; asins: string[] };
    }
  | { ok: false; error: string };

export async function postProductHunterEvidenceFeed(payload: {
  budget: string;
  marketplace: ProductHunterMarketplaceId;
  experienceLevel: "beginner" | "intermediate" | "advanced";
  editionDate?: string;
  filters?: EvidenceWinnerFiltersPayload;
  locale?: AppLocale;
}): Promise<ProductHunterEvidenceFeedResponse> {
  const { locale = "pt-BR", ...rest } = payload;
  const res = await fetch(apiUrl("/api/client/product-hunter/evidence-feed"), {
    method: "POST",
    headers: jsonUserHeaders(),
    body: JSON.stringify({ ...rest, locale }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = typeof data.error === "string" ? data.error : `HTTP ${res.status}`;
    return { ok: false, error: err };
  }
  const hunter = parseEvidenceHunter(data);
  if (!hunter) {
    return { ok: false, error: "Resposta inválida do servidor." };
  }
  const mode = data.mode === "evidence" ? "evidence" : "evidence_demo";
  const fromCache = data.fromCache === true;
  const metaRaw = data.meta;
  const meta =
    metaRaw && typeof metaRaw === "object"
      ? (metaRaw as Record<string, unknown>)
      : { editionDate: null, rowCount: 0, asins: [] as string[] };
  const editionDate = typeof meta.editionDate === "string" ? meta.editionDate : null;
  const rowCount = typeof meta.rowCount === "number" && Number.isFinite(meta.rowCount) ? Math.max(0, Math.floor(meta.rowCount)) : 0;
  const asins: string[] = [];
  if (Array.isArray(meta.asins)) {
    for (const a of meta.asins) {
      if (typeof a === "string" && a.trim()) asins.push(a.trim().toUpperCase());
    }
  }
  return { ok: true, mode, fromCache, hunter, meta: { editionDate, rowCount, asins } };
}

/** Parse one candidate row from API JSON (tests + client guards). */
export function parseProductHunterCandidate(raw: unknown): ProductHunterCandidate | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  const suite = typeof r.suite === "string" ? r.suite.trim() : "";
  const savedAtIso = typeof r.savedAtIso === "string" ? r.savedAtIso.trim() : "";
  const updatedAtIso = typeof r.updatedAtIso === "string" ? r.updatedAtIso.trim() : "";
  const sourceRaw = r.source;
  const source: ProductHunterCandidateSource | null =
    typeof sourceRaw === "string" && isProductHunterCandidateSource(sourceRaw) ? sourceRaw : null;
  const statusRaw = r.status;
  const status: ProductHunterCandidateStatus | null =
    typeof statusRaw === "string" && isProductHunterCandidateStatus(statusRaw) ? statusRaw : null;
  const idea = coerceProductHunterIdea(r.idea);
  if (!id || !suite || !savedAtIso || !updatedAtIso || !source || !status || !idea) return null;
  const notes = typeof r.notes === "string" ? r.notes : undefined;
  const hunterContext = normalizeProductHunterCandidateContext(r.hunterContext);
  const brief = normalizeProductHunterBrief(r.brief) ?? undefined;
  return { id, suite, savedAtIso, updatedAtIso, source, idea, status, notes, hunterContext, brief };
}

export type ListCandidatesResponse = { ok: true; candidates: ProductHunterCandidate[] } | { ok: false; error: string };

export async function listProductHunterCandidates(): Promise<ListCandidatesResponse> {
  const res = await fetch(apiUrl("/api/client/product-hunter/candidates"), { headers: jsonUserHeaders() });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = typeof data.error === "string" ? data.error : `HTTP ${res.status}`;
    return { ok: false, error: err };
  }
  const arr = data.candidates;
  if (!Array.isArray(arr)) return { ok: false, error: "Resposta inválida do servidor." };
  const candidates: ProductHunterCandidate[] = [];
  for (const x of arr) {
    const c = parseProductHunterCandidate(x);
    if (c) candidates.push(c);
  }
  return { ok: true, candidates };
}

export type SaveCandidatesResponse =
  | { ok: true; saved: ProductHunterCandidate[] }
  | { ok: false; error: string };

export async function saveProductHunterCandidates(payload: {
  ideas: ProductHunterIdea[];
  source?: ProductHunterCandidateSource;
}): Promise<SaveCandidatesResponse> {
  const res = await fetch(apiUrl("/api/client/product-hunter/candidates"), {
    method: "POST",
    headers: jsonUserHeaders(),
    body: JSON.stringify({ ideas: payload.ideas, source: payload.source }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = typeof data.error === "string" ? data.error : `HTTP ${res.status}`;
    return { ok: false, error: err };
  }
  const savedRaw = data.saved;
  if (!Array.isArray(savedRaw)) return { ok: false, error: "Resposta inválida do servidor." };
  const saved: ProductHunterCandidate[] = [];
  for (const x of savedRaw) {
    const c = parseProductHunterCandidate(x);
    if (c) saved.push(c);
  }
  return { ok: true, saved };
}

export type PatchCandidateResponse = { ok: true; candidate: ProductHunterCandidate } | { ok: false; error: string };

export async function patchProductHunterCandidate(
  id: string,
  patch: { status?: ProductHunterCandidateStatus; notes?: string; hunterContext?: ProductHunterCandidateContext },
): Promise<PatchCandidateResponse> {
  const res = await fetch(apiUrl(`/api/client/product-hunter/candidates/${encodeURIComponent(id)}`), {
    method: "PATCH",
    headers: jsonUserHeaders(),
    body: JSON.stringify({ patch }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = typeof data.error === "string" ? data.error : `HTTP ${res.status}`;
    return { ok: false, error: err };
  }
  const c = parseProductHunterCandidate(data.candidate);
  if (!c) return { ok: false, error: "Resposta inválida do servidor." };
  return { ok: true, candidate: c };
}

export type DeleteCandidateResponse = { ok: true } | { ok: false; error: string };

export async function deleteProductHunterCandidate(id: string): Promise<DeleteCandidateResponse> {
  const res = await fetch(apiUrl(`/api/client/product-hunter/candidates/${encodeURIComponent(id)}`), {
    method: "DELETE",
    headers: jsonUserHeaders(),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = typeof data.error === "string" ? data.error : `HTTP ${res.status}`;
    return { ok: false, error: err };
  }
  return { ok: true };
}

export type GetBriefResponse = { ok: true; brief: ProductHunterBrief } | { ok: false; error: string; status?: number };

export async function getProductHunterBrief(id: string): Promise<GetBriefResponse> {
  const res = await fetch(apiUrl(`/api/client/product-hunter/candidates/${encodeURIComponent(id)}/brief`), {
    headers: jsonUserHeaders(),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = typeof data.error === "string" ? data.error : `HTTP ${res.status}`;
    return { ok: false, error: err, status: res.status };
  }
  const brief = normalizeProductHunterBrief(data.brief);
  if (!brief) return { ok: false, error: "Resposta inválida do servidor." };
  return { ok: true, brief };
}

export type PostBriefResponse = { ok: true; brief: ProductHunterBrief } | { ok: false; error: string; status?: number };

export async function postProductHunterBrief(
  id: string,
  body: {
    seedAsin?: string;
    force?: boolean;
    editionDate?: string;
    categoryLabel?: string;
    competitorAsins?: string[];
    locale?: AppLocale;
  } = {},
): Promise<PostBriefResponse> {
  const { locale = "pt-BR", ...rest } = body;
  const res = await fetch(apiUrl(`/api/client/product-hunter/candidates/${encodeURIComponent(id)}/brief`), {
    method: "POST",
    headers: jsonUserHeaders(),
    body: JSON.stringify({ ...rest, locale }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = typeof data.error === "string" ? data.error : `HTTP ${res.status}`;
    return { ok: false, error: err, status: res.status };
  }
  const brief = normalizeProductHunterBrief(data.brief);
  if (!brief) return { ok: false, error: "Resposta inválida do servidor." };
  return { ok: true, brief };
}
