/**
 * Fetch Amazon product-reviews HTML and extract negative review snippets (cheerio).
 */

import { load } from "cheerio";
import { assertSafePublicUrl } from "./scrapeSupplier";

const MAX_HTML_BYTES = 8_000_000;
const FETCH_TIMEOUT_MS = 12_000;
const SNIPPET_BODY_MAX = 400;
const MAX_SNIPPETS_PER_ASIN = 30;

export const NEGATIVE_REVIEW_KEYWORDS = [
  "broke",
  "broken",
  "don't like",
  "doesn't work",
  "waste",
  "poor quality",
  "stopped working",
  "cheaply made",
  "refund",
  "disappointed",
  "defective",
  "flimsy",
  "doesn't fit",
  "arrived damaged",
  "not as described",
] as const;

export type ReviewSnippet = {
  asin: string;
  body: string;
  rating: number | null;
  rawText: string;
};

function countNegativeKeywords(text: string): number {
  const low = text.toLowerCase();
  let n = 0;
  for (const kw of NEGATIVE_REVIEW_KEYWORDS) {
    if (low.includes(kw.toLowerCase())) n += 1;
  }
  return n;
}

/** Extract 1–5 from common Amazon patterns (aria-label, title, text). */
export function extractStarRatingFromBlock(text: string): number | null {
  const m =
    /(\d(?:\.\d)?)\s*out\s*of\s*5\s*stars/i.exec(text) ||
    /(\d(?:\.\d)?)\s*stars?\b/i.exec(text) ||
    /\b([1-5])\s*\/\s*5\b/.exec(text);
  if (!m?.[1]) return null;
  const v = Number.parseFloat(m[1]);
  if (!Number.isFinite(v) || v < 1 || v > 5) return null;
  return Math.round(v * 10) / 10;
}

function dedupeSnippets(snippets: ReviewSnippet[]): ReviewSnippet[] {
  const seen = new Set<string>();
  const out: ReviewSnippet[] = [];
  for (const s of snippets) {
    const key = s.body.toLowerCase().replace(/\s+/g, " ").slice(0, 80);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= MAX_SNIPPETS_PER_ASIN) break;
  }
  return out;
}

function shouldIncludeReview(body: string, rating: number | null): boolean {
  if (rating != null && Number.isFinite(rating) && rating <= 3) return true;
  if (rating == null && countNegativeKeywords(body) >= 2) return true;
  return false;
}

export function amazonProductReviewsUrl(asin: string): string {
  const a = asin.trim().toUpperCase();
  return `https://www.amazon.com/product-reviews/${encodeURIComponent(a)}`;
}

export async function fetchNegativeReviewSnippetsForAsin(asin: string): Promise<{ ok: true; snippets: ReviewSnippet[] } | { ok: false; error: string }> {
  const urlStr = amazonProductReviewsUrl(asin);
  let url: URL;
  try {
    url = assertSafePublicUrl(urlStr);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "URL inválida." };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "DBX-ProductHunterBrief/1.0",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_HTML_BYTES) return { ok: false, error: "Página demasiado grande." };
    const html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    const $ = load(html);
    $("script, style, noscript").remove();
    const snippets: ReviewSnippet[] = [];

    $("[data-hook='review-collapsed'], [data-hook='review-body'], .review").each((_i, el) => {
      if (snippets.length >= MAX_SNIPPETS_PER_ASIN * 2) return false;
      const block = $(el).text().replace(/\s+/g, " ").trim();
      if (block.length < 20) return;
      const rating = extractStarRatingFromBlock(block);
      const body = block.slice(0, SNIPPET_BODY_MAX);
      if (!shouldIncludeReview(block, rating)) return;
      const rawText = rating != null ? `[${rating}★] ${body}` : body;
      snippets.push({ asin: asin.trim().toUpperCase(), body, rating, rawText });
    });

    if (snippets.length === 0) {
      const bodyText = $("body").text().replace(/\s+/g, " ").trim();
      const chunks = bodyText.split(/(?=\d(?:\.\d)?\s*out\s*of\s*5\s*stars)/i);
      for (const ch of chunks) {
        if (snippets.length >= MAX_SNIPPETS_PER_ASIN * 2) break;
        const t = ch.trim();
        if (t.length < 40) continue;
        const rating = extractStarRatingFromBlock(t.slice(0, 120));
        const body = t.slice(0, SNIPPET_BODY_MAX);
        if (!shouldIncludeReview(t, rating)) continue;
        snippets.push({
          asin: asin.trim().toUpperCase(),
          body,
          rating,
          rawText: rating != null ? `[${rating}★] ${body}` : body,
        });
      }
    }

    return { ok: true, snippets: dedupeSnippets(snippets) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha de rede";
    if (msg.includes("abort") || msg === "This operation was aborted") {
      return { ok: false, error: "Tempo limite ao obter reviews." };
    }
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}
