import type { Express, Request, Response } from "express";
import { requireUser, userSuite } from "./authMiddleware";
import {
  type ProductHunterCompetition,
  type ProductHunterDemand,
  type ProductHunterExperienceLevel,
  type ProductHunterIdea,
  type ProductHunterMarketplaceId,
  type ProductHunterResult,
  type ProductHunterCandidateSource,
  type ProductHunterCandidateContext,
  buildDemoProductHunter,
  isProductHunterCandidateSource,
  isProductHunterCandidateStatus,
  isProductHunterExperienceLevel,
  isProductHunterMarketplaceId,
  normalizeProductHunterCandidateContext,
  normalizeProductHunterUiLocale,
  type ProductHunterUiLocale,
} from "../shared/productHunter";
import { getEditionByDate, getLatestEdition } from "./amazonLeadsDailyStore";
import { coerceLeadRow, type AmazonLeadTableRow } from "./keepaAmazonLeads";
import { mergeEvidenceFilters, runEvidenceFeedPipeline, type EvidenceWinnerFilters } from "./productHunterEvidenceFeed";
import { generateProductHunterBrief } from "./productHunterBriefService";
import { resolveCompetitorAsins } from "./productHunterBriefCompetitors";
import { tryConsumeBriefSlot } from "./productHunterBriefRateStore";
import {
  deleteCandidate,
  getCandidateByIdInSuite,
  listCandidatesBySuite,
  patchCandidate,
  readAllCandidates,
  saveCandidate,
} from "./productHunterCandidateStore";

const MAX_BUDGET_LEN = 200;

function productHunterLiveSystemPrompt(locale: ProductHunterUiLocale): string {
  const loc = normalizeProductHunterUiLocale(locale);
  const lang =
    loc === "pt-BR"
      ? "All human-readable string values in the JSON (summary, idea, estimatedProfitMargin, bestMarketplace, logisticsFeasibility, whyTrending, sellingStrategy) must be in Brazilian Portuguese (pt-BR). Keep enum fields demandLevel and competitionLevel exactly as: high | medium | low."
      : loc === "es"
        ? "All human-readable string values in the JSON must be in Spanish (es). Keep demandLevel and competitionLevel exactly as: high | medium | low."
        : "All human-readable string values in the JSON must be in English. Keep demandLevel and competitionLevel exactly as: high | medium | low.";
  return `You are Product Hunter AI — a senior US e-commerce analyst for Direct Box USA.

The user is an e-commerce seller evaluating what to sell next on US marketplaces. Inputs: budget (free text), target marketplace (one of: amazon_us, walmart_us, tiktok_shop_us, shopify, ebay_us), experience level (beginner | intermediate | advanced).

Output ONLY valid JSON:
{
  "summary": "2-3 sentences: analytical read of the opportunity set for this profile; no hype; decision-oriented.",
  "products": [
    {
      "idea": "concise product concept (not a brand name; category + angle)",
      "demandLevel": "high" | "medium" | "low",
      "competitionLevel": "high" | "medium" | "low",
      "estimatedProfitMargin": "string like 18–28% or numeric range; honest band, not a guarantee",
      "bestMarketplace": "single best primary marketplace name for the chosen language (e.g. Amazon USA may stay as a proper noun)",
      "logisticsFeasibility": "2-4 sentences: size/weight/inbound complexity/returns risk",
      "whyTrending": "2-4 sentences: demand drivers, search/social signals, category cycle — factual tone",
      "sellingStrategy": "3-5 sentences: positioning, pricing discipline, listing/promo angle for the chosen marketplace",
      "opportunityScore": integer 0-100
    }
  ]
}

Rules:
- Return exactly 5 products, each with all fields.
- Rank products by opportunityScore descending in the array (highest first).
- opportunityScore must reflect profitability potential, scalability, ease of entry for the experience level, and fit to the selected marketplace — not hype.
- demandLevel and competitionLevel must be consistent with the narrative.
- Do not invent trademarked brand names or claim verified sales data you do not have; speak in category/strategy terms.
- ${lang}
- No markdown fences.`;
}

