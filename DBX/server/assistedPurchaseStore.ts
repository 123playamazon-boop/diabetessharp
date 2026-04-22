import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data", "assisted-purchases.json");

/** Taxa de serviço da plataforma sobre o subtotal do produto (10%). */
export const ASSISTED_PURCHASE_SERVICE_FEE_RATE = 0.1;
/** Imposto de vendas estimado para a Flórida (7% sobre o subtotal do produto). */
export const ASSISTED_PURCHASE_FLORIDA_TAX_RATE = 0.07;

export type AssistedPurchaseStatus =
  | "pending_review"
  | "waiting_customer_approval"
  | "approved"
  | "purchasing"
  | "purchased"
  | "in_transit"
  | "received"
  | "cancelled";

/** Avisos registados pela operação — o cliente vê no portal. */
export type AssistedPurchaseClientAlertType =
  | "price_higher_than_declared"
  | "product_out_of_stock"
  | "characteristics_mismatch"
  | "shipping_timeframe_mismatch";

export type AssistedPurchaseClientNotification = {
  type: AssistedPurchaseClientAlertType;
  atIso: string;
};

/** Checklist interna para a equipa (não afecta débito). */
export type AssistedPurchaseAdminChecklist = {
  valueMatchesSupplierScreen: boolean;
  characteristicsMatchLink: boolean;
  shippingMatchesSupplier: boolean;
};

export type AssistedPurchase = {
  id: string;
  suite: string;
  clientName?: string;
  productUrl: string;
  productTitle: string;
  quantity: number;
  notes: string;
  estimatedUnitPriceUsd: number;
  estimatedProductSubtotalUsd: number;
  serviceFeeRate: number;
  estimatedServiceFeeUsd: number;
  floridaTaxRate?: number;
  floridaTaxUsd?: number;
  estimatedTotalUsd: number;
  productImageUrl?: string;
  registeredUnitPriceUsd?: number;
  linkScrapeUnitPriceUsd?: number;
  linkScrapeAtIso?: string;
  finalUnitPriceUsd?: number;
  finalProductSubtotalUsd?: number;
  finalServiceFeeUsd?: number;
  finalFloridaTaxUsd?: number;
  finalTotalUsd?: number;
  status: AssistedPurchaseStatus;
  adminNotes?: string;
  storeName?: string;
  storeOrderId?: string;
  trackingNumber?: string;
  /** Valor já debitado do saldo (auditoria). */
  debitedUsd?: number;
  debitedAtIso?: string;
  customerApprovedAtIso?: string;
  auditLog?: { atIso: string; actor: "client" | "admin"; action: string; detail?: string }[];
  /** Data mínima em que o cliente precisa do artigo (YYYY-MM-DD). */
  requiredDeliveryByDate?: string;
  /** Avisos enviados ao cliente pela operação. */
  clientNotifications?: AssistedPurchaseClientNotification[];
  adminChecklist?: AssistedPurchaseAdminChecklist;
  createdAtIso: string;
  updatedAtIso: string;
};

type Snapshot = { purchases: AssistedPurchase[] };

