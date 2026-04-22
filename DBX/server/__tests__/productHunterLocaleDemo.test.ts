import { describe, expect, it } from "vitest";
import { buildDemoProductHunter } from "../../shared/productHunter";
import { buildDeterministicIdea } from "../productHunterEvidenceFeed";
import type { AmazonLeadTableRow } from "../keepaAmazonLeads";

describe("Product Hunter locale demo", () => {
  it("buildDemoProductHunter pt-BR usa copy em português brasileiro", () => {
    const r = buildDemoProductHunter("3k USD", "amazon_us", "intermediate", "pt-BR");
    expect(r.summary).toContain("Modo demo");
    expect(r.products.some((p) => p.idea.includes("cozinha"))).toBe(true);
  });

  it("buildDemoProductHunter en mantém copy em inglês", () => {
    const r = buildDemoProductHunter("3k USD", "amazon_us", "intermediate", "en");
    expect(r.summary).toContain("Demo mode");
    expect(r.products.some((p) => /kitchen/i.test(p.idea))).toBe(true);
  });

  it("buildDeterministicIdea pt-BR usa placeholder localizado", () => {
    const row: AmazonLeadTableRow = {
      asin: "B0TEST1234",
      title: "Widget",
      imageUrl: "",
      amazonUrl: "https://www.amazon.com/dp/B0TEST1234",
      categoryLabel: "Home",
      usdAmazon: "29.99",
      emsMonthly: 200,
      newOffersTotal: 5,
      bsrCurrent: "8000",
      bsrAvg90: "8200",
      roiPct: 30,
    };
    const idea = buildDeterministicIdea(row, 70, "pt-BR");
    expect(idea.logisticsFeasibility).toContain("Modo demo");
  });
});
