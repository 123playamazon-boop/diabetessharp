import type { Express, Request, Response } from "express";
import { requireUser } from "./authMiddleware";
import { fetchListingUrlPlainText } from "./listingUrlFetch";
import { isListingPlatformId, LISTING_PLATFORM_IDS, type ListingPlatformId } from "../shared/listingGenerator";
import { parseUnifiedListingText } from "../shared/listingMultiPlatform";
import { isValidHttpListingUrl } from "../shared/listingUrlInput";
import type {
  ListingAnalysisResult,
  ListingAnalysisWeakArea,
} from "../shared/listingAnalysis";

const MAX_TITLE = 2000;
const MAX_BULLETS = 12000;
const MAX_DESCRIPTION = 24000;

const LISTING_ANALYST_SYSTEM = `You are a senior marketplace listing analyst for Direct Box USA.

You receive a product listing (title, bullet points as pasted text, and description) for a specific sales platform.

Your job is a PRACTICAL audit—not generic praise.

Score each dimension from 0 to 10 (integers only):
- seoScore: search discoverability and information architecture in the copy (title keywords without stuffing, bullets scannable, description supporting search intent)—penalize keyword spam and duplicate stuffing.
- conversionScore: clarity of value prop, benefit order, trust and specificity, objections handled, scannability, CTA/readiness to buy where appropriate for the platform.
- complianceScore: policy-safe language (no unsupported medical/disease claims, no false guarantees, no fake urgency, no trademark abuse, no "#1/best ever" without proof). Lower the score when risk exists even if subtle.

Also return:
- suggestions: 5–10 specific, actionable improvements (each one concrete: what to change and why). No vague lines like "improve SEO" without saying how.
- weakAreas: 3–8 items with label (short area name), detail (one or two sentences, concrete), severity high|medium|low.

Rules:
- Judge ONLY from the text provided; do not invent product facts.
- Prefer bullets and short paragraphs in your suggestions when listing many fixes.
- If the listing is strong in one area, say what is working briefly in suggestions—not only negatives.
- Output ONLY valid JSON matching the schema in the user message. No markdown fences.`;

type AnalysisBody = {
  platform?: string;
  title?: string;
  bullets?: string;
  description?: string;
  /** When set, server fetches HTML and derives title / bullets / description (overrides pasted fields). */
  listingUrl?: string;
};

function clampScore(n: unknown): number {
  const x = typeof n === "number" && !Number.isNaN(n) ? Math.round(n) : 0;
  return Math.max(0, Math.min(10, x));
}

function normalizeBullets(raw: string): string[] {
  return raw
    .split(/\n+/)
    .map((s) => s.replace(/^[\s•\-\*]+\s*/, "").trim())
    .filter(Boolean);
}

