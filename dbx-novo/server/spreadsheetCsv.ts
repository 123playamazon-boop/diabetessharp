import * as XLSX from "xlsx";
import type { AmazonLeadTableRow, LeadRowStatus } from "./keepaAmazonLeads";

/** Campos opcionais vindos da planilha (chaves normalizadas). */
export type LeadSupplementFields = {
  store_url?: string;
  store_product_url?: string;
  product_usd?: string;
  notas?: string;
  shipping_usd?: string;
  cash_back?: string;
  lead_status?: string;
};

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQ = !inQ;
      continue;
    }
    if (!inQ && c === ",") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function normHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Mapeia cabeçalho da planilha → campo interno. */
function mapHeaderToField(h: string): keyof LeadSupplementFields | "asin" | null {
  const n = normHeader(h);
  const aliases: Record<string, keyof LeadSupplementFields | "asin"> = {
    asin: "asin",
    amazon_asin: "asin",
    store_url: "store_url",
    loja: "store_url",
    url_loja: "store_url",
    link_loja: "store_product_url",
    store_product_url: "store_product_url",
    produto_usd: "product_usd",
    product_usd: "product_usd",
    preco_loja: "product_usd",
    usd_produto: "product_usd",
    notas: "notas",
    notes: "notas",
    frete_usd: "shipping_usd",
    shipping_usd: "shipping_usd",
    frete: "shipping_usd",
    cash_back: "cash_back",
    cashback: "cash_back",
    status: "lead_status",
    lead_status: "lead_status",
  };
  return aliases[n] ?? null;
}

function parseLeadStatus(v: string | undefined): LeadRowStatus | undefined {
  if (!v) return undefined;
  const s = v.trim().toLowerCase();
  if (s === "lista" || s === "status_lista") return "lista";
  if (s === "aprovado" || s === "aprovados") return "aprovado";
  if (s === "reprovado" || s === "reprovados") return "reprovado";
  return undefined;
}

export type ParsedSupplements = {
  /** ASIN uppercase → campos da planilha */
  byAsin: Map<string, LeadSupplementFields>;
  asinOrder: string[];
  errors: string[];
};

const MAX_ROWS = 200;

function cellToString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

