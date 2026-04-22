/**
 * Conclusão de pedidos PREP_KIT: liberta reservas, baixa stock físico de origem
 * e credita linhas novas no inventário da suite do cliente.
 */
import { findBySuite } from "./clientRegistryStore";
import { patchClientOrder, readAllClientOrders } from "./clientOrdersStore";
import {
  appendRow,
  loadSnapshot,
  patchRow,
  removeDeductions,
  type InventoryJsonRow,
} from "./inventoryStore";

export type PrepKitOutputLine = { id: string; title: string; qty: number };

function isPrepKitOrder(o: Record<string, unknown>): boolean {
  return String(o.service ?? "") === "PREP_KIT";
}

export function adminDeliverPrepKitOrder(
  orderId: string,
  outputs: PrepKitOutputLine[],
): { ok: true; order: Record<string, unknown> } | { ok: false; error: string } {
  const id = orderId.trim();
  if (!id) return { ok: false, error: "Pedido inválido." };
  const rows = readAllClientOrders();
  const order = rows.find((o) => String(o.id) === id);
  if (!order) return { ok: false, error: "Pedido não encontrado." };
  if (!isPrepKitOrder(order)) return { ok: false, error: "Este pedido não é de montagem/prep (PREP_KIT)." };
  if (String(order.status ?? "") !== "em_producao") {
    return { ok: false, error: "Aceite o pedido em produção antes de disponibilizar o stock." };
  }
  const suite = typeof order.suite === "string" ? order.suite.trim() : "";
  if (!suite) return { ok: false, error: "Pedido sem suite." };

  const normalized: PrepKitOutputLine[] = [];
  for (const raw of outputs) {
    const rid = typeof raw.id === "string" ? raw.id.trim().toUpperCase() : "";
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    const qty = Math.floor(Number(raw.qty));
    if (!rid || rid.length < 2) return { ok: false, error: "Cada artigo de saída precisa de um SKU (id) válido." };
    if (!title || title.length < 2) return { ok: false, error: "Cada artigo precisa de descrição/título." };
    if (qty < 1) return { ok: false, error: "Quantidades de saída devem ser ≥ 1." };
    normalized.push({ id: rid, title, qty });
  }
  if (normalized.length === 0) return { ok: false, error: "Indique pelo menos uma linha de stock a creditar." };

  const deductionsRaw = order.inventoryDeductions;
  if (!Array.isArray(deductionsRaw) || deductionsRaw.length === 0) {
    return { ok: false, error: "Pedido sem baixa de stock de origem." };
  }
  const deductions: { id: string; qty: number }[] = [];
  for (const d of deductionsRaw) {
    if (!d || typeof d !== "object") continue;
    const dr = d as Record<string, unknown>;
    const did = typeof dr.id === "string" ? dr.id.trim() : "";
    const q = Math.floor(Number(dr.qty));
    if (did && q > 0) deductions.push({ id: did, qty: q });
  }
  if (!deductions.length) return { ok: false, error: "Baixas de origem inválidas." };

  removeDeductions(deductions);

  const client = findBySuite(suite);
  for (const { id: invId, qty: take } of deductions) {
    const snap = loadSnapshot();
    const row = snap.additions.find((r) => r.id === invId && (r.clientSuite ?? "").trim() === suite);
    if (!row) continue;
    const nextQty = Math.max(0, Math.floor(row.qty) - take);
    patchRow(row.id, { qty: nextQty });
  }

  for (const out of normalized) {
    const existing = loadSnapshot().additions.find((r) => r.clientSuite === suite && r.id === out.id);
    if (existing) {
      patchRow(existing.id, { qty: Math.floor(existing.qty) + out.qty });
    } else {
      const row: InventoryJsonRow = {
        id: out.id,
        asin: "PREP-KIT",
        title: out.title,
        qty: out.qty,
        kind: "novo",
        storageDays: 0,
        storageLimitDays: 30,
        clientSuite: suite,
        clientName: client?.name,
        notes: `Montagem/prep — pedido ${id}`,
      };
      appendRow(row);
    }
  }

  const prevWork =
    order.prepKitWork && typeof order.prepKitWork === "object"
      ? (order.prepKitWork as Record<string, unknown>)
      : {};
  const now = new Date().toISOString();
  const merged = patchClientOrder(id, {
    status: "concluido",
    opsShippedAtIso: now,
    prepKitWork: {
      ...prevWork,
      outputsDelivered: normalized,
      deliveredAtIso: now,
    },
  });
  if (!merged) return { ok: false, error: "Falha ao atualizar o pedido." };
  return { ok: true, order: merged };
}
