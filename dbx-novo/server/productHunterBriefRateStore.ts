import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_FILE = path.join(__dirname, "data", "product-hunter-brief-rate.json");

function resolveFile(): string {
  const o = process.env.PRODUCT_HUNTER_BRIEF_RATE_FILE?.trim();
  if (o) return path.isAbsolute(o) ? o : path.resolve(process.cwd(), o);
  return DEFAULT_FILE;
}

const DATA_FILE = resolveFile();

export type BriefRateEntry = { dateIso: string; count: number };

type Snapshot = Record<string, BriefRateEntry>;

function empty(): Snapshot {
  return {};
}

function readSnap(): Snapshot {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return empty();
    const out: Snapshot = {};
    for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
      if (!v || typeof v !== "object") continue;
      const o = v as Record<string, unknown>;
      const dateIso = typeof o.dateIso === "string" ? o.dateIso.trim() : "";
      const count = typeof o.count === "number" && Number.isFinite(o.count) ? Math.max(0, Math.floor(o.count)) : 0;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) continue;
      out[k.trim()] = { dateIso, count };
    }
    return out;
  } catch {
    return empty();
  }
}

function writeSnap(s: Snapshot): void {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(s, null, 2), "utf8");
}

export function utcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nextUtcMidnightIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0)).toISOString();
}

export function maxBriefsPerDay(): number {
  const n = Number.parseInt(process.env.PRODUCT_HUNTER_BRIEF_MAX_PER_DAY ?? "10", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(500, Math.floor(n)) : 10;
}

/** Increments count if under daily cap (UTC calendar day). Returns ok false when capped. */
export function tryConsumeBriefSlot(suite: string): { ok: true } | { ok: false; resetsAtIso: string; max: number } {
  const s = suite.trim();
  const max = maxBriefsPerDay();
  const today = utcDateString();
  const snap = readSnap();
  const prev = snap[s];
  let count = 0;
  if (prev && prev.dateIso === today) count = prev.count;
  if (count >= max) {
    return { ok: false, resetsAtIso: nextUtcMidnightIso(), max };
  }
  snap[s] = { dateIso: today, count: count + 1 };
  writeSnap(snap);
  return { ok: true };
}

/** Test helper: reset suite entry */
export function clearBriefRateForSuite(suite: string): void {
  const snap = readSnap();
  delete snap[suite.trim()];
  writeSnap(snap);
}
