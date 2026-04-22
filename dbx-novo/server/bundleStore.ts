/**
 * Kitagem (bundles) — armazenamento JSON demo.
 * Em produção com BD relacional: transação única que bloqueia linhas de inventário,
 * movimenta stock e grava pedido (ver bundles.schema.sql).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyWalletDelta, findBySuite } from "./clientRegistryStore";
import {
  addDeductions,
  appendRow,
  loadSnapshot,
  patchRow,
  removeDeductions,
  type InventoryJsonRow,
  type InventorySnapshot,
} from "./inventoryStore";
import { appendWalletLedger } from "./walletLedger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data", "bundles.json");

export type BundleOrderStatus =
  | "pending"
  | "picking"
  | "assembling"
  | "quality_check"
  | "completed"
  | "cancelled";

export type BundleItem = { productSku: string; qtyPerBundle: number };

export type BundleRecord = {
  id: string;
  suite: string;
  name: string;
  bundleSku: string;
  /** Texto livre do cliente: como quer o kit (o prep lê isto). */
  clientDescription?: string;
  assemblyFeeUsd: number;
  setupFeeUsd: number;
  items: BundleItem[];
  createdAtIso: string;
  updatedAtIso: string;
};

export type BundleOrderLog = {
  id: string;
  bundleOrderId: string;
  status: BundleOrderStatus;
  changedBy: "system" | "client" | "admin";
  note?: string;
  atIso: string;
};

export type BundleOrder = {
  id: string;
  suite: string;
  bundleId: string;
  /** Cópia no pedido para painel admin sem join extra. */
  bundleSku?: string;
  bundleName?: string;
  quantity: number;
  status: BundleOrderStatus;
  totalFeeUsd: number;
  labelFnsku?: string;
  qcPhotoDataUrl?: string;
  /** Instruções do cliente para separação / embalagem (visível no admin). */
  pickingNotes?: string;
  /** Kits por lote ou caixa (ex.: 100 kits total, 10 por caixa → 10 caixas). Opcional. */
  batchSize?: number;
  /** Nota só desta linha quando o pedido vem com vários kits. */
  lineNotes?: string;
  /** Várias linhas criadas no mesmo POST partilham este id (admin agrupa picking). */
  assemblyGroupId?: string;
  groupLineIndex?: number;
  groupLineCount?: number;
  /**
   * Baixa de inventário aplicada na criação do pedido (reserva até concluir ou cancelar).
   * Pedidos antigos sem este campo continuam a baixar componentes só em `adminCompleteBundleOrder`.
   */
  reservedDeductions?: { id: string; qty: number }[];
  createdAtIso: string;
  updatedAtIso: string;
  logs: BundleOrderLog[];
};

type BundleSnapshot = { bundles: BundleRecord[]; orders: BundleOrder[] };

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function readDisk(): BundleSnapshot {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return { bundles: [], orders: [] };
    const o = j as Record<string, unknown>;
    const bundles = Array.isArray(o.bundles) ? (o.bundles as BundleRecord[]) : [];
    const orders = Array.isArray(o.orders) ? (o.orders as BundleOrder[]) : [];
    return { bundles, orders };
  } catch {
    return { bundles: [], orders: [] };
  }
}

function persist(s: BundleSnapshot): void {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(s, null, 0), "utf8");
}

export function clearBundles(): void {
  persist({ bundles: [], orders: [] });
}

export function listBundlesBySuite(suite: string): BundleRecord[] {
  const q = suite.trim();
  return readDisk().bundles.filter((b) => b.suite === q);
}

export function getBundleById(id: string, suite: string): BundleRecord | undefined {
  const q = suite.trim();
  return readDisk().bundles.find((b) => b.id === id && b.suite === q);
}

export function listOrdersBySuite(suite: string): BundleOrder[] {
  const q = suite.trim();
  return readDisk().orders.filter((o) => o.suite === q).sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
}

export function getOrderById(id: string): BundleOrder | undefined {
  return readDisk().orders.find((o) => o.id === id);
}

export function listOrdersAdmin(status?: string): BundleOrder[] {
  const s = readDisk().orders;
  const f = status?.trim();
  if (!f) return [...s].sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
  return s.filter((o) => o.status === f).sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
}

/** Quantidade disponível no prep (qty - deduções de envio). */
export function netInventoryQty(row: InventoryJsonRow, inv: InventorySnapshot): number {
  const d = inv.deductions[row.id] ?? 0;
  return Math.max(0, Math.floor(row.qty) - Math.floor(d));
}

