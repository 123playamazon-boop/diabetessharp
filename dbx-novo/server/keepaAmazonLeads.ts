/**
 * Keepa Product API + regras de leads (Amazon.com).
 * Documentação: https://keepa.com/#!api
 */

export type KeepaProduct = Record<string, unknown>;

export type KeepaProductResponse = {
  tokensLeft?: number;
  refillIn?: number;
  products?: KeepaProduct[];
};

const AMAZON_RETAIL_US = "ATVPDKIKX0DER";

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function str(v: unknown): string | null {
  if (typeof v === "string") return v;
  return null;
}

export function sumNewOffers(p: KeepaProduct): number {
  const arr = p.buyBoxEligibleOfferCounts;
  if (!Array.isArray(arr) || arr.length < 2) return 0;
  const fba = num(arr[0]) ?? 0;
  const fbm = num(arr[1]) ?? 0;
  return Math.max(0, fba) + Math.max(0, fbm);
}

/** Ofertas New FBA elegíveis ao buy box (índice 0 em buyBoxEligibleOfferCounts). */
export function fbaNewOfferCount(p: KeepaProduct): number {
  const arr = p.buyBoxEligibleOfferCounts;
  if (!Array.isArray(arr) || arr.length < 1) return 0;
  return Math.max(0, num(arr[0]) ?? 0);
}

export function getMonthlySold(p: KeepaProduct): number | null {
  const v = num(p.monthlySold);
  if (v == null || v <= 0) return null;
  return v;
}

export function getLastBuyBoxSellerId(p: KeepaProduct): string | null {
  const h = p.buyBoxSellerIdHistory;
  if (!Array.isArray(h) || h.length === 0) return null;
  const last = h[h.length - 1];
  return str(last);
}

export function isAmazonBuyBoxSeller(p: KeepaProduct): boolean {
  const id = getLastBuyBoxSellerId(p);
  return id === AMAZON_RETAIL_US;
}

export function lowestNewOfferPriceCents(p: KeepaProduct): number | null {
  const offers = p.offers;
  if (!Array.isArray(offers)) return null;
  let min: number | null = null;
  for (const o of offers) {
    if (!o || typeof o !== "object") continue;
    const row = o as Record<string, unknown>;
    const cond = num(row.condition);
    const price = num(row.price);
    if (price == null || price <= 0) continue;
    if (cond != null && cond !== 1 && cond !== 0) continue;
    min = min == null ? price : Math.min(min, price);
  }
  return min;
}

export function centsToUsd(cents: number | null): string {
  if (cents == null || cents <= 0) return "";
  return (cents / 100).toFixed(2);
}

export function amazonProductUrl(asin: string): string {
  return `https://www.amazon.com/dp/${encodeURIComponent(asin)}`;
}

export type LeadRules = {
  minMonthlySold: number;
  minNewOffersTotal: number;
  excludeAmazonBuyBox: boolean;
};

export function passesLeadRules(p: KeepaProduct, rules: LeadRules): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const ms = getMonthlySold(p);
  if (ms == null || ms < rules.minMonthlySold) {
    reasons.push(`monthlySold<${rules.minMonthlySold} (${ms ?? "n/d"})`);
  }
  const offers = sumNewOffers(p);
  if (offers < rules.minNewOffersTotal) {
    reasons.push(`newOffers<${rules.minNewOffersTotal} (${offers})`);
  }
  if (rules.excludeAmazonBuyBox && isAmazonBuyBoxSeller(p)) {
    reasons.push("buyBoxAmazon");
  }
  return { ok: reasons.length === 0, reasons };
}

export type LeadRowStatus = "lista" | "aprovado" | "reprovado";

