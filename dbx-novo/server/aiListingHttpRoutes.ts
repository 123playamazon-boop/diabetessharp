import type { Express, Request, Response } from "express";
import { requireUser } from "./authMiddleware";
import { fetchListingUrlPlainText } from "./listingUrlFetch";
import {
  LISTING_PLATFORM_IDS,
  isListingGeneratorOperation,
  isListingPlatformId,
  type ListingGeneratorOperation,
  type ListingPlatformId,
} from "../shared/listingGenerator";
import { isValidHttpListingUrl } from "../shared/listingUrlInput";

/** System instructions for live AI generation — benefits-first, SEO, compliance, platform tone. */
const LISTING_COPYWRITER_SYSTEM = `You are an elite e-commerce copywriter and marketplace optimization expert for Direct Box USA (DBX).

Your job is to create HIGH-CONVERTING product listings tailored for the requested platform.

You must:
- Lead with benefits, then support with concrete features and proof (materials, dimensions, use cases) only when grounded in the user’s inputs.
- Use persuasive, natural, scannable language — no robotic keyword stuffing.
- Weave in SEO-relevant terms organically in title, bullets, description, and the keywords field.
- Follow each platform’s listing and advertising compliance: no medical/disease cures, no guaranteed income or miracle results, no competitor brand names or trademark misuse, no exaggerated or misleading claims. If the user did not supply a fact, do not invent certifications, awards, ratings, or test results.
- Avoid superlatives you cannot justify from the inputs (e.g. “#1”, “best in the world”). Prefer “designed to”, “helps”, “supports”, “built for”.

Bullet points:
- Default (most platforms): exactly 5 bullets; each starts with a strong benefit-driven opening, then a short supporting clause.
- Walmart USA: exactly 5 bullets; each line pairs a clear benefit with a concrete feature (see Walmart appendix).
- Mercado Livre International: exactly 5 bullets; benefit + specification in Portuguese (see Mercado Livre appendix).
- TikTok Shop USA: exactly 3 to 5 bullets only; each line short and benefit-led; see platform appendix.
- Shopify: exactly 5 bullets; each line leads with a strong customer benefit tied to the brand story or product truth (see Shopify appendix).
- One idea per bullet where applicable; TikTok Shop may use at most one emoji in the entire listing (optional).

Structure and tone:
- Adapt title length, bullet style, and description rhythm to the platform (e.g. Amazon: keyword-aware title within reasonable length, policy-safe; TikTok Shop: punchy, mobile-first, impulse-friendly; Walmart: clear value and trust; Mercado Livre International: Portuguese (Brazil), objective and complete; Shopify: conversion-led DTC — headline + subheadline, brand storytelling, clear CTA).

Output format:
- Return ONLY valid JSON with keys: title (string), bulletPoints (array of strings), description (string), keywords (string), and hook (string).
- When "operation" is "improve_existing": same schema; primary source is the listing URL (optional server-fetched "listingPageText"). Optional "existingListing" is extra notes only.
- When "operation" is "improve_pasted": same schema; primary source is the user-pasted title, bullets, and description (see listingPageText). Optional "existingListing" is extra notes only. Preserve facts from the paste; fix compliance; do not invent specs, awards, or medical outcomes.
- For platformId "shopify": title is the main hero HEADLINE (H1); also include subheadline (string, one supporting line under the headline) and callToAction (string, short primary-button style phrase, honest urgency only if justified); set hook to "".
- For platformId "tiktok_shop_us": hook must be a non-empty attention-grabbing opening line; bulletPoints length must be 3, 4, or 5. For all other platforms except TikTok: set hook to an empty string "" and bulletPoints must contain exactly 5 strings.
- keywords: comma-separated; no competitor brand names; avoid repetition spam.
- No markdown fences or commentary outside the JSON.`;

/** When operation is improve_existing — rewrite pasted listing for SEO, conversion, and compliance. */
const IMPROVE_EXISTING_LISTING_APPEND = `
IMPROVE EXISTING LISTING mode (user JSON "operation": "improve_existing"):

The user provides the live listing URL in productContext (field listingUrl). The server may include "listingPageText" (plain text extracted from that URL). Optional "existingListing" is only extra notes from the user—not the primary source.

Produce the IMPROVED listing in the SAME JSON shape and platform rules as normal generation for the given platformId.

You must:
- Rewrite and optimize from the URL-derived text (and notes): clearer hierarchy, tighter sentences, stronger benefit order, remove redundancy, improve scannability.
- Improve SEO: natural search phrases in title, bullets, description, and a fresh deduped "keywords" field appropriate to the platform.
- Improve conversion: clearer value proposition, honest urgency only if justified, stronger CTA patterns where the platform allows (e.g. Shopify callToAction).
- Fix compliance: remove or soften prohibited claims (medical cures, miracle results, false scarcity, unverifiable “#1/best”, fake reviews), competitor trademark misuse in keywords; replace vague hype with supportable language.

Rules:
- Treat "listingPageText" (when present) as the main factual source; if fetch failed and only listingUrl is present, improve structure generically without inventing product facts.
- Optional fields in productContext (audience, benefit, differentiation) refine tone only—must not contradict visible listing facts.
- If critical specs are missing, use short bracket placeholders like "[add weight]" instead of inventing numbers.
- Output ONLY the JSON object—no audit trail, no markdown fences.`;

const IMPROVE_PASTED_LISTING_APPEND = `
IMPROVE PASTED LISTING mode (user JSON "operation": "improve_pasted"):

The user pasted their CURRENT listing in structured sections inside "listingPageText" (title, bullets, description). There is NO live product URL—treat the pasted copy as the factual baseline.

Produce the FULLY OPTIMIZED listing in the SAME JSON shape and platform rules as normal generation for the given platformId.

Goals:
- Increase conversion: clearer hierarchy, stronger benefit order, scannable bullets, remove redundancy, honest specificity.
- Improve SEO: natural search phrases in title, bullets, description, and a fresh deduped "keywords" field for the platform—no keyword stuffing.
- Fix compliance: remove or soften prohibited claims, false scarcity, unverifiable superlatives, medical miracles, competitor trademarks in keywords.

Rules:
- Preserve real specs, dimensions, pack contents, and variant names that appear in the paste; do not invent numbers or certifications.
- Optional "existingListingNotes" refines tone or constraints only—must not contradict the pasted listing facts.
- If a critical fact is missing from the paste, use a short bracket placeholder like "[add weight]" instead of inventing it.
- Output ONLY the JSON object—no markdown fences.`;

/** Extra rules when generating for Amazon.com (US). Appended to the system message only for platformId amazon_us. */
const AMAZON_US_LISTING_APPEND = `
Amazon USA ONLY (platformId "amazon_us") — produce a FULL listing:

1) Title
- Hard limit: 200 characters or fewer (count spaces and punctuation).
- Keyword-optimized for Amazon US search, still readable; do not use ALL CAPS for the title.

2) Bullet points — exactly 5
- Each bullet begins with a 2–4 WORD benefit hook in ALL CAPS, then an em dash " — ", then the rest in normal sentence case (not all caps).
- Order ideas for impact: problem/outcome, core benefit, differentiation, trust/contents or use case, compliance-safe reassurance.
- No exaggerated or unverifiable claims.

3) Product description
- Persuasive, easy to read: several short paragraphs, clear spacing; benefits first, then supporting features only from user inputs.

4) keywords field = Amazon-style backend search terms
- Comma-separated; relevant roots only; no duplicate or near-duplicate tokens; no competitor brand names; no promotional slogans; comply with Amazon restricted terms guidance.

General: no misleading health or performance guarantees; no invented certifications or review scores.`;

