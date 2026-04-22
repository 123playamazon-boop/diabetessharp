import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AmazonLeadTableRow, LeadRules } from "./keepaAmazonLeads";

export type AmazonLeadsDailyEdition = {
  editionDate: string;
  publishedAtIso: string;
  rowCount: number;
  rows: AmazonLeadTableRow[];
  csv: string;
  pipelineNote?: string;
  rulesSnapshot: LeadRules;
  asinsRequested: number;
  rejectedCount: number;
};

type FileShape = { editions: AmazonLeadsDailyEdition[] };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data", "amazon-leads-daily.json");

function load(): FileShape {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const j = JSON.parse(raw) as FileShape;
    if (!j || !Array.isArray(j.editions)) return { editions: [] };
    return { editions: j.editions };
  } catch {
    return { editions: [] };
  }
}

function persist(s: FileShape): void {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(s, null, 2), "utf8");
}

function sortDesc(a: AmazonLeadsDailyEdition, b: AmazonLeadsDailyEdition): number {
  if (a.editionDate !== b.editionDate) return a.editionDate < b.editionDate ? 1 : -1;
  return a.publishedAtIso < b.publishedAtIso ? 1 : -1;
}

export function getLatestEdition(): AmazonLeadsDailyEdition | null {
  const { editions } = load();
  if (!editions.length) return null;
  return [...editions].sort(sortDesc)[0] ?? null;
}

export function getEditionByDate(editionDate: string): AmazonLeadsDailyEdition | null {
  const d = editionDate.trim();
  return load().editions.find((e) => e.editionDate === d) ?? null;
}

export function listEditionDatesDesc(limit: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of [...load().editions].sort(sortDesc)) {
    if (seen.has(e.editionDate)) continue;
    seen.add(e.editionDate);
    out.push(e.editionDate);
    if (out.length >= limit) break;
  }
  return out;
}

export function listEditionsMetaDesc(): Omit<AmazonLeadsDailyEdition, "rows" | "csv">[] {
  return [...load().editions]
    .sort(sortDesc)
    .map(({ rows: _r, csv: _c, ...rest }) => rest);
}

export function upsertDailyEdition(edition: AmazonLeadsDailyEdition): void {
  const s = load();
  const i = s.editions.findIndex((e) => e.editionDate === edition.editionDate);
  const next = [...s.editions];
  if (i >= 0) next[i] = edition;
  else next.push(edition);
  persist({ editions: next });
}

/** Remove todas as edições (ex.: reset global antes de testes com dados reais). */
export function clearAllAmazonLeadsEditions(): void {
  persist({ editions: [] });
}
