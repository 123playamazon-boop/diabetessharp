import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyWalletDelta } from "./clientRegistryStore";
import { appendWalletLedger } from "./walletLedger";
import {
  GROWTH_PROGRAM_MONTHLY_USD,
  GROWTH_PROGRAM_PLAN_ID,
  GROWTH_PROGRAM_PROFIT_SHARE_RATE,
} from "../shared/growthProgramRoutes";
import {
  GROWTH_BUSINESS_MODELS,
  GROWTH_INVESTMENT_READINESS,
  GROWTH_PREP_CENTER_USAGE,
  GROWTH_PRODUCT_COUNT_BANDS,
  GROWTH_REVENUE_BANDS,
  isOneOf,
} from "../shared/growthLeadQualification";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data", "growth-program.json");

export type GrowthSubscriptionStatus = "active" | "paused" | "cancelled";

export type GrowthSubscription = {
  id: string;
  suite: string;
  clientName?: string;
  planId: string;
  status: GrowthSubscriptionStatus;
  monthlyUsd: number;
  profitShareRate: number;
  startedAtIso: string;
  currentPeriodEndIso?: string;
  lastBilledAtIso?: string;
  pausedAtIso?: string;
  cancelledAtIso?: string;
  paymentProvider: "internal_wallet";
  externalRef?: string;
};

export type RevenueTrackingRow = {
  id: string;
  suite: string;
  productSku: string;
  salesAmountUsd: number;
  profitAmountUsd: number;
  platform: string;
  commissionRate: number;
  commissionDueUsd: number;
  periodStartIso?: string;
  periodEndIso?: string;
  note?: string;
  createdAtIso: string;
  createdBy: "admin" | "import";
};

export type ProfitShareStatus = "pending" | "paid";

export type ProfitShareRow = {
  id: string;
  revenueTrackingId: string;
  suite: string;
  commissionRate: number;
  commissionDueUsd: number;
  status: ProfitShareStatus;
  paidAtIso?: string;
  paidNote?: string;
};

export type AdminGrowthTaskStatus = "open" | "in_progress" | "done" | "blocked";

export type AdminGrowthTask = {
  id: string;
  suite: string;
  title: string;
  description?: string;
  assignee?: string;
  status: AdminGrowthTaskStatus;
  dueAtIso?: string;
  createdAtIso: string;
  updatedAtIso: string;
};

export type GrowthServiceRequestType = "ungating" | "listing_optimization" | "product_setup" | "other";

export type GrowthServiceRequestStatus = "submitted" | "in_review" | "scheduled" | "completed" | "declined";

export type GrowthServiceRequest = {
  id: string;
  suite: string;
  type: GrowthServiceRequestType;
  subject?: string;
  body: string;
  status: GrowthServiceRequestStatus;
  createdAtIso: string;
  adminReply?: string;
};

export type GrowthFinancialAuditEntry = {
  id: string;
  atIso: string;
  suite?: string;
  actor: "client" | "admin" | "system";
  action: string;
  entityType: string;
  entityId: string;
  detail?: string;
  amountUsd?: number;
};

export type GrowthLeadIntakeStatus = "new" | "contacted" | "qualified" | "closed";

/** Lead qualificado a partir da landing (funil; sem venda directa na página). */
export type GrowthLeadIntake = {
  id: string;
  suite?: string;
  fullName: string;
  email: string;
  /** WhatsApp (E.164 ou texto livre curto). */
  whatsapp?: string;
  phone?: string;
  businessModel?: string;
  monthlyRevenueBand?: string;
  productCountBand?: string;
  biggestChallenge?: string;
  prepCenterUsage?: string;
  investmentReadiness?: string;
  storeOrBrand?: string;
  /** Narrativa principal (legado + espelho de biggestChallenge em leads novos). */
  blockerSummary: string;
  goals?: string;
  marketplaceFocus?: string;
  status: GrowthLeadIntakeStatus;
  adminNote?: string;
  /** Agente / owner interno (texto livre). */
  assignedTo?: string;
  createdAtIso: string;
  updatedAtIso?: string;
};

type Snapshot = {
  subscriptions: GrowthSubscription[];
  revenueRows: RevenueTrackingRow[];
  profitShares: ProfitShareRow[];
  tasks: AdminGrowthTask[];
  requests: GrowthServiceRequest[];
  audit: GrowthFinancialAuditEntry[];
  /** Overrides de copy da landing (chaves i18n → texto). */
  landingCopyOverrides: Record<string, string>;
  leadIntakes: GrowthLeadIntake[];
};