type HunterBody = {
  budget?: string;
  marketplace?: string;
  experienceLevel?: string;
  locale?: unknown;
};

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function coerceDemand(v: unknown): ProductHunterDemand {
  return v === "high" || v === "medium" || v === "low" ? v : "medium";
}

function coerceCompetition(v: unknown): ProductHunterCompetition {
  return v === "high" || v === "medium" || v === "low" ? v : "medium";
}

function normalizeProductHunterIdeaFromUnknown(item: unknown): ProductHunterIdea | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const idea = typeof o.idea === "string" ? o.idea.trim() : "";
  const estimatedProfitMargin = typeof o.estimatedProfitMargin === "string" ? o.estimatedProfitMargin.trim() : "";
  const bestMarketplace = typeof o.bestMarketplace === "string" ? o.bestMarketplace.trim() : "";
  const logisticsFeasibility = typeof o.logisticsFeasibility === "string" ? o.logisticsFeasibility.trim() : "";
  const whyTrending = typeof o.whyTrending === "string" ? o.whyTrending.trim() : "";
  const sellingStrategy = typeof o.sellingStrategy === "string" ? o.sellingStrategy.trim() : "";
  if (!idea || !estimatedProfitMargin || !bestMarketplace || !logisticsFeasibility || !whyTrending || !sellingStrategy) return null;
  return {
    idea: idea.slice(0, 500),
    demandLevel: coerceDemand(o.demandLevel),
    competitionLevel: coerceCompetition(o.competitionLevel),
    estimatedProfitMargin: estimatedProfitMargin.slice(0, 80),
    bestMarketplace: bestMarketplace.slice(0, 120),
    logisticsFeasibility: logisticsFeasibility.slice(0, 1200),
    whyTrending: whyTrending.slice(0, 1200),
    sellingStrategy: sellingStrategy.slice(0, 1200),
    opportunityScore: clampScore(typeof o.opportunityScore === "number" ? o.opportunityScore : Number(o.opportunityScore)),
  };
}

function parseProductHunterJson(raw: string): ProductHunterResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const root = parsed as Record<string, unknown>;
  const arr = root.products;
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const products: ProductHunterIdea[] = [];
  for (const item of arr) {
    const row = normalizeProductHunterIdeaFromUnknown(item);
    if (!row) continue;
    products.push(row);
    if (products.length >= 8) break;
  }
  if (products.length < 3) return null;
  products.sort((a, b) => b.opportunityScore - a.opportunityScore);
  const summary = typeof root.summary === "string" ? root.summary.trim().slice(0, 800) : undefined;
  return { products: products.slice(0, 8), summary: summary || undefined };
}

async function callOpenAiProductHunter(
  budget: string,
  marketplace: ProductHunterMarketplaceId,
  experience: ProductHunterExperienceLevel,
  locale: ProductHunterUiLocale,
): Promise<ProductHunterResult | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const loc = normalizeProductHunterUiLocale(locale);
  const instruction =
    loc === "pt-BR"
      ? "Gere exatamente 5 oportunidades ranqueadas. Tom analítico, orientado a decisão, em português do Brasil. Sem floreio."
      : loc === "es"
        ? "Genera exactamente 5 oportunidades rankeadas. Tono analítico, orientado a decisión, en español. Sin relleno."
        : "Generate exactly 5 ranked opportunities. English. Analytical, business-focused, decision-making oriented. No fluff.";
  const userPayload = {
    budget,
    marketplace,
    experienceLevel: experience,
    outputLocale: loc,
    instruction,
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: productHunterLiveSystemPrompt(loc) },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenAI HTTP ${res.status}: ${errText.slice(0, 400)}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) return null;
  return parseProductHunterJson(raw);
}