/** TikTok Shop USA — scroll + hook + short bullets + emotional body; mobile-first impulse framing. */
const TIKTOK_SHOP_LISTING_APPEND = `
TikTok Shop USA ONLY (platformId "tiktok_shop_us") — generate a mobile-first listing built for impulse buys:

1) Title (field "title")
- Scroll-stopping: curiosity, outcome, or tension—readable on a phone; avoid spam punctuation stacks; honest claims only.

2) Hook (field "hook" — REQUIRED, non-empty)
- One opening line that instantly grabs attention (single sentence; aim under ~180 characters).
- Must not be ALL CAPS; must not promise impossible results.

3) bulletPoints — array length MUST be 3, 4, or 5 only
- Each entry short (aim under ~95 characters); benefit-driven; scannable vertical rhythm for mobile thumb-stopping.

4) description
- Emotional and engaging: short paragraphs, airy spacing; builds desire after the hook without repeating the hook verbatim as the first sentence; still compliant—no fake urgency inventory lies, no medical miracles.

5) keywords
- Comma-separated discovery-style phrases; light, natural; no competitor trademarks.

6) Mobile-first + impulse
- Short clauses, clear payoff, low cognitive load; optional single emoji in the entire listing (title, hook, bullets, or description) — maximum one if used.

Also set hook to "" for non-TikTok platforms (never omit the key).`;

/** Walmart USA — clear value, benefit+feature bullets, informative copy; no hype. */
const WALMART_US_LISTING_APPEND = `
Walmart USA ONLY (platformId "walmart_us") — generate a trustworthy retail listing:

1) Title
- Clear, shopper-friendly US English; everyday value tone; easy to scan.
- No hype words (avoid “amazing”, “unbelievable”, “miracle”, “#1”, “best ever”); no false urgency; no ALL CAPS title.
- Keyword-aware but natural; stay grounded in the user’s inputs.

2) Bullet points — exactly 5
- Each bullet must pair a customer BENEFIT with a supporting FEATURE (concrete detail: material, fit, capacity, use case, or what’s included—only when tied to the user’s notes).
- Use a calm pattern such as “Benefit — feature.” or “Benefit: feature.” in sentence case.
- Short clauses; no stacked exclamation marks; no exaggerated performance claims.

3) Description
- Informative and persuasive: short paragraphs; lead with what the shopper needs to know, then why it’s a sensible buy; warm but not loud.
- No hype, no invented reviews, awards, or certifications.

4) keywords
- Comma-separated helpful search phrases; deduplicate; no competitor brand names; no promotional shouting.

General Walmart tone: plainspoken trust, value clarity, and compliance with honest advertising—no exaggerated claims.`;

/** Shopify DTC product page — conversion, brand story, structured hero + CTA. */
const SHOPIFY_LISTING_APPEND = `
Shopify product page ONLY (platformId "shopify") — US English, built to convert on your own storefront:

1) Headline (JSON key "title")
- Short, confident H1-style line: outcome or identity-led; grounded in user inputs; aim ~8–14 words; max ~90 characters if possible without sounding cramped.

2) Subheadline (JSON key "subheadline")
- One line directly under the headline: expands the promise, names who it’s for, or states the key proof—complements the headline without repeating it verbatim; max ~180 characters.

3) Bullet points — exactly 5 (JSON key "bulletPoints")
- Strong benefits first; each line can add a brief proof clause (material, fit, ritual, what’s included) only from user data.
- Scannable; no fake review quotes; no invented awards.

4) Description (JSON key "description")
- Brand storytelling + product clarity: opening that reflects the brand’s voice, middle that moves the reader toward purchase (benefits, differentiation, social proof only if user supplied it), and a short practical block (specs, what’s in the box, care, or variant prompts) without inventing numbers.
- Short paragraphs; mobile-friendly rhythm.

5) Call to action (JSON key "callToAction")
- One line suitable for a primary button or bold link line (e.g. “Add to cart — …” or “Choose your size — …”); specific, honest, aligned with inventory/variants the user can actually offer.

6) keywords
- Comma-separated terms for SEO/meta or internal tags; dedupe; no competitor trademarks.

Also set hook to "".

Rules: conversion focus without manipulation (no fake scarcity, no false “last one” claims); no medical miracles or guaranteed cures; no competitor brand names.`;

/** Mercado Livre International — PT-BR, SEO title, benefit+spec bullets, structured description + conditional disclaimers. */
const MERCADO_LIVRE_INTL_LISTING_APPEND = `
Mercado Livre International ONLY (platformId "mercado_livre_intl") — write ALL customer-facing fields in Portuguese (Brazil):

1) Title
- SEO-oriented: include relevant search terms naturally; readable; no misleading bait; aim max 200 characters when possible without sacrificing clarity.

2) Bullet points — exactly 5
- Each bullet pairs a clear BENEFIT with a SPEC or concrete detail (material, size, compatibility, contents, use case) grounded in the user’s inputs.
- Short lines, easy to scan (one main idea per bullet).

3) Description — must contain three labeled sections in this order:
   a) "Introdução" — context and who the product is for.
   b) "Benefícios" — what the buyer gains (honest, no hype).
   c) "Detalhes técnicos" — specs, inclusions, compatibility; if user data is missing, say what still needs to be filled before publish—do not invent numbers or certifications.

Conditional blocks (append in Portuguese, after the three sections — follow user flags exactly):

IF brandOwner is false:
- Append a final block titled "Aviso importante" with: product imported from the United States; legal acquisition, not manufacturer or official brand representative in Brazil; warranty limited to manufacturer in country of origin (may not apply in Brazil); product information based on manufacturer data.
- IF internationalProduct is true: include in that disclaimer the paragraph on international logistics, delivery variation, and possible taxes per Receita Federal rules. IF internationalProduct is false: do NOT claim international shipment or customs in the disclaimer.
- IF internationalProduct is true: after "Aviso importante", append a second block titled "Nota de reforço — envio e tributos" (3 short bullets): variable delivery by carrier/customs; import taxes/fees may be the buyer’s responsibility—check listing and Receita Federal; confirm shipping mode, estimated total, and seller return policy before purchase.

IF brandOwner is true AND internationalProduct is true:
- Append "Envio internacional" (shipment, delivery variation, taxation per Receita Federal, manufacturer-sourced copy).
- Then append "Nota de reforço — envio e tributos" as above.

IF brandOwner is true AND internationalProduct is false:
- No international-only blocks unless the user’s notes require neutral domestic-shipping wording.

Rules:
- No misleading claims; no invented seals, reviews, or rankings.
- Never imply the seller is the official brand when brandOwner is false.
- Set hook to "".
`;

/** Extra PT-BR reinforcement when internationalProduct is true (Mercado Livre). */
const MERCADO_INTL_REFORCO_ENVIO_TRIBUTOS_PT = `Nota de reforço — envio e tributos

• Prazo de entrega pode variar conforme modalidade de envio, alfândega e transportadora.
• Impostos e taxas de importação, quando aplicáveis, são de responsabilidade do comprador — verifique o anúncio no Mercado Livre e orientações da Receita Federal.
• Confirme no anúncio o custo final estimado, modalidade de envio e política de devolução do vendedor antes de concluir a compra.`;