export type AmazonLeadTableRow = {
  asin: string;
  title: string;
  imageUrl: string;
  amazonUrl: string;
  categoryLabel: string;
  usdAmazon: string;
  emsMonthly: number | null;
  newOffersTotal: number;
  bsrCurrent: string;
  bsrAvg90: string;
  /** URL da loja de origem (arbitragem). */
  storeUrl?: string;
  /** Link directo ao produto na loja. */
  storeProductUrl?: string;
  /** Preço na loja (USD), ex. "19.99" ou "$19.99". */
  productUsd?: string;
  /** Lucro líquido estimado (texto), ex. "$11.55". */
  netProfitUsd?: string;
  /** ROI % quando calculável ou preenchido manualmente. */
  roiPct?: number | null;
  /** Ofertas New FBA (Keepa). */
  fbaOfferCount?: number;
  notas?: string;
  shippingUsd?: string;
  cashBack?: string;
  leadStatus?: LeadRowStatus;
};

function parseUsdLoose(v: string | undefined): number | null {
  if (v == null || !String(v).trim()) return null;
  const n = Number.parseFloat(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Normaliza uma linha vinda de JSON antigo ou parcial antes de enviar à API cliente. */
export function coerceLeadRow(raw: unknown): AmazonLeadTableRow {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const numOrNull = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const st = o.leadStatus;
  const leadStatus: LeadRowStatus | undefined =
    st === "aprovado" || st === "reprovado" || st === "lista" ? st : undefined;
  const asin = str(o.asin);
  const row: AmazonLeadTableRow = {
    asin,
    title: str(o.title),
    imageUrl: str(o.imageUrl),
    amazonUrl: str(o.amazonUrl) || amazonProductUrl(asin),
    categoryLabel: str(o.categoryLabel),
    usdAmazon: str(o.usdAmazon),
    emsMonthly: numOrNull(o.emsMonthly),
    newOffersTotal: numOrNull(o.newOffersTotal) ?? 0,
    bsrCurrent: str(o.bsrCurrent),
    bsrAvg90: str(o.bsrAvg90),
    storeUrl: str(o.storeUrl) || undefined,
    storeProductUrl: str(o.storeProductUrl) || undefined,
    productUsd: str(o.productUsd) || undefined,
    netProfitUsd: str(o.netProfitUsd) || undefined,
    roiPct: numOrNull(o.roiPct) ?? undefined,
    fbaOfferCount: numOrNull(o.fbaOfferCount) ?? undefined,
    notas: str(o.notas) || undefined,
    shippingUsd: str(o.shippingUsd) || undefined,
    cashBack: str(o.cashBack) || undefined,
    leadStatus,
  };
  return enrichLeadRowCalculations(row);
}

/** Preenche netProfitUsd / roiPct a partir de productUsd e usdAmazon quando ainda vazios. */
export function enrichLeadRowCalculations(r: AmazonLeadTableRow): AmazonLeadTableRow {
  if (r.netProfitUsd?.trim() && r.roiPct != null && Number.isFinite(r.roiPct)) return r;
  const store = parseUsdLoose(r.productUsd);
  const amz = parseUsdLoose(r.usdAmazon);
  if (store == null || amz == null || store <= 0) return r;
  const net = Math.round((amz - store) * 100) / 100;
  const roi = Math.round((net / store) * 10000) / 100;
  const next: AmazonLeadTableRow = { ...r };
  if (!next.netProfitUsd?.trim()) {
    next.netProfitUsd = `$${net.toFixed(2)}`;
  }
  if (next.roiPct == null || !Number.isFinite(next.roiPct)) {
    next.roiPct = roi;
  }
  return next;
}

export function productToLeadRow(p: KeepaProduct, asin: string): AmazonLeadTableRow {
  const title = typeof p.title === "string" ? p.title : "";
  const img =
    typeof p.imagesCSV === "string" && p.imagesCSV
      ? `https://m.media-amazon.com/images/I/${p.imagesCSV.split(",")[0]}`
      : "";
  const cat =
    typeof p.rootCategory === "number"
      ? String(p.rootCategory)
      : typeof p.categoryTree === "string"
        ? p.categoryTree
        : "";
  const stats = p.stats as Record<string, unknown> | undefined;
  const cur = stats?.current;
  let bsr = "";
  let bsr90 = "";
  if (Array.isArray(cur) && cur.length > 3) {
    bsr = cur[3] != null && Number(cur[3]) > 0 ? String(cur[3]) : "";
  }
  const avg90 = stats?.avg90;
  if (Array.isArray(avg90) && avg90.length > 3) {
    bsr90 = avg90[3] != null && Number(avg90[3]) > 0 ? String(avg90[3]) : "";
  }
  const row: AmazonLeadTableRow = {
    asin,
    title,
    imageUrl: img,
    amazonUrl: amazonProductUrl(asin),
    categoryLabel: cat,
    usdAmazon: centsToUsd(lowestNewOfferPriceCents(p)),
    emsMonthly: getMonthlySold(p),
    newOffersTotal: sumNewOffers(p),
    bsrCurrent: bsr,
    bsrAvg90: bsr90,
    fbaOfferCount: fbaNewOfferCount(p),
    leadStatus: "lista",
  };
  return enrichLeadRowCalculations(row);
}

function escCell(c: string): string {
  if (!c.includes(",") && !c.includes('"') && !c.includes("\n")) return c;
  return `"${c.replace(/"/g, '""')}"`;
}

export function leadsRowsToCsv(rows: AmazonLeadTableRow[], dateIso: string): string {
  const header = [
    "Data",
    "Produto",
    "FOTO",
    "ASIN",
    "Amazon_URL",
    "Loja_URL",
    "Link_Loja_URL",
    "Categoria",
    "USD_Produto_loja",
    "USD_Amazon_ref",
    "Net_profit_est",
    "ROI_pct_est",
    "EMS_mensal",
    "New_FBA_FBM_offers",
    "FBA_new_offers",
    "Current_BSR",
    "Avg90_BSR",
    "Notas",
    "Frete_USD",
    "Cash_back",
    "Status",
  ].join(",");
  const lines = rows.map((r) =>
    [
      escCell(dateIso),
      escCell(r.title),
      escCell(r.imageUrl),
      escCell(r.asin),
      escCell(r.amazonUrl),
      escCell(r.storeUrl ?? ""),
      escCell(r.storeProductUrl ?? ""),
      escCell(r.categoryLabel),
      escCell(r.productUsd ?? ""),
      escCell(r.usdAmazon),
      escCell(r.netProfitUsd ?? ""),
      escCell(r.roiPct != null && Number.isFinite(r.roiPct) ? String(r.roiPct) : ""),
      escCell(r.emsMonthly != null ? String(r.emsMonthly) : ""),
      escCell(String(r.newOffersTotal)),
      escCell(String(r.fbaOfferCount ?? "")),
      escCell(r.bsrCurrent),
      escCell(r.bsrAvg90),
      escCell(r.notas ?? ""),
      escCell(r.shippingUsd ?? ""),
      escCell(r.cashBack ?? ""),
      escCell(r.leadStatus ?? "lista"),
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

export async function fetchKeepaProducts(params: {
  key: string;
  domain: number;
  asins: string[];
  stats: number;
  offers: number;
}): Promise<KeepaProductResponse> {
  const asinParam = params.asins.map((a) => a.trim().toUpperCase()).filter(Boolean).join(",");
  if (!asinParam) return { products: [] };
  const u = new URL("https://api.keepa.com/product");
  u.searchParams.set("key", params.key);
  u.searchParams.set("domain", String(params.domain));
  u.searchParams.set("asin", asinParam);
  u.searchParams.set("stats", String(params.stats));
  if (params.offers > 0) u.searchParams.set("offers", String(params.offers));

  const res = await fetch(u.toString(), { headers: { Accept: "application/json" } });
  const text = await res.text();
  let j: unknown;
  try {
    j = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Keepa: resposta não-JSON (${res.status}).`);
  }
  if (!res.ok) {
    const err = typeof j === "object" && j && "error" in j ? String((j as { error: unknown }).error) : text;
    throw new Error(`Keepa API ${res.status}: ${err}`);
  }
  return j as KeepaProductResponse;
}

/** Extrai ASINs (B + 9 alfanum) do texto; deduplica; máximo `max`. */
export function parseAsinsFromText(text: string, max: number): string[] {
  const re = /\b(B[A-Z0-9]{9})\b/gi;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  const s = text.toUpperCase();
  while ((m = re.exec(s)) !== null) {
    found.add(m[1]!);
    if (found.size >= max) break;
  }
  return [...found];
}