function emptySnapshot(): Snapshot {
  return { purchases: [] };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Pedidos antigos (só subtotal + 10%). */
function computeAssistedPurchaseTotalsLegacy(unitPriceUsd: number, quantity: number, feeRate = ASSISTED_PURCHASE_SERVICE_FEE_RATE) {
  const q = Math.max(1, Math.floor(quantity));
  const sub = round2(unitPriceUsd * q);
  const fee = round2(sub * feeRate);
  const total = round2(sub + fee);
  return {
    quantity: q,
    estimatedProductSubtotalUsd: sub,
    serviceFeeRate: feeRate,
    estimatedServiceFeeUsd: fee,
    estimatedTotalUsd: total,
  };
}

/** Subtotal + 10% plataforma (sobre subtotal) + 7% imposto FL (sobre subtotal). */
export function computeAssistedPurchaseTotals(unitPriceUsd: number, quantity: number, feeRate = ASSISTED_PURCHASE_SERVICE_FEE_RATE) {
  const q = Math.max(1, Math.floor(quantity));
  const sub = round2(unitPriceUsd * q);
  const fee = round2(sub * feeRate);
  const florida = round2(sub * ASSISTED_PURCHASE_FLORIDA_TAX_RATE);
  const total = round2(sub + fee + florida);
  return {
    quantity: q,
    estimatedProductSubtotalUsd: sub,
    serviceFeeRate: feeRate,
    estimatedServiceFeeUsd: fee,
    floridaTaxRate: ASSISTED_PURCHASE_FLORIDA_TAX_RATE,
    floridaTaxUsd: florida,
    estimatedTotalUsd: total,
  };
}

export function isScrapedUnitAboveRegistered(ap: AssistedPurchase): boolean {
  const reg = typeof ap.registeredUnitPriceUsd === "number" ? ap.registeredUnitPriceUsd : ap.estimatedUnitPriceUsd;
  const s = ap.linkScrapeUnitPriceUsd;
  if (typeof s !== "number" || !Number.isFinite(s) || typeof reg !== "number" || !Number.isFinite(reg)) return false;
  return s > reg + 0.02;
}

function pushAudit(ap: AssistedPurchase, actor: "client" | "admin", action: string, detail?: string): void {
  const log = ap.auditLog ?? [];
  log.push({ atIso: new Date().toISOString(), actor, action, detail });
  ap.auditLog = log;
}

function readSnapshot(): Snapshot {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return emptySnapshot();
    const o = j as Partial<Snapshot>;
    const purchases: AssistedPurchase[] = [];
    if (Array.isArray(o.purchases)) {
      for (const x of o.purchases) {
        const p = normalizePurchase(x);
        if (p) purchases.push(p);
      }
    }
    return { purchases };
  } catch {
    return emptySnapshot();
  }
}

function writeSnapshot(s: Snapshot): void {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(s, null, 2), "utf8");
}