/** Standard "Aviso importante" body for non–brand-owner; international paragraph only if internationalProduct. */
function buildMercadoDisclaimerNotBrandPt(internationalProduct: boolean): string {
  const parts: string[] = [
    "Produto importado dos Estados Unidos.",
    "",
    "Este anúncio refere-se a um produto original, adquirido legalmente no exterior. Não somos fabricantes nem representantes oficiais da marca no Brasil.",
    "",
    "A garantia, quando aplicável, é limitada ao fabricante no país de origem, podendo não ser válida no Brasil.",
  ];
  if (internationalProduct) {
    parts.push(
      "",
      "O produto é enviado via logística internacional, podendo sofrer variações no prazo de entrega e eventuais tributações conforme regras da Receita Federal.",
    );
  }
  parts.push("", "Todas as informações do produto são baseadas nos dados fornecidos pelo fabricante.");
  return parts.join("\n");
}

/** Envio + fonte dos dados when the seller is brand owner but product is international. */
const MERCADO_INTL_ENVIO_E_DADOS_FABRICANTE_PT = [
  "O produto é enviado via logística internacional, podendo sofrer variações no prazo de entrega e eventuais tributações conforme regras da Receita Federal.",
  "",
  "Todas as informações do produto são baseadas nos dados fornecidos pelo fabricante.",
].join("\n");

export type AiListingResult = {
  title: string;
  bulletPoints: string[];
  description: string;
  keywords: string;
  /** TikTok Shop USA: attention-grabbing opening line (required for that platform). */
  hook?: string;
  /** Shopify DTC: line under the hero headline. */
  subheadline?: string;
  /** Shopify DTC: primary button-style action line. */
  callToAction?: string;
};

type GenerateBody = {
  productName?: string;
  productUrl?: string;
  productDescription?: string;
  platform?: string;
  targetAudience?: string;
  mainBenefit?: string;
  productDifferentiation?: string;
  brandOwner?: boolean;
  internationalProduct?: boolean;
  /** "generate" (default) | "improve_existing" | "improve_pasted" */
  operation?: string;
  /** Optional extra notes when operation is improve_* (not the main source). */
  existingListing?: string;
  /** improve_pasted: structured paste. */
  listingTitle?: string;
  listingBullets?: string;
  listingDescription?: string;
};

const MIN_PASTED_LISTING_CHARS = 80;

/** Junta título, bullets e descrição colados para modo improve_pasted. */
function mergePastedListingBody(b: GenerateBody): string {
  const lt = typeof b.listingTitle === "string" ? b.listingTitle.trim() : "";
  const lb = typeof b.listingBullets === "string" ? b.listingBullets.trim() : "";
  const ld = typeof b.listingDescription === "string" ? b.listingDescription.trim() : "";
  if (lt || lb || ld) {
    return [`--- TÍTULO (listagem actual) ---\n${lt}`, `--- BULLETS ---\n${lb}`, `--- DESCRIÇÃO ---\n${ld}`].join("\n\n");
  }
  return typeof b.productDescription === "string" ? b.productDescription.trim() : "";
}

function isImproveOperation(op: ListingGeneratorOperation): boolean {
  return op === "improve_existing" || op === "improve_pasted";
}

function normalizeListingOperation(b: GenerateBody): ListingGeneratorOperation {
  const raw = typeof b.operation === "string" ? b.operation.trim() : "";
  return isListingGeneratorOperation(raw) ? raw : "generate";
}

function summarizeProduct(b: GenerateBody): string {
  const chunks: string[] = [];
  const n = typeof b.productName === "string" ? b.productName.trim() : "";
  const u = typeof b.productUrl === "string" ? b.productUrl.trim() : "";
  const d = typeof b.productDescription === "string" ? b.productDescription.trim() : "";
  if (n) chunks.push(`Product name: ${n}`);
  if (u) chunks.push(`Product URL / reference: ${u}`);
  if (d) chunks.push(`Product description / notes:\n${d}`);
  return chunks.join("\n\n");
}

function platformLabel(id: ListingPlatformId): string {
  switch (id) {
    case "amazon_us":
      return "Amazon USA";
    case "tiktok_shop_us":
      return "TikTok Shop USA";
    case "walmart_us":
      return "Walmart USA";
    case "mercado_livre_intl":
      return "Mercado Livre International";
    case "shopify":
      return "Shopify";
    default:
      return id;
  }
}

function listingLanguage(id: ListingPlatformId): "en" | "pt" {
  return id === "mercado_livre_intl" ? "pt" : "en";
}

function platformCopyGuidance(id: ListingPlatformId): string {
  switch (id) {
    case "amazon_us":
      return "Amazon USA: follow the AMAZON_US_LISTING_APPEND block in the system message exactly (title ≤200 chars; 5 bullets with 2–4 word ALL CAPS hook + em dash + sentence case body; persuasive scannable description; deduped backend-style keywords).";
    case "tiktok_shop_us":
      return "TikTok Shop USA: follow TIKTOK_SHOP_LISTING_APPEND in the system message (scroll-stopping title; required hook; 3–5 short benefit bullets; emotional mobile-first description; impulse-safe compliance).";
    case "walmart_us":
      return "Walmart USA: follow WALMART_US_LISTING_APPEND (clear title; 5 bullets benefit+feature; informative persuasive description; deduped keywords; no hype or exaggerated claims).";
    case "mercado_livre_intl":
      return "Mercado Livre International: use ONLY MERCADO_LIVRE_INTL_LISTING_APPEND. Respect brandOwner / internationalProduct (disclaimer if not brand owner; reinforce envio/tributos when international).";
    case "shopify":
      return "Shopify DTC: follow SHOPIFY_LISTING_APPEND (headline in title; required subheadline + callToAction; 5 benefit bullets; story-led description; conversion + brand voice; honest CTA).";
    default:
      return "";
  }
}

function dedupeCommaKeywords(keywords: string): string {
  const segments = keywords.split(",").map((s) => s.trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const seg of segments) {
    const key = seg.toLowerCase().replace(/\s+/g, " ");
    if (key.length < 2) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(seg);
  }
  return out.join(", ");
}

function amazonBackendKeywordsFromInputs(coreName: string, benefit: string, diff: string, audience: string): string {
  const blob = `${coreName} ${benefit} ${diff} ${audience}`.toLowerCase();
  const words = blob.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "your",
    "from",
    "you",
    "are",
    "our",
    "not",
    "but",
    "has",
    "have",
    "was",
    "were",
    "its",
    "any",
    "can",
    "may",
  ]);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    if (stop.has(w)) continue;
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= 45) break;
  }
  return out.join(", ");
}

function buildAmazonTitle(coreName: string, benefit: string, audience: string): string {
  const ben = benefit.replace(/\s+/g, " ").trim();
  const aud = audience.replace(/\s+/g, " ").trim();
  const primary = `${coreName} — ${ben}`.replace(/\s+/g, " ").trim();
  if (primary.length <= 200) return primary;
  const shorter = `${coreName} — ${ben.slice(0, 110)}`.replace(/\s+/g, " ").trim();
  if (shorter.length <= 200) return shorter;
  const withAud = `${coreName}. ${aud.slice(0, 90)}`.replace(/\s+/g, " ").trim();
  if (withAud.length <= 200) return withAud;
  return `${coreName} — ${ben.slice(0, 55)}`.replace(/\s+/g, " ").trim();
}