function emptySnapshot(): Snapshot {
  return {
    subscriptions: [],
    revenueRows: [],
    profitShares: [],
    tasks: [],
    requests: [],
    audit: [],
    landingCopyOverrides: {},
    leadIntakes: [],
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function readSnapshot(): Snapshot {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return emptySnapshot();
    const o = j as Partial<Snapshot>;
    const landingRaw = (o as { landingCopyOverrides?: unknown }).landingCopyOverrides;
    const landingCopyOverrides: Record<string, string> = {};
    if (landingRaw && typeof landingRaw === "object" && !Array.isArray(landingRaw)) {
      for (const [k, v] of Object.entries(landingRaw as Record<string, unknown>)) {
        if (typeof k === "string" && k.startsWith("growth.") && typeof v === "string") landingCopyOverrides[k] = v;
      }
    }
    const leadsRaw = (o as { leadIntakes?: unknown }).leadIntakes;
    const leadIntakes: GrowthLeadIntake[] = Array.isArray(leadsRaw)
      ? (leadsRaw as unknown[])
          .map((x) => {
            if (!x || typeof x !== "object") return null;
            const r = x as Record<string, unknown>;
            if (typeof r.id !== "string" || typeof r.fullName !== "string" || typeof r.email !== "string") return null;
            const blockerRaw =
              typeof r.blockerSummary === "string" && r.blockerSummary.trim()
                ? r.blockerSummary.trim()
                : typeof r.biggestChallenge === "string"
                  ? r.biggestChallenge.trim()
                  : "";
            if (!blockerRaw) return null;
            const st = r.status;
            const status: GrowthLeadIntakeStatus =
              st === "contacted" || st === "qualified" || st === "closed" || st === "new" ? st : "new";
            const lead: GrowthLeadIntake = {
              id: r.id,
              suite: typeof r.suite === "string" ? r.suite.trim() || undefined : undefined,
              fullName: String(r.fullName).trim(),
              email: String(r.email).trim().toLowerCase(),
              whatsapp: typeof r.whatsapp === "string" ? r.whatsapp.trim() || undefined : undefined,
              phone: typeof r.phone === "string" ? r.phone.trim() || undefined : undefined,
              businessModel: typeof r.businessModel === "string" ? r.businessModel : undefined,
              monthlyRevenueBand: typeof r.monthlyRevenueBand === "string" ? r.monthlyRevenueBand : undefined,
              productCountBand: typeof r.productCountBand === "string" ? r.productCountBand : undefined,
              biggestChallenge: typeof r.biggestChallenge === "string" ? r.biggestChallenge : undefined,
              prepCenterUsage: typeof r.prepCenterUsage === "string" ? r.prepCenterUsage : undefined,
              investmentReadiness: typeof r.investmentReadiness === "string" ? r.investmentReadiness : undefined,
              storeOrBrand: typeof r.storeOrBrand === "string" ? r.storeOrBrand.trim() || undefined : undefined,
              blockerSummary: blockerRaw,
              goals: typeof r.goals === "string" ? r.goals : undefined,
              marketplaceFocus: typeof r.marketplaceFocus === "string" ? r.marketplaceFocus : undefined,
              status,
              adminNote: typeof r.adminNote === "string" ? r.adminNote : undefined,
              assignedTo: typeof r.assignedTo === "string" ? r.assignedTo.trim() || undefined : undefined,
              createdAtIso: typeof r.createdAtIso === "string" ? r.createdAtIso : new Date().toISOString(),
              updatedAtIso: typeof r.updatedAtIso === "string" ? r.updatedAtIso : undefined,
            };
            return lead;
          })
          .filter((x): x is GrowthLeadIntake => x !== null)
      : [];
    return {
      subscriptions: Array.isArray(o.subscriptions) ? o.subscriptions.filter(Boolean) as GrowthSubscription[] : [],
      revenueRows: Array.isArray(o.revenueRows) ? o.revenueRows.filter(Boolean) as RevenueTrackingRow[] : [],
      profitShares: Array.isArray(o.profitShares) ? o.profitShares.filter(Boolean) as ProfitShareRow[] : [],
      tasks: Array.isArray(o.tasks) ? o.tasks.filter(Boolean) as AdminGrowthTask[] : [],
      requests: Array.isArray(o.requests) ? o.requests.filter(Boolean) as GrowthServiceRequest[] : [],
      audit: Array.isArray(o.audit) ? o.audit.filter(Boolean) as GrowthFinancialAuditEntry[] : [],
      landingCopyOverrides,
      leadIntakes,
    };
  } catch {
    return emptySnapshot();
  }
}

function writeSnapshot(s: Snapshot): void {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(s, null, 2), "utf8");
}

