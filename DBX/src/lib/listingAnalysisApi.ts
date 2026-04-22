import { apiUrl } from "./apiUrl";
import { jsonUserHeaders } from "./authHeaders";
import type { ListingAnalysisResult } from "../../shared/listingAnalysis";
import type { ListingPlatformId } from "../../shared/listingGenerator";

export type ListingAnalysisResponse =
  | { ok: true; mode: "live" | "demo"; analysis: ListingAnalysisResult; platform: ListingPlatformId; warn?: string }
  | { ok: false; error: string };

export async function postListingAnalysis(payload: {
  platform: ListingPlatformId;
  title?: string;
  bullets?: string;
  description?: string;
  listingUrl?: string;
}): Promise<ListingAnalysisResponse> {
  const res = await fetch(apiUrl("/api/client/listing-analysis"), {
    method: "POST",
    headers: jsonUserHeaders(),
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = typeof data.error === "string" ? data.error : `HTTP ${res.status}`;
    return { ok: false, error: err };
  }
  const analysis = data.analysis as ListingAnalysisResult | undefined;
  if (
    !analysis ||
    typeof analysis.seoScore !== "number" ||
    typeof analysis.conversionScore !== "number" ||
    typeof analysis.complianceScore !== "number" ||
    !Array.isArray(analysis.suggestions) ||
    !Array.isArray(analysis.weakAreas)
  ) {
    return { ok: false, error: "Resposta inválida do servidor." };
  }
  const mode = data.mode === "live" ? "live" : "demo";
  const warn = typeof data.warn === "string" ? data.warn : undefined;
  const platform = (typeof data.platform === "string" ? data.platform : payload.platform) as ListingPlatformId;
  return { ok: true, mode, analysis, platform, warn };
}