function buildAmazonTemplateBullets(
  benefit: string,
  diff: string,
  audience: string,
  brand: boolean,
  intl: boolean,
): string[] {
  return [
    `YOUR EVERYDAY WIN — ${benefit} Framed for ${audience} without overstating results.`,
    `CLEAR STANDOUT VALUE — ${diff} Support with specs and pack contents you publish on the detail page.`,
    brand
      ? `BRAND YOU CAN TRUST — Messaging suited to a brand-owner listing; claims only where you can verify them.`
      : `HONEST PRODUCT TRUTH — What’s included, what need it targets, and what it is not designed to do.`,
    intl
      ? `GLOBAL BUYER READY — When relevant, clarify compatibility, region, voltage, or import timing so expectations stay realistic.`
      : `SIMPLE TO START — What’s in the box and how it fits a typical day—written for fast Amazon scanning.`,
    `STAY POLICY SAFE — No miracle cures, no competitor trademarks in backend terms, and no all-caps sentences beyond the short hook at the start of each bullet.`,
  ];
}

function buildAmazonTemplateDescription(productBlock: string, benefit: string, diff: string, audience: string): string {
  const parts = [
    `You’re choosing an outcome, not just a box. ${benefit}`,
    `Here’s the honest difference: ${diff}`,
    `Who it’s for: ${audience}. We keep the tone persuasive but grounded—no invented awards, ratings, or guarantees.`,
  ];
  if (productBlock.trim()) {
    parts.push(`What you told us about the product:\n${productBlock}`);
  }
  parts.push(
    "Before you publish on Amazon: add accurate dimensions, materials, safety notices for your category, warranty terms, and exactly what’s in the box. Double-check Amazon’s current listing policies for your product type.",
  );
  return parts.join("\n\n");
}

function enforceAmazonUsOutput(r: AiListingResult): AiListingResult {
  let title = r.title.replace(/\s+/g, " ").trim();
  if (title.length > 200) title = `${title.slice(0, 197).trimEnd()}…`;
  const kw = dedupeCommaKeywords(r.keywords || "");
  return {
    ...r,
    title,
    keywords: kw.length ? kw : r.keywords,
  };
}

/**
 * Platform-based prompt rules: exactly one appendix is merged per request.
 * IF amazon_us → Amazon append; IF tiktok_shop_us → TikTok; IF walmart_us → Walmart;
 * IF mercado_livre_intl → Mercado (conditionals for disclaimer / intl inside that append);
 * IF shopify → Shopify.
 */
function appendPlatformListingPrompt(platform: ListingPlatformId): string {
  switch (platform) {
    case "amazon_us":
      return `\n\n${AMAZON_US_LISTING_APPEND}`;
    case "tiktok_shop_us":
      return `\n\n${TIKTOK_SHOP_LISTING_APPEND}`;
    case "walmart_us":
      return `\n\n${WALMART_US_LISTING_APPEND}`;
    case "mercado_livre_intl":
      return `\n\n${MERCADO_LIVRE_INTL_LISTING_APPEND}`;
    case "shopify":
      return `\n\n${SHOPIFY_LISTING_APPEND}`;
    default:
      return "";
  }
}

function buildListingSystemPrompt(platform: ListingPlatformId, operation: ListingGeneratorOperation): string {
  const improve =
    operation === "improve_existing"
      ? `\n\n${IMPROVE_EXISTING_LISTING_APPEND}`
      : operation === "improve_pasted"
        ? `\n\n${IMPROVE_PASTED_LISTING_APPEND}`
        : "";
  return LISTING_COPYWRITER_SYSTEM + appendPlatformListingPrompt(platform) + improve;
}

function buildWalmartTitle(coreName: string, benefit: string): string {
  const t = `${coreName} — ${benefit}`.replace(/\s+/g, " ").trim();
  const shorter = t.length <= 175 ? t : `${coreName} — ${benefit.slice(0, 120)}`.replace(/\s+/g, " ").trim();
  return shorter.length <= 175 ? shorter : `${shorter.slice(0, 172).trimEnd()}…`;
}

function buildWalmartTemplateBullets(
  benefit: string,
  diff: string,
  audience: string,
  brand: boolean,
  intl: boolean,
): string[] {
  const audShort = audience.length > 70 ? `${audience.slice(0, 67)}…` : audience;
  return [
    `Enjoy ${benefit.slice(0, 85)}${benefit.length > 85 ? "…" : ""} — structured layout and copy you can tighten with exact dimensions and materials from your notes.`,
    `Made with ${audShort} in mind — ${diff.slice(0, 95)}${diff.length > 95 ? "…" : ""}: say plainly what differs from generic alternatives.`,
    `Know what you’re bringing home — list pack contents, warranty, and size or color options on Walmart before you go live (this draft reflects only your inputs).`,
    brand
      ? `Buy from a brand listing — keep claims to what the brand can verify; add model numbers or care steps where shoppers expect them.`
      : `Straight talk, not flash — each benefit ties to a feature you can show or measure; avoid empty superlatives.`,
    intl
      ? `Cross-border clarity when it applies — note plug type, voltage, region fit, or import timing only if relevant to this product.`
      : `Everyday reliability — short guidance on use, returns, and support in the tone Walmart shoppers trust.`,
  ];
}

function buildWalmartTemplateDescription(productBlock: string, benefit: string, diff: string, audience: string): string {
  const parts = [
    `Here’s the straight story: ${benefit} We keep the tone informative first—so you can compare quickly—then a light nudge on why it’s a sensible pick.`,
    `Who it fits: ${audience}. What sets it apart: ${diff}`,
    "Walmart shoppers reward clarity: what it does, what it doesn’t promise, and what to check before you buy (size, compatibility, what’s in the box).",
  ];
  if (productBlock.trim()) {
    parts.push(`Details you provided (verify before publish):\n${productBlock}`);
  }
  parts.push(
    "No hype rule: skip miracle language, fake scarcity, and unproven rankings. If you add numbers (battery life, weight, capacity), source them from your product facts.",
  );
  return parts.join("\n\n");
}

function buildWalmartTemplateListing(
  productBlock: string,
  coreName: string,
  benefit: string,
  diff: string,
  audience: string,
  brand: boolean,
  intl: boolean,
): AiListingResult {
  const title = buildWalmartTitle(coreName, benefit);
  const bullets = buildWalmartTemplateBullets(benefit, diff, audience, brand, intl);
  const description = buildWalmartTemplateDescription(productBlock, benefit, diff, audience);
  const kwRaw = `${amazonBackendKeywordsFromInputs(coreName, benefit, diff, audience)}, everyday value, walmart`;
  const keywords = dedupeCommaKeywords(kwRaw).slice(0, 499);
  return { title, bulletPoints: bullets, description, keywords };
}

function enforceWalmartOutput(r: AiListingResult): AiListingResult {
  let title = r.title.replace(/\s+/g, " ").trim();
  if (title.length > 175) title = `${title.slice(0, 172).trimEnd()}…`;
  const kw = dedupeCommaKeywords(r.keywords || "");
  return { ...r, title, keywords: kw.length ? kw : r.keywords };
}

function buildShopifyHeadline(coreName: string, benefit: string): string {
  let h = `${coreName} — ${benefit}`.replace(/\s+/g, " ").trim();
  if (h.length > 90) h = `${coreName}: ${benefit.slice(0, 52)}`.replace(/\s+/g, " ").trim();
  if (h.length > 90) h = `${h.slice(0, 87).trimEnd()}…`;
  return h;
}

function buildShopifySubheadline(benefit: string, diff: string, audience: string): string {
  const aud0 = audience.split(",")[0]?.trim() || audience;
  let s = `Built for ${aud0}: ${benefit} ${diff}`.replace(/\s+/g, " ").trim();
  if (s.length > 180) s = `${s.slice(0, 177).trimEnd()}…`;
  return s;
}