export function registerProductHunterRoutes(app: Express): void {
  app.post("/api/client/product-hunter", requireUser, async (req: Request, res: Response) => {
    const b = (req.body && typeof req.body === "object" ? req.body : {}) as HunterBody;
    const budget = typeof b.budget === "string" ? b.budget.trim() : "";
    const marketplaceRaw = typeof b.marketplace === "string" ? b.marketplace.trim() : "";
    const experienceRaw = typeof b.experienceLevel === "string" ? b.experienceLevel.trim() : "";

    if (!budget) {
      res.status(400).json({ error: "Indique o orçamento (budget)." });
      return;
    }
    if (budget.length > MAX_BUDGET_LEN) {
      res.status(400).json({ error: "Orçamento demasiado longo." });
      return;
    }
    if (!isProductHunterMarketplaceId(marketplaceRaw)) {
      res.status(400).json({ error: "Marketplace inválido.", validMarketplaces: ["amazon_us", "walmart_us", "tiktok_shop_us", "shopify", "ebay_us"] });
      return;
    }
    if (!isProductHunterExperienceLevel(experienceRaw)) {
      res.status(400).json({ error: "Nível de experiência inválido.", validLevels: ["beginner", "intermediate", "advanced"] });
      return;
    }
    const marketplace = marketplaceRaw as ProductHunterMarketplaceId;
    const experience = experienceRaw as ProductHunterExperienceLevel;
    const locale = normalizeProductHunterUiLocale(b.locale);

    const runDemo = (): ProductHunterResult => buildDemoProductHunter(budget, marketplace, experience, locale);

    if (process.env.OPENAI_API_KEY?.trim()) {
      try {
        const ai = await callOpenAiProductHunter(budget, marketplace, experience, locale);
        if (ai) {
          res.json({ ok: true, mode: "live", hunter: ai });
          return;
        }
      } catch (e) {
        res.json({
          ok: true,
          mode: "demo",
          hunter: runDemo(),
          warn: e instanceof Error ? e.message.slice(0, 240) : "openai_error",
        });
        return;
      }
    }

    res.json({ ok: true, mode: "demo", hunter: runDemo() });
  });

  app.post("/api/client/product-hunter/evidence-feed", requireUser, async (req: Request, res: Response) => {
    const suite = userSuite(req);
    const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const locale = normalizeProductHunterUiLocale(b.locale);
    const budget = typeof b.budget === "string" ? b.budget.trim() : "";
    const marketplaceRaw = typeof b.marketplace === "string" ? b.marketplace.trim() : "";
    const experienceRaw = typeof b.experienceLevel === "string" ? b.experienceLevel.trim() : "";

    if (!budget) {
      res.status(400).json({ error: "Indique o orçamento (budget)." });
      return;
    }
    if (budget.length > MAX_BUDGET_LEN) {
      res.status(400).json({ error: "Orçamento demasiado longo." });
      return;
    }
    if (!isProductHunterMarketplaceId(marketplaceRaw)) {
      res.status(400).json({ error: "Marketplace inválido.", validMarketplaces: ["amazon_us", "walmart_us", "tiktok_shop_us", "shopify", "ebay_us"] });
      return;
    }
    if (marketplaceRaw !== "amazon_us") {
      res.status(400).json({
        error:
          "Evidence feed disponível apenas para amazon_us nesta fase. Use POST /api/client/product-hunter para outros marketplaces.",
      });
      return;
    }
    if (!isProductHunterExperienceLevel(experienceRaw)) {
      res.status(400).json({ error: "Nível de experiência inválido.", validLevels: ["beginner", "intermediate", "advanced"] });
      return;
    }
    const experience = experienceRaw as ProductHunterExperienceLevel;

    const editionDateQ = typeof b.editionDate === "string" ? b.editionDate.trim() : "";
    const editionDate =
      editionDateQ && /^\d{4}-\d{2}-\d{2}$/.test(editionDateQ) ? editionDateQ : undefined;
    const edition = editionDate ? getEditionByDate(editionDate) ?? getLatestEdition() : getLatestEdition();

    if (!edition) {
      const emptySummary: Record<ProductHunterUiLocale, string> = {
        en: "No edition published in amazonLeadsDailyStore. Publish an edition in Admin → Amazon Leads (Keepa) to power the evidence feed.",
        "pt-BR":
          "Sem edição publicada em amazonLeadsDailyStore. Publique uma edição em Admin → Leads Amazon (Keepa) para alimentar o evidence feed.",
        es: "No hay edición publicada en amazonLeadsDailyStore. Publica una edición en Admin → Leads Amazon (Keepa) para alimentar el evidence feed.",
      };
      res.json({
        ok: true,
        mode: "evidence_demo" as const,
        fromCache: false,
        hunter: {
          products: [] as ProductHunterIdea[],
          summary: emptySummary[locale] ?? emptySummary["pt-BR"],
        },
        meta: { editionDate: null, rowCount: 0, asins: [] as string[] },
      });
      return;
    }

    const filtersPartial = b.filters && typeof b.filters === "object" ? (b.filters as Partial<EvidenceWinnerFilters>) : undefined;
    const filters = mergeEvidenceFilters(filtersPartial);

    const rows = edition.rows.map((r) => coerceLeadRow(r));
    try {
      const { result, mode, fromCache } = await runEvidenceFeedPipeline({
        rows,
        filters,
        budget,
        experience,
        editionDate: edition.editionDate,
        suite,
        useCache: true,
        cacheKeyExtra: {},
        locale,
      });
      res.json({
        ok: true,
        mode,
        fromCache,
        hunter: { products: result.products, summary: result.summary },
        meta: result.meta,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message.slice(0, 400) : "Erro ao gerar evidence feed.";
      res.status(502).json({ error: msg });
    }
  });

  const MAX_CANDIDATE_IDEAS = 8;

  app.post("/api/client/product-hunter/candidates", requireUser, (req: Request, res: Response) => {
    const suite = userSuite(req);
    const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const rawIdeas = b.ideas;
    if (!Array.isArray(rawIdeas)) {
      res.status(400).json({ error: "Envie «ideas» como array." });
      return;
    }
    if (rawIdeas.length === 0) {
      res.status(400).json({ error: "Indique pelo menos uma ideia." });
      return;
    }
    if (rawIdeas.length > MAX_CANDIDATE_IDEAS) {
      res.status(400).json({ error: `No máximo ${MAX_CANDIDATE_IDEAS} ideias por pedido.` });
      return;
    }
    const rawSource = b.source;
    let source: ProductHunterCandidateSource = "hunter_run";
    if (rawSource !== undefined && rawSource !== null) {
      if (!isProductHunterCandidateSource(rawSource)) {
        res.status(400).json({ error: "Origem inválida. Use «hunter_run», «manual» ou «evidence_feed»." });
        return;
      }
      source = rawSource;
    }
    const normalized: ProductHunterIdea[] = [];
    for (const item of rawIdeas) {
      const row = normalizeProductHunterIdeaFromUnknown(item);
      if (!row) {
        res.status(400).json({ error: "Uma ou mais ideias são inválidas ou incompletas." });
        return;
      }
      normalized.push(row);
    }
    const saved = normalized.map((idea) => saveCandidate(suite, idea, source));
    res.json({ ok: true, saved });
  });

  app.get("/api/client/product-hunter/candidates", requireUser, (req: Request, res: Response) => {
    const suite = userSuite(req);
    const candidates = listCandidatesBySuite(suite);
    res.json({ ok: true, candidates });
  });

  app.get("/api/client/product-hunter/candidates/:id/brief", requireUser, (req: Request, res: Response) => {
    const suite = userSuite(req);
    const id = typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!id) {
      res.status(400).json({ error: "Identificador em falta." });
      return;
    }
    const c = getCandidateByIdInSuite(suite, id);
    if (!c) {
      res.status(404).json({ error: "Candidato não encontrado." });
      return;
    }
    if (!c.brief) {
      res.status(404).json({ error: "Ainda não existe brief para este candidato. Use POST para gerar." });
      return;
    }
    res.json({ ok: true, brief: c.brief });
  });

  app.post("/api/client/product-hunter/candidates/:id/brief", requireUser, async (req: Request, res: Response) => {
    const suite = userSuite(req);
    const id = typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!id) {
      res.status(400).json({ error: "Identificador em falta." });
      return;
    }
    const c = getCandidateByIdInSuite(suite, id);
    if (!c) {
      res.status(404).json({ error: "Candidato não encontrado." });
      return;
    }
    const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const force = b.force === true || b.force === 1 || (typeof b.force === "string" && b.force.trim().toLowerCase() === "true");
    if (c.brief && !force) {
      res.status(409).json({
        error: "Já existe um brief para este candidato. Envie «force»: true no corpo para regerar.",
      });
      return;
    }

    const seedRaw = typeof b.seedAsin === "string" ? b.seedAsin.trim().toUpperCase() : "";
    const seedAsin = seedRaw || c.hunterContext?.seedAsin?.trim().toUpperCase() || "";
    if (!seedAsin || !/^B[A-Z0-9]{9}$/.test(seedAsin)) {
      res.status(400).json({
        error: "Indique o ASIN alvo em «seedAsin» no corpo ou guarde «hunterContext.seedAsin» no candidato (via PATCH).",
      });
      return;
    }

    const manualRaw = b.competitorAsins;
    const manual =
      Array.isArray(manualRaw) && manualRaw.every((x) => typeof x === "string")
        ? (manualRaw as string[]).map((x) => x.trim().toUpperCase())
        : undefined;
    const manualOk = (manual?.length ?? 0) >= 3;

    const editionDateQ =
      typeof b.editionDate === "string" ? b.editionDate.trim() : c.hunterContext?.editionDate?.trim() || "";
    let editionRows: AmazonLeadTableRow[] = [];
    if (!manualOk) {
      const edition =
        editionDateQ && /^\d{4}-\d{2}-\d{2}$/.test(editionDateQ)
          ? getEditionByDate(editionDateQ) ?? getLatestEdition()
          : getLatestEdition();
      if (!edition) {
        res.status(400).json({
          error: "Sem edição de leads Amazon. Publique uma edição (Admin → Leads Amazon) para seleccionar concorrentes.",
        });
        return;
      }
      editionRows = edition.rows.map((r) => coerceLeadRow(r));
    } else {
      const edition =
        editionDateQ && /^\d{4}-\d{2}-\d{2}$/.test(editionDateQ)
          ? getEditionByDate(editionDateQ) ?? getLatestEdition()
          : getLatestEdition();
      if (edition) editionRows = edition.rows.map((r) => coerceLeadRow(r));
    }

    const catHint =
      (typeof b.categoryLabel === "string" ? b.categoryLabel.trim() : "") ||
      c.hunterContext?.categoryLabel?.trim() ||
      "";
    const seedRow = editionRows.find((r) => r.asin.trim().toUpperCase() === seedAsin);
    const categoryLabel = catHint || (seedRow?.categoryLabel ?? "").trim() || (manualOk ? "manual" : "");

    if (!manualOk && !categoryLabel) {
      res.status(400).json({
        error: "Indique «categoryLabel» no corpo ou em «hunterContext» do candidato para encontrar vizinhos na edição.",
      });
      return;
    }

    const resolved = resolveCompetitorAsins({
      editionRows,
      seedAsin,
      categoryLabel: categoryLabel || "manual",
      manual,
    });
    if (!resolved.ok) {
      res.status(400).json({ error: resolved.error });
      return;
    }

    const slot = tryConsumeBriefSlot(suite);
    if (!slot.ok) {
      res.status(429).json({
        error: `Limite diário de briefs (${slot.max}) atingido. Reinicia à meia-noite UTC.`,
        resetsAtIso: slot.resetsAtIso,
        max: slot.max,
      });
      return;
    }

    try {
      const briefLocale = normalizeProductHunterUiLocale(b.locale);
      const { brief } = await generateProductHunterBrief({
        targetIdea: c.idea,
        competitorAsins: resolved.asins,
        locale: briefLocale,
      });
      const updated = patchCandidate(suite, id, { brief });
      if (!updated) {
        res.status(404).json({ error: "Candidato não encontrado." });
        return;
      }
      res.json({ ok: true, brief: updated.brief });
    } catch (e) {
      const msg = e instanceof Error ? e.message.slice(0, 400) : "Erro ao gerar brief.";
      res.status(502).json({ error: msg });
    }
  });

  app.patch("/api/client/product-hunter/candidates/:id", requireUser, (req: Request, res: Response) => {
    const suite = userSuite(req);
    const id = typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!id) {
      res.status(400).json({ error: "Identificador em falta." });
      return;
    }
    const all = readAllCandidates();
    const row = all.find((c) => c.id === id);
    if (!row) {
      res.status(404).json({ error: "Candidato não encontrado." });
      return;
    }
    if (row.suite !== suite) {
      res.status(403).json({ error: "Este candidato pertence a outra conta." });
      return;
    }
    const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const patchRaw = b.patch;
    if (!patchRaw || typeof patchRaw !== "object") {
      res.status(400).json({ error: "Envie «patch» como objeto." });
      return;
    }
    const p = patchRaw as Record<string, unknown>;
    const hasStatus = Object.prototype.hasOwnProperty.call(p, "status");
    const hasNotes = Object.prototype.hasOwnProperty.call(p, "notes");
    const hasHunterContext = Object.prototype.hasOwnProperty.call(p, "hunterContext");
    if (!hasStatus && !hasNotes && !hasHunterContext) {
      res.status(400).json({ error: "O patch está vazio. Indique «status», «notes» e/ou «hunterContext»." });
      return;
    }
    const patch: { status?: typeof row.status; notes?: string; hunterContext?: ProductHunterCandidateContext } = {};
    if (hasStatus) {
      if (!isProductHunterCandidateStatus(p.status)) {
        res.status(400).json({ error: "Estado inválido.", validStatuses: ["saved", "testing", "launched", "rejected"] });
        return;
      }
      patch.status = p.status;
    }
    if (hasNotes) {
      if (typeof p.notes !== "string") {
        res.status(400).json({ error: "«notes» deve ser texto." });
        return;
      }
      patch.notes = p.notes;
    }
    if (hasHunterContext) {
      if (!p.hunterContext || typeof p.hunterContext !== "object") {
        res.status(400).json({ error: "«hunterContext» deve ser um objecto." });
        return;
      }
      const hc = normalizeProductHunterCandidateContext(p.hunterContext);
      if (!hc || (!hc.seedAsin && !hc.editionDate && !hc.categoryLabel)) {
        res.status(400).json({ error: "«hunterContext» vazio ou inválido." });
        return;
      }
      patch.hunterContext = hc as ProductHunterCandidateContext;
    }
    const updated = patchCandidate(suite, id, patch);
    if (!updated) {
      res.status(404).json({ error: "Candidato não encontrado." });
      return;
    }
    res.json({ ok: true, candidate: updated });
  });

  app.delete("/api/client/product-hunter/candidates/:id", requireUser, (req: Request, res: Response) => {
    const suite = userSuite(req);
    const id = typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!id) {
      res.status(400).json({ error: "Identificador em falta." });
      return;
    }
    const all = readAllCandidates();
    const row = all.find((c) => c.id === id);
    if (!row) {
      res.status(404).json({ error: "Candidato não encontrado." });
      return;
    }
    if (row.suite !== suite) {
      res.status(403).json({ error: "Este candidato pertence a outra conta." });
      return;
    }
    const ok = deleteCandidate(suite, id);
    if (!ok) {
      res.status(404).json({ error: "Candidato não encontrado." });
      return;
    }
    res.json({ ok: true });
  });
}
