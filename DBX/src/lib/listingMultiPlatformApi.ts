import { apiUrl } from "./apiUrl";
import { jsonUserHeaders } from "./authHeaders";
import type { ListingAdapterPlatformId, MultiPlatformAdapterResult } from "../../shared/listingMultiPlatform";

export type ListingMultiPlatformResponse =
  | { ok: true; mode: "live" | "demo"; adapter: MultiPlatformAdapterResult; warn?: string }
  | { ok: false; error: string };

export async function postListingMultiPlatform(listingText: string): Promise<ListingMultiPlatformResponse> {
  const res = await fetch(apiUrl("/api/client/listing-multi-platform"), {
    method: "POST",
    headers: jsonUserHeaders(),
    body: JSON.stringify({ listingText }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = typeof data.error === "string" ? data.error : `HTTP ${res.status}`;
    return { ok: false, error: err };
  }
  const adapter = data.adapter as MultiPlatformAdapterResult | undefined;
  const versions = adapter?.versions;
  if (!versions || typeof versions !== "object") {
    return { ok: false, error: "Resposta inválida do servidor." };
  }
  const ids: ListingAdapterPlatformId[] = ["amazon_us", "walmart_us", "tiktok_shop_us", "shopify"];
  for (const id of ids) {
    const v = versions[id];
    if (!v || typeof v.title !== "string" || !Array.isArray(v.bulletPoints) || typeof v.description !== "string") {
      return { ok: false, error: "Resposta inválida do servidor." };
    }
  }
  const mode = data.mode === "live" ? "live" : "demo";
  const warn = typeof data.warn === "string" ? data.warn : undefined;
  return { ok: true, mode, adapter: adapter!, warn };
}