function buildShopifyTemplateBullets(
  benefit: string,
  diff: string,
  audience: string,
  brand: boolean,
  intl: boolean,
): string[] {
  return [
    `${benefit.slice(0, 100)}${benefit.length > 100 ? "…" : ""} — own the outcome with rituals and specs you’ll tighten from your product facts.`,
    `${diff.slice(0, 100)}${diff.length > 100 ? "…" : ""} — the “why us” line shoppers remember when they compare tabs.`,
    `Made with ${audience.slice(0, 75)}${audience.length > 75 ? "…" : ""} in mind — less friction from cart to doorstep.`,
    brand
      ? `Brand-native story — voice, guarantees, and care notes that match what only you control on Shopify.`
      : `Honest curation — say where it shines, where it doesn’t, and what to verify before checkout.`,
    intl
      ? `Global-ready — call out plug, region, duties, or timelines only if true for this SKU; link out to policy pages for the rest.`
      : `Trust the flow — shipping, returns, and support live in your store policies; this page sells the promise.`,
  ];
}

function buildShopifyTemplateDescription(
  productBlock: string,
  coreName: string,
  benefit: string,
  diff: string,
  audience: string,
  brand: boolean,
): string {
  const benLower = benefit.length ? benefit.charAt(0).toLowerCase() + benefit.slice(1) : benefit;
  const story = brand
    ? `We built ${coreName} because ${benLower} It’s the through-line in how we show up—on the site, in the box, and after you click buy.`
    : `This is ${coreName}—chosen for ${benLower} We keep the story tight: what you feel first, what earns a spot in your day, and what to double-check before you commit.`;
  const mid = `Differentiation you can stand behind: ${diff} If you have press, awards, or certifications, paste them here with links—never invent proof.`;
  const who = `Who it’s for: ${audience}. Keep scrolling for the details that finish the sale (measurements, materials, what ships together).`;
  const parts = [story, mid, who];
  if (productBlock.trim()) parts.push(`Notes from your brief:\n${productBlock}`);
  parts.push(
    "Conversion check: add social proof you actually have, variant names shoppers understand, and a secondary CTA (learn more / compare) if your theme supports it.",
  );
  return parts.join("\n\n");
}

function buildShopifyCallToAction(coreName: string, benefit: string): string {
  let cta = `Add to cart — bring home ${coreName}`.replace(/\s+/g, " ").trim();
  const alt = `Choose yours — ${benefit.slice(0, 60)}${benefit.length > 60 ? "…" : ""}`.replace(/\s+/g, " ").trim();
  cta = cta.length <= 100 ? cta : alt;
  if (cta.length > 100) cta = `${cta.slice(0, 97).trimEnd()}…`;
  return cta;
}

function buildShopifyTemplateListing(
  productBlock: string,
  coreName: string,
  benefit: string,
  diff: string,
  audience: string,
  brand: boolean,
  intl: boolean,
): AiListingResult {
  const title = buildShopifyHeadline(coreName, benefit);
  const subheadline = buildShopifySubheadline(benefit, diff, audience);
  const callToAction = buildShopifyCallToAction(coreName, benefit);
  const bullets = buildShopifyTemplateBullets(benefit, diff, audience, brand, intl);
  const description = buildShopifyTemplateDescription(productBlock, coreName, benefit, diff, audience, brand);
  const kwRaw = `${amazonBackendKeywordsFromInputs(coreName, benefit, diff, audience)}, shopify, dtc, buy online`;
  const keywords = dedupeCommaKeywords(kwRaw).slice(0, 499);
  return { title, subheadline, callToAction, bulletPoints: bullets, description, keywords };
}

function enforceShopifyOutput(r: AiListingResult): AiListingResult {
  let title = r.title.replace(/\s+/g, " ").trim();
  if (title.length > 90) title = `${title.slice(0, 87).trimEnd()}…`;
  let sub = (r.subheadline ?? "").replace(/\s+/g, " ").trim();
  if (!sub) sub = "Discover the details below—crafted from what you told us about this product.";
  if (sub.length > 200) sub = `${sub.slice(0, 197).trimEnd()}…`;
  let cta = (r.callToAction ?? "").replace(/\s+/g, " ").trim();
  if (!cta) cta = "Add to cart — update this line to match your checkout wording.";
  if (cta.length > 120) cta = `${cta.slice(0, 117).trimEnd()}…`;
  const kw = dedupeCommaKeywords(r.keywords || "");
  return { ...r, title, subheadline: sub, callToAction: cta, keywords: kw.length ? kw : r.keywords };
}

function mercadoIntlKeywordsFromInputs(coreName: string, benefit: string, diff: string, audience: string): string {
  const blob = `${coreName} ${benefit} ${diff} ${audience} mercado livre internacional produto importado envio`.toLowerCase();
  const words = blob
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^a-z0-9]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length > 48) break;
  }
  return dedupeCommaKeywords(out.join(", "));
}

function buildMercadoIntlTitle(coreName: string, benefit: string, audience: string): string {
  const audFirst = audience.split(",")[0]?.trim() || audience;
  let t = `${coreName} — ${benefit} | ${audFirst}`.replace(/\s+/g, " ").trim();
  if (t.length > 200) t = `${coreName} — ${benefit.slice(0, 110)}`.replace(/\s+/g, " ").trim();
  if (t.length > 200) t = `${t.slice(0, 197).trimEnd()}…`;
  return t;
}

function buildMercadoIntlTemplateBullets(
  benefit: string,
  diff: string,
  audience: string,
  brand: boolean,
  intl: boolean,
): string[] {
  const ben = benefit.length > 92 ? `${benefit.slice(0, 89)}…` : benefit;
  const df = diff.length > 92 ? `${diff.slice(0, 89)}…` : diff;
  const aud = audience.length > 78 ? `${audience.slice(0, 75)}…` : audience;
  return [
    `${ben} — confira no anúncio final medidas, voltagem (se houver) e conteúdo exato da embalagem com base no produto real.`,
    `${df} — substitua qualquer estimativa por números e materiais da sua ficha técnica antes de publicar.`,
    `Público ideal: ${aud} — indique variantes (cor, tamanho, modelo) disponíveis no Mercado Livre.`,
    brand
      ? `Comunicação honesta — só prometa o que a titularidade da marca e a legislação permitem comprovar.`
      : `Revenda transparente — descreva condição, origem e suporte sem se apresentar como marca oficial.`,
    intl
      ? `Envio internacional — prazos e tributos podem variar; alinhe ao modo de envio e política do seu anúncio real.`
      : `Logística — deixe claro prazos e opções de envio conforme o que você oferece neste anúncio.`,
  ];
}

function buildMercadoIntlDescription(
  productBlock: string,
  coreName: string,
  benefit: string,
  diff: string,
  audience: string,
  brand: boolean,
  intl: boolean,
): string {
  const introBody = `Olá! Aqui você encontra informações sobre ${coreName}, pensado para ${audience}. Este rascunho é baseado apenas no que foi informado — ajuste fotos, vídeo e especificações finais antes de publicar.`;

  const benef = `Benefícios\n\n• ${benefit}\n• ${diff}\n• Clareza na hora de decidir — sem promessas que você não possa sustentar com ficha técnica e conteúdo da embalagem.`;

  const techBody = productBlock.trim()
    ? `Use os dados abaixo como base e complete dimensões exatas, voltagem, peso, SKU e itens inclusos antes de publicar:\n\n${productBlock}`
    : "Antes de publicar, insira na publicação final: dimensões, peso, voltagem/plug, materiais, itens inclusos e compatibilidades — conforme o produto real.";

  let tail = "";
  if (!brand) {
    tail += `\n\nAviso importante\n\n${buildMercadoDisclaimerNotBrandPt(intl)}`;
    if (intl) {
      tail += `\n\n${MERCADO_INTL_REFORCO_ENVIO_TRIBUTOS_PT}`;
    }
  } else if (intl) {
    tail += `\n\nEnvio internacional\n\n${MERCADO_INTL_ENVIO_E_DADOS_FABRICANTE_PT}\n\n${MERCADO_INTL_REFORCO_ENVIO_TRIBUTOS_PT}`;
  }

  return `Introdução\n\n${introBody}\n\n---\n\n${benef}\n\n---\n\nDetalhes técnicos\n\n${techBody}${tail}`;
}