function findClientRow(inv: InventorySnapshot, suite: string, productSku: string): InventoryJsonRow | undefined {
  return inv.additions.find((r) => r.clientSuite === suite && r.id === productSku);
}

export function validateBundleAssemblyInventory(
  suite: string,
  bundle: BundleRecord,
  assembleQty: number,
): { ok: true } | { ok: false; error: string } {
  const inv = loadSnapshot();
  for (const it of bundle.items) {
    const need = Math.ceil(it.qtyPerBundle * assembleQty);
    const row = findClientRow(inv, suite, it.productSku);
    if (!row) return { ok: false, error: `SKU componente em falta no estoque: ${it.productSku}` };
    const net = netInventoryQty(row, inv);
    if (net < need) {
      return {
        ok: false,
        error: `Stock insuficiente para ${it.productSku}: precisa ${need}, disponível ${net}.`,
      };
    }
  }
  return { ok: true };
}

/** Valida stock para várias linhas de montagem (soma componentes por SKU). */
export function validateMultiLineAssemblyInventory(
  suite: string,
  bundles: BundleRecord[],
  lineQtys: number[],
): { ok: true } | { ok: false; error: string } {
  if (bundles.length !== lineQtys.length) return { ok: false, error: "Dados de linhas inconsistentes." };
  const inv = loadSnapshot();
  const needBySku: Record<string, number> = {};
  for (let i = 0; i < bundles.length; i++) {
    const bundle = bundles[i]!;
    const q = Math.floor(lineQtys[i]!);
    if (q < 1) return { ok: false, error: "Quantidade inválida numa linha." };
    for (const it of bundle.items) {
      const sku = it.productSku;
      const add = Math.ceil(it.qtyPerBundle * q);
      needBySku[sku] = (needBySku[sku] ?? 0) + add;
    }
  }
  for (const [sku, need] of Object.entries(needBySku)) {
    const row = findClientRow(inv, suite, sku);
    if (!row) return { ok: false, error: `SKU componente em falta no estoque: ${sku}` };
    const net = netInventoryQty(row, inv);
    if (net < need) {
      return { ok: false, error: `Stock insuficiente para ${sku}: precisa ${need} (total nas linhas), disponível ${net}.` };
    }
  }
  return { ok: true };
}

/** Quantidades a deduzir por linha de inventário (id = SKU da linha no prep). */
export function bundleAssemblyDeductions(
  bundle: BundleRecord,
  assembleQty: number,
): { id: string; qty: number }[] {
  const q = Math.floor(assembleQty);
  const out: { id: string; qty: number }[] = [];
  for (const it of bundle.items) {
    const need = Math.floor(it.qtyPerBundle * q);
    if (need > 0) out.push({ id: it.productSku, qty: need });
  }
  return out;
}

function pushLog(order: BundleOrder, status: BundleOrderStatus, changedBy: BundleOrderLog["changedBy"], note?: string): void {
  order.logs.push({
    id: newId("BLOG"),
    bundleOrderId: order.id,
    status,
    changedBy,
    note,
    atIso: new Date().toISOString(),
  });
}

export function createBundle(input: {
  suite: string;
  name: string;
  bundleSku: string;
  items: BundleItem[];
  clientDescription?: string;
  assemblyFeeUsd?: number;
  setupFeeUsd?: number;
}): { ok: true; bundle: BundleRecord } | { ok: false; error: string } {
  const suite = input.suite.trim();
  if (!suite) return { ok: false, error: "Suite em falta." };
  if (!findBySuite(suite)) return { ok: false, error: "Conta não encontrada." };
  const name = input.name.trim();
  const bundleSku = input.bundleSku.trim().toUpperCase();
  if (name.length < 2) return { ok: false, error: "Nome do kit inválido." };
  if (bundleSku.length < 2) return { ok: false, error: "SKU do kit inválido." };
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false, error: "Indique pelo menos um componente." };
  }
  for (const it of input.items) {
    if (!it.productSku?.trim()) return { ok: false, error: "SKU de componente inválido." };
    if (!Number.isFinite(it.qtyPerBundle) || it.qtyPerBundle < 1 || !Number.isInteger(it.qtyPerBundle)) {
      return { ok: false, error: "Quantidade por kit deve ser inteira ≥ 1." };
    }
  }
  const snap = readDisk();
  if (snap.bundles.some((b) => b.suite === suite && b.bundleSku === bundleSku)) {
    return { ok: false, error: "Já existe um kit com este SKU para a sua suite." };
  }
  const now = new Date().toISOString();
  const assemblyFeeUsd =
    typeof input.assemblyFeeUsd === "number" && Number.isFinite(input.assemblyFeeUsd) && input.assemblyFeeUsd >= 0
      ? Math.round(input.assemblyFeeUsd * 100) / 100
      : 2;
  const setupFeeUsd =
    typeof input.setupFeeUsd === "number" && Number.isFinite(input.setupFeeUsd) && input.setupFeeUsd >= 0
      ? Math.round(input.setupFeeUsd * 100) / 100
      : 0;
  const desc =
    typeof input.clientDescription === "string" ? input.clientDescription.trim().slice(0, 4000) : "";
  const bundle: BundleRecord = {
    id: newId("BDL"),
    suite,
    name,
    bundleSku,
    clientDescription: desc || undefined,
    assemblyFeeUsd,
    setupFeeUsd,
    items: input.items.map((i) => ({
      productSku: i.productSku.trim(),
      qtyPerBundle: Math.floor(i.qtyPerBundle),
    })),
    createdAtIso: now,
    updatedAtIso: now,
  };
  snap.bundles.push(bundle);
  persist(snap);
  return { ok: true, bundle };
}

