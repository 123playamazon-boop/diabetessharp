import { apiUrl } from "./apiUrl";
import { jsonUserHeaders } from "./authHeaders";

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
  storeUrl?: string;
  storeProductUrl?: string;
  productUsd?: string;
  netProfitUsd?: string;
  roiPct?: number | null;
  fbaOfferCount?: number;
  notas?: string;
  shippingUsd?: string;
  cashBack?: string;
  leadStatus?: LeadRowStatus;
};

export type AmazonLeadsDailyEditionDto = {
  editionDate: string;
  publishedAtIso: string;
  rowCount: number;
  rows: AmazonLeadTableRow[];
  csv: string;
  pipelineNote?: string;
  rulesSnapshot: { minMonthlySold: number; minNewOffersTotal: number; excludeAmazonBuyBox: boolean };
  asinsRequested: number;
  rejectedCount: number;
};

export type AmazonLeadsDailyResponse = {
  subscribed: boolean;
  edition: AmazonLeadsDailyEditionDto | null;
  recentEditionDates: string[];
  priceUsdMonthly?: number;
  disclaimer?: string;
};

export async function getAmazonLeadsDaily(
  suite: string,
  editionDate?: string,
): Promise<{ ok: true; data: AmazonLeadsDailyResponse } | { ok: false; error: string }> {
  const q = new URLSearchParams({ suite });
  if (editionDate?.trim()) q.set("editionDate", editionDate.trim());
  const res = await fetch(apiUrl(`/api/client/amazon-leads/daily?${q.toString()}`), {
    headers: jsonUserHeaders(),
  });
  const raw = await res.text();
  try {
    const j = JSON.parse(raw) as AmazonLeadsDailyResponse & { error?: string };
    if (!res.ok) return { ok: false, error: typeof j.error === "string" ? j.error : raw };
    if (typeof j.subscribed !== "boolean") return { ok: false, error: "Resposta inesperada." };
    return { ok: true, data: j };
  } catch {
    return { ok: false, error: "Resposta inválida da API." };
  }
}
