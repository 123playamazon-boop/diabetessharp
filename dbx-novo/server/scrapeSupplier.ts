import { load } from "cheerio";

export type ScrapedProduct = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  brand: string | null;
  model: string | null;
  /** Preço unitário detectado na página (USD quando currency indica USD ou não especificado). */
  priceUsd: number | null;
  supplier: string;
  sourceUrl: string;
};

/** Amazon e outras lojas enviam HTML muito pesado (3–15+ MB). Configurável por env. */
function maxHtmlBytes(): number {
  const raw = process.env.SCRAPE_MAX_HTML_BYTES;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  const fallback = 12_000_000; /* 12 MB — típico para PDP Amazon */
  const v = Number.isFinite(n) && n > 0 ? n : fallback;
  return Math.min(Math.max(v, 500_000), 25_000_000); /* entre 0,5 MB e 25 MB */
}

function fetchTimeoutMs(hostname: string): number {
  const base = Number.parseInt(process.env.SCRAPE_FETCH_TIMEOUT_MS ?? "", 10);
  if (Number.isFinite(base) && base > 0) return Math.min(base, 120_000);
  const h = hostname.toLowerCase();
  if (h.includes("amazon.")) return 25_000;
  return 15_000;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "0.0.0.0",
  "127.0.0.1",
  "::1",
  "metadata.google.internal",
  "169.254.169.254",
]);

function isPrivateIpv4Host(hostname: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return false;
  const [a, b] = hostname.split(".").map(Number);
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
  return false;
}

/** Remove query string longa em PDP Amazon (/dp/ASIN/...) — não altera o tamanho do HTML mas evita URLs ruidosas. */
export function normalizeRetailUrl(u: URL): URL {
  const host = u.hostname.toLowerCase();
  if (!host.includes("amazon.")) return u;
  const m = u.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  if (!m?.[1]) return u;
  return new URL(`/dp/${m[1]}`, `${u.protocol}//${u.host}`);
}

export function assertSafePublicUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new Error("URL inválida.");
  }
  if (u.username || u.password) throw new Error("URL com credenciais não é permitida.");
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Apenas links http ou https.");
  const host = u.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith(".local") || host.endsWith(".localhost")) {
    throw new Error("Este endereço não pode ser usado.");
  }
  if (isPrivateIpv4Host(host)) throw new Error("Endereços de rede interna não são permitidos.");
  return u;
}

export function absolutize(base: URL, href: string | null | undefined): string | null {
  if (!href) return null;
  const t = href.trim();
  if (!t || t.toLowerCase().startsWith("data:") || t.startsWith("javascript:")) return null;
  try {
    const resolved = new URL(t, base);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return null;
    return resolved.href;
  } catch {
    return null;
  }
}

function metaContent($: ReturnType<typeof load>, selectors: string[]): string | null {
  for (const sel of selectors) {
    const v = $(sel).attr("content")?.trim();
    if (v) return v;
  }
  return null;
}

function isProductTyped(obj: object): boolean {
  const t = (obj as Record<string, unknown>)["@type"];
  const hit = (x: unknown) =>
    x === "Product" || x === "IndividualProduct" || x === "ProductModel" || x === "ProductGroup";
  if (typeof t === "string") return hit(t);
  if (Array.isArray(t)) return t.some((x) => typeof x === "string" && hit(x));
  return false;
}

function flattenLd(data: unknown): object[] {
  const out: object[] = [];
  const visit = (v: unknown) => {
    if (v === null || v === undefined) return;
    if (Array.isArray(v)) {
      v.forEach(visit);
      return;
    }
    if (typeof v !== "object") return;
    out.push(v as object);
    const o = v as Record<string, unknown>;
    if (Array.isArray(o["@graph"])) visit(o["@graph"]);
    if (o.mainEntity) visit(o.mainEntity);
    if (o.hasVariant) visit(o.hasVariant);
    if (o.includesObject) visit(o.includesObject);
  };
  visit(data);
  return out;
}

