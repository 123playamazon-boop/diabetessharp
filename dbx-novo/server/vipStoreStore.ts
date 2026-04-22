import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data", "vip-store.json");

export type VipStoreProduct = {
  id: string;
  title: string;
  shortDescription: string;
  unitPriceUsd: number;
  /** Referência interna — custo aproximado para a equipa (não aparece ao cliente). */
  referenceCostUsd?: number;
  stockQty: number;
  imageUrl?: string;
  /** Link público do produto no fornecedor (Walmart, Amazon, etc.). */
  supplierUrl?: string;
  /** Detalhes / observações extra visíveis ao cliente na ficha do produto. */
  observationsDetail?: string;
  /** Notas de design / preparação da equipa DBX (visível ao cliente na ficha). */
  designerNotes?: string;
  active: boolean;
  category: string;
  createdAtIso: string;
};

export type VipStoreOrderStatus =
  | "pago_aguardando_compra"
  | "em_compra"
  | "enviado_prep"
  | "entregue"
  | "cancelado";

export type VipStoreOrderLine = {
  productId: string;
  title: string;
  qty: number;
  unitPriceUsd: number;
  lineTotalUsd: number;
};

export type VipStoreOrder = {
  id: string;
  suite: string;
  clientName?: string;
  items: VipStoreOrderLine[];
  subtotalUsd: number;
  platformFeeUsd: number;
  totalUsd: number;
  status: VipStoreOrderStatus;
  noteAdmin?: string;
  createdAtIso: string;
  updatedAtIso: string;
};

export type VipStoreSnapshot = {
  /** Taxa da plataforma sobre o subtotal (ex.: 0,05 = 5%). */
  platformFeePct: number;
  products: VipStoreProduct[];
  orders: VipStoreOrder[];
};

function defaultSnapshot(): VipStoreSnapshot {
  return { platformFeePct: 0.05, products: [], orders: [] };
}

function normalizeStoreProduct(raw: unknown): VipStoreProduct | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const id = typeof p.id === "string" ? p.id.trim() : "";
  const title = typeof p.title === "string" ? p.title.trim() : "";
  if (!id || !title) return null;
  const unitPriceUsd = typeof p.unitPriceUsd === "number" && Number.isFinite(p.unitPriceUsd) ? p.unitPriceUsd : 0;
  const stockQty = typeof p.stockQty === "number" && Number.isFinite(p.stockQty) ? Math.max(0, Math.floor(p.stockQty)) : 0;
  const shortDescription = typeof p.shortDescription === "string" ? p.shortDescription.trim() : "";
  const category = typeof p.category === "string" && p.category.trim() ? p.category.trim() : "Geral";
  const createdAtIso = typeof p.createdAtIso === "string" && p.createdAtIso.trim() ? p.createdAtIso : new Date().toISOString();
  const imageUrl = typeof p.imageUrl === "string" && p.imageUrl.trim() ? p.imageUrl.trim() : undefined;
  const observationsDetail =
    typeof p.observationsDetail === "string" && p.observationsDetail.trim() ? p.observationsDetail.trim() : undefined;
  const designerNotes =
    typeof p.designerNotes === "string" && p.designerNotes.trim() ? p.designerNotes.trim() : undefined;
  const supplierUrl =
    typeof p.supplierUrl === "string" && p.supplierUrl.trim().startsWith("http") ? p.supplierUrl.trim() : undefined;
  const referenceCostUsd =
    typeof p.referenceCostUsd === "number" && Number.isFinite(p.referenceCostUsd) ? p.referenceCostUsd : undefined;
  return {
    id,
    title,
    shortDescription,
    unitPriceUsd: Math.round(unitPriceUsd * 100) / 100,
    referenceCostUsd:
      referenceCostUsd !== undefined ? Math.round(referenceCostUsd * 100) / 100 : undefined,
    stockQty,
    imageUrl,
    supplierUrl,
    observationsDetail,
    designerNotes,
    active: p.active !== false,
    category,
    createdAtIso,
  };
}

export function readVipStore(): VipStoreSnapshot {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return defaultSnapshot();
    const o = j as Partial<VipStoreSnapshot>;
    const platformFeePct =
      typeof o.platformFeePct === "number" && Number.isFinite(o.platformFeePct) && o.platformFeePct >= 0
        ? Math.min(0.5, o.platformFeePct)
        : 0.05;
    const rawProducts = Array.isArray(o.products) ? o.products : [];
    const products: VipStoreProduct[] = [];
    for (const x of rawProducts) {
      const np = normalizeStoreProduct(x);
      if (np) products.push(np);
    }
    const orders = Array.isArray(o.orders) ? o.orders : [];
    return { platformFeePct, products, orders };
  } catch {
    return defaultSnapshot();
  }
}

function writeVipStore(s: VipStoreSnapshot): void {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(s, null, 2), "utf8");
}

export function listVipStoreProductsPublic(): VipStoreProduct[] {
  return readVipStore()
    .products.filter((p) => p.active)
    .sort((a, b) => (b.stockQty > 0 ? 1 : 0) - (a.stockQty > 0 ? 1 : 0) || Date.parse(b.createdAtIso) - Date.parse(a.createdAtIso));
}

export function listVipStoreProductsAdmin(): VipStoreProduct[] {
  return readVipStore().products.sort((a, b) => Date.parse(b.createdAtIso) - Date.parse(a.createdAtIso));
}

export function upsertVipStoreProduct(p: VipStoreProduct): void {
  const s = readVipStore();
  const i = s.products.findIndex((x) => x.id === p.id);
  if (i >= 0) s.products[i] = p;
  else s.products.push(p);
  writeVipStore(s);
}

export function setVipStoreFeePct(pct: number): void {
  const s = readVipStore();
  s.platformFeePct = Math.min(0.5, Math.max(0, Number.isFinite(pct) ? pct : 0));
  writeVipStore(s);
}

export function getVipStoreProductById(id: string): VipStoreProduct | undefined {
  return readVipStore().products.find((p) => p.id === id);
}

export function appendVipStoreOrder(order: VipStoreOrder): void {
  const s = readVipStore();
  s.orders.unshift(order);
  writeVipStore(s);
}

export function updateVipStoreOrder(
  id: string,
  patch: Partial<Pick<VipStoreOrder, "status" | "noteAdmin">>,
): VipStoreOrder | null {
  const s = readVipStore();
  const i = s.orders.findIndex((o) => o.id === id);
  if (i < 0) return null;
  const cur = s.orders[i]!;
  const next: VipStoreOrder = {
    ...cur,
    ...patch,
    updatedAtIso: new Date().toISOString(),
  };
  s.orders[i] = next;
  writeVipStore(s);
  return next;
}

/** Decrementa stock após venda (quantidades já validadas). */
export function applyVipStoreStockDecrement(lines: { productId: string; qty: number }[]): void {
  const s = readVipStore();
  for (const { productId, qty } of lines) {
    const p = s.products.find((x) => x.id === productId);
    if (p) p.stockQty = Math.max(0, (p.stockQty || 0) - qty);
  }
  writeVipStore(s);
}

/** Restaura stock ao cancelar / estornar. */
export function applyVipStoreStockRestore(lines: { productId: string; qty: number }[]): void {
  const s = readVipStore();
  for (const { productId, qty } of lines) {
    const p = s.products.find((x) => x.id === productId);
    if (p) p.stockQty = (p.stockQty || 0) + qty;
  }
  writeVipStore(s);
}

export function replaceAllVipStore(snapshot: VipStoreSnapshot): void {
  writeVipStore(snapshot);
}