export type BundleOrderLineInput = { bundleId: string; quantity: number; lineNotes?: string };

/**
 * Um ou mais kits no mesmo pedido lógico: valida stock agregado, debita uma vez,
 * cria uma linha `bundle_orders` por kit (admin vê `assemblyGroupId` + picking consolidado).
 */
export function createBundleOrdersGrouped(input: {
  suite: string;
  lines: BundleOrderLineInput[];
  pickingNotes?: string;
  batchSize?: number;
  labelFnsku?: string;
}): { ok: true; orders: BundleOrder[]; balanceUsd: number; assemblyGroupId?: string } | { ok: false; error: string } {
  const suite = input.suite.trim();
  if (!suite) return { ok: false, error: "Suite em falta." };
  const client = findBySuite(suite);
  if (!client) return { ok: false, error: "Conta não encontrada." };
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    return { ok: false, error: "Indique pelo menos uma linha de montagem." };
  }

  let batchSize: number | undefined;
  if (input.batchSize != null && Number.isFinite(Number(input.batchSize))) {
    const b = Math.floor(Number(input.batchSize));
    if (b >= 1) batchSize = b;
  }

  const snap = readDisk();
  const resolved: BundleRecord[] = [];
  const qtys: number[] = [];
  const lineNotesList: (string | undefined)[] = [];

  for (const raw of input.lines) {
    const bundleId = typeof raw.bundleId === "string" ? raw.bundleId.trim() : "";
    const qty = Math.floor(raw.quantity);
    if (!bundleId || qty < 1) return { ok: false, error: "Linha inválida (kit ou quantidade)." };
    const bundle = snap.bundles.find((b) => b.id === bundleId && b.suite === suite);
    if (!bundle) return { ok: false, error: `Kit não encontrado: ${bundleId}.` };
    resolved.push(bundle);
    qtys.push(qty);
    const ln = typeof raw.lineNotes === "string" ? raw.lineNotes.trim() : "";
    lineNotesList.push(ln || undefined);
  }

  const invMulti = validateMultiLineAssemblyInventory(suite, resolved, qtys);
  if (!invMulti.ok) return invMulti;

  const reservedPerLine: { id: string; qty: number }[][] = [];
  for (let i = 0; i < resolved.length; i++) {
    const bundle = resolved[i]!;
    const qty = qtys[i]!;
    const d = bundleAssemblyDeductions(bundle, qty);
    addDeductions(d);
    reservedPerLine.push(d);
  }

  const lineFees: number[] = [];
  let totalFeeUsd = 0;
  for (let i = 0; i < resolved.length; i++) {
    const bundle = resolved[i]!;
    const qty = qtys[i]!;
    const hadPriorOrder = snap.orders.some(
      (o) => o.bundleId === bundle.id && o.suite === suite && o.status !== "cancelled",
    );
    const earlierSameBundleInBatch = resolved.slice(0, i).some((b) => b.id === bundle.id);
    const setupCharge = hadPriorOrder || earlierSameBundleInBatch ? 0 : bundle.setupFeeUsd;
    const assemblyCharge = bundle.assemblyFeeUsd * qty;
    const lineTotal = Math.round((assemblyCharge + setupCharge) * 100) / 100;
    lineFees.push(lineTotal);
    totalFeeUsd = Math.round((totalFeeUsd + lineTotal) * 100) / 100;
  }

  const debit = applyWalletDelta(suite, -totalFeeUsd);
  if (!debit.ok) {
    for (let j = reservedPerLine.length - 1; j >= 0; j--) {
      removeDeductions(reservedPerLine[j]!);
    }
    return { ok: false, error: debit.error };
  }

  const orderIds = input.lines.map(() => newId("BDO"));
  const assemblyGroupId = input.lines.length > 1 ? newId("BGP") : undefined;
  const ledgerRef = assemblyGroupId ?? orderIds[0]!;

  appendWalletLedger({
    suite,
    deltaUsd: -totalFeeUsd,
    balanceAfter: debit.balanceUsd,
    reason: "bundle_assembly_order",
    reference: ledgerRef,
  });

  const now = new Date().toISOString();
  const pickingNotes = typeof input.pickingNotes === "string" ? input.pickingNotes.trim() : "";
  const notesField = pickingNotes || undefined;
  const labelFnsku = typeof input.labelFnsku === "string" ? input.labelFnsku.trim() : "";
  const ordersOut: BundleOrder[] = [];

  for (let i = 0; i < resolved.length; i++) {
    const bundle = resolved[i]!;
    const qty = qtys[i]!;
    const order: BundleOrder = {
      id: orderIds[i]!,
      suite,
      bundleId: bundle.id,
      bundleSku: bundle.bundleSku,
      bundleName: bundle.name,
      quantity: qty,
      status: "pending",
      totalFeeUsd: lineFees[i]!,
      labelFnsku: labelFnsku || undefined,
      pickingNotes: notesField,
      batchSize,
      lineNotes: lineNotesList[i],
      assemblyGroupId,
      groupLineIndex: input.lines.length > 1 ? i : undefined,
      groupLineCount: input.lines.length > 1 ? input.lines.length : undefined,
      reservedDeductions: reservedPerLine[i],
      createdAtIso: now,
      updatedAtIso: now,
      logs: [],
    };
    const groupHint =
      assemblyGroupId != null
        ? ` Grupo ${assemblyGroupId} (linha ${i + 1}/${input.lines.length}).`
        : "";
    pushLog(
      order,
      "pending",
      "system",
      `Taxa desta linha: US$ ${lineFees[i]!}.${groupHint} Total debitado no pedido: US$ ${totalFeeUsd}. Stock dos componentes reservado (dedução).`,
    );
    snap.orders.push(order);
    ordersOut.push(order);
  }

  persist(snap);
  return { ok: true, orders: ordersOut, balanceUsd: debit.balanceUsd, assemblyGroupId };
}

