import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sampleIdea = {
  idea: "Test SKU concept",
  demandLevel: "high",
  competitionLevel: "low",
  estimatedProfitMargin: "20–30%",
  bestMarketplace: "Amazon USA",
  logisticsFeasibility: "Small parcel.",
  whyTrending: "Steady demand.",
  sellingStrategy: "Focus on reviews.",
  opportunityScore: 72,
};

describe("productHunterCandidateStore", () => {
  let tmpFile: string;
  let prevEnv: string | undefined;

  beforeEach(() => {
    prevEnv = process.env.PRODUCT_HUNTER_CANDIDATES_DATA_FILE;
    tmpFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "phc-test-")), "candidates.json");
    process.env.PRODUCT_HUNTER_CANDIDATES_DATA_FILE = tmpFile;
    vi.resetModules();
  });

  afterEach(() => {
    if (prevEnv === undefined) delete process.env.PRODUCT_HUNTER_CANDIDATES_DATA_FILE;
    else process.env.PRODUCT_HUNTER_CANDIDATES_DATA_FILE = prevEnv;
    try {
      if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      const dir = path.dirname(tmpFile);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
    } catch {
      /* ignore */
    }
    vi.resetModules();
  });

  it("saveCandidate e listCandidatesBySuite devolvem o registo (newest-first)", async () => {
    const {
      saveCandidate,
      listCandidatesBySuite,
    } = await import("../productHunterCandidateStore");
    const a = saveCandidate("suite-a", sampleIdea, "hunter_run");
    expect(a.id.startsWith("phc-")).toBe(true);
    expect(a.status).toBe("saved");
    const list = listCandidatesBySuite("suite-a");
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(a.id);
  });

  it("listCandidatesBySuite só devolve candidatos da suite pedida", async () => {
    const { saveCandidate, listCandidatesBySuite } = await import("../productHunterCandidateStore");
    saveCandidate("suite-x", sampleIdea, "manual");
    saveCandidate("suite-y", { ...sampleIdea, idea: "Other" }, "hunter_run");
    expect(listCandidatesBySuite("suite-x").length).toBe(1);
    expect(listCandidatesBySuite("suite-x")[0].suite).toBe("suite-x");
    expect(listCandidatesBySuite("suite-y").length).toBe(1);
    expect(listCandidatesBySuite("suite-z").length).toBe(0);
  });

  it("patchCandidate actualiza status e notes", async () => {
    const { saveCandidate, patchCandidate, listCandidatesBySuite } = await import("../productHunterCandidateStore");
    const c = saveCandidate("s1", sampleIdea, "hunter_run");
    const u = patchCandidate("s1", c.id, { status: "testing", notes: "  hello  " });
    expect(u).not.toBeNull();
    expect(u?.status).toBe("testing");
    expect(u?.notes).toBe("hello");
    const again = listCandidatesBySuite("s1")[0];
    expect(again.status).toBe("testing");
    expect(again.notes).toBe("hello");
  });

  it("patchCandidate com id de outra suite devolve null", async () => {
    const { saveCandidate, patchCandidate } = await import("../productHunterCandidateStore");
    const other = saveCandidate("suite-b", sampleIdea, "hunter_run");
    const out = patchCandidate("suite-a", other.id, { status: "launched" });
    expect(out).toBeNull();
  });

  it("deleteCandidate com id de outra suite devolve false", async () => {
    const { saveCandidate, deleteCandidate, listCandidatesBySuite } = await import("../productHunterCandidateStore");
    const other = saveCandidate("suite-b", sampleIdea, "hunter_run");
    expect(deleteCandidate("suite-a", other.id)).toBe(false);
    expect(listCandidatesBySuite("suite-b").length).toBe(1);
  });

  it("patchCandidate trunca notes acima de 2000 caracteres", async () => {
    const { saveCandidate, patchCandidate } = await import("../productHunterCandidateStore");
    const c = saveCandidate("s-trunc", sampleIdea, "manual");
    const long = "x".repeat(2001);
    const u = patchCandidate("s-trunc", c.id, { notes: long });
    expect(u?.notes?.length).toBe(2000);
  });
});