function pushAudit(
  s: Snapshot,
  entry: Omit<GrowthFinancialAuditEntry, "id" | "atIso"> & { id?: string; atIso?: string },
): void {
  s.audit.push({
    id: entry.id ?? newId("gaudit"),
    atIso: entry.atIso ?? new Date().toISOString(),
    suite: entry.suite,
    actor: entry.actor,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    detail: entry.detail,
    amountUsd: entry.amountUsd,
  });
}

function mutate(mutator: (s: Snapshot) => void): void {
  const s = readSnapshot();
  mutator(s);
  writeSnapshot(s);
}

export function clearGrowthProgram(): void {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(emptySnapshot(), null, 2), "utf8");
}

export function listSubscriptions(): GrowthSubscription[] {
  return readSnapshot().subscriptions;
}

export function getActiveSubscriptionForSuite(suite: string): GrowthSubscription | undefined {
  const q = suite.trim();
  return readSnapshot().subscriptions.find((x) => x.suite === q && x.status === "active");
}

export function listRevenueForSuite(suite: string): RevenueTrackingRow[] {
  const q = suite.trim();
  return readSnapshot().revenueRows.filter((r) => r.suite === q);
}

export function listProfitSharesForSuite(suite: string): ProfitShareRow[] {
  const q = suite.trim();
  return readSnapshot().profitShares.filter((p) => p.suite === q);
}

export function listTasksForSuite(suite: string): AdminGrowthTask[] {
  const q = suite.trim();
  return readSnapshot().tasks.filter((t) => t.suite === q);
}

export function listRequestsForSuite(suite: string): GrowthServiceRequest[] {
  const q = suite.trim();
  return readSnapshot().requests.filter((r) => r.suite === q);
}

export function listAudit(limit = 200): GrowthFinancialAuditEntry[] {
  const a = readSnapshot().audit;
  return a.slice(-limit).reverse();
}

/** Grava subscrição activa após cobrança bem-sucedida (ex.: carteira) — a rota HTTP deve validar duplicados e saldo. */
export function insertActiveSubscription(opts: { suite: string; clientName?: string }): GrowthSubscription {
  const suite = opts.suite.trim();
  const now = new Date().toISOString();
  const end = new Date();
  end.setDate(end.getDate() + 30);
  const sub: GrowthSubscription = {
    id: newId("gsub"),
    suite,
    clientName: opts.clientName?.trim(),
    planId: GROWTH_PROGRAM_PLAN_ID,
    status: "active",
    monthlyUsd: GROWTH_PROGRAM_MONTHLY_USD,
    profitShareRate: GROWTH_PROGRAM_PROFIT_SHARE_RATE,
    startedAtIso: now,
    currentPeriodEndIso: end.toISOString(),
    lastBilledAtIso: now,
    paymentProvider: "internal_wallet",
  };
  mutate((s) => {
    s.subscriptions.push(sub);
    pushAudit(s, {
      actor: "system",
      action: "subscription_activated",
      entityType: "subscription",
      entityId: sub.id,
      suite,
      detail: `Monthly US$${GROWTH_PROGRAM_MONTHLY_USD}; profit share ${GROWTH_PROGRAM_PROFIT_SHARE_RATE * 100}%`,
      amountUsd: -GROWTH_PROGRAM_MONTHLY_USD,
    });
  });
  return sub;
}

function mutateWithResult<T>(fn: (s: Snapshot) => T): T {
  const s = readSnapshot();
  const out = fn(s);
  writeSnapshot(s);
  return out;
}