/**
 * Cria pedido de montagem: valida stock, debita taxa total (montagem + taxa de setup opcional só na 1ª encomenda deste kit).
 * Aceita várias linhas via `createBundleOrdersGrouped` quando `lines` tem 2+ entradas.
 */
export function createBundleOrder(input: {
  suite: string;
  bundleId: string;
  quantity: number;
  labelFnsku?: string;
  pickingNotes?: string;
  batchSize?: number;
  lineNotes?: string;
}): { ok: true; order: BundleOrder; balanceUsd: number } | { ok: false; error: string } {
  const r = createBundleOrdersGrouped({
    suite: input.suite,
    lines: [
      {
        bundleId: input.bundleId,
        quantity: input.quantity,
        lineNotes: input.lineNotes,
      },
    ],
    pickingNotes: input.pickingNotes,
    batchSize: input.batchSize,
    labelFnsku: input.labelFnsku,
  });
  if (!r.ok) return r;
  const order = r.orders[0];
  if (!order) return { ok: false, error: "Falha ao criar pedido." };
  return { ok: true, order, balanceUsd: r.balanceUsd };
}

const STATUS_ORDER: BundleOrderStatus[] = ["pending", "picking", "assembling", "quality_check", "completed"];

function canTransition(from: BundleOrderStatus, to: BundleOrderStatus): boolean {
  if (to === "cancelled") return from !== "completed" && from !== "cancelled";
  if (from === "cancelled" || from === "completed") return false;
  const fi = STATUS_ORDER.indexOf(from);
  const ti = STATUS_ORDER.indexOf(to);
  if (fi < 0 || ti < 0) return false;
  return ti === fi + 1;
}

