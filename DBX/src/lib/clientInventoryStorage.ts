import { mockInventory } from "../mock/data";
import type { InventoryRow } from "../types";
import { apiUrl } from "./apiUrl";
import { jsonAdminHeaders, jsonUserHeaders } from "./authHeaders";

/** Mesma origem (host+porta) para cliente e admin; `localhost` ≠ `127.0.0.1` para o browser. */
export const CLIENT_INVENTORY_ADDITIONS_KEY = "dbx.client.inventory.additions";
export const CLIENT_INVENTORY_DEDUCTIONS_KEY = "dbx.client.inventory.deductions";

const STORAGE_KEY = CLIENT_INVENTORY_ADDITIONS_KEY;
const DEDUCTIONS_KEY = CLIENT_INVENTORY_DEDUCTIONS_KEY;

const inventoryApi = (suffix: string) => apiUrl(`/api/client/inventory${suffix}`);

export const INVENTORY_UPDATED_EVENT = "dbx-inventory-updated";

function isValidStoredRow(x: unknown): x is InventoryRow {
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
  for (const k of [
    "supplier",
    "brand",
    "condition",
    "poNumber",
    "arrivalDate",
    "notes",
    "storageFreeStartIso",
    "imageUrl",
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

function filterRows(arr: unknown[]): InventoryRow[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter(isValidStoredRow);
}

/** Escreve o snapshot do servidor no `localStorage` e notifica a UI. */
function applySnapshot(data: { additions?: unknown; deductions?: unknown }): void {
  if (typeof window === "undefined") return;
  if (Array.isArray(data.additions)) {
    const valid = filterRows(data.additions);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
  }
  if (data.deductions && typeof data.deductions === "object") {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(data.deductions as Record<string, unknown>)) {
      if (typeof v === "number" && v > 0) out[k] = v;
    }
    localStorage.setItem(DEDUCTIONS_KEY, JSON.stringify(out));
  }
  window.dispatchEvent(new CustomEvent(INVENTORY_UPDATED_EVENT));
}

/**
 * Puxa inventário da API demo (Express :8787; em DEV via `apiUrl` no mesmo hostname).
 * O servidor é sempre a fonte de verdade: se o inventário no disco estiver vazio (ex.: após reset),
 * o `localStorage` deste browser é alinhado a vazio — não se repovoa o servidor a partir de dados antigos.
 * (Migração local → servidor: `POST /api/client/inventory/bootstrap` manual ou fluxo dedicado.)
 */
export async function pullInventoryFromServer(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const res = await fetch(inventoryApi(""), { headers: jsonUserHeaders() });
    if (!res.ok) return false;
    const merged = (await res.json()) as { additions?: unknown[]; deductions?: unknown };
    applySnapshot(merged);
    return true;
  } catch {
    return false;
  }
}

export function loadAddedInventory(): InventoryRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidStoredRow);
  } catch {
    return [];
  }
}

export async function appendInventoryRow(row: InventoryRow): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const res = await fetch(inventoryApi("/additions"), {
      method: "POST",
      headers: jsonUserHeaders(),
      body: JSON.stringify({ row }),
    });
    if (res.ok) {
      const snap = (await res.json()) as { additions?: unknown[]; deductions?: unknown };
      applySnapshot(snap);
      return;
    }
  } catch {
    /* API desligada — só browser */
  }
  const next = [row, ...loadAddedInventory()];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(INVENTORY_UPDATED_EVENT));
  } catch {
    /* quota */
  }
}

/** Atualiza uma linha guardada pelo cliente (cadastros inbound, etc.). Não altera o mock estático. */
export async function updateAddedInventoryRow(id: string, patch: Partial<InventoryRow>): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const res = await fetch(inventoryApi(`/additions/${encodeURIComponent(id)}`), {
      method: "PATCH",
      headers: jsonUserHeaders(),
      body: JSON.stringify({ patch }),
    });
    if (res.ok) {
      const snap = (await res.json()) as { additions?: unknown[]; deductions?: unknown };
      applySnapshot(snap);
      return true;
    }
  } catch {
    /* fallback local */
  }
  const list = loadAddedInventory();
  const idx = list.findIndex((r) => r.id === id);
  if (idx < 0) return false;
  const next = [...list];
  next[idx] = { ...next[idx], ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  window.dispatchEvent(new CustomEvent(INVENTORY_UPDATED_EVENT));
  return true;
}