export function patchSubscriptionStatus(
  subscriptionId: string,
  status: GrowthSubscriptionStatus,
): { ok: true; subscription: GrowthSubscription } | { ok: false; error: string } {
  return mutateWithResult((s) => {
    const sub = s.subscriptions.find((x) => x.id === subscriptionId);
    if (!sub) return { ok: false, error: "Subscrição não encontrada." };
    sub.status = status;
    if (status === "paused") sub.pausedAtIso = new Date().toISOString();
    if (status === "cancelled") sub.cancelledAtIso = new Date().toISOString();
    pushAudit(s, {
      actor: "admin",
      action: `subscription_${status}`,
      entityType: "subscription",
      entityId: sub.id,
      suite: sub.suite,
    });
    return { ok: true, subscription: sub };
  });
}

export type RevenueEntryInput = {
  suite: string;
  productSku: string;
  salesAmountUsd: number;
  profitAmountUsd: number;
  platform: string;
  periodStartIso?: string;
  periodEndIso?: string;
  note?: string;
  createdBy?: "admin" | "import";
};

export function addRevenueEntry(input: RevenueEntryInput): { ok: true; revenue: RevenueTrackingRow; profitShare: ProfitShareRow } | { ok: false; error: string } {
  const suite = input.suite.trim();
  const sku = input.productSku.trim();
  if (!suite || !sku) return { ok: false, error: "suite e productSku são obrigatórios." };
  const sales = round2(Number(input.salesAmountUsd));
  const profit = round2(Number(input.profitAmountUsd));
  if (!Number.isFinite(sales) || sales < 0 || !Number.isFinite(profit)) return { ok: false, error: "Valores de venda/lucro inválidos." };

  const rate = GROWTH_PROGRAM_PROFIT_SHARE_RATE;
  const commissionDue = round2(Math.max(0, profit) * rate);

  return mutateWithResult((s) => {
    const revId = newId("grev");
    const rev: RevenueTrackingRow = {
      id: revId,
      suite,
      productSku: sku,
      salesAmountUsd: sales,
      profitAmountUsd: profit,
      platform: (input.platform || "Amazon").trim() || "Amazon",
      commissionRate: rate,
      commissionDueUsd: commissionDue,
      periodStartIso: input.periodStartIso?.trim(),
      periodEndIso: input.periodEndIso?.trim(),
      note: input.note?.trim(),
      createdAtIso: new Date().toISOString(),
      createdBy: input.createdBy ?? "admin",
    };
    s.revenueRows.push(rev);
    const ps: ProfitShareRow = {
      id: newId("gps"),
      revenueTrackingId: revId,
      suite,
      commissionRate: rate,
      commissionDueUsd: commissionDue,
      status: commissionDue <= 0 ? "paid" : "pending",
      paidAtIso: commissionDue <= 0 ? new Date().toISOString() : undefined,
      paidNote: commissionDue <= 0 ? "zero_commission" : undefined,
    };
    s.profitShares.push(ps);
    pushAudit(s, {
      actor: "admin",
      action: "revenue_entry_created",
      entityType: "revenue_tracking",
      entityId: revId,
      suite,
      detail: `SKU ${sku}; sales US$${sales}; profit US$${profit}; commission US$${commissionDue}`,
      amountUsd: commissionDue,
    });
    return { ok: true, revenue: rev, profitShare: ps };
  });
}

export function markProfitSharePaid(
  profitShareId: string,
  paidNote?: string,
): { ok: true; row: ProfitShareRow } | { ok: false; error: string } {
  return mutateWithResult((s) => {
    const row = s.profitShares.find((x) => x.id === profitShareId);
    if (!row) return { ok: false, error: "Profit share não encontrado." };
    if (row.status === "paid") return { ok: false, error: "Já marcado como pago." };
    row.status = "paid";
    row.paidAtIso = new Date().toISOString();
    row.paidNote = paidNote?.trim() || "marked_paid";
    pushAudit(s, {
      actor: "admin",
      action: "profit_share_paid",
      entityType: "profit_share",
      entityId: row.id,
      suite: row.suite,
      amountUsd: row.commissionDueUsd,
      detail: row.paidNote,
    });
    return { ok: true, row };
  });
}