function normalizePurchase(raw: unknown): AssistedPurchase | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  const suite = typeof r.suite === "string" ? r.suite.trim() : "";
  const productUrl = typeof r.productUrl === "string" ? r.productUrl.trim() : "";
  const productTitle = typeof r.productTitle === "string" ? r.productTitle.trim() : "";
  const quantity = typeof r.quantity === "number" && Number.isFinite(r.quantity) ? Math.max(1, Math.floor(r.quantity)) : 1;
  const notes = typeof r.notes === "string" ? r.notes.trim() : "";
  const status = typeof r.status === "string" ? (r.status as AssistedPurchaseStatus) : "pending_review";
  const allowed: AssistedPurchaseStatus[] = [
    "pending_review",
    "waiting_customer_approval",
    "approved",
    "purchasing",
    "purchased",
    "in_transit",
    "received",
    "cancelled",
  ];
  if (!id || !suite || !productUrl || !allowed.includes(status)) return null;
  const estUnit = typeof r.estimatedUnitPriceUsd === "number" && Number.isFinite(r.estimatedUnitPriceUsd) ? r.estimatedUnitPriceUsd : 0;
  if (estUnit <= 0) return null;
  const feeRate = typeof r.serviceFeeRate === "number" && Number.isFinite(r.serviceFeeRate) ? r.serviceFeeRate : ASSISTED_PURCHASE_SERVICE_FEE_RATE;
  const hasFlorida = typeof r.floridaTaxUsd === "number" && Number.isFinite(r.floridaTaxUsd);
  const tNew = hasFlorida ? computeAssistedPurchaseTotals(estUnit, quantity, feeRate) : null;
  const t = tNew ?? computeAssistedPurchaseTotalsLegacy(estUnit, quantity, feeRate);
  const floridaTaxUsd = tNew?.floridaTaxUsd;
  const floridaTaxRate = tNew?.floridaTaxRate;
  return {
    id,
    suite,
    clientName: typeof r.clientName === "string" ? r.clientName.trim() : undefined,
    productUrl,
    productTitle: productTitle || "Produto",
    quantity: t.quantity,
    notes,
    estimatedUnitPriceUsd: round2(estUnit),
    estimatedProductSubtotalUsd: t.estimatedProductSubtotalUsd,
    serviceFeeRate: t.serviceFeeRate,
    estimatedServiceFeeUsd: t.estimatedServiceFeeUsd,
    floridaTaxRate,
    floridaTaxUsd,
    estimatedTotalUsd: t.estimatedTotalUsd,
    productImageUrl: typeof r.productImageUrl === "string" && r.productImageUrl.trim() ? r.productImageUrl.trim() : undefined,
    registeredUnitPriceUsd:
      typeof r.registeredUnitPriceUsd === "number" && Number.isFinite(r.registeredUnitPriceUsd)
        ? round2(r.registeredUnitPriceUsd)
        : round2(estUnit),
    linkScrapeUnitPriceUsd:
      typeof r.linkScrapeUnitPriceUsd === "number" && Number.isFinite(r.linkScrapeUnitPriceUsd) ? round2(r.linkScrapeUnitPriceUsd) : undefined,
    linkScrapeAtIso: typeof r.linkScrapeAtIso === "string" ? r.linkScrapeAtIso : undefined,
    finalUnitPriceUsd:
      typeof r.finalUnitPriceUsd === "number" && Number.isFinite(r.finalUnitPriceUsd) ? round2(r.finalUnitPriceUsd) : undefined,
    finalProductSubtotalUsd:
      typeof r.finalProductSubtotalUsd === "number" && Number.isFinite(r.finalProductSubtotalUsd)
        ? round2(r.finalProductSubtotalUsd)
        : undefined,
    finalServiceFeeUsd:
      typeof r.finalServiceFeeUsd === "number" && Number.isFinite(r.finalServiceFeeUsd) ? round2(r.finalServiceFeeUsd) : undefined,
    finalFloridaTaxUsd:
      typeof r.finalFloridaTaxUsd === "number" && Number.isFinite(r.finalFloridaTaxUsd) ? round2(r.finalFloridaTaxUsd) : undefined,
    finalTotalUsd: typeof r.finalTotalUsd === "number" && Number.isFinite(r.finalTotalUsd) ? round2(r.finalTotalUsd) : undefined,
    status,
    adminNotes: typeof r.adminNotes === "string" ? r.adminNotes.trim() || undefined : undefined,
    storeName: typeof r.storeName === "string" ? r.storeName.trim() || undefined : undefined,
    storeOrderId: typeof r.storeOrderId === "string" ? r.storeOrderId.trim() || undefined : undefined,
    trackingNumber: typeof r.trackingNumber === "string" ? r.trackingNumber.trim() || undefined : undefined,
    debitedUsd: typeof r.debitedUsd === "number" && Number.isFinite(r.debitedUsd) ? round2(r.debitedUsd) : undefined,
    debitedAtIso: typeof r.debitedAtIso === "string" ? r.debitedAtIso : undefined,
    customerApprovedAtIso: typeof r.customerApprovedAtIso === "string" ? r.customerApprovedAtIso : undefined,
    auditLog: Array.isArray(r.auditLog) ? (r.auditLog as AssistedPurchase["auditLog"]) : undefined,
    requiredDeliveryByDate:
      typeof r.requiredDeliveryByDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.requiredDeliveryByDate.trim())
        ? r.requiredDeliveryByDate.trim()
        : undefined,
    clientNotifications: normalizeClientNotifications(r.clientNotifications),
    adminChecklist: normalizeAdminChecklist(r.adminChecklist),
    createdAtIso: typeof r.createdAtIso === "string" ? r.createdAtIso : new Date().toISOString(),
    updatedAtIso: typeof r.updatedAtIso === "string" ? r.updatedAtIso : new Date().toISOString(),
  };
}

const CLIENT_ALERT_TYPE_SET = new Set<AssistedPurchaseClientAlertType>([
  "price_higher_than_declared",
  "product_out_of_stock",
  "characteristics_mismatch",
  "shipping_timeframe_mismatch",
]);

export function isAssistedPurchaseClientAlertType(x: string): x is AssistedPurchaseClientAlertType {
  return CLIENT_ALERT_TYPE_SET.has(x as AssistedPurchaseClientAlertType);
}

function normalizeClientNotifications(raw: unknown): AssistedPurchaseClientNotification[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: AssistedPurchaseClientNotification[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const type = o.type;
    const atIso = typeof o.atIso === "string" ? o.atIso : "";
    if (typeof type === "string" && isAssistedPurchaseClientAlertType(type) && atIso) {
      out.push({ type, atIso });
    }
  }
  return out.length ? out : undefined;
}

