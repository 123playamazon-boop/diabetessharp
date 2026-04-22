import * as XLSX from "xlsx";
import type { GeneratedListing } from "./aiListingGeneratorApi";
import type { ListingPlatformId } from "../../shared/listingGenerator";

function platformLabel(id: ListingPlatformId): string {
  switch (id) {
    case "amazon_us":
      return "Amazon USA";
    case "tiktok_shop_us":
      return "TikTok Shop USA";
    case "walmart_us":
      return "Walmart USA";
    case "mercado_livre_intl":
      return "Mercado Livre Internacional";
    case "shopify":
      return "Shopify";
    default:
      return id;
  }
}

const BULLET_COLS = 5;

/** Gera um .xlsx com uma linha de cabeçalhos e uma linha de valores (título, bullets, descrição e keywords em colunas separadas). */
export function downloadListingExcel(params: {
  listing: GeneratedListing;
  platform: ListingPlatformId;
  operationLabel: string;
  fileBase?: string;
}): void {
  const { listing, platform, operationLabel, fileBase = "listing-ia" } = params;

  const headers: string[] = [
    "Plataforma",
    "Modo",
    "Gerado em (UTC)",
    "Título",
    ...Array.from({ length: BULLET_COLS }, (_, i) => `Bullet ${i + 1}`),
    "Descrição",
    "Palavras-chave",
  ];
  const values: string[] = [
    platformLabel(platform),
    operationLabel,
    new Date().toISOString(),
    listing.title,
    ...Array.from({ length: BULLET_COLS }, (_, i) => listing.bulletPoints[i] ?? ""),
    listing.description,
    listing.keywords,
  ];

  if (listing.hook) {
    headers.push("Gancho (TikTok)");
    values.push(listing.hook);
  }
  if (listing.subheadline) {
    headers.push("Submanchete (Shopify)");
    values.push(listing.subheadline);
  }
  if (listing.callToAction) {
    headers.push("CTA (Shopify)");
    values.push(listing.callToAction);
  }

  const sheet = XLSX.utils.aoa_to_sheet([headers, values]);
  const wch: number[] = headers.map((h) => {
    if (h === "Descrição") return 60;
    if (h === "Palavras-chave") return 55;
    if (h === "Título") return 55;
    if (h.startsWith("Bullet")) return 42;
    if (h === "Plataforma") return 22;
    if (h === "Modo") return 28;
    if (h.startsWith("Gerado em")) return 26;
    return 28;
  });
  sheet["!cols"] = wch.map((wch) => ({ wch }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Listagem");
  const safe = fileBase.replace(/[^\w\-]+/g, "-").slice(0, 80);
  XLSX.writeFile(wb, `${safe}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
