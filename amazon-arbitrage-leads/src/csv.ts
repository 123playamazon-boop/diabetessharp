import type { KeepaProduct } from "./keepa.js";
import { amazonProductUrl, centsToUsd, getMonthlySold, lowestNewOfferPriceCents, sumNewOffers } from "./keepa.js";

function esc(c: string): string {
  if (!c.includes(",") && !c.includes('"') && !c.includes("\n")) return c;
  return `"${c.replace(/"/g, '""')}"`;
}

/** Colunas alinhadas ao estilo Direct Box / planilha manual (custos loja preenchidos depois). */
export function leadsToCsv(rows: { date: string; p: KeepaProduct; asin: string }[]): string {
  const header = [
    "Data",
    "Produto",
    "FOTO",
    "ASIN",
    "Amazon_URL",
    "Loja_URL",
    "Link_Loja",
    "Categoria",
    "USD_Produto_fonte",
    "USD_Amazon_ref",
    "Net_Profit_calc",
    "ROI_pct_calc",
    "EMS_mensal",
    "New_FBA_FBM_offers",
    "Current_BSR",
    "Avg90_BSR",
  ].join(",");

  const lines = rows.map(({ date, p, asin }) => {
    const title = typeof p.title === "string" ? p.title : "";
    const img = typeof p.imagesCSV === "string" && p.imagesCSV ? `https://m.media-amazon.com/images/I/${p.imagesCSV.split(",")[0]}` : "";
    const cat = typeof p.rootCategory === "number" ? String(p.rootCategory) : typeof p.categoryTree === "string" ? p.categoryTree : "";
    const amazonUrl = amazonProductUrl(asin);
    const ms = getMonthlySold(p) ?? "";
    const offers = sumNewOffers(p);
    const priceCents = lowestNewOfferPriceCents(p);
    const usdAmz = centsToUsd(priceCents);
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

    return [
      esc(date),
      esc(title),
      esc(img),
      esc(asin),
      esc(amazonUrl),
      esc(""),
      esc(""),
      esc(cat),
      esc(""),
      esc(usdAmz),
      esc(""),
      esc(""),
      esc(String(ms)),
      esc(String(offers)),
      esc(bsr),
      esc(bsr90),
    ].join(",");
  });

  return [header, ...lines].join("\n");
}