function pickLdImage(o: Record<string, unknown>, pageUrl: URL): string | null {
  const img = o.image;
  if (typeof img === "string") return absolutize(pageUrl, img);
  if (Array.isArray(img)) {
    for (const x of img) {
      if (typeof x === "string") {
        const a = absolutize(pageUrl, x);
        if (a) return a;
      }
      if (x && typeof x === "object") {
        const u = (x as { url?: string }).url;
        if (typeof u === "string") {
          const a = absolutize(pageUrl, u);
          if (a) return a;
        }
      }
    }
  }
  if (img && typeof img === "object" && typeof (img as { url?: string }).url === "string") {
    return absolutize(pageUrl, (img as { url: string }).url);
  }
  return null;
}

function pickBrand(o: Record<string, unknown>): string | null {
  const b = o.brand;
  if (typeof b === "string") return b.trim() || null;
  if (b && typeof b === "object" && typeof (b as { name?: string }).name === "string") {
    return (b as { name: string }).name.trim() || null;
  }
  return null;
}

function pickModel(o: Record<string, unknown>): string | null {
  for (const key of ["model", "mpn", "sku"] as const) {
    const v = o[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function isLikelyAmazonProductImage(href: string): boolean {
  const lower = href.toLowerCase();
  if (lower.includes("data:image")) return false;
  if (lower.includes("pixel") && lower.includes(".gif")) return false;
  if (lower.includes("nav-sprite") || lower.includes("/navbar/")) return false;
  if (lower.includes("amazon-logo") || lower.includes("prime-logo") || lower.includes("kindle")) return false;
  if (/\/images\/G\/0[0-9]{2}\//.test(lower)) return false;
  return true;
}

/** Prioriza URLs com sufixo Amazon _SL1500_ / _AC_SL… maior = melhor. */
function scoreProductImageUrl(u: string): number {
  const sl = u.match(/_SL(\d+)_/i);
  if (sl) return parseInt(sl[1], 10);
  const ac = u.match(/\._AC_[A-Z0-9]*(\d+)_/i);
  if (ac) return parseInt(ac[1], 10);
  if (u.includes("media-amazon.com/images/I/")) return 500;
  return 50;
}

function decodeJsonUrlEscapes(s: string): string {
  return s.replace(/\\u002F/gi, "/").replace(/\\\//g, "/").replace(/\\"/g, '"');
}

/** Amazon mete URLs de alta resolução em scripts inline (hiRes / large / colorImages). */
function extractAmazonImageUrlsFromRawHtml(html: string): string[] {
  const out: string[] = [];
  const pushDecoded = (raw: string) => {
    const u = decodeJsonUrlEscapes(raw).trim();
    if (u.startsWith("http") && isLikelyAmazonProductImage(u)) out.push(u);
  };
  for (const key of ["hiRes", "large", "thumb"] as const) {
    for (const q of ['"', "'"] as const) {
      const re = new RegExp(`${q}${key}${q}\\s*:\\s*${q}([^${q}]+\\.(?:jpg|jpeg|png|webp)[^${q}]*)${q}`, "gi");
      let m: RegExpExecArray | null;
      while ((m = re.exec(html)) !== null) {
        pushDecoded(m[1]);
      }
    }
  }
  const reHttps = /https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9%._-]+\.(?:jpg|jpeg|png|webp)/gi;
  let m2: RegExpExecArray | null;
  while ((m2 = reHttps.exec(html)) !== null) {
    let u = m2[0];
    try {
      u = decodeURIComponent(u);
    } catch {
      /* keep raw */
    }
    if (isLikelyAmazonProductImage(u)) out.push(u);
  }
  return out;
}

function parseDataADynamicImage(attr: string | undefined): string[] {
  if (!attr) return [];
  try {
    const map = JSON.parse(attr) as Record<string, unknown>;
    const urls: { url: string; area: number }[] = [];
    for (const [url, dims] of Object.entries(map)) {
      if (typeof url !== "string" || !url.startsWith("http")) continue;
      if (!isLikelyAmazonProductImage(url)) continue;
      let area = 0;
      if (Array.isArray(dims) && typeof dims[0] === "number" && typeof dims[1] === "number") {
        area = dims[0] * dims[1];
      }
      urls.push({ url, area });
    }
    urls.sort((a, b) => b.area - a.area);
    return urls.map((x) => x.url);
  } catch {
    return [];
  }
}

function pickAmazonDomImages($: ReturnType<typeof load>, pageUrl: URL): string[] {
  const out: string[] = [];
  const selectors = [
    "#landingImage",
    "#imgBlkFront",
    "#main-image",
    'img[data-a-image-name="landingImage"]',
    "img#landingImage",
  ];
  for (const sel of selectors) {
    const el = $(sel).first();
    const src =
      el.attr("src") ||
      el.attr("data-src") ||
      el.attr("data-old-hi-res") ||
      el.attr("data-zoom-hires");
    const abs = absolutize(pageUrl, src);
    if (abs && isLikelyAmazonProductImage(abs)) out.push(abs);
  }
  $("img[data-a-dynamic-image]").each((_, node) => {
    out.push(...parseDataADynamicImage($(node).attr("data-a-dynamic-image")));
  });
  return out;
}

function pickPrimaryImageFromLd($: ReturnType<typeof load>, pageUrl: URL): string[] {
  const found: string[] = [];
  $("script[type='application/ld+json']").each((_, el) => {
    const txt = $(el).text();
    if (!txt) return;
    let data: unknown;
    try {
      data = JSON.parse(txt) as unknown;
    } catch {
      return;
    }
    for (const obj of flattenLd(data)) {
      const o = obj as Record<string, unknown>;
      if (isProductTyped(o)) {
        const img = pickLdImage(o, pageUrl);
        if (img) found.push(img);
      }
      const pip = o.primaryImageOfPage;
      if (pip && typeof pip === "object") {
        const u = (pip as { url?: string }).url;
        const abs = absolutize(pageUrl, u);
        if (abs) found.push(abs);
      }
    }
  });
  return found;
}

function pickBestImageCandidate(candidates: string[]): string | null {
  const uniq = [...new Set(candidates.filter(Boolean))];
  if (!uniq.length) return null;
  uniq.sort((a, b) => scoreProductImageUrl(b) - scoreProductImageUrl(a));
  return uniq[0];
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseMoneyValue(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0 && v < 10_000_000) return roundMoney(v);
  if (typeof v !== "string") return null;
  const t = v.replace(/[^\d.,]/g, "").trim();
  if (!t) return null;
  const lastComma = t.lastIndexOf(",");
  const lastDot = t.lastIndexOf(".");
  let normalized: string;
  if (lastComma > lastDot) normalized = t.replace(/\./g, "").replace(",", ".");
  else normalized = t.replace(/,/g, "");
  const n = Number.parseFloat(normalized);
  if (!Number.isFinite(n) || n <= 0 || n >= 10_000_000) return null;
  return roundMoney(n);
}

function extractOfferPriceNode(o: unknown, depth = 0): number | null {
  if (depth > 5 || !o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  for (const k of ["price", "lowPrice", "highPrice"] as const) {
    const n = parseMoneyValue(r[k]);
    if (n) return n;
  }
  const nested = r.offers;
  if (nested) return pickPriceFromOffers(nested, depth + 1);
  return null;
}

function pickPriceFromOffers(offers: unknown, depth = 0): number | null {
  if (depth > 5 || !offers) return null;
  if (Array.isArray(offers)) {
    for (const o of offers) {
      const n = extractOfferPriceNode(o, depth + 1);
      if (n) return n;
    }
    return null;
  }
  return extractOfferPriceNode(offers, depth + 1);
}

function pickPriceFromLdProductObjects($: ReturnType<typeof load>): number | null {
  let found: number | null = null;
  $("script[type='application/ld+json']").each((_, el) => {
    if (found != null) return;
    const txt = $(el).text();
    if (!txt) return;
    let data: unknown;
    try {
      data = JSON.parse(txt) as unknown;
    } catch {
      return;
    }
    for (const obj of flattenLd(data)) {
      if (!isProductTyped(obj)) continue;
      const o = obj as Record<string, unknown>;
      const p = pickPriceFromOffers(o.offers);
      if (p) {
        found = p;
        return;
      }
    }
  });
  return found;
}

function pickRetailDomPrice($: ReturnType<typeof load>): number | null {
  const metaSelectors = [
    'meta[property="product:price:amount"]',
    'meta[property="og:price:amount"]',
    'meta[itemprop="price"]',
  ];
  for (const sel of metaSelectors) {
    const c = $(sel).attr("content");
    const n = parseMoneyValue(c);
    if (n) return n;
  }
  const ip = $("[itemprop=price]").first();
  const fromContent = parseMoneyValue(ip.attr("content"));
  if (fromContent) return fromContent;
  const fromText = parseMoneyValue(ip.text());
  if (fromText) return fromText;
  return null;
}

export function parseProductHtml(html: string, pageUrl: URL): Omit<ScrapedProduct, "supplier" | "sourceUrl"> {
  const $ = load(html);
  const host = pageUrl.hostname.toLowerCase();
  const isAmazon = host.includes("amazon.");

  let title =
    metaContent($, ['meta[property="og:title"]', 'meta[name="twitter:title"]']) ||
    $("title").first().text().trim() ||
    $("h1").first().text().trim() ||
    null;
  title = title ? title.replace(/\s+/g, " ").trim() : null;

  let description =
    metaContent($, ['meta[property="og:description"]', 'meta[name="description"]', 'meta[name="twitter:description"]']) ||
    null;
  description = description ? description.replace(/\s+/g, " ").trim() : null;

  const ogCandidates: string[] = [];
  const og1 = absolutize(pageUrl, metaContent($, ['meta[property="og:image"]', 'meta[property="og:image:url"]']));
  const ogSecure = absolutize(pageUrl, metaContent($, ['meta[property="og:image:secure_url"]']));
  const tw = absolutize(pageUrl, metaContent($, ['meta[name="twitter:image"]', 'meta[name="twitter:image:src"]']));
  const preload = absolutize(pageUrl, $('link[rel="preload"][as="image"]').attr("href"));
  for (const c of [og1, ogSecure, tw, preload]) {
    if (c && (!isAmazon || isLikelyAmazonProductImage(c))) ogCandidates.push(c);
  }

  let brand: string | null = null;
  let model: string | null = null;

  $("script[type='application/ld+json']").each((_, el) => {
    const txt = $(el).text();
    if (!txt) return;
    let data: unknown;
    try {
      data = JSON.parse(txt) as unknown;
    } catch {
      return;
    }
    for (const obj of flattenLd(data)) {
      if (!isProductTyped(obj)) continue;
      const o = obj as Record<string, unknown>;
      if (!title && typeof o.name === "string") title = o.name.replace(/\s+/g, " ").trim();
      if (!brand) brand = pickBrand(o);
      if (!model) model = pickModel(o);
    }
  });

  const ldImages = pickPrimaryImageFromLd($, pageUrl);
  const amazonDom = isAmazon ? pickAmazonDomImages($, pageUrl) : [];
  const amazonScripts = isAmazon ? extractAmazonImageUrlsFromRawHtml(html) : [];

  const imageCandidates = [...amazonDom, ...amazonScripts, ...ldImages, ...ogCandidates];
  const imageUrl = pickBestImageCandidate(imageCandidates);

  let priceUsd = pickRetailDomPrice($);
  if (priceUsd == null) {
    priceUsd = pickPriceFromLdProductObjects($);
  }

  return { title, description, imageUrl, brand, model, priceUsd };
}

export async function scrapeSupplierPage(urlStr: string): Promise<ScrapedProduct> {
  const pageUrl = normalizeRetailUrl(assertSafePublicUrl(urlStr));
  const supplier = pageUrl.hostname.replace(/^www\./, "");
  const limitBytes = maxHtmlBytes();
  const FETCH_TIMEOUT_MS = fetchTimeoutMs(pageUrl.hostname);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(pageUrl.href, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 DBXProductImport/1.0",
      },
    });
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof Error && e.name === "AbortError") throw new Error("Tempo esgotado ao buscar a página.");
    throw new Error("Não foi possível aceder ao link. Tente outro fornecedor ou cadastro manual.");
  }
  clearTimeout(timer);

  if (!res.ok) throw new Error(`O site respondeu com erro HTTP ${res.status}.`);

  const buf = await res.arrayBuffer();
  if (buf.byteLength > limitBytes) {
    const mb = (buf.byteLength / 1_000_000).toFixed(1);
    const limMb = (limitBytes / 1_000_000).toFixed(0);
    throw new Error(
      `Página demasiado grande (${mb} MB; limite ${limMb} MB). Tenta um link mais curto (sem parâmetros de tracking) ou define SCRAPE_MAX_HTML_BYTES no servidor.`,
    );
  }

  const html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  const parsed = parseProductHtml(html, pageUrl);

  return {
    ...parsed,
    supplier,
    sourceUrl: pageUrl.href,
  };
}
