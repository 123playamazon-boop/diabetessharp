import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findBySuite } from "./clientRegistryStore";
import { queueDemoEmail } from "./emailOutbox";
import { migrateStorageStartFromArrival, summarizeStorageFreeServer } from "./storageFreeMath";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data", "inventory.json");

export type InventoryJsonRow = {
  id: string;
  asin: string;
  title: string;
  qty: number;
  kind: string;
  storageDays: number;
  storageLimitDays: number;
  /** ISO — início dos dias grátis de armazenagem (cadastro). */
  storageFreeStartIso?: string;
  imageUrl?: string;
  unitPriceUsd?: number;
  fbmUnitLabelReady?: boolean;
  /** Suite do cliente que criou o cadastro (multi-tenant demo). */
  clientSuite?: string;
  clientName?: string;
  supplier?: string;
  brand?: string;
  condition?: string;
  poNumber?: string;
  arrivalDate?: string;
  notes?: string;
  color?: string;
  size?: string;
  model?: string;
  upc?: string;
  tracking?: string;
  productCostUsd?: number;
  prepCenterPlan?: string;
  prepCenterServiceId?: string;
  platformFeePct?: number;
  desiredMarginPct?: number;
  labelFeeUsd?: number;
  prepCenterFeeUsd?: number;
  pricingPreviewQty?: number;
  profitPerUnitUsd?: number;
  projectedProfitUsd?: number;
  suggestedSaleUsd?: number;
  /** Demo: evita reenviar o mesmo aviso de armazenagem. */
  storageNotify10dAtIso?: string;
  storageNotify5dAtIso?: string;
  storageNotifyExpiredAtIso?: string;
};

export type InventorySnapshot = {
  additions: InventoryJsonRow[];
  deductions: Record<string, number>;
};

export function isRow(x: unknown): x is InventoryJsonRow {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  if (
    typeof r.id !== "string" ||
    typeof r.asin !== "string" ||
    typeof r.title !== "string" ||
    typeof r.qty !== "number" ||
    typeof r.kind !== "string" ||
    typeof r.storageDays !== "number" ||
    typeof r.storageLimitDays !== "number"
  ) {
    return false;
  }
  if (r.clientSuite !== undefined && typeof r.clientSuite !== "string") return false;
  if (r.clientName !== undefined && typeof r.clientName !== "string") return false;
  if (r.storageFreeStartIso !== undefined && typeof r.storageFreeStartIso !== "string") return false;
  if (r.storageNotify10dAtIso !== undefined && typeof r.storageNotify10dAtIso !== "string") return false;
  if (r.storageNotify5dAtIso !== undefined && typeof r.storageNotify5dAtIso !== "string") return false;
  if (r.storageNotifyExpiredAtIso !== undefined && typeof r.storageNotifyExpiredAtIso !== "string") return false;
  for (const k of [
    "supplier",
    "brand",
    "condition",
    "poNumber",
    "arrivalDate",
    "notes",
    "color",
    "size",
    "model",
    "upc",
    "tracking",
    "prepCenterPlan",
    "prepCenterServiceId",
  ] as const) {
    if (r[k] !== undefined && typeof r[k] !== "string") return false;
  }
  if (r.prepCenterPlan !== undefined && r.prepCenterPlan !== "basic" && r.prepCenterPlan !== "premium") return false;
  for (const nk of [
    "productCostUsd",
    "platformFeePct",
    "desiredMarginPct",
    "labelFeeUsd",
    "prepCenterFeeUsd",
    "pricingPreviewQty",
    "profitPerUnitUsd",
    "projectedProfitUsd",
    "suggestedSaleUsd",
    "unitPriceUsd",
  ] as const) {
    if (r[nk] !== undefined && (typeof r[nk] !== "number" || !Number.isFinite(r[nk]))) return false;
  }
  return true;
}

export type LoadSnapshotOptions = {
  /** Ao listar inventário (GET) corre avisos de e-mail demo e grava flags na linha. */
  processStorageReminders?: boolean;
};

function readSnapshotFromDisk(): InventorySnapshot {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return { additions: [], deductions: {} };
    const o = j as Record<string, unknown>;
    const additions = Array.isArray(o.additions) ? o.additions.filter(isRow) : [];
    const deductions: Record<string, number> = {};
    if (o.deductions && typeof o.deductions === "object") {
      for (const [k, v] of Object.entries(o.deductions as Record<string, unknown>)) {
        if (typeof v === "number" && v > 0) deductions[k] = v;
      }
    }
    return { additions, deductions };
  } catch {
    return { additions: [], deductions: {} };
  }
}

function persist(s: InventorySnapshot): void {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(s, null, 0), "utf8");
}