function buildMercadoIntlTemplateListing(
  productBlock: string,
  coreName: string,
  benefit: string,
  diff: string,
  audience: string,
  brand: boolean,
  intl: boolean,
): AiListingResult {
  const title = buildMercadoIntlTitle(coreName, benefit, audience);
  const bullets = buildMercadoIntlTemplateBullets(benefit, diff, audience, brand, intl);
  const description = buildMercadoIntlDescription(productBlock, coreName, benefit, diff, audience, brand, intl);
  const keywords = mercadoIntlKeywordsFromInputs(coreName, benefit, diff, audience).slice(0, 499);
  return { title, bulletPoints: bullets, description, keywords };
}

function enforceMercadoIntlOutput(r: AiListingResult): AiListingResult {
  let title = r.title.replace(/\s+/g, " ").trim();
  if (title.length > 200) title = `${title.slice(0, 197).trimEnd()}…`;
  const kw = dedupeCommaKeywords(r.keywords || "");
  return { ...r, title, keywords: kw.length ? kw : r.keywords };
}

function buildTikTokTemplateListing(
  productBlock: string,
  coreName: string,
  benefit: string,
  diff: string,
  audience: string,
  brand: boolean,
  intl: boolean,
): AiListingResult {
  const cn = coreName.replace(/\s+/g, " ").trim();
  const ben = benefit.replace(/\s+/g, " ").trim();
  const aud = audience.replace(/\s+/g, " ").trim();
  const df = diff.replace(/\s+/g, " ").trim();

  const title = `The ${cn.slice(0, 42)} you’ll actually use — ${ben.slice(0, 52)}`.replace(/\s+/g, " ").trim().slice(0, 120);
  const hook = `Wait… ${ben.slice(0, 88)}${ben.length > 88 ? "…" : ""} Made for ${aud.slice(0, 52)}${aud.length > 52 ? "…" : ""}—your “add to cart” moment starts here.`
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);

  const bullets = [
    `${ben.slice(0, 78)} — quick win you feel right away.`,
    `${df.slice(0, 78)} — not the same boring pick.`,
    brand ? `Backed by the brand owner — less mystery, more trust.` : `Honest listing energy — we say what it does.`,
    intl ? `Buying across borders? Check fit, voltage, and region before checkout.` : `Fast-feel flow — clear, tight, built for thumb-scrolling.`,
  ];

  const descParts = [
    `That little spark when something finally feels worth it? We’re channeling it—without fake hype or invented proof.`,
    `${ben} We’re centering ${aud} because TikTok Shop rewards listings that match the vibe people are already in.`,
    `The flex isn’t exaggeration—it’s ${df.charAt(0).toLowerCase()}${df.slice(1)}`,
  ];
  if (productBlock.trim()) {
    descParts.push(`What you shared (keep it truthful on publish):\n${productBlock}`);
  }
  descParts.push(
    "Write for a phone screen: short beats, emotion, then the practical “what you get.” Impulse is the goal; trust is the guardrail—no fake reviews, no miracle cures, no false scarcity.",
  );
  const description = descParts.join("\n\n");

  const keywords = dedupeCommaKeywords(
    [cn, ben.split(/\s+/).slice(0, 5).join(" "), "tiktok shop", "fyp", "must have", aud.split(/\s+/).slice(0, 4).join(" ")].join(", "),
  ).slice(0, 400);

  return { title, hook, bulletPoints: bullets, description, keywords };
}

function enforceTikTokOutput(r: AiListingResult): AiListingResult {
  let title = r.title.replace(/\s+/g, " ").trim();
  if (title.length > 140) title = `${title.slice(0, 137).trimEnd()}…`;
  let hook = (r.hook ?? "").replace(/\s+/g, " ").trim();
  if (hook.length > 180) hook = `${hook.slice(0, 177).trimEnd()}…`;
  const bp = r.bulletPoints
    .slice(0, 5)
    .map((b) => (b.length > 115 ? `${b.slice(0, 112).trimEnd()}…` : b));
  while (bp.length < 3) bp.push("—");
  return { ...r, title, hook, bulletPoints: bp };
}

function buildTemplateBullets(
  platform: ListingPlatformId,
  lang: "en" | "pt",
  benefit: string,
  diff: string,
  audience: string,
  brand: boolean,
  intl: boolean,
): string[] {
  const plat = platformLabel(platform);
  if (lang === "pt" && platform !== "mercado_livre_intl") {
    return [
      `Tenha o melhor da sua rotina — ${benefit}, pensado para ${audience}.`,
      `Compre com critério — ${diff}`,
      brand
        ? "Compre da marca certa — comunicação e suporte alinhados ao vendedor/fabricante indicado nos seus dados."
        : "Transparência que ajuda a decidir — descreva no anúncio o que vem na caixa e o que o produto faz de fato.",
      intl
        ? "Compra internacional sem surpresas — deixe explícito o que o comprador precisa saber (compatibilidade, voltagem, prazo, garantia) com base nos seus dados."
        : "Logística e pós-venda claras — prazos e condições alinhados ao que você pode cumprir.",
      `Publique com segurança no ${plat} — benefícios primeiro, depois especificações; sem alegações que você não possa comprovar.`,
    ];
  }

  const trust = brand
    ? "Buy with confidence from the brand side — messaging stays consistent with what only you can promise."
    : "Shop smarter — we spell out what you get and what problem it solves, based on your inputs only.";

  const ship = intl
    ? "Ship and use with clarity — if cross-border, state compatibility, region, voltage, or lead times only when relevant to your product type."
    : "Get it and use it sooner — fulfillment and support expectations stated plainly for your market.";

  switch (platform) {
    case "shopify":
      return [
        `Love your routine more — ${benefit}, crafted with ${audience} in mind.`,
        `Stand out on your store — ${diff}`,
        trust,
        ship,
        `Shopify-ready storytelling — lead with benefits, weave keywords naturally, then guide shoppers to variants, care, and what’s in the box.`,
      ];
    default:
      return [
        `Experience the outcome buyers want — ${benefit}; built with ${audience} in mind.`,
        `See why it’s not generic — ${diff}`,
        trust,
        ship,
        `List responsibly on ${plat} — benefits first, features as proof; keywords for search intent only; follow marketplace rules and avoid unverifiable superlatives.`,
      ];
  }
}

/**
 * Demo «melhorar»: evita usar o URL cru como nome do produto (título e keywords deixavam de parecer listagem).
 * Preferimos texto obtido da página; senão um rótulo neutro.
 */
