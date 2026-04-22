import type { ClientOrder, InventoryRow } from "../types";
import { getMergedInventoryView } from "./clientInventoryStorage";
import { loadAddedClientOrders } from "./clientOrdersStorage";
import { isDeliveryOrder } from "./deliveryOrder";
import { mockClientOrders } from "../mock/data";
import { hasMeaningfulDraftContent, parseRegisterProductDraft, registerProductDraftKey } from "./registerProductDraft";

export function getMergedClientOrders(): ClientOrder[] {
  return [...loadAddedClientOrders(), ...mockClientOrders];
}

function suiteNorm(s: string): string {
  return s.trim();
}

/** Pedidos visíveis para a suite (pedidos sem suite contam no mesmo browser). */
export function ordersForSuite(orders: ClientOrder[], suite: string): ClientOrder[] {
  const s = suiteNorm(suite);
  if (!s) return orders;
  return orders.filter((o) => !suiteNorm(o.suite ?? "") || suiteNorm(o.suite ?? "") === s);
}

/**
 * Linhas visíveis para a suite — alinhado ao painel de estoque do cliente (merge global).
 * Linhas sem `clientSuite` contam para o utilizador atual (demo / legado).
 */
export function inventoryRowsForSuite(rows: InventoryRow[], suite: string): InventoryRow[] {
  const s = suiteNorm(suite);
  if (!s) return rows;
  return rows.filter((r) => {
    const rowSuite = suiteNorm(r.clientSuite ?? "");
    return !rowSuite || rowSuite === s;
  });
}

export type ClientDashboardKpis = {
  totalInventoryQty: number;
  inTransitQty: number;
  /** Unidades em linhas com tipo problema (card KPI). */
  problemQty: number;
  /** Linhas/SKUs em problema (banner de alerta). */
  problemLineCount: number;
  completedOrders: number;
};

export type ClientQuickActionCounts = {
  registerDrafts: number;
  shipmentsQueue: number;
  activeSkus: number;
  announcementsUnread: number;
  financePending: number;
};

export type ClientPipelineStage = {
  id: string;
  label: string;
  count: number;
  tone: "zinc" | "violet" | "blue" | "amber" | "emerald";
};

export function countRegisterDraftForSuite(suite: string): number {
  if (typeof window === "undefined") return 0;
  const d = parseRegisterProductDraft(localStorage.getItem(registerProductDraftKey(suite)));
  return d && hasMeaningfulDraftContent(d) ? 1 : 0;
}

export function computeClientDashboardMetrics(
  suite: string,
  opts?: { balanceUsd?: number; vipUnread?: number },
): {
  kpis: ClientDashboardKpis;
  quick: ClientQuickActionCounts;
  pipeline: ClientPipelineStage[];
} {
  const inv = inventoryRowsForSuite(getMergedInventoryView(), suite);
  const orders = ordersForSuite(getMergedClientOrders(), suite);

  const totalInventoryQty = inv.reduce((a, r) => a + Math.max(0, Math.floor(r.qty)), 0);
  const inTransitQty = inv.filter((r) => r.kind === "transito").reduce((a, r) => a + Math.max(0, Math.floor(r.qty)), 0);
  const problemRows = inv.filter((r) => r.kind === "problema");
  const problemQty = problemRows.reduce((a, r) => a + Math.max(0, Math.floor(r.qty)), 0);
  const problemLineCount = problemRows.length;
  const completedOrders = orders.filter((o) => o.status === "concluido").length;

  const activeNonDone = orders.filter((o) => o.status !== "concluido").length;
  const activeSkus = inv.filter((r) => r.qty > 0).length;

  const pipeline: ClientPipelineStage[] = [
    { id: "received", label: "Recebido", count: orders.filter((o) => o.status === "aguardando_cliente").length, tone: "zinc" },
    { id: "production", label: "Em produção", count: orders.filter((o) => o.status === "em_producao").length, tone: "violet" },
    { id: "labeling", label: "Rotulagem", count: orders.filter((o) => o.status === "em_fila").length, tone: "blue" },
    {
      id: "shipped",
      label: "Enviado",
      count: orders.filter((o) => o.status === "concluido" && !isDeliveryOrder(o)).length,
      tone: "amber",
    },
    { id: "completed", label: "Concluído", count: orders.filter(isDeliveryOrder).length, tone: "emerald" },
  ];

  return {
    kpis: {
      totalInventoryQty,
      inTransitQty,
      problemQty,
      problemLineCount,
      completedOrders,
    },
    quick: {
      registerDrafts: countRegisterDraftForSuite(suite),
      shipmentsQueue: activeNonDone,
      activeSkus,
      announcementsUnread: typeof opts?.vipUnread === "number" ? Math.max(0, Math.floor(opts.vipUnread)) : 0,
      financePending:
        opts?.balanceUsd != null && Number.isFinite(opts.balanceUsd) && opts.balanceUsd < 25 ? 1 : 0,
    },
    pipeline,
  };
}