function applyArrivalDateMigration(s: InventorySnapshot): boolean {
  let mutated = false;
  for (let i = 0; i < s.additions.length; i++) {
    const next = migrateStorageStartFromArrival(s.additions[i]!);
    if (next) {
      s.additions[i] = next;
      mutated = true;
    }
  }
  return mutated;
}

const DEFAULT_PAY_EXTEND_URL =
  "https://demo.dbx-prep.example/pagar-extensao-armazenagem?utm_source=demo_email";

function processStorageReminders(s: InventorySnapshot): boolean {
  const now = Date.now();
  const payUrl = (process.env.STORAGE_EXTENSION_PAY_URL ?? "").trim() || DEFAULT_PAY_EXTEND_URL;
  let mutated = false;

  for (let i = 0; i < s.additions.length; i++) {
    const row = s.additions[i]!;
    const suite = row.clientSuite?.trim();
    if (!suite) continue;
    const client = findBySuite(suite);
    const to = client?.email?.trim();
    if (!to) continue;

    const shipped = s.deductions[row.id] ?? 0;
    const netQty = Math.max(0, Math.floor(row.qty) - shipped);
    if (netQty <= 0) continue;

    const sum = summarizeStorageFreeServer(row, now);
    const title = (row.title ?? row.asin ?? row.id).slice(0, 120);
    const stamp = new Date().toISOString();

    if (sum.expired) {
      if (row.storageNotifyExpiredAtIso) continue;
      queueDemoEmail({
        to,
        subject: `[DBX Prep] Armazenagem grátis vencida — ${title}`,
        text: [
          `Olá,`,
          ``,
          `O período grátis de armazenagem (30 dias) para o produto abaixo já terminou.`,
          ``,
          `Suite: ${suite}`,
          `SKU / ID: ${row.id}`,
          `ASIN: ${row.asin}`,
          `Produto: ${row.title ?? "—"}`,
          `Quantidade no prep (após envios): ${netQty}`,
          ``,
          `Pode solicitar o descarte dos artigos ou pagar para prolongar o prazo de estocagem.`,
          `Link para pagamento (demo): ${payUrl}`,
          ``,
          `Esta mensagem é uma simulação — registo na fila «email-outbox» do servidor.`,
        ].join("\n"),
        meta: { kind: "storage_expired", inventoryId: row.id, suite },
      });
      s.additions[i] = { ...row, storageNotifyExpiredAtIso: stamp };
      mutated = true;
      continue;
    }

    if (sum.daysLeft <= 5 && !row.storageNotify5dAtIso) {
      queueDemoEmail({
        to,
        subject: `[DBX Prep] Armazenagem — faltam ${sum.daysLeft} dia(s) — ${title}`,
        text: [
          `Olá,`,
          ``,
          `Faltam ${sum.daysLeft} dia(s) para terminar o período grátis de armazenagem do produto:`,
          ``,
          `Suite: ${suite}`,
          `SKU: ${row.id} · ASIN: ${row.asin}`,
          `Produto: ${row.title ?? "—"}`,
          ``,
          `Depois do prazo, poderá descartar ou pagar para prolongar: ${payUrl}`,
          ``,
          `(Demo — fila no servidor.)`,
        ].join("\n"),
        meta: { kind: "storage_5d", inventoryId: row.id, suite, daysLeft: sum.daysLeft },
      });
      s.additions[i] = { ...s.additions[i]!, storageNotify5dAtIso: stamp };
      mutated = true;
      continue;
    }

    if (sum.daysLeft <= 10 && !row.storageNotify10dAtIso) {
      queueDemoEmail({
        to,
        subject: `[DBX Prep] Armazenagem — faltam ${sum.daysLeft} dias — ${title}`,
        text: [
          `Olá,`,
          ``,
          `Faltam ${sum.daysLeft} dias para terminar o período grátis de armazenagem do produto:`,
          ``,
          `Suite: ${suite}`,
          `SKU: ${row.id} · ASIN: ${row.asin}`,
          `Produto: ${row.title ?? "—"}`,
          ``,
          `Receberá outro aviso a 5 dias do fim. Depois do prazo: descarte ou pagamento para prolongar.`,
          `Link (demo): ${payUrl}`,
        ].join("\n"),
        meta: { kind: "storage_10d", inventoryId: row.id, suite, daysLeft: sum.daysLeft },
      });
      s.additions[i] = { ...s.additions[i]!, storageNotify10dAtIso: stamp };
      mutated = true;
    }
  }

  return mutated;
}

export function loadSnapshot(opts?: LoadSnapshotOptions): InventorySnapshot {
  const s = readSnapshotFromDisk();
  let mutated = applyArrivalDateMigration(s);
  if (opts?.processStorageReminders) mutated = processStorageReminders(s) || mutated;
  if (mutated) persist(s);
  return s;
}

