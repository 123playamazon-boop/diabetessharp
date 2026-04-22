import { load } from "cheerio";
import { assertSafePublicUrl } from "./scrapeSupplier";

/**
 * PDPs Amazon/Walmart costumam ter 2–8+ MB de HTML. O texto extraído continua limitado abaixo.
 * `LISTING_FETCH_MAX_HTML_BYTES` > `SCRAPE_MAX_HTML_BYTES` > defeito 8 MB; clamp 0,5–15 MB.
 */
function maxListingHtmlBytes(): number {
  const rawListing = process.env.LISTING_FETCH_MAX_HTML_BYTES;
  const rawScrape = process.env.SCRAPE_MAX_HTML_BYTES;
  const n = rawListing ? Number.parseInt(rawListing, 10) : rawScrape ? Number.parseInt(rawScrape, 10) : NaN;
  const fallback = 8_000_000;
  const v = Number.isFinite(n) && n > 0 ? n : fallback;
  return Math.min(Math.max(v, 500_000), 15_000_000);
}

/**
 * Fetches a public product/listing URL and returns visible text for AI improve mode.
 * SSRF guard via assertSafePublicUrl (same rules as supplier scrape).
 */
export async function fetchListingUrlPlainText(rawUrl: string): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  let url: URL;
  try {
    url = assertSafePublicUrl(rawUrl);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "URL inválida." };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(url.toString(), {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "DBX-AiListingImprove/1.0",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const buf = await res.arrayBuffer();
    const maxBytes = maxListingHtmlBytes();
    if (buf.byteLength > maxBytes) {
      const mb = (buf.byteLength / 1_000_000).toFixed(1);
      const limMb = (maxBytes / 1_000_000).toFixed(1);
      return {
        ok: false,
        error: `Página demasiado grande (${mb} MB; limite ${limMb} MB). Tenta um URL mais curto ou define LISTING_FETCH_MAX_HTML_BYTES no servidor.`,
      };
    }
    const html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    const $ = load(html);
    $("script, style, noscript, svg, iframe, object, link, meta").remove();
    const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 18_000);
    if (text.length < 40) {
      return { ok: false, error: "Pouco texto extraível desta página." };
    }
    return { ok: true, text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha de rede";
    if (msg.includes("abort") || msg === "This operation was aborted") {
      return { ok: false, error: "Tempo limite ao obter a página." };
    }
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}