export function addAdminTask(input: {
  suite: string;
  title: string;
  description?: string;
  assignee?: string;
  dueAtIso?: string;
}): { ok: true; task: AdminGrowthTask } | { ok: false; error: string } {
  const suite = input.suite.trim();
  const title = input.title.trim();
  if (!suite || !title) return { ok: false, error: "suite e title são obrigatórios." };
  const now = new Date().toISOString();
  return mutateWithResult((s) => {
    const task: AdminGrowthTask = {
      id: newId("gtask"),
      suite,
      title,
      description: input.description?.trim(),
      assignee: input.assignee?.trim(),
      status: "open",
      dueAtIso: input.dueAtIso?.trim(),
      createdAtIso: now,
      updatedAtIso: now,
    };
    s.tasks.push(task);
    pushAudit(s, {
      actor: "admin",
      action: "task_created",
      entityType: "admin_task",
      entityId: task.id,
      suite,
    });
    return { ok: true, task };
  });
}

export function patchAdminTask(
  taskId: string,
  patch: Partial<Pick<AdminGrowthTask, "title" | "description" | "assignee" | "status" | "dueAtIso">>,
): { ok: true; task: AdminGrowthTask } | { ok: false; error: string } {
  return mutateWithResult((s) => {
    const task = s.tasks.find((x) => x.id === taskId);
    if (!task) return { ok: false, error: "Tarefa não encontrada." };
    if (typeof patch.title === "string") task.title = patch.title.trim() || task.title;
    if (patch.description !== undefined) task.description = patch.description?.trim();
    if (patch.assignee !== undefined) task.assignee = patch.assignee?.trim();
    if (patch.dueAtIso !== undefined) task.dueAtIso = patch.dueAtIso?.trim();
    if (patch.status) {
      const allowed: AdminGrowthTaskStatus[] = ["open", "in_progress", "done", "blocked"];
      if (allowed.includes(patch.status)) task.status = patch.status;
    }
    task.updatedAtIso = new Date().toISOString();
    pushAudit(s, {
      actor: "admin",
      action: "task_updated",
      entityType: "admin_task",
      entityId: task.id,
      suite: task.suite,
    });
    return { ok: true, task };
  });
}

const REQUEST_TYPES: GrowthServiceRequestType[] = ["ungating", "listing_optimization", "product_setup", "other"];

export function addServiceRequest(input: {
  suite: string;
  type: string;
  body: string;
  subject?: string;
}): { ok: true; request: GrowthServiceRequest } | { ok: false; error: string } {
  const suite = input.suite.trim();
  const body = input.body.trim();
  const t = (input.type || "other").trim() as GrowthServiceRequestType;
  if (!suite || !body) return { ok: false, error: "suite e body são obrigatórios." };
  if (!REQUEST_TYPES.includes(t)) return { ok: false, error: "Tipo de pedido inválido." };
  const now = new Date().toISOString();
  return mutateWithResult((s) => {
    const req: GrowthServiceRequest = {
      id: newId("greq"),
      suite,
      type: t,
      subject: input.subject?.trim(),
      body,
      status: "submitted",
      createdAtIso: now,
    };
    s.requests.push(req);
    pushAudit(s, {
      actor: "client",
      action: "service_request_submitted",
      entityType: "service_request",
      entityId: req.id,
      suite,
      detail: t,
    });
    return { ok: true, request: req };
  });
}

export function aggregateSuiteReport(suite: string): {
  totalSalesUsd: number;
  totalProfitUsd: number;
  commissionPendingUsd: number;
  commissionPaidUsd: number;
  revenueCount: number;
} {
  const q = suite.trim();
  const s = readSnapshot();
  const revs = s.revenueRows.filter((r) => r.suite === q);
  const shares = s.profitShares.filter((p) => p.suite === q);
  let totalSalesUsd = 0;
  let totalProfitUsd = 0;
  for (const r of revs) {
    totalSalesUsd += r.salesAmountUsd;
    totalProfitUsd += r.profitAmountUsd;
  }
  let commissionPendingUsd = 0;
  let commissionPaidUsd = 0;
  for (const p of shares) {
    if (p.status === "paid") commissionPaidUsd += p.commissionDueUsd;
    else commissionPendingUsd += p.commissionDueUsd;
  }
  return {
    totalSalesUsd: round2(totalSalesUsd),
    totalProfitUsd: round2(totalProfitUsd),
    commissionPendingUsd: round2(commissionPendingUsd),
    commissionPaidUsd: round2(commissionPaidUsd),
    revenueCount: revs.length,
  };
}

export function listAllForAdmin(): Snapshot {
  return readSnapshot();
}

export function getLandingCopyOverrides(): Record<string, string> {
  return { ...readSnapshot().landingCopyOverrides };
}

