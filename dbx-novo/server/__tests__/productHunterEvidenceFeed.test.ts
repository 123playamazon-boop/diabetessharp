import { describe, expect, it } from "vitest";
import type { AmazonLeadTableRow } from "../keepaAmazonLeads";
import {
  DEFAULT_EVIDENCE_WINNER_FILTERS,
  buildEvidenceProductIdeasForTests,
  extractConceptFromListing,
  mergeEvidenceFilters,
  parseBsrFromCell,
  parseUsdFromCell,
  passesWinnerFilters,
  scoreEvidenceRow,
} from "../productHunterEvidenceFeed";

function sampleRow(over: Partial<AmazonLeadTableRow> = {}): AmazonLeadTableRow {
  return {
    asin: "B0TEST1234",
    title: "Sample title",
    imageUrl: "",
    amazonUrl: "https://www.amazon.com/dp/B0TEST1234",
    categoryLabel: "Home & Kitchen",
    usdAmazon: "39.99",
    emsMonthly: 200,
    newOffersTotal: 8,
    bsrCurrent: "5000",
    bsrAvg90: "5200",
    roiPct: 35,
    ...over,
  };
}

describe("productHunterEvidenceFeed", () => {
  it("extractConceptFromListing remove marcas CAPS e junta categoria", () => {
    const out = extractConceptFromListing(
      "AMAZING PRO XL Silicon Pet Hair Remover Premium Kitchen",
      "Home & Kitchen",
    );
    expect(out).toBe("Silicon Pet Hair Remover — Home & Kitchen");
  });

  it("parseUsdFromCell e parseBsrFromCell", () => {
    expect(parseUsdFromCell("$19.50")).toBe(19.5);
    expect(parseBsrFromCell("12,345")).toBe(12345);
  });

  it("passesWinnerFilters rejeita preço e BSR fora da banda", () => {
    const f = DEFAULT_EVIDENCE_WINNER_FILTERS;
    expect(passesWinnerFilters(sampleRow(), f)).toBe(true);
    expect(passesWinnerFilters(sampleRow({ usdAmazon: "5.00" }), f)).toBe(false);
    expect(passesWinnerFilters(sampleRow({ emsMonthly: 20 }), f)).toBe(false);
    expect(passesWinnerFilters(sampleRow({ bsrAvg90: "50" }), f)).toBe(false);
    expect(passesWinnerFilters(sampleRow({ roiPct: 10 }), f)).toBe(false);
  });

  it("scoreEvidenceRow devolve 0–100", () => {
    const s = scoreEvidenceRow(sampleRow(), DEFAULT_EVIDENCE_WINNER_FILTERS);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });

  it("mergeEvidenceFilters corrige min/max invertidos", () => {
    const m = mergeEvidenceFilters({ priceMinUsd: 90, priceMaxUsd: 10, bsrMin: 200_000, bsrMax: 500 });
    expect(m.priceMinUsd).toBe(10);
    expect(m.priceMaxUsd).toBe(90);
    expect(m.bsrMin).toBe(500);
    expect(m.bsrMax).toBe(200_000);
  });

  it("buildEvidenceProductIdeasForTests sem LLM produz produtos alinhados aos filtros", async () => {
    const rows = [
      sampleRow({ asin: "B000000001", title: "A", usdAmazon: "30.00", newOffersTotal: 5, roiPct: 40, emsMonthly: 300 }),
      sampleRow({ asin: "B000000002", title: "B", usdAmazon: "25.00", newOffersTotal: 6, roiPct: 28, emsMonthly: 180 }),
    ];
    const r = await buildEvidenceProductIdeasForTests(
      rows,
      DEFAULT_EVIDENCE_WINNER_FILTERS,
      "500 USD",
      "intermediate",
      { disableLlm: true },
    );
    expect(r.llmNarrativeOk).toBe(false);
    expect(r.products.length).toBe(2);
    expect(r.products[0].bestMarketplace).toBe("Amazon USA");
    expect(r.meta.asins.length).toBe(2);
  });
});
