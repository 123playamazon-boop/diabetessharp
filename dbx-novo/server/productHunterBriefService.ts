/**
 * Generate Product Hunter improvement brief from competitor review snippets + LLM.
 * Briefs já gravados ficam congelados no idioma da geração — sem retrofit automático.
 */

import type {
  ProductHunterBrief,
  ProductHunterBriefMarketingAngle,
  ProductHunterBriefPainPoint,
  ProductHunterIdea,
} from "../shared/productHunter";
import { isProductHunterPainPointSeverity, normalizeProductHunterBrief, normalizeProductHunterUiLocale, type ProductHunterUiLocale } from "../shared/productHunter";
import { fetchNegativeReviewSnippetsForAsin, type ReviewSnippet } from "./productHunterReviewFetch";

const MIN_SNIPPETS_FOR_FULL_QUALITY = 6;

type LlmBriefShape = {
  painPoints: ProductHunterBriefPainPoint[];
  productV2Improvements: string[];
  marketingAngles: ProductHunterBriefMarketingAngle[];
  differentiationSummary: string;
};

function briefSystemPrompt(locale: ProductHunterUiLocale): string {
  const loc = normalizeProductHunterUiLocale(locale);
  const lang =
    loc === "pt-BR"
      ? "All string values in the JSON output must be in Brazilian Portuguese (pt-BR)."
      : loc === "es"
        ? "All string values in the JSON output must be in Spanish (es)."
        : "All string values in the JSON output must be in English.";
  return `You are a US Amazon competitive strategist for Direct Box USA.

You receive JSON with:
- targetIdea: { idea, demandLevel, competitionLevel, estimatedProfitMargin, bestMarketplace } (the seller's saved opportunity)
- mode: "reviews_real" | "category_inference"
- competitorAsins: string[]
- reviewSnippets: array of { asin, text } (negative-leaning customer quotes; may be empty in category_inference mode)

Output ONLY valid JSON with these keys (no markdown fences):
{
  "painPoints": [ { "point": "short label", "mentionCount": integer >= 1, "severity": "high"|"medium"|"low", "quoteSample": "optional short quote" } ],
  "productV2Improvements": [ "concrete improvement strings" ],
  "marketingAngles": [ { "angle": "positioning line", "exploits": "which competitor pain it targets" } ],
  "differentiationSummary": "2 sentences positioning vs competitors"
}

Rules:
- If mode is reviews_real, ground painPoints in the snippets (paraphrase; do not invent star ratings not present).
- If mode is category_inference, be explicit that signals are category-level only; keep painPoints fewer and label uncertainty in point text.
- 4–10 painPoints when data allows; at least 3 productV2Improvements; 3–6 marketingAngles.
- ${lang}
- Severity values must remain exactly: high | medium | low.`;
}

function briefContingencyCore(locale: ProductHunterUiLocale): LlmBriefShape {
  const loc = normalizeProductHunterUiLocale(locale);
  if (loc === "en") {
    return {
      painPoints: [
        {
          point: "Perceived quality / durability",
          mentionCount: 1,
          severity: "high",
          quoteSample: "Generic market signals — validate with manual Amazon research.",
        },
      ],
      productV2Improvements: [
        "Tighten materials and QC with the supplier before the 2nd PO.",
        "Damage-resistant packaging and insert with clear instructions.",
        "A variant that addresses the most common use case mentioned in niche reviews.",
      ],
      marketingAngles: [
        {
          angle: "“Built to last” with explicit warranty and social proof",
          exploits: "fear of fragile product / early failure",
        },
      ],
      differentiationSummary:
        "Position as the dependable alternative: clearer specs, stronger warranty messaging, and proof-backed claims versus noisy competitors. Validate every claim against your actual unit before scaling ads.",
    };
  }
  if (loc === "es") {
    return {
      painPoints: [
        {
          point: "Calidad / durabilidad percibida",
          mentionCount: 1,
          severity: "high",
          quoteSample: "Señales genéricas de mercado — valida con research manual en Amazon.",
        },
      ],
      productV2Improvements: [
        "Refuerza materiales y QC con el proveedor antes del 2º PO.",
        "Embalaje anti-daño e insert con instrucciones claras.",
        "Variante que cubra el uso más común mencionado en reviews del nicho.",
      ],
      marketingAngles: [
        {
          angle: "“Hecho para durar” con garantía explícita y prueba social",
          exploits: "miedo a producto frágil / rotura temprana",
        },
      ],
      differentiationSummary:
        "Posiciónate como la alternativa confiable: fichas más claras, garantía más fuerte y claims con respaldo frente a competidores ruidosos. Valida cada claim contra tu unidad real antes de escalar ads.",
    };
  }
  return {
    painPoints: [
      {
        point: "Qualidade / durabilidade percebida",
        mentionCount: 1,
        severity: "high",
        quoteSample: "Sinais genéricos de mercado — validar com pesquisa manual no Amazon.",
      },
    ],
    productV2Improvements: [
      "Reforçar materiais e QC com fornecedor antes do 2º lote.",
      "Embalagem à prova de pancada e insert com instruções claras no idioma do listing.",
      "Variante que resolve o uso mais comum citado nas reviews do nicho.",
    ],
    marketingAngles: [
      {
        angle: "«Feito pra durar» com garantia explícita e prova social",
        exploits: "medo de produto frágil ou que quebra cedo demais",
      },
    ],
    differentiationSummary:
      "Se posicione como a opção confiável: ficha técnica mais clara, mensagem de garantia mais forte e claims com prova frente a concorrentes barulhentos. Valide cada promessa na unidade real antes de escalar mídia.",
  };
}