function heuristicListingAnalysis(
  platform: ListingPlatformId,
  title: string,
  bulletsText: string,
  description: string,
): ListingAnalysisResult {
  const bullets = normalizeBullets(bulletsText);
  const titleT = title.trim();
  const descT = description.trim();
  const titleLen = titleT.length;
  const descWords = descT.split(/\s+/).filter(Boolean).length;

  const suggestions: string[] = [];
  const weakAreas: ListingAnalysisWeakArea[] = [];

  let seo = 5;
  let conv = 5;
  let comp = 8;

  // --- SEO ---
  if (titleLen < 25) {
    seo -= 2;
    suggestions.push("Alargue o título (≥40–60 caracteres) com o produto + 1 benefício mensurável + palavra de cauda (ex.: «para X») sem repetir a mesma raiz 3 vezes.");
    weakAreas.push({ label: "Título", detail: "Título curto demais para competir em pesquisa e clareza.", severity: "high" });
  } else if (titleLen > 180 && platform === "amazon_us") {
    seo -= 1;
    suggestions.push("Na Amazon EUA o título costuma ter limite útil ~200 caracteres: remova redundâncias e sinónimos repetidos; mantenha as raízes mais pesquisadas no início.");
    weakAreas.push({ label: "Título", detail: "Título muito longo ou denso — risco de truncamento e de parecer «keyword stuffing».", severity: "medium" });
  } else if (titleLen >= 50 && titleLen <= 160) {
    seo += 1;
  }

  const titleWords = titleT.toLowerCase().split(/[^a-záàâãéêíóôõúç0-9]+/).filter((w) => w.length > 2);
  const uniqueTitle = new Set(titleWords);
  if (titleWords.length > 0 && uniqueTitle.size / titleWords.length < 0.45) {
    seo -= 2;
    suggestions.push("Reduza repetição da mesma palavra-chave no título; troque por sinónimos naturais ou especificações (tamanho, material, uso) que o comprador procura.");
    weakAreas.push({ label: "SEO (título)", detail: "Alta repetição de termos — parece stuffing e dilui legibilidade.", severity: "medium" });
  }

  if (bullets.length < 3) {
    seo -= 2;
    conv -= 2;
    suggestions.push(`Use pelo menos 3–5 bullets (plataforma ${platform}): cada um benefício em 1ª linha + prova (material, medida, uso) na mesma frase.`);
    weakAreas.push({ label: "Bullets", detail: "Poucos bullets — perde escaneabilidade e espaço para palavras de cauda.", severity: "high" });
  } else if (bullets.length >= 5) {
    seo += 1;
    conv += 1;
  }

  if (descWords < 60) {
    seo -= 1;
    conv -= 2;
    suggestions.push("Desenvolva a descrição (≥120–200 palavras): parágrafos curtos, objeções (compatibilidade, devolução, conteúdo da caixa), e diferenciação vs. alternativa genérica.");
    weakAreas.push({ label: "Descrição", detail: "Corpo muito fino — pouco material para SEO longo e para convencer quem lê até ao fim.", severity: "high" });
  } else if (descWords >= 120) {
    seo += 1;
    conv += 1;
  }

  if (!/\n\n/.test(descT) && descWords > 80) {
    conv -= 1;
    suggestions.push("Parta a descrição em blocos curtos (2–4 frases por parágrafo) e use negrito só em 3–5 frases-chave no editor da loja — melhora retenção em mobile.");
    weakAreas.push({ label: "Descrição", detail: "Pouca hierarquia visual — parede de texto afasta leitura rápida.", severity: "low" });
  }

  // --- Conversion ---
  const thinBullets = bullets.filter((b) => b.length < 45).length;
  if (bullets.length && thinBullets >= bullets.length * 0.6) {
    conv -= 2;
    suggestions.push("Alonge bullets fracos: cada um deve ter benefício explícito + detalhe verificável (ex.: «reduz ruído até X dB» só se for verdade no pack).");
    weakAreas.push({ label: "Bullets", detail: "Muitos bullets curtos e genéricos — pouca prova e pouco ganho em clique-to-cart.", severity: "medium" });
  }

  const allCapsTitle = titleT.length > 15 && titleT === titleT.toUpperCase();
  if (allCapsTitle && platform !== "tiktok_shop_us") {
    conv -= 1;
    suggestions.push("Evite título todo em MAIÚSCULAS (exceto se a plataforma o exigir): use capitalização normal para parecer listagem profissional e legível.");
    weakAreas.push({ label: "Título", detail: "MAIÚSCULAS excessivas — associadas a spam e baixa conversão.", severity: "medium" });
  }

  // --- Compliance ---
  const blob = `${titleT}\n${bulletsText}\n${descT}`;
  const red = [
    { re: /\b(cura|curam|curing|cures)\b/i, msg: "Evite linguagem médica tipo «cura»; use formulações compatíveis com políticas de saúde da plataforma." },
    { re: /\b(garantido|100%\s*garantido|guaranteed\s+cure|milagre|miracle)\b/i, msg: "Suavize garantias absolutas ou «milagre»; prefira «concebido para», «ajuda a», com limites honestos." },
    { re: /#\s*1\b|n[ºo]\.?\s*1\b|best\s+ever|o\s+melhor\s+do\s+mundo/i, msg: "Remova rankings não comprováveis («#1», «melhor do mundo») a menos que tenha fonte na própria listagem." },
    { re: /\b(fda\s+approved|rated\s+#1\s+by)\b/i, msg: "Não invoque aprovações ou prémios sem prova visível na listagem." },
  ];
  for (const { re, msg } of red) {
    if (re.test(blob)) {
      comp -= 2;
      suggestions.push(msg);
      weakAreas.push({ label: "Conformidade", detail: `Padrão sensível detectado (${re.source}) — rever antes de publicar.`, severity: "high" });
    }
  }

  if (/\$\s*\d|\d+\s*%\s*off\s*today\s*only|últimas\s+unidades\s+hoje/i.test(blob)) {
    comp -= 1;
    suggestions.push("Evite urgência falsa ou desconto inventado; use prazos reais de promoção ou remova o gatilho.");
    weakAreas.push({ label: "Conformidade", detail: "Linguagem de urgência/preço pode violar regras de anúncios ou de preço mínimo.", severity: "medium" });
  }

  seo = Math.max(0, Math.min(10, seo));
  conv = Math.max(0, Math.min(10, conv));
  comp = Math.max(0, Math.min(10, comp));

  if (suggestions.length < 5) {
    suggestions.push("Cruze o título com os bullets: cada bullet deve introduzir uma ideia nova (não repetir o subtítulo do título).");
    suggestions.push("Na descrição, feche com «O que vem na caixa» e «Compatibilidade» em bullets ou lista — reduz devoluções e aumenta confiança.");
    if (platform === "amazon_us") {
      suggestions.push("Reserve o campo de palavras-chave backend para raízes sem repetir o que já está no título e nos 5 bullets.");
    }
    if (platform === "mercado_livre_intl") {
      suggestions.push("Em ML internacional, antecipe envio/tributos na descrição se o produto vier de fora — reduz perguntas e abandono.");
    }
  }

  return {
    seoScore: Math.round(seo),
    conversionScore: Math.round(conv),
    complianceScore: Math.round(comp),
    suggestions: suggestions.slice(0, 10),
    weakAreas: weakAreas.slice(0, 8),
  };
}

function parseAnalysisJson(raw: string): ListingAnalysisResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const seoScore = clampScore(o.seoScore);
  const conversionScore = clampScore(o.conversionScore);
  const complianceScore = clampScore(o.complianceScore);
  const sug = o.suggestions;
  const weak = o.weakAreas;
  const suggestions = Array.isArray(sug)
    ? sug.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean).slice(0, 12)
    : [];
  const weakAreas: ListingAnalysisWeakArea[] = [];
  if (Array.isArray(weak)) {
    for (const item of weak) {
      if (!item || typeof item !== "object") continue;
      const w = item as Record<string, unknown>;
      const label = typeof w.label === "string" ? w.label.trim() : "";
      const detail = typeof w.detail === "string" ? w.detail.trim() : "";
      const sev = w.severity === "high" || w.severity === "medium" || w.severity === "low" ? w.severity : "medium";
      if (label && detail) weakAreas.push({ label, detail, severity: sev });
    }
  }
  if (suggestions.length === 0) return null;
  const pads = [
    "Alinhe o primeiro bullet com a promessa do título; os seguintes devem cobrir prova social, conteúdo da caixa, compatibilidade e política de devolução (quando aplicável).",
    "Insira na descrição um bloco curto «Perguntas frequentes» (3–5 linhas) com as dúvidas que o seu suporte já recebe — reduz atrito pós-clique.",
  ];
  let i = 0;
  while (suggestions.length < 5 && i < pads.length) {
    suggestions.push(pads[i]!);
    i += 1;
  }
  return {
    seoScore,
    conversionScore,
    complianceScore,
    suggestions,
    weakAreas: weakAreas.slice(0, 10),
  };
}

async function callOpenAiListingAnalysis(
  platform: ListingPlatformId,
  title: string,
  bullets: string,
  description: string,
): Promise<ListingAnalysisResult | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const userPayload = {
    platform,
    schema: {
      seoScore: "integer 0-10",
      conversionScore: "integer 0-10",
      complianceScore: "integer 0-10",
      suggestions: "array of strings, 5-10 items",
      weakAreas: "array of { label: string, detail: string, severity: 'high'|'medium'|'low' }",
    },
    listing: { title, bullets, description },
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
        { role: "system", content: LISTING_ANALYST_SYSTEM },
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
  return parseAnalysisJson(raw);
}

export function registerListingAnalysisRoutes(app: Express): void {
  app.post("/api/client/listing-analysis", requireUser, async (req: Request, res: Response) => {
    const b = (req.body && typeof req.body === "object" ? req.body : {}) as AnalysisBody;
    let title = typeof b.title === "string" ? b.title.trim() : "";
    let bullets = typeof b.bullets === "string" ? b.bullets.trim() : "";
    let description = typeof b.description === "string" ? b.description.trim() : "";
    const platformRaw = typeof b.platform === "string" ? b.platform.trim() : "";
    const listingUrl = typeof b.listingUrl === "string" ? b.listingUrl.trim() : "";

    if (listingUrl) {
      if (!isValidHttpListingUrl(listingUrl)) {
        res.status(400).json({ error: "URL inválida (http/https, 12–2048 caracteres)." });
        return;
      }
      const fetched = await fetchListingUrlPlainText(listingUrl);
      if (!fetched.ok) {
        res.status(400).json({ error: fetched.error });
        return;
      }
      const parsed = parseUnifiedListingText(fetched.text);
      title = parsed.title.slice(0, MAX_TITLE);
      bullets = parsed.bulletPoints.join("\n").slice(0, MAX_BULLETS);
      description = parsed.description.slice(0, MAX_DESCRIPTION);
    }

    if (!title && !bullets && !description) {
      res.status(400).json({ error: "Envie título, bullets, descrição ou uma URL (listingUrl)." });
      return;
    }
    if (title.length > MAX_TITLE || bullets.length > MAX_BULLETS || description.length > MAX_DESCRIPTION) {
      res.status(400).json({ error: "Texto demasiado longo." });
      return;
    }
    if (!isListingPlatformId(platformRaw)) {
      res.status(400).json({ error: "Plataforma inválida.", validPlatforms: [...LISTING_PLATFORM_IDS] });
      return;
    }
    const platform = platformRaw as ListingPlatformId;

    const runDemo = (): ListingAnalysisResult => heuristicListingAnalysis(platform, title, bullets, description);

    if (process.env.OPENAI_API_KEY?.trim()) {
      try {
        const ai = await callOpenAiListingAnalysis(platform, title, bullets, description);
        if (ai) {
          res.json({ ok: true, mode: "live", analysis: ai, platform });
          return;
        }
      } catch (e) {
        res.json({
          ok: true,
          mode: "demo",
          analysis: runDemo(),
          platform,
          warn: e instanceof Error ? e.message.slice(0, 240) : "openai_error",
        });
        return;
      }
    }

    res.json({ ok: true, mode: "demo", analysis: runDemo(), platform });
  });
}
