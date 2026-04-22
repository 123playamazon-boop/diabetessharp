const ASIN_RE = /^[A-Z0-9]{10}$/i;

/** Extrai ASIN de texto puro ou de URL Amazon (`/dp/`, `/gp/product/`). */
export function extractAmazonAsin(input: string): string | null {
  const s = input.trim();
  const fromPath = s.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i);
  if (fromPath?.[1] && ASIN_RE.test(fromPath[1])) return fromPath[1].toUpperCase();
  const compact = s.replace(/\s+/g, "").toUpperCase();
  if (ASIN_RE.test(compact)) return compact;
  return null;
}

/** URL de PDP Amazon US (melhor compatibilidade com o scraper demo). */
export function amazonComDpUrl(asin: string): string {
  return `https://www.amazon.com/dp/${asin}`;
}
