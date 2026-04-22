import { apiUrl } from "../lib/apiUrl";
import { jsonUserHeaders } from "../lib/authHeaders";

export type ScrapeSupplierResponse =
  | {
      title: string | null;
      description: string | null;
      imageUrl: string | null;
      brand: string | null;
      model: string | null;
      supplier: string;
      sourceUrl: string;
    }
  | { error: string };

function scrapeEndpoint(): string {
  const base = import.meta.env.VITE_SCRAPE_API_URL?.replace(/\/$/, "");
  if (base) return `${base}/api/scrape`;
  return apiUrl("/api/scrape");
}

export async function fetchSupplierScrape(url: string): Promise<ScrapeSupplierResponse> {
  const res = await fetch(scrapeEndpoint(), {
    method: "POST",
    headers: jsonUserHeaders(),
    body: JSON.stringify({ url }),
  });
  const data = (await res.json()) as ScrapeSupplierResponse;
  if (!res.ok && data && typeof data === "object" && "error" in data) {
    return data;
  }
  if (!res.ok) {
    return { error: typeof data === "object" && data && "error" in data ? String(data.error) : `HTTP ${res.status}` };
  }
  return data;
}