function parseLlmBriefShape(raw: string): LlmBriefShape | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const painPoints: ProductHunterBriefPainPoint[] = [];
  if (Array.isArray(o.painPoints)) {
    for (const p of o.painPoints) {
      if (!p || typeof p !== "object") continue;
      const r = p as Record<string, unknown>;
      const point = typeof r.point === "string" ? r.point.trim() : "";
      const mc = typeof r.mentionCount === "number" && Number.isFinite(r.mentionCount) ? Math.max(1, Math.floor(r.mentionCount)) : 1;
      const sev = isProductHunterPainPointSeverity(r.severity) ? r.severity : null;
      const quoteSample = typeof r.quoteSample === "string" ? r.quoteSample.trim().slice(0, 400) : undefined;
      if (!point || !sev) continue;
      painPoints.push({ point: point.slice(0, 500), mentionCount: mc, severity: sev, quoteSample });
    }
  }
  const productV2Improvements: string[] = [];
  if (Array.isArray(o.productV2Improvements)) {
    for (const x of o.productV2Improvements) {
      if (typeof x === "string" && x.trim()) productV2Improvements.push(x.trim().slice(0, 800));
    }
  }
  const marketingAngles: ProductHunterBriefMarketingAngle[] = [];
  if (Array.isArray(o.marketingAngles)) {
    for (const m of o.marketingAngles) {
      if (!m || typeof m !== "object") continue;
      const r = m as Record<string, unknown>;
      const angle = typeof r.angle === "string" ? r.angle.trim() : "";
      const exploits = typeof r.exploits === "string" ? r.exploits.trim() : "";
      if (!angle || !exploits) continue;
      marketingAngles.push({ angle: angle.slice(0, 500), exploits: exploits.slice(0, 800) });
    }
  }
  const differentiationSummary = typeof o.differentiationSummary === "string" ? o.differentiationSummary.trim() : "";
  if (!differentiationSummary || painPoints.length === 0 || productV2Improvements.length === 0 || marketingAngles.length === 0) return null;
  return {
    painPoints: painPoints.slice(0, 16),
    productV2Improvements: productV2Improvements.slice(0, 20),
    marketingAngles: marketingAngles.slice(0, 12),
    differentiationSummary: differentiationSummary.slice(0, 1200),
  };
}

async function callOpenAiBrief(params: {
  targetIdea: ProductHunterIdea;
  mode: "reviews_real" | "category_inference";
  competitorAsins: string[];
  reviewSnippets: { asin: string; text: string }[];
  locale: ProductHunterUiLocale;
}): Promise<LlmBriefShape | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model =
    process.env.PRODUCT_HUNTER_BRIEF_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const userPayload = {
    targetIdea: {
      idea: params.targetIdea.idea.slice(0, 500),
      demandLevel: params.targetIdea.demandLevel,
      competitionLevel: params.targetIdea.competitionLevel,
      estimatedProfitMargin: params.targetIdea.estimatedProfitMargin,
      bestMarketplace: params.targetIdea.bestMarketplace,
    },
    mode: params.mode,
    competitorAsins: params.competitorAsins,
    reviewSnippets: params.reviewSnippets.slice(0, 120),
    outputLocale: normalizeProductHunterUiLocale(params.locale),
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.28,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: briefSystemPrompt(params.locale) },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) return null;
  return parseLlmBriefShape(raw);
}