export function mergeLandingCopyOverrides(patch: Record<string, string>): void {
  mutate((s) => {
    const next = { ...s.landingCopyOverrides };
    for (const [k, v] of Object.entries(patch)) {
      if (typeof k !== "string" || !k.startsWith("growth.")) continue;
      if (typeof v !== "string" || v.trim() === "") delete next[k];
      else next[k] = v;
    }
    s.landingCopyOverrides = next;
    pushAudit(s, {
      actor: "admin",
      action: "growth_landing_copy_merge",
      entityType: "landing_copy",
      entityId: newId("glc"),
      detail: `keys=${Object.keys(patch).length}`,
    });
  });
}

export function recordGrowthLandingConversionEvent(placement: string, suite?: string): void {
  const p = placement.trim().slice(0, 160);
  if (!p) return;
  mutate((s) => {
    pushAudit(s, {
      actor: "client",
      action: "growth_landing_conversion",
      entityType: "cta",
      entityId: newId("gconv"),
      suite: suite?.trim() || undefined,
      detail: p,
    });
  });
}

export type GrowthLeadIntakeInput = {
  fullName: string;
  email: string;
  whatsapp: string;
  phone?: string;
  suite?: string;
  storeOrBrand?: string;
  businessModel: string;
  monthlyRevenueBand: string;
  productCountBand: string;
  biggestChallenge: string;
  prepCenterUsage: string;
  investmentReadiness: string;
  /** Legado: se enviado, usado em vez de biggestChallenge para o texto longo. */
  blockerSummary?: string;
  goals?: string;
  marketplaceFocus?: string;
};

export function addGrowthLeadIntake(input: GrowthLeadIntakeInput): { ok: true; lead: GrowthLeadIntake } | { ok: false; error: string } {
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const whatsapp = input.whatsapp.trim();
  const challenge = (input.biggestChallenge?.trim() || input.blockerSummary?.trim() || "").trim();
  if (!fullName || fullName.length < 2) return { ok: false, error: "Nome inválido." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "E-mail inválido." };
  if (!whatsapp || whatsapp.length < 6) return { ok: false, error: "Indique um WhatsApp válido." };
  if (!isOneOf(input.businessModel.trim(), GROWTH_BUSINESS_MODELS)) return { ok: false, error: "Modelo de negócio inválido." };
  if (!isOneOf(input.monthlyRevenueBand.trim(), GROWTH_REVENUE_BANDS)) return { ok: false, error: "Faixa de receita inválida." };
  if (!isOneOf(input.productCountBand.trim(), GROWTH_PRODUCT_COUNT_BANDS)) return { ok: false, error: "Volume de SKUs inválido." };
  if (!isOneOf(input.prepCenterUsage.trim(), GROWTH_PREP_CENTER_USAGE)) return { ok: false, error: "Resposta prep center inválida." };
  if (!isOneOf(input.investmentReadiness.trim(), GROWTH_INVESTMENT_READINESS)) return { ok: false, error: "Prontidão de investimento inválida." };
  if (challenge.length < 30) return { ok: false, error: "Descreva o maior desafio com pelo menos 30 caracteres." };
  const now = new Date().toISOString();
  const lead: GrowthLeadIntake = {
    id: newId("glead"),
    suite: input.suite?.trim() || undefined,
    fullName,
    email,
    whatsapp: whatsapp.slice(0, 80),
    phone: input.phone?.trim() || undefined,
    businessModel: input.businessModel.trim(),
    monthlyRevenueBand: input.monthlyRevenueBand.trim(),
    productCountBand: input.productCountBand.trim(),
    biggestChallenge: challenge.slice(0, 8000),
    prepCenterUsage: input.prepCenterUsage.trim(),
    investmentReadiness: input.investmentReadiness.trim(),
    storeOrBrand: input.storeOrBrand?.trim() || undefined,
    blockerSummary: challenge.slice(0, 8000),
    goals: input.goals?.trim().slice(0, 4000) || undefined,
    marketplaceFocus: input.marketplaceFocus?.trim().slice(0, 500) || undefined,
    status: "new",
    createdAtIso: now,
  };
  mutate((s) => {
    s.leadIntakes.push(lead);
    pushAudit(s, {
      actor: "client",
      action: "growth_lead_intake",
      entityType: "growth_lead",
      entityId: lead.id,
      suite: lead.suite,
      detail: `${email} · ${fullName.slice(0, 40)}`,
    });
  });
  return { ok: true, lead };
}