export function appendRow(row: InventoryJsonRow): InventorySnapshot {
  const s = loadSnapshot();
  s.additions = [row, ...s.additions.filter((r) => r.id !== row.id)];
  persist(s);
  return s;
}

const RECEIPT_META_KEYS = ["color", "size", "model", "upc", "tracking", "brand", "condition"] as const;
type ReceiptMetaKey = (typeof RECEIPT_META_KEYS)[number];

/** Recebimento no prep: liberta stock (`novo`) ou marca problema + notas. */
export function confirmInventoryReceipt(
  id: string,
  opts: {
    mode: "release" | "issue";
    qtyReceived: number;
    adminNotes?: string;
    damageNotes?: string;
    metadata?: Partial<Record<ReceiptMetaKey, string>>;
  },
): InventorySnapshot | null {
  const s = loadSnapshot();
  const i = s.additions.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const row = s.additions[i];
  if (row.kind !== "cadastro_pendente") return null;
  if (!Number.isFinite(opts.qtyReceived) || opts.qtyReceived < 0) return null;

  let merged: InventoryJsonRow = { ...row };
  if (opts.metadata) {
    for (const k of RECEIPT_META_KEYS) {
      const v = opts.metadata[k];
      if (typeof v !== "string") continue;
      const t = v.trim();
      merged = { ...merged, [k]: t ? t : undefined };
    }
  }

  const stamp = new Date().toISOString();
  const noteParts: string[] = [];
  if (merged.notes?.trim()) noteParts.push(merged.notes.trim());
  if (opts.adminNotes?.trim()) noteParts.push(`[Recebimento admin ${stamp}] ${opts.adminNotes.trim()}`);
  if (opts.mode === "issue" && opts.damageNotes?.trim()) {
    noteParts.push(`Avaria / divergência: ${opts.damageNotes.trim()}`);
  }
  const mergedNotes = noteParts.length ? noteParts.join("\n\n") : merged.notes;

  s.additions[i] = {
    ...merged,
    kind: opts.mode === "release" ? "novo" : "problema",
    qty: Math.floor(opts.qtyReceived),
    notes: mergedNotes,
  };
  persist(s);
  return s;
}

export function patchRow(id: string, patch: Partial<InventoryJsonRow>): InventorySnapshot | null {
  const s = loadSnapshot();
  const i = s.additions.findIndex((r) => r.id === id);
  if (i < 0) return null;
  s.additions[i] = { ...s.additions[i], ...patch };
  persist(s);
  return s;
}

export function addDeductions(items: { id: string; qty: number }[]): InventorySnapshot {
  const s = loadSnapshot();
  for (const { id, qty } of items) {
    if (!id || qty <= 0) continue;
    s.deductions[id] = (s.deductions[id] ?? 0) + qty;
  }
  persist(s);
  return s;
}

/** Remove baixas (ex.: cancelamento de envio na primeira hora). */
export function removeDeductions(items: { id: string; qty: number }[]): InventorySnapshot {
  const s = loadSnapshot();
  for (const { id, qty } of items) {
    if (!id || qty <= 0) continue;
    const cur = s.deductions[id] ?? 0;
    const next = Math.max(0, cur - Math.floor(qty));
    if (next <= 0) delete s.deductions[id];
    else s.deductions[id] = next;
  }
  persist(s);
  return s;
}

/** Só quando o servidor ainda não tem cadastros — migra `localStorage` antigo para a demo partilhada. */
export function bootstrapAdditionsIfEmpty(rows: unknown[]): InventorySnapshot | null {
  const s = loadSnapshot();
  if (s.additions.length > 0) return null;
  const valid = rows.filter(isRow);
  if (valid.length === 0) return null;
  s.additions = valid;
  persist(s);
  return s;
}

/** Zera inventário no servidor (demo / reset). */
export function resetInventoryToEmpty(): InventorySnapshot {
  const empty: InventorySnapshot = { additions: [], deductions: {} };
  persist(empty);
  return empty;
}

/** Vista do inventário só para linhas com `clientSuite` igual à suite autenticada. */
export function filterInventorySnapshotForSuite(full: InventorySnapshot, suite: string): InventorySnapshot {
  const st = suite.trim();
  const additions = full.additions.filter((r) => (r.clientSuite?.trim() ?? "") === st);
  const allowedIds = new Set(additions.map((r) => r.id));
  const deductions: Record<string, number> = {};
  for (const [id, qty] of Object.entries(full.deductions)) {
    if (allowedIds.has(id)) deductions[id] = qty;
  }
  return { additions, deductions };
}

export function additionBelongsToSuite(full: InventorySnapshot, id: string, suite: string): boolean {
  const row = full.additions.find((r) => r.id === id);
  if (!row) return false;
  return (row.clientSuite?.trim() ?? "") === suite.trim();
}