function improveDemoCoreName(b: GenerateBody, platform: ListingPlatformId): string {
  const lang = listingLanguage(platform);
  const n = typeof b.productName === "string" ? b.productName.trim() : "";
  if (n) return n.slice(0, 120);
  const d = typeof b.productDescription === "string" ? b.productDescription.trim() : "";
  let body = d.replace(/^---[\s\S]*?---\s*\n?/m, "").trim();
  const lines = body.split("\n").map((x) => x.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.length < 10) continue;
    if (/^https?:\/\//i.test(line)) continue;
    if (/^---\s*$/.test(line)) continue;
    if (/não foi possível obter o html/i.test(line)) continue;
    if (/could not obtain|unable to fetch/i.test(line)) continue;
    const cleaned = line.replace(/^[-•\d.)]+\s*/, "").trim().slice(0, 120);
    if (cleaned.length >= 10) return cleaned;
  }
  return lang === "pt" ? "Anúncio a melhorar" : "Listing to improve";
}

/** Demo path: productDescription already contains URL scrape + optional notes; OpenAI does full rewrite. */
function buildTemplateImproveListing(b: GenerateBody, platform: ListingPlatformId): AiListingResult {
  const lang = listingLanguage(platform);
  const core = improveDemoCoreName(b, platform);
  const merged: GenerateBody = {
    ...b,
    productName: core,
    productDescription:
      b.productDescription?.trim() ||
      (typeof b.productUrl === "string" && b.productUrl.trim() ? `URL do anúncio:\n${b.productUrl.trim()}` : ""),
  };
  const base = buildTemplateListing(merged, platform);
  const demoNote =
    lang === "pt"
      ? "【Demo — melhorar anúncio】 Esta saída combina o modelo local com o texto fornecido (URL ou colagem) e notas opcionais. Com OPENAI_API_KEY ativa, o servidor reescreve por completo (SEO, conversão e conformidade).\n\n"
      : "【Demo — improve listing】 This output blends the local template with your provided listing text (URL scrape or paste) and optional notes. With OPENAI_API_KEY enabled, the server performs a full rewrite for SEO, conversion, and compliance.\n\n";
  const titlePrefixed = base.title.startsWith("↻ ") ? base.title : `↻ ${base.title}`;
  let result: AiListingResult = {
    ...base,
    title: titlePrefixed.slice(0, 250),
    description: `${demoNote}${base.description}`,
    keywords: dedupeCommaKeywords(`${base.keywords}, listing refresh, seo rewrite, compliance`).slice(0, 499),
  };
  if (platform === "amazon_us") return enforceAmazonUsOutput(result);
  if (platform === "tiktok_shop_us") return enforceTikTokOutput(result);
  if (platform === "walmart_us") return enforceWalmartOutput(result);
  if (platform === "mercado_livre_intl") return enforceMercadoIntlOutput(result);
  if (platform === "shopify") return enforceShopifyOutput(result);
  return result;
}