function assembleBrief(
  core: LlmBriefShape,
  meta: {
    source: "reviews_real" | "category_inference";
    quality: "full" | "reduced";
    warnings: string[];
    competitorAsins: string[];
    reviewSampleSize: number;
  },
): ProductHunterBrief | null {
  const generatedAtIso = new Date().toISOString();
  return normalizeProductHunterBrief({
    generatedAtIso,
    source: meta.source,
    quality: meta.quality,
    warnings: meta.warnings,
    competitorAsins: meta.competitorAsins,
    reviewSampleSize: meta.reviewSampleSize,
    painPoints: core.painPoints,
    productV2Improvements: core.productV2Improvements,
    marketingAngles: core.marketingAngles,
    differentiationSummary: core.differentiationSummary,
  });
}

function warnNoSnippets(locale: ProductHunterUiLocale, asin: string): string {
  const loc = normalizeProductHunterUiLocale(locale);
  if (loc === "en") return `${asin}: no negative-review snippets extracted from HTML.`;
  if (loc === "es") return `${asin}: no se extrajeron fragmentos de reseñas negativas del HTML.`;
  return `${asin}: nenhum trecho de review negativa extraído do HTML.`;
}

function warnLowReviews(locale: ProductHunterUiLocale): string {
  const loc = normalizeProductHunterUiLocale(locale);
  if (loc === "en") return "Few negative reviews extracted; brief uses category inference (reduced quality).";
  if (loc === "es") return "Pocas reseñas negativas extraídas; el brief usa inferencia de categoría (calidad reducida).";
  return "Poucas reviews negativas extraídas; o brief usa inferência de categoria (qualidade reduzida).";
}

function warnContingency(locale: ProductHunterUiLocale): string {
  const loc = normalizeProductHunterUiLocale(locale);
  if (loc === "en") return "Model did not return valid JSON — using contingency brief.";
  if (loc === "es") return "El modelo no devolvió JSON válido — usando brief de contingencia.";
  return "O modelo não devolveu JSON válido — a usar brief de contingência.";
}

export async function generateProductHunterBrief(params: {
  targetIdea: ProductHunterIdea;
  competitorAsins: string[];
  locale?: ProductHunterUiLocale;
}): Promise<{ brief: ProductHunterBrief; warnings: string[] }> {
  const locale = normalizeProductHunterUiLocale(params.locale);
  const warnings: string[] = [];
  const allSnippets: ReviewSnippet[] = [];
  for (const asin of params.competitorAsins) {
    const r = await fetchNegativeReviewSnippetsForAsin(asin);
    if (!r.ok) {
      warnings.push(`${asin}: ${r.error}`);
      continue;
    }
    if (r.snippets.length === 0) warnings.push(warnNoSnippets(locale, asin));
    allSnippets.push(...r.snippets);
  }

  const reviewSampleSize = allSnippets.length;
  const reviewSnippets = allSnippets.map((s) => ({ asin: s.asin, text: s.rawText.slice(0, 500) }));

  const useInference = reviewSnippets.length < MIN_SNIPPETS_FOR_FULL_QUALITY;
  const mode: "reviews_real" | "category_inference" = useInference ? "category_inference" : "reviews_real";
  if (useInference) {
    warnings.push(warnLowReviews(locale));
  }

  let core = await callOpenAiBrief({
    targetIdea: params.targetIdea,
    mode,
    competitorAsins: params.competitorAsins,
    reviewSnippets,
    locale,
  });
  let source: "reviews_real" | "category_inference" = mode;
  if (!core) {
    warnings.push(warnContingency(locale));
    source = "category_inference";
    core = briefContingencyCore(locale);
  }

  const quality: "full" | "reduced" =
    source === "reviews_real" && reviewSampleSize >= MIN_SNIPPETS_FOR_FULL_QUALITY ? "full" : "reduced";

  const brief = assembleBrief(core, {
    source,
    quality,
    warnings,
    competitorAsins: params.competitorAsins,
    reviewSampleSize,
  });

  if (!brief) {
    throw new Error("Falha ao normalizar o brief.");
  }
  return { brief, warnings };
}
