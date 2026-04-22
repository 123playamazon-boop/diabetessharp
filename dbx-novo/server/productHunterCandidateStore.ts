import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type ProductHunterCandidate,
  type ProductHunterCandidateSource,
  type ProductHunterCandidateStatus,
  type ProductHunterIdea,
  isProductHunterCandidateSource,
  isProductHunterCandidateStatus,
} from "../shared/productHunter";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_DATA_FILE = path.join(__dirname, "data", "product-hunter-candidates.json");

function resolveDataFile(): string {
  const override = process.env.PRODUCT_HUNTER_CANDIDATES_DATA_FILE?.trim();
  if (override) return path.isAbsolute(override) ? override : path.resolve(process.cwd(), override);
  return DEFAULT_DATA_FILE;
}

const DATA_FILE = resolveDataFile();

const NOTES_MAX_LEN = 2000;

type Snapshot = { candidates: ProductHunterCandidate[] };

function emptySnapshot(): Snapshot {
  return { candidates: [] };
}

function sanitizeNotes(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const t = raw.trim();
  if (!t) return undefined;
  return t.length > NOTES_MAX_LEN ? t.slice(0, NOTES_MAX_LEN) : t;
}

function normalizeIdea(raw: unknown): ProductHunterIdea | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const idea = typeof o.idea === "string" ? o.idea.trim() : "";
  const estimatedProfitMargin = typeof o.estimatedProfitMargin === "string" ? o.estimatedProfitMargin.trim() : "";
  const bestMarketplace = typeof o.bestMarketplace === "string" ? o.bestMarketplace.trim() : "";
  const logisticsFeasibility = typeof o.logisticsFeasibility === "string" ? o.logisticsFeasibility.trim() : "";
  const whyTrending = typeof o.whyTrending === "string" ? o.whyTrending.trim() : "";
  const sellingStrategy = typeof o.sellingStrategy === "string" ? o.sellingStrategy.trim() : "";
  if (!idea || !estimatedProfitMargin || !bestMarketplace || !logisticsFeasibility || !whyTrending || !sellingStrategy) return null;
  const demandLevel = o.demandLevel === "high" || o.demandLevel === "medium" || o.demandLevel === "low" ? o.demandLevel : "medium";
  const competitionLevel =
    o.competitionLevel === "high" || o.competitionLevel === "medium" || o.competitionLevel === "low" ? o.competitionLevel : "medium";
  const scoreRaw = typeof o.opportunityScore === "number" ? o.opportunityScore : Number(o.opportunityScore);
  const opportunityScore = Number.isFinite(scoreRaw) ? Math.max(0, Math.min(100, Math.round(scoreRaw))) : 0;
  return {
    idea: idea.slice(0, 500),
    demandLevel,
    competitionLevel,
    estimatedProfitMargin: estimatedProfitMargin.slice(0, 80),
    bestMarketplace: bestMarketplace.slice(0, 120),
    logisticsFeasibility: logisticsFeasibility.slice(0, 1200),
    whyTrending: whyTrending.slice(0, 1200),
    sellingStrategy: sellingStrategy.slice(0, 1200),
    opportunityScore,
  };
}

function normalizeCandidate(raw: unknown): ProductHunterCandidate | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  const suite = typeof r.suite === "string" ? r.suite.trim() : "";
  const savedAtIso = typeof r.savedAtIso === "string" ? r.savedAtIso : "";
  const updatedAtIso = typeof r.updatedAtIso === "string" ? r.updatedAtIso : "";
  const sourceRaw = r.source;
  const source: ProductHunterCandidateSource | null =
    typeof sourceRaw === "string" && isProductHunterCandidateSource(sourceRaw) ? sourceRaw : null;
  const statusRaw = r.status;
  const status: ProductHunterCandidateStatus | null =
    typeof statusRaw === "string" && isProductHunterCandidateStatus(statusRaw) ? statusRaw : null;
  const idea = normalizeIdea(r.idea);
  if (!id || !suite || !savedAtIso || !updatedAtIso || !source || !status || !idea) return null;
  const notes = typeof r.notes === "string" ? sanitizeNotes(r.notes) : undefined;
  return { id, suite, savedAtIso, updatedAtIso, source, idea, status, notes };
}

function readSnapshot(): Snapshot {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return emptySnapshot();
    const o = j as Partial<Snapshot>;
    const candidates: ProductHunterCandidate[] = [];
    if (Array.isArray(o.candidates)) {
      for (const x of o.candidates) {
        const c = normalizeCandidate(x);
        if (c) candidates.push(c);
      }
    }
    return { candidates };
  } catch {
    return emptySnapshot();
  }
}

function writeSnapshot(s: Snapshot): void {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(s, null, 2), "utf8");
}

function newCandidateId(): string {
  const rnd = Math.random().toString(36).slice(2, 10);
  return `phc-${Date.now().toString(36)}-${rnd}`;
}

export function readAllCandidates(): ProductHunterCandidate[] {
  return readSnapshot().candidates;
}

export function listCandidatesBySuite(suite: string): ProductHunterCandidate[] {
  const s = suite.trim();
  if (!s) return [];
  return readSnapshot()
    .candidates.filter((c) => c.suite === s)
    .sort((a, b) => Date.parse(b.savedAtIso) - Date.parse(a.savedAtIso));
}

export function saveCandidate(suite: string, idea: ProductHunterIdea, source: ProductHunterCandidateSource): ProductHunterCandidate {
  const sTrim = suite.trim();
  const now = new Date().toISOString();
  const c: ProductHunterCandidate = {
    id: newCandidateId(),
    suite: sTrim,
    savedAtIso: now,
    updatedAtIso: now,
    source,
    idea,
    status: "saved",
  };
  const snap = readSnapshot();
  snap.candidates.push(c);
  writeSnapshot(snap);
  return c;
}

export function patchCandidate(
  suite: string,
  id: string,
  patch: { status?: ProductHunterCandidateStatus; notes?: string },
): ProductHunterCandidate | null {
  const sTrim = suite.trim();
  const idTrim = id.trim();
  if (!sTrim || !idTrim) return null;
  const snap = readSnapshot();
  const i = snap.candidates.findIndex((c) => c.id === idTrim);
  if (i < 0) return null;
  const cur = snap.candidates[i];
  if (cur.suite !== sTrim) return null;
  const next: ProductHunterCandidate = { ...cur, updatedAtIso: new Date().toISOString() };
  if (patch.status !== undefined) next.status = patch.status;
  if (patch.notes !== undefined) next.notes = sanitizeNotes(patch.notes);
  snap.candidates[i] = next;
  writeSnapshot(snap);
  return next;
}

export function deleteCandidate(suite: string, id: string): boolean {
  const sTrim = suite.trim();
  const idTrim = id.trim();
  if (!sTrim || !idTrim) return false;
  const snap = readSnapshot();
  const idx = snap.candidates.findIndex((c) => c.id === idTrim);
  if (idx < 0) return false;
  if (snap.candidates[idx].suite !== sTrim) return false;
  snap.candidates.splice(idx, 1);
  writeSnapshot(snap);
  return true;
}
