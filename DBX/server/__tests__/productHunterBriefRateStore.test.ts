import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("productHunterBriefRateStore", () => {
  let tmpFile: string;
  let prevEnv: string | undefined;
  let prevMax: string | undefined;

  beforeEach(() => {
    prevEnv = process.env.PRODUCT_HUNTER_BRIEF_RATE_FILE;
    prevMax = process.env.PRODUCT_HUNTER_BRIEF_MAX_PER_DAY;
    tmpFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "phbr-test-")), "product-hunter-brief-rate.json");
    process.env.PRODUCT_HUNTER_BRIEF_RATE_FILE = tmpFile;
    process.env.PRODUCT_HUNTER_BRIEF_MAX_PER_DAY = "2";
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    if (prevEnv === undefined) delete process.env.PRODUCT_HUNTER_BRIEF_RATE_FILE;
    else process.env.PRODUCT_HUNTER_BRIEF_RATE_FILE = prevEnv;
    if (prevMax === undefined) delete process.env.PRODUCT_HUNTER_BRIEF_MAX_PER_DAY;
    else process.env.PRODUCT_HUNTER_BRIEF_MAX_PER_DAY = prevMax;
    try {
      if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      const dir = path.dirname(tmpFile);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
    } catch {
      /* ignore */
    }
    vi.resetModules();
  });

  it("reseta contador após meia-noite UTC (novo dateIso)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T12:00:00.000Z"));
    const { tryConsumeBriefSlot, clearBriefRateForSuite } = await import("../productHunterBriefRateStore");
    clearBriefRateForSuite("suite-a");
    expect(tryConsumeBriefSlot("suite-a").ok).toBe(true);
    expect(tryConsumeBriefSlot("suite-a").ok).toBe(true);
    const fail = tryConsumeBriefSlot("suite-a");
    expect(fail.ok).toBe(false);
    if (!fail.ok) {
      expect(fail.max).toBe(2);
      expect(fail.resetsAtIso).toMatch(/2026-04-22T00:00:00\.000Z/);
    }
    vi.setSystemTime(new Date("2026-04-22T00:00:01.000Z"));
    vi.resetModules();
    process.env.PRODUCT_HUNTER_BRIEF_RATE_FILE = tmpFile;
    process.env.PRODUCT_HUNTER_BRIEF_MAX_PER_DAY = "2";
    const mod2 = await import("../productHunterBriefRateStore");
    expect(mod2.tryConsumeBriefSlot("suite-a").ok).toBe(true);
  });
});
