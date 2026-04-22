/**
 * Pick competitor ASINs from an Amazon leads edition using BSR proximity + category.
 */

import type { AmazonLeadTableRow } from "./keepaAmazonLeads";
import { parseBsrFromCell } from "./productHunterEvidenceFeed";

export function pickBsrFromLeadRow(row: AmazonLeadTableRow): number | null {
  return parseBsrFromCell(row.bsrAvg90) ?? parseBsrFromCell(row.bsrCurrent);
}

function bsrBand(candidateBsr: number, pct: number): { lo: number; hi: number } {
  const spanUp = Math.max(1, Math.floor(candidateBsr * pct));
  const spanDown = Math.max(Math.floor(candidateBsr * pct), 500);
  const lo = Math.max(1, candidateBsr - spanDown);
  const hi = candidateBsr + spanUp;
  return { lo, hi };
}

function sameCategory(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function neighborsInBand(
  rows: AmazonLeadTableRow[],
  seedAsin: string,
  categoryLabel: string,
  candidateBsr: number,
  pct: number,
  maxPick: number,
): string[] {
  const { lo, hi } = bsrBand(candidateBsr, pct);
  const seed = seedAsin.trim().toUpperCase();
  const scored: { asin: string; bsr: number; dist: number }[] = [];
  for (const row of rows) {
    const asin = row.asin.trim().toUpperCase();
    if (!asin || asin === seed) continue;
    if (!sameCategory(row.categoryLabel ?? "", categoryLabel)) continue;
    const bsr = pickBsrFromLeadRow(row);
    if (bsr == null || bsr < lo || bsr > hi) continue;
    scored.push({ asin, bsr, dist: Math.abs(bsr - candidateBsr) });
  }
  scored.sort((a, b) => a.dist - b.dist);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of scored) {
    if (seen.has(s.asin)) continue;
    seen.add(s.asin);
    out.push(s.asin);
    if (out.length >= maxPick) break;
  }
  return out;
}

const MIN_COMPETITORS = 3;
const MAX_COMPETITORS = 5;

export type ResolveCompetitorsResult =
  | { ok: true; asins: string[] }
  | { ok: false; error: string };

/**
 * Resolves 3–5 competitor ASINs: manual list or BSR neighbours in edition (±30%, then ±50%).
 */
export function resolveCompetitorAsins(params: {
  editionRows: AmazonLeadTableRow[];
  seedAsin: string;
  categoryLabel: string;
  manual?: string[];
}): ResolveCompetitorsResult {
  const manual = params.manual?.map((a) => a.trim().toUpperCase()).filter((a) => /^B[A-Z0-9]{9}$/.test(a)) ?? [];
  if (manual.length >= MIN_COMPETITORS) {
    const uniq = [...new Set(manual)].slice(0, MAX_COMPETITORS);
    return { ok: true, asins: uniq };
  }
  if (manual.length > 0 && manual.length < MIN_COMPETITORS) {
    return { ok: false, error: "Indique entre 3 e 5 ASINs em «competitorAsins», ou omita para seleção automática." };
  }

  const seed = params.seedAsin.trim().toUpperCase();
  const seedRow = params.editionRows.find((r) => r.asin.trim().toUpperCase() === seed);
  if (!seedRow) {
    return { ok: false, error: "ASIN alvo não encontrado nesta edição de leads." };
  }
  const cat = params.categoryLabel.trim() || (seedRow.categoryLabel ?? "").trim();
  if (!cat) {
    return {
      ok: false,
      error:
        "Não foi possível achar concorrentes suficientes para gerar brief automático. Envie 3–5 ASINs em «competitorAsins».",
    };
  }
  const candidateBsr = pickBsrFromLeadRow(seedRow);
  if (candidateBsr == null) {
    return {
      ok: false,
      error:
        "Não foi possível achar concorrentes suficientes para gerar brief automático. Envie 3–5 ASINs em «competitorAsins».",
    };
  }

  let asins = neighborsInBand(params.editionRows, seed, cat, candidateBsr, 0.3, MAX_COMPETITORS);
  if (asins.length < MIN_COMPETITORS) {
    asins = neighborsInBand(params.editionRows, seed, cat, candidateBsr, 0.5, MAX_COMPETITORS);
  }
  if (asins.length < MIN_COMPETITORS) {
    return {
      ok: false,
      error:
        "Não foi possível achar concorrentes suficientes para gerar brief automático. Envie 3–5 ASINs em «competitorAsins».",
    };
  }
  return { ok: true, asins: asins.slice(0, MAX_COMPETITORS) };
}
