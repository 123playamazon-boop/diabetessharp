import { describe, expect, it } from "vitest";
import type { AmazonLeadTableRow } from "../keepaAmazonLeads";
import { resolveCompetitorAsins } from "../productHunterBriefCompetitors";

function row(asin: string, cat: string, bsr: string): AmazonLeadTableRow {
  return {
    asin,
    title: "t",
    imageUrl: "",
    amazonUrl: `https://www.amazon.com/dp/${asin}`,
    categoryLabel: cat,
    usdAmazon: "30",
    emsMonthly: 200,
    newOffersTotal: 5,
    bsrCurrent: bsr,
    bsrAvg90: bsr,
  };
}

describe("productHunterBriefCompetitors", () => {
  it("resolveCompetitorAsins aceita lista manual 3–5", () => {
    const r = resolveCompetitorAsins({
      editionRows: [],
      seedAsin: "B0SEED0001",
      categoryLabel: "manual",
      manual: ["B0MANUAL01", "B0MANUAL02", "B0MANUAL03"],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.asins).toEqual(["B0MANUAL01", "B0MANUAL02", "B0MANUAL03"]);
  });

  it("resolveCompetitorAsins 400 quando manual tem 1–2 ASINs", () => {
    const r = resolveCompetitorAsins({
      editionRows: [],
      seedAsin: "B0SEED0001",
      categoryLabel: "x",
      manual: ["B0MANUAL01"],
    });
    expect(r.ok).toBe(false);
  });

  it("resolveCompetitorAsins encontra vizinhos na edição por BSR", () => {
    const cat = "Home & Kitchen";
    const rows = [
      row("B0TARGET01", cat, "10000"),
      row("B0NEAR0001", cat, "9200"),
      row("B0NEAR0002", cat, "10800"),
      row("B0NEAR0003", cat, "11500"),
      row("B0FAR00001", cat, "500"),
      row("B0OTHERCAT", "Toys", "9500"),
    ];
    const r = resolveCompetitorAsins({
      editionRows: rows,
      seedAsin: "B0TARGET01",
      categoryLabel: cat,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.asins.length).toBeGreaterThanOrEqual(3);
      expect(r.asins).not.toContain("B0TARGET01");
      expect(r.asins).not.toContain("B0OTHERCAT");
    }
  });

  it("mensagem 400 quando não há vizinhos suficientes", () => {
    const cat = "X";
    const rows = [row("B0TARGET01", cat, "10000"), row("B0ONLY0001", cat, "200000")];
    const r = resolveCompetitorAsins({
      editionRows: rows,
      seedAsin: "B0TARGET01",
      categoryLabel: cat,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("competitorAsins");
    }
  });
});