export function listGrowthLeadIntakesAdmin(): GrowthLeadIntake[] {
  return [...readSnapshot().leadIntakes].sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
}

export function patchGrowthLeadIntake(
  id: string,
  patch: { status?: GrowthLeadIntakeStatus; adminNote?: string; assignedTo?: string | null },
): { ok: true; lead: GrowthLeadIntake } | { ok: false; error: string } {
  return mutateWithResult((s) => {
    const lead = s.leadIntakes.find((x) => x.id === id);
    if (!lead) return { ok: false, error: "Lead não encontrado." };
    const allowed: GrowthLeadIntakeStatus[] = ["new", "contacted", "qualified", "closed"];
    if (patch.status && allowed.includes(patch.status)) lead.status = patch.status;
    if (patch.adminNote !== undefined) lead.adminNote = patch.adminNote.trim().slice(0, 4000) || undefined;
    if (patch.assignedTo !== undefined) {
      lead.assignedTo =
        patch.assignedTo === null || patch.assignedTo.trim() === "" ? undefined : patch.assignedTo.trim().slice(0, 200);
    }
    lead.updatedAtIso = new Date().toISOString();
    pushAudit(s, {
      actor: "admin",
      action: "growth_lead_updated",
      entityType: "growth_lead",
      entityId: lead.id,
      suite: lead.suite,
      detail: `${lead.status}${lead.assignedTo ? ` · ${lead.assignedTo}` : ""}`,
    });
    return { ok: true, lead };
  });
}

/** Debita US$ 400/mês por subscrição activa com período vencido (job manual / admin). */
export function renewDueGrowthSubscriptions(): { renewed: number; errors: string[] } {
  const s = readSnapshot();
  const now = Date.now();
  const errors: string[] = [];
  let renewed = 0;
  for (const sub of s.subscriptions) {
    if (sub.status !== "active" || !sub.currentPeriodEndIso) continue;
    const end = Date.parse(sub.currentPeriodEndIso);
    if (!Number.isFinite(end) || end > now) continue;
    const charge = applyWalletDelta(sub.suite, -GROWTH_PROGRAM_MONTHLY_USD);
    if (!charge.ok) {
      errors.push(`${sub.suite}: ${charge.error}`);
      continue;
    }
    appendWalletLedger({
      suite: sub.suite,
      deltaUsd: -GROWTH_PROGRAM_MONTHLY_USD,
      balanceAfter: charge.balanceUsd,
      reason: "growth_program_renewal",
      reference: sub.id,
    });
    const next = new Date();
    next.setDate(next.getDate() + 30);
    sub.currentPeriodEndIso = next.toISOString();
    sub.lastBilledAtIso = new Date().toISOString();
    renewed++;
    pushAudit(s, {
      actor: "system",
      action: "subscription_renewed",
      entityType: "subscription",
      entityId: sub.id,
      suite: sub.suite,
      amountUsd: -GROWTH_PROGRAM_MONTHLY_USD,
    });
  }
  writeSnapshot(s);
  return { renewed, errors };
}

/** Import CSV: header line suite,product_sku,sales_usd,profit_usd,platform[,note] */
export function importRevenueCsv(csvText: string): { ok: number; errors: string[] } {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return { ok: 0, errors: ["CSV vazio ou sem dados."] };
  const errors: string[] = [];
  let ok = 0;
  const dataLines = lines.slice(1);
  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i]!;
    const parts = line.split(",").map((c) => c.trim());
    if (parts.length < 5) {
      errors.push(`Linha ${i + 2}: colunas insuficientes.`);
      continue;
    }
    const [suite, productSku, salesS, profitS, platform, ...rest] = parts;
    const note = rest.join(",").trim() || undefined;
    const salesAmountUsd = Number(salesS);
    const profitAmountUsd = Number(profitS);
    const r = addRevenueEntry({
      suite: suite ?? "",
      productSku: productSku ?? "",
      salesAmountUsd,
      profitAmountUsd,
      platform: platform ?? "Amazon",
      note,
      createdBy: "import",
    });
    if (!r.ok) errors.push(`Linha ${i + 2}: ${r.error}`);
    else ok++;
  }
  return { ok, errors };
}