export function adminSetBundleOrderStatus(
  orderId: string,
  next: BundleOrderStatus,
): { ok: true; order: BundleOrder } | { ok: false; error: string } {
  const snap = readDisk();
  const i = snap.orders.findIndex((o) => o.id === orderId);
  if (i < 0) return { ok: false, error: "Pedido não encontrado." };
  const order = snap.orders[i]!;
  if (order.status === "completed") return { ok: false, error: "Pedido já concluído." };

  if (next === "cancelled") {
    const refund = applyWalletDelta(order.suite, order.totalFeeUsd);
    if (!refund.ok) return { ok: false, error: refund.error };
    appendWalletLedger({
      suite: order.suite,
      deltaUsd: order.totalFeeUsd,
      balanceAfter: refund.balanceUsd,
      reason: "bundle_assembly_cancel_refund",
      reference: order.id,
    });
    if (order.reservedDeductions?.length) {
      removeDeductions(order.reservedDeductions);
    }
    order.status = "cancelled";
    const stockNote = order.reservedDeductions?.length ? " Devolvido stock reservado ao cliente." : "";
    pushLog(order, "cancelled", "admin", `Estornado taxa ao cliente.${stockNote}`);
    order.updatedAtIso = new Date().toISOString();
    persist(snap);
    return { ok: true, order };
  }

  if (!canTransition(order.status, next)) {
    return { ok: false, error: `Transição inválida: ${order.status} → ${next}.` };
  }
  order.status = next;
  pushLog(order, next, "admin");
  order.updatedAtIso = new Date().toISOString();
  persist(snap);
  return { ok: true, order };
}

/**
 * Conclui montagem: baixa componentes (deduções), credita SKU do kit no inventário.
 * Só a partir de quality_check (fluxo warehouse).
 */
export function adminCompleteBundleOrder(orderId: string): { ok: true; order: BundleOrder } | { ok: false; error: string } {
  const snap = readDisk();
  const i = snap.orders.findIndex((o) => o.id === orderId);
  if (i < 0) return { ok: false, error: "Pedido não encontrado." };
  const order = snap.orders[i]!;
  if (order.status !== "quality_check") {
    return { ok: false, error: "Só é possível concluir após «Controlo de qualidade»." };
  }
  const bundle = snap.bundles.find((b) => b.id === order.bundleId && b.suite === order.suite);
  if (!bundle) return { ok: false, error: "Kit não encontrado." };

  const inv = loadSnapshot();
  const v = validateBundleAssemblyInventory(order.suite, bundle, order.quantity);
  if (!v.ok) return v;

  const hadReserve = Array.isArray(order.reservedDeductions) && order.reservedDeductions.length > 0;
  if (!hadReserve) {
    addDeductions(bundleAssemblyDeductions(bundle, order.quantity));
  }

  const existing = inv.additions.find((r) => r.clientSuite === order.suite && r.id === bundle.bundleSku);
  const outQty = order.quantity;
  if (existing) {
    patchRow(existing.id, { qty: Math.floor(existing.qty) + outQty });
  } else {
    const row: InventoryJsonRow = {
      id: bundle.bundleSku,
      asin: "BUNDLE",
      title: `${bundle.name} (kit)`,
      qty: outQty,
      kind: "novo",
      storageDays: 0,
      storageLimitDays: 30,
      clientSuite: order.suite,
      clientName: findBySuite(order.suite)?.name,
      notes: `Gerado por kitagem — pedido ${order.id}`,
    };
    appendRow(row);
  }

  order.status = "completed";
  order.updatedAtIso = new Date().toISOString();
  const completeNote = hadReserve
    ? "Kit creditado no inventário; componentes já estavam reservados no pedido."
    : "Stock transformado; kit disponível para envio FBA/FBM.";
  pushLog(order, "completed", "admin", completeNote);
  persist(snap);
  return { ok: true, order };
}

export function adminPatchBundleOrderMeta(
  orderId: string,
  patch: { labelFnsku?: string; qcPhotoDataUrl?: string },
): { ok: true; order: BundleOrder } | { ok: false; error: string } {
  const snap = readDisk();
  const o = snap.orders.find((x) => x.id === orderId);
  if (!o) return { ok: false, error: "Pedido não encontrado." };
  if (typeof patch.labelFnsku === "string") o.labelFnsku = patch.labelFnsku.trim() || undefined;
  if (typeof patch.qcPhotoDataUrl === "string") o.qcPhotoDataUrl = patch.qcPhotoDataUrl.trim() || undefined;
  o.updatedAtIso = new Date().toISOString();
  persist(snap);
  return { ok: true, order: o };
}