function normalizeAdminChecklist(raw: unknown): AssistedPurchaseAdminChecklist | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  return {
    valueMatchesSupplierScreen: o.valueMatchesSupplierScreen === true,
    characteristicsMatchLink: o.characteristicsMatchLink === true,
    shippingMatchesSupplier: o.shippingMatchesSupplier === true,
  };
}

function persistPurchase(ap: AssistedPurchase): void {
  const s = readSnapshot();
  const i = s.purchases.findIndex((x) => x.id === ap.id);
  ap.updatedAtIso = new Date().toISOString();
  if (i >= 0) s.purchases[i] = ap;
  else s.purchases.push(ap);
  writeSnapshot(s);
}

export function clearAssistedPurchases(): void {
  writeSnapshot(emptySnapshot());
}

export function listAssistedPurchasesBySuite(suite: string): AssistedPurchase[] {
  return readSnapshot()
    .purchases.filter((p) => p.suite === suite)
    .sort((a, b) => Date.parse(b.createdAtIso) - Date.parse(a.createdAtIso));
}

const ALL_STATUSES: AssistedPurchaseStatus[] = [
  "pending_review",
  "waiting_customer_approval",
  "approved",
  "purchasing",
  "purchased",
  "in_transit",
  "received",
  "cancelled",
];

export function listAssistedPurchasesAdmin(status?: string): AssistedPurchase[] {
  let list = readSnapshot().purchases.sort((a, b) => Date.parse(b.createdAtIso) - Date.parse(a.createdAtIso));
  if (status && typeof status === "string") {
    const st = status.trim() as AssistedPurchaseStatus;
    if (ALL_STATUSES.includes(st)) list = list.filter((p) => p.status === st);
  }
  return list;
}

export function getAssistedPurchaseById(id: string): AssistedPurchase | undefined {
  return readSnapshot().purchases.find((p) => p.id === id);
}

export function appendAssistedPurchaseDraft(input: {
  suite: string;
  clientName?: string;
  productUrl: string;
  productTitle: string;
  quantity: number;
  notes: string;
  unitPriceUsd: number;
  requiredDeliveryByDate: string;
  productImageUrl?: string;
  linkScrapeUnitPriceUsd?: number;
  linkScrapeAtIso?: string;
}): AssistedPurchase {
  const t = computeAssistedPurchaseTotals(input.unitPriceUsd, input.quantity);
  const id = `AP-${Date.now().toString(36).toUpperCase()}`;
  const now = new Date().toISOString();
  const ap: AssistedPurchase = {
    id,
    suite: input.suite,
    clientName: input.clientName,
    productUrl: input.productUrl,
    productTitle: input.productTitle,
    quantity: t.quantity,
    notes: input.notes,
    estimatedUnitPriceUsd: round2(input.unitPriceUsd),
    estimatedProductSubtotalUsd: t.estimatedProductSubtotalUsd,
    serviceFeeRate: t.serviceFeeRate,
    estimatedServiceFeeUsd: t.estimatedServiceFeeUsd,
    floridaTaxRate: t.floridaTaxRate,
    floridaTaxUsd: t.floridaTaxUsd,
    estimatedTotalUsd: t.estimatedTotalUsd,
    registeredUnitPriceUsd: round2(input.unitPriceUsd),
    productImageUrl: input.productImageUrl,
    linkScrapeUnitPriceUsd: input.linkScrapeUnitPriceUsd,
    linkScrapeAtIso: input.linkScrapeAtIso,
    requiredDeliveryByDate: input.requiredDeliveryByDate,
    adminChecklist: {
      valueMatchesSupplierScreen: false,
      characteristicsMatchLink: false,
      shippingMatchesSupplier: false,
    },
    status: "pending_review",
    createdAtIso: now,
    updatedAtIso: now,
  };
  pushAudit(ap, "client", "create", `estimate_total=${ap.estimatedTotalUsd}`);
  persistPurchase(ap);
  return ap;
}

export function saveAssistedPurchase(ap: AssistedPurchase): void {
  persistPurchase(ap);
}
