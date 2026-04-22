import { apiUrl } from "./apiUrl";
import { jsonUserHeaders } from "./authHeaders";
import type { ListingComplianceResult } from "../../shared/listingCompliance";

export type ListingComplianceResponse =
  | { ok: true; mode: "live" | "demo"; compliance: ListingComplianceResult; warn?: string }
  | { ok: false; error: string };

export type ListingCompliancePayload = { listingText?: string; listingUrl?: string };

export async function postListingCompliance(payload: ListingCompliancePayload): Promise<ListingComplianceResponse> {
  const res = await fetch(apiUrl("/api/client/listing-compliance"), {
    method: "POST",
    headers: jsonUserHeaders(),
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = typeof data.error === "string" ? data.error : `HTTP ${res.status}`;
    return { ok: false, error: err };
  }
  const compliance = data.compliance as ListingComplianceResult | undefined;
  if (!compliance || !Array.isArray(compliance.violations)) {
    return { ok: false, error: "Resposta inválida do servidor." };
  }
  const mode = data.mode === "live" ? "live" : "demo";
  const warn = typeof data.warn === "string" ? data.warn : undefined;
  return { ok: true, mode, compliance, warn };
}