function csvEscapeCell(s: string): string {
  const t = s.replace(/"/g, '""');
  return /[,"\r\n]/.test(t) ? `"${t}"` : t;
}

/**
 * Primeira linha = cabeçalhos (texto); linhas seguintes = dados. Coluna obrigatória mapeada para `asin`.
 */
export function parseLeadSupplementTable(
  headerCells: string[],
  dataRows: string[][],
): { ok: true; data: ParsedSupplements } | { ok: false; error: string } {
  if (headerCells.length === 0) return { ok: false, error: "Cabeçalho vazio." };

  const colIndex: (keyof LeadSupplementFields | "asin" | null)[] = headerCells.map((h) => mapHeaderToField(h));
  if (!colIndex.includes("asin")) {
    return {
      ok: false,
      error: `Coluna «asin» em falta no cabeçalho. Recebido: ${headerCells.join(", ")}`,
    };
  }

  const byAsin = new Map<string, LeadSupplementFields>();
  const asinOrder: string[] = [];
  const errors: string[] = [];

  for (let r = 0; r < dataRows.length && r < MAX_ROWS; r++) {
    const cells = dataRows[r] ?? [];
    if (!cells.some((c) => c.trim().length > 0)) continue;

    const row: LeadSupplementFields & { asin?: string } = {};
    for (let c = 0; c < Math.min(colIndex.length, cells.length); c++) {
      const key = colIndex[c];
      if (!key || key === "asin") continue;
      const val = cells[c]?.trim();
      if (val) (row as Record<string, string>)[key] = val;
    }
    const asinIdx = colIndex.indexOf("asin");
    const asinRaw = asinIdx >= 0 ? cells[asinIdx]?.trim().toUpperCase() : "";
    const asin = /^B[A-Z0-9]{9}$/.test(asinRaw) ? asinRaw : "";
    if (!asin) {
      errors.push(`Linha ${r + 2}: ASIN inválido ou vazio («${asinRaw || "—"}»).`);
      continue;
    }
    if (!byAsin.has(asin)) asinOrder.push(asin);
    const prev = byAsin.get(asin) ?? {};
    byAsin.set(asin, {
      ...prev,
      ...row,
      lead_status: row.lead_status ?? prev.lead_status,
    });
  }

  if (asinOrder.length === 0) {
    return { ok: false, error: errors.length ? errors.slice(0, 8).join(" ") : "Nenhum ASIN válido na planilha." };
  }

  return { ok: true, data: { byAsin, asinOrder, errors } };
}

/** CSV canónico (UTF-8) para colar no admin — colunas estáveis. */
export function supplementsToCanonicalCsv(data: ParsedSupplements): string {
  const cols: (keyof LeadSupplementFields)[] = [
    "store_url",
    "store_product_url",
    "product_usd",
    "shipping_usd",
    "cash_back",
    "notas",
    "lead_status",
  ];
  const head = ["asin", ...cols].join(",");
  const lines = [head];
  for (const asin of data.asinOrder) {
    const s = data.byAsin.get(asin)!;
    lines.push([csvEscapeCell(asin), ...cols.map((c) => csvEscapeCell((s[c] ?? "").trim()))].join(","));
  }
  return lines.join("\n");
}

/**
 * Lê CSV (UTF-8) com cabeçalho na 1.ª linha. Coluna obrigatória: asin (vários nomes aceites).
 * Exportar do Excel: «Guardar como» → CSV UTF-8 (delimitado por vírgulas).
 */
export function parseLeadSupplementCsv(csvText: string): { ok: true; data: ParsedSupplements } | { ok: false; error: string } {
  const raw = csvText.replace(/^\uFEFF/, "").trim();
  if (!raw) return { ok: false, error: "CSV vazio." };

  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { ok: false, error: "CSV precisa de cabeçalho + pelo menos uma linha de dados." };

  const headerCells = parseCsvLine(lines[0]!);
  const dataRows = lines.slice(1, MAX_ROWS + 1).map((line) => parseCsvLine(line));
  return parseLeadSupplementTable(headerCells, dataRows);
}

export type ParsedSpreadsheetFile = {
  sheetName: string;
  data: ParsedSupplements;
  canonicalCsv: string;
};

/** Lê a 1.ª folha de um .xlsx / .xls (buffer). Cabeçalhos na linha 1; mesmos aliases que o CSV. */
export function parseLeadSupplementXlsxBuffer(buf: Buffer): { ok: true; value: ParsedSpreadsheetFile } | { ok: false; error: string } {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "buffer", cellDates: true, cellNF: false, sheetStubs: true });
  } catch {
    return { ok: false, error: "Ficheiro Excel inválido ou corrompido." };
  }
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { ok: false, error: "Livro sem folhas." };
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return { ok: false, error: "Primeira folha em falta." };

  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  if (!aoa.length) return { ok: false, error: "Folha vazia." };

  const rows = aoa.map((row) => (Array.isArray(row) ? row.map(cellToString) : []));
  const headerCells = (rows[0] ?? []).map((h) => String(h));
  const dataRows = rows.slice(1).map((r) => {
    const pad = [...r];
    while (pad.length < headerCells.length) pad.push("");
    return pad;
  });

  const parsed = parseLeadSupplementTable(headerCells, dataRows);
  if (!parsed.ok) return parsed;

  return {
    ok: true,
    value: {
      sheetName,
      data: parsed.data,
      canonicalCsv: supplementsToCanonicalCsv(parsed.data),
    },
  };
}

export function mergeKeepaRowWithSupplement(row: AmazonLeadTableRow, sup: LeadSupplementFields | undefined): AmazonLeadTableRow {
  if (!sup) return row;
  const st = parseLeadStatus(sup.lead_status);
  return {
    ...row,
    storeUrl: sup.store_url?.trim() || row.storeUrl,
    storeProductUrl: sup.store_product_url?.trim() || row.storeProductUrl,
    productUsd: sup.product_usd?.trim() || row.productUsd,
    notas: sup.notas?.trim() || row.notas,
    shippingUsd: sup.shipping_usd?.trim() || row.shippingUsd,
    cashBack: sup.cash_back?.trim() || row.cashBack,
    leadStatus: st ?? row.leadStatus,
  };
}
