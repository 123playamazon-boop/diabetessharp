import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  coerceProductHunterIdea,
  parseEvidenceHunter,
  parseProductHunterCandidate,
  listProductHunterCandidates,
  patchProductHunterCandidate,
  postProductHunter,
} from "./productHunterApi";

describe("productHunterApi", () => {
  describe("coerceProductHunterIdea", () => {
    it("accepts a valid idea object", () => {
      const p = coerceProductHunterIdea({
        idea: "Test",
        demandLevel: "high",
        competitionLevel: "medium",
        estimatedProfitMargin: "20%",
        bestMarketplace: "Amazon USA",
        logisticsFeasibility: "Small parcel.",
        whyTrending: "Trend.",
        sellingStrategy: "Strategy.",
        opportunityScore: 72.4,
      });
      expect(p).not.toBeNull();
      expect(p!.opportunityScore).toBe(72);
    });

    it("rejects invalid demand", () => {
      expect(
        coerceProductHunterIdea({
          idea: "Test",
          demandLevel: "nope",
          competitionLevel: "medium",
          estimatedProfitMargin: "20%",
          bestMarketplace: "Amazon USA",
          logisticsFeasibility: "Small parcel.",
          whyTrending: "Trend.",
          sellingStrategy: "Strategy.",
          opportunityScore: 50,
        }),
      ).toBeNull();
    });
  });

  describe("parseEvidenceHunter", () => {
    it("allows empty products with summary", () => {
      const r = parseEvidenceHunter({
        hunter: { products: [], summary: "No rows passed filters." },
      });
      expect(r).not.toBeNull();
      expect(r!.products).toEqual([]);
      expect(r!.summary).toBe("No rows passed filters.");
    });
  });

  describe("parseProductHunterCandidate", () => {
    it("parses a minimal valid candidate", () => {
      const c = parseProductHunterCandidate({
        id: "phc-1",
        suite: "suite-a",
        savedAtIso: "2026-01-01T00:00:00.000Z",
        updatedAtIso: "2026-01-01T00:00:00.000Z",
        source: "hunter_run",
        status: "saved",
        idea: {
          idea: "Gadget",
          demandLevel: "high",
          competitionLevel: "low",
          estimatedProfitMargin: "25%",
          bestMarketplace: "Amazon USA",
          logisticsFeasibility: "FBA.",
          whyTrending: "Signals.",
          sellingStrategy: "PPC caps.",
          opportunityScore: 80,
        },
      });
      expect(c).not.toBeNull();
      expect(c!.id).toBe("phc-1");
      expect(c!.status).toBe("saved");
    });
  });

  describe("fetch wrappers", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ ok: true, candidates: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("listProductHunterCandidates calls GET /api/client/product-hunter/candidates", async () => {
      const r = await listProductHunterCandidates();
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.candidates).toEqual([]);
      expect(fetch).toHaveBeenCalledWith(
        "/api/client/product-hunter/candidates",
        expect.objectContaining({ headers: expect.any(Object) }),
      );
    });

    it("postProductHunter inclui locale no JSON", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            mode: "demo",
            hunter: {
              products: [
                {
                  idea: "x",
                  demandLevel: "high",
                  competitionLevel: "low",
                  estimatedProfitMargin: "10%",
                  bestMarketplace: "Amazon USA",
                  logisticsFeasibility: "a",
                  whyTrending: "b",
                  sellingStrategy: "c",
                  opportunityScore: 50,
                },
                {
                  idea: "y",
                  demandLevel: "high",
                  competitionLevel: "low",
                  estimatedProfitMargin: "10%",
                  bestMarketplace: "Amazon USA",
                  logisticsFeasibility: "a",
                  whyTrending: "b",
                  sellingStrategy: "c",
                  opportunityScore: 40,
                },
                {
                  idea: "z",
                  demandLevel: "high",
                  competitionLevel: "low",
                  estimatedProfitMargin: "10%",
                  bestMarketplace: "Amazon USA",
                  logisticsFeasibility: "a",
                  whyTrending: "b",
                  sellingStrategy: "c",
                  opportunityScore: 30,
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      await postProductHunter({
        budget: "1",
        marketplace: "amazon_us",
        experienceLevel: "beginner",
        locale: "en",
      });
      expect(fetch).toHaveBeenCalledWith(
        "/api/client/product-hunter",
        expect.objectContaining({
          body: expect.stringContaining('"locale":"en"'),
        }),
      );
    });

    it("patchProductHunterCandidate sends nested patch body", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            candidate: {
              id: "x",
              suite: "s",
              savedAtIso: "2026-01-01T00:00:00.000Z",
              updatedAtIso: "2026-01-01T00:00:00.000Z",
              source: "manual",
              status: "testing",
              idea: {
                idea: "Gadget",
                demandLevel: "high",
                competitionLevel: "low",
                estimatedProfitMargin: "25%",
                bestMarketplace: "Amazon USA",
                logisticsFeasibility: "FBA.",
                whyTrending: "Signals.",
                sellingStrategy: "PPC caps.",
                opportunityScore: 80,
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      const r = await patchProductHunterCandidate("x", { status: "testing" });
      expect(r.ok).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        "/api/client/product-hunter/candidates/x",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ patch: { status: "testing" } }),
        }),
      );
    });
  });
});