export type ConfirmReceiptBody = {
  mode: "release" | "issue";
  qtyReceived: number;
  notifyClient?: boolean;
  adminNotes?: string;
  damageNotes?: string;
  metadata?: Partial<
    Pick<InventoryRow, "color" | "size" | "model" | "upc" | "tracking" | "brand" | "condition">
  >;
};

/** Admin prep: confirma recebimento e sincroniza snapshot no browser. */
export async function confirmInventoryReceiptOnServer(
  id: string,
  body: ConfirmReceiptBody,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof window === "undefined") return { ok: false, error: "Indisponível." };
  try {
    const res = await fetch(
      apiUrl(`/api/admin/inventory/additions/${encodeURIComponent(id)}/confirm-receipt`),
      {
        method: "POST",
        headers: jsonAdminHeaders(),
        body: JSON.stringify(body),
      },
    );
    const raw = await res.text();
    let j: { error?: string; additions?: unknown[]; deductions?: unknown } = {};
    try {
      if (raw) j = JSON.parse(raw) as typeof j;
    } catch {
      if (!res.ok) {
        return {
          ok: false,
          error: `Resposta inválida do servidor (HTTP ${res.status}). Confirme se a API está atualizada.`,
        };
      }
      return { ok: false, error: "Resposta inválida do servidor." };
    }
    if (!res.ok) {
      const apiErr = typeof j.error === "string" && j.error.trim() ? j.error.trim() : null;
      if (apiErr) return { ok: false, error: apiErr };
      if (res.status === 404 && /Cannot POST|Cannot GET/i.test(raw)) {
        return {
          ok: false,
          error:
            "A API que está a correr parece desatualizada (rota não encontrada). Pare o processo na porta 8787 e volte a iniciar «npm run dev» na pasta DBX_NOVO.",
        };
      }
      return { ok: false, error: `Pedido falhou (HTTP ${res.status}).` };
    }
    applySnapshot(j);
    return { ok: true };
  } catch {
    return { ok: false, error: "API indisponível. Confirme o Express (porta 8787)." };
  }
}

export function loadDeductions(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(DEDUCTIONS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "number" && v > 0) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Reverte baixa de estoque (ex.: cancelamento de envio na demo). */
export async function removeInventoryDeductions(items: { id: string; qty: number }[]): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const res = await fetch(inventoryApi("/deductions/remove"), {
      method: "POST",
      headers: jsonUserHeaders(),
      body: JSON.stringify({ items }),
    });
    if (res.ok) {
      const snap = (await res.json()) as { additions?: unknown[]; deductions?: unknown };
      applySnapshot(snap);
      return;
    }
  } catch {
    /* fallback local */
  }
  const d = loadDeductions();
  for (const { id, qty } of items) {
    if (!id || qty <= 0) continue;
    const cur = d[id] ?? 0;
    const next = Math.max(0, cur - Math.floor(qty));
    if (next <= 0) delete d[id];
    else d[id] = next;
  }
  localStorage.setItem(DEDUCTIONS_KEY, JSON.stringify(d));
  window.dispatchEvent(new CustomEvent(INVENTORY_UPDATED_EVENT));
}

/** Baixa de estoque após envio (quantidades já enviadas por SKU). */
export async function addInventoryDeductions(items: { id: string; qty: number }[]): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const res = await fetch(inventoryApi("/deductions"), {
      method: "POST",
      headers: jsonUserHeaders(),
      body: JSON.stringify({ items }),
    });
    if (res.ok) {
      const snap = (await res.json()) as { additions?: unknown[]; deductions?: unknown };
      applySnapshot(snap);
      return;
    }
  } catch {
    /* fallback */
  }
  const d = loadDeductions();
  for (const { id, qty } of items) {
    if (!id || qty <= 0) continue;
    d[id] = (d[id] ?? 0) + qty;
  }
  localStorage.setItem(DEDUCTIONS_KEY, JSON.stringify(d));
  window.dispatchEvent(new CustomEvent(INVENTORY_UPDATED_EVENT));
}

/** Linhas com quantidade disponível (mock + cadastros − envios). */
export function getMergedInventoryView(): InventoryRow[] {
  const ded = loadDeductions();
  const added = loadAddedInventory();
  const seen = new Set<string>();
  const rows: InventoryRow[] = [];
  for (const r of [...added, ...mockInventory]) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    const shipped = ded[r.id] ?? 0;
    const qty = Math.max(0, r.qty - shipped);
    rows.push({ ...r, qty });
  }
  return rows;
}