function buildTemplateListing(b: GenerateBody, platform: ListingPlatformId): AiListingResult {
  const lang = listingLanguage(platform);
  const productBlock = summarizeProduct(b);
  const coreName =
    (typeof b.productName === "string" ? b.productName.trim() : "") ||
    (typeof b.productUrl === "string" ? b.productUrl.trim().slice(0, 80) : "") ||
    (typeof b.productDescription === "string" ? b.productDescription.trim().slice(0, 60) : "") ||
    (lang === "pt" ? "Seu produto" : "Your product");
  const audience =
    (typeof b.targetAudience === "string" ? b.targetAudience.trim() : "") ||
    (lang === "pt" ? "Compradores online em busca de valor e confiança." : "Online shoppers looking for value and trust.");
  const benefit =
    (typeof b.mainBenefit === "string" ? b.mainBenefit.trim() : "") ||
    (lang === "pt" ? "Benefício principal claro e mensurável." : "A clear, compelling primary benefit.");
  const diff =
    (typeof b.productDifferentiation === "string" ? b.productDifferentiation.trim() : "") ||
    (lang === "pt" ? "Diferenciação autêntica em relação a alternativas genéricas." : "Authentic differentiation vs. generic alternatives.");
  const brand = platform === "mercado_livre_intl" && b.brandOwner === true;
  const intl = platform === "mercado_livre_intl" && b.internationalProduct === true;
  const plat = platformLabel(platform);

  if (platform === "amazon_us" && lang === "en") {
    const titleA = buildAmazonTitle(coreName, benefit, audience);
    const titleFinal = titleA.length > 200 ? `${titleA.slice(0, 197).trimEnd()}…` : titleA;
    return {
      title: titleFinal,
      bulletPoints: buildAmazonTemplateBullets(benefit, diff, audience, brand, intl),
      description: buildAmazonTemplateDescription(productBlock, benefit, diff, audience),
      keywords: dedupeCommaKeywords(amazonBackendKeywordsFromInputs(coreName, benefit, diff, audience)).slice(0, 499),
    };
  }

  if (platform === "tiktok_shop_us" && lang === "en") {
    return buildTikTokTemplateListing(productBlock, coreName, benefit, diff, audience, brand, intl);
  }

  if (platform === "walmart_us" && lang === "en") {
    return buildWalmartTemplateListing(productBlock, coreName, benefit, diff, audience, brand, intl);
  }

  if (platform === "shopify" && lang === "en") {
    return buildShopifyTemplateListing(productBlock, coreName, benefit, diff, audience, brand, intl);
  }

  if (platform === "mercado_livre_intl" && lang === "pt") {
    return buildMercadoIntlTemplateListing(productBlock, coreName, benefit, diff, audience, brand, intl);
  }

  const titleEn = `${coreName} — ${benefit.slice(0, 80)}${benefit.length > 80 ? "…" : ""} | ${plat}`;
  const titlePt = `${coreName} — ${benefit.slice(0, 70)}${benefit.length > 70 ? "…" : ""} (${plat})`;
  let title = (lang === "pt" ? titlePt : titleEn).replace(/\s+/g, " ").trim();
  if (title.length > 200) title = title.slice(0, 197) + "…";

  const bullets = buildTemplateBullets(platform, lang, benefit, diff, audience, brand, intl);

  const descEn = `Channel: ${plat}.\n\n${productBlock ? `Source inputs:\n${productBlock}\n\n` : ""}Benefit-led story:\n${benefit}\n\nDifferentiation (fact-based from your notes):\n${diff}\n\nWho it’s for:\n${audience}\n\nCompliance note: Do not publish claims you cannot substantiate. Add accurate specs, pack contents, warranty, and variant options per ${plat} rules before going live.`;

  const descPt = `Canal: ${plat}.\n\n${productBlock ? `Entradas usadas:\n${productBlock}\n\n` : ""}História orientada a benefício:\n${benefit}\n\nDiferenciação (com base no que você informou):\n${diff}\n\nPúblico:\n${audience}\n\nConformidade: não publique alegações que não possa comprovar. Inclua especificações corretas, conteúdo da embalagem, garantia e variantes conforme as regras do ${plat}.`;

  const kwEn = `${coreName}, ${benefit.split(/\s+/).slice(0, 4).join(" ")}, ${diff.split(/\s+/).slice(0, 5).join(" ")}, ${audience.split(/\s+/).slice(0, 4).join(" ")}, ${plat.replace(/\s+/g, " ")}`
    .toLowerCase()
    .replace(/[^a-z0-9,\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const kwPt = `${coreName}, ${benefit.split(/\s+/).slice(0, 4).join(" ")}, ${diff.split(/\s+/).slice(0, 5).join(" ")}, ${audience.split(/\s+/).slice(0, 4).join(" ")}, mercado livre internacional`
    .toLowerCase()
    .replace(/[^a-záàâãéêíóôõúç0-9,\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    title,
    bulletPoints: bullets,
    description: lang === "pt" ? descPt : descEn,
    keywords: lang === "pt" ? kwPt.slice(0, 500) : kwEn.slice(0, 500),
  };
}

async function callOpenAiListing(
  b: GenerateBody,
  platform: ListingPlatformId,
  operation: ListingGeneratorOperation,
): Promise<AiListingResult | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const productContext = summarizeProduct(b);
  const listingUrl = operation === "improve_existing" && typeof b.productUrl === "string" ? b.productUrl.trim() : "";
  const listingPageText =
    isImproveOperation(operation) && typeof b.productDescription === "string" ? b.productDescription.trim().slice(0, 24_000) : "";
  const existingListing =
    isImproveOperation(operation) && typeof b.existingListing === "string" ? b.existingListing.trim().slice(0, 8000) : "";
  const userPayload = {
    operation,
    platform: platformLabel(platform),
    platformId: platform,
    platformGuidance: platformCopyGuidance(platform),
    productContext,
    ...(isImproveOperation(operation)
      ? {
          ...(operation === "improve_existing" && listingUrl ? { listingUrl } : {}),
          ...(listingPageText ? { listingPageText } : {}),
          ...(existingListing ? { existingListingNotes: existingListing } : {}),
        }
      : {}),
    targetAudience: typeof b.targetAudience === "string" ? b.targetAudience.trim() : "",
    mainBenefit: typeof b.mainBenefit === "string" ? b.mainBenefit.trim() : "",
    productDifferentiation: typeof b.productDifferentiation === "string" ? b.productDifferentiation.trim() : "",
    brandOwner: platform === "mercado_livre_intl" && b.brandOwner === true,
    internationalProduct: platform === "mercado_livre_intl" && b.internationalProduct === true,
    outputLanguage: listingLanguage(platform) === "pt" ? "Portuguese (Brazil)" : "English (US)",
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.55,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: buildListingSystemPrompt(platform, operation),
        },
        {
          role: "user",
          content: JSON.stringify(userPayload),
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenAI HTTP ${res.status}: ${errText.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const description = typeof o.description === "string" ? o.description.trim() : "";
  const keywords = typeof o.keywords === "string" ? o.keywords.trim() : "";
  const hookRaw = typeof o.hook === "string" ? o.hook.trim() : "";
  const subheadlineRaw = typeof o.subheadline === "string" ? o.subheadline.trim() : "";
  const callToActionRaw = typeof o.callToAction === "string" ? o.callToAction.trim() : "";
  const bp = o.bulletPoints;
  const bulletPoints = Array.isArray(bp)
    ? bp.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean).slice(0, 8)
    : [];
  if (!title || !description) return null;

  if (platform === "tiktok_shop_us") {
    while (bulletPoints.length < 3) bulletPoints.push("—");
    if (bulletPoints.length > 5) bulletPoints.length = 5;
    if (!hookRaw) return null;
  } else {
    while (bulletPoints.length < 5) bulletPoints.push("—");
  }
  if (bulletPoints.length < 3) return null;

  const bpOut = bulletPoints.slice(0, 5);

  const base: AiListingResult = {
    title: platform === "amazon_us" || platform === "mercado_livre_intl" ? title.slice(0, 200) : title.slice(0, 250),
    bulletPoints: bpOut,
    description,
    keywords: keywords || "—",
    ...(platform === "tiktok_shop_us" ? { hook: hookRaw.slice(0, 200) } : {}),
    ...(platform === "shopify"
      ? { subheadline: subheadlineRaw.slice(0, 220), callToAction: callToActionRaw.slice(0, 140) }
      : {}),
  };

  if (platform === "amazon_us") return enforceAmazonUsOutput(base);
  if (platform === "tiktok_shop_us") return enforceTikTokOutput(base);
  if (platform === "walmart_us") return enforceWalmartOutput(base);
  if (platform === "mercado_livre_intl") return enforceMercadoIntlOutput(base);
  if (platform === "shopify") return enforceShopifyOutput(base);
  return base;
}

export function registerAiListingRoutes(app: Express): void {
  app.post("/api/client/listing-generator", requireUser, async (req: Request, res: Response) => {
    const b = (req.body && typeof req.body === "object" ? req.body : {}) as GenerateBody;
    const operation = normalizeListingOperation(b);
    const productName = typeof b.productName === "string" ? b.productName.trim() : "";
    const productUrl = typeof b.productUrl === "string" ? b.productUrl.trim() : "";
    const productDescription = typeof b.productDescription === "string" ? b.productDescription.trim() : "";
    const existingListing = typeof b.existingListing === "string" ? b.existingListing.trim() : "";

    if (operation === "improve_existing") {
      if (!isValidHttpListingUrl(productUrl)) {
        res.status(400).json({
          error: "Envie uma URL válida (http ou https) da página do anúncio a melhorar.",
        });
        return;
      }
    } else if (operation === "improve_pasted") {
      const mergedPaste = mergePastedListingBody(b);
      if (mergedPaste.length < MIN_PASTED_LISTING_CHARS) {
        res.status(400).json({
          error: `Cole a listagem actual (título, bullets e/ou descrição) com pelo menos ${MIN_PASTED_LISTING_CHARS} caracteres no total.`,
        });
        return;
      }
    } else if (!productName && !productUrl && !productDescription) {
      res.status(400).json({ error: "Informe nome do produto, URL ou descrição (pelo menos um)." });
      return;
    }
    const platformRaw = typeof b.platform === "string" ? b.platform.trim() : "";
    if (!isListingPlatformId(platformRaw)) {
      res.status(400).json({ error: "Plataforma inválida.", validPlatforms: [...LISTING_PLATFORM_IDS] });
      return;
    }
    const platform = platformRaw;

    let bForAi: GenerateBody = b;
    if (operation === "improve_existing") {
      const fetched = await fetchListingUrlPlainText(productUrl);
      const parts: string[] = [];
      if (fetched.ok) {
        parts.push(`--- Texto obtido da URL (análise) ---\n${fetched.text}`);
      } else {
        parts.push(`--- Aviso: não foi possível obter o HTML (${fetched.error}). Use só a URL e notas opcionais. ---`);
      }
      if (existingListing) parts.push(`--- Notas opcionais do utilizador ---\n${existingListing}`);
      bForAi = {
        ...b,
        productName: "",
        targetAudience: "",
        mainBenefit: "",
        productDifferentiation: "",
        productDescription: parts.join("\n\n"),
      };
    } else if (operation === "improve_pasted") {
      const pastedMerged = mergePastedListingBody(b);
      const parts: string[] = [pastedMerged];
      if (existingListing) parts.push(`--- Notas opcionais do utilizador ---\n${existingListing}`);
      bForAi = {
        ...b,
        productName: "",
        productUrl: "",
        targetAudience: "",
        mainBenefit: "",
        productDifferentiation: "",
        productDescription: parts.join("\n\n"),
      };
    }

    const buildListing = (): AiListingResult =>
      isImproveOperation(operation) ? buildTemplateImproveListing(bForAi, platform) : buildTemplateListing(b, platform);

    if (process.env.OPENAI_API_KEY?.trim()) {
      try {
        const ai = await callOpenAiListing(bForAi, platform, operation);
        if (ai) {
          res.json({ ok: true, mode: "live", listing: ai, listingOperation: operation });
          return;
        }
      } catch (e) {
        const listing = buildListing();
        res.json({
          ok: true,
          mode: "demo",
          listing,
          listingOperation: operation,
          warn: e instanceof Error ? e.message.slice(0, 240) : "openai_error",
        });
        return;
      }
    }

    res.json({ ok: true, mode: "demo", listing: buildListing(), listingOperation: operation });
  });
}
