import {
  GROWTH_PROGRAM_ADMIN_API_BASE,
  GROWTH_PROGRAM_CLIENT_API_BASE,
  GROWTH_PROGRAM_MONTHLY_USD,
  GROWTH_PROGRAM_PROFIT_SHARE_RATE,
} from "../../shared/growthProgramRoutes";
import type { GrowthStrategyAiMode, GrowthStrategyAiResult } from "../../shared/growthStrategyAi";
import { apiUrl } from "./apiUrl";
import { jsonAdminHeaders, jsonUserHeaders } from "./authHeaders";

export { GROWTH_PROGRAM_MONTHLY_USD, GROWTH_PROGRAM_PROFIT_SHARE_RATE };

export type GrowthSubscriptionDto = {
  id: string;
  suite: string;
  clientName?: string;
  planId: string;
  status: "active" | "paused" | "cancelled";
  monthlyUsd: number;
  profitShareRate: number;
  startedAtIso: string;
  currentPeriodEndIso?: string;
  lastBilledAtIso?: string;
};

export type RevenueRowDto = {
  id: string;
  suite: string;
  productSku: string;
  salesAmountUsd: number;
  profitAmountUsd: number;
  platform: string;
  commissionRate: number;
  commissionDueUsd: number;
  createdAtIso: string;
  note?: string;
};

export type ProfitShareDto = {
  id: string;
  revenueTrackingId: string;
  suite: string;
  commissionRate: number;
  commissionDueUsd: number;
  status: "pending" | "paid";
  paidAtIso?: string;
};

export type GrowthTaskDto = {
  id: string;
  suite: string;
  title: string;
  description?: string;
  assignee?: string;
  status: "open" | "in_progress" | "done" | "blocked";
  dueAtIso?: string;
  createdAtIso: string;
  updatedAtIso: string;
};

export type GrowthRequestDto = {
  id: string;
  suite: string;
  type: "ungating" | "listing_optimization" | "product_setup" | "other";
  subject?: string;
  body: string;
  status: "submitted" | "in_review" | "scheduled" | "completed" | "declined";
  createdAtIso: string;
};

export type GrowthLeadIntakeStatusDto = "new" | "contacted" | "qualified" | "closed";

export type GrowthLeadIntakeDto = {
  id: string;
  suite?: string;
  fullName: string;
  email: string;
  whatsapp?: string;
  phone?: string;
  businessModel?: string;
  monthlyRevenueBand?: string;
  productCountBand?: string;
  biggestChallenge?: string;
  prepCenterUsage?: string;
  investmentReadiness?: string;
  storeOrBrand?: string;
  blockerSummary: string;
  goals?: string;
  marketplaceFocus?: string;
  status: GrowthLeadIntakeStatusDto;
  adminNote?: string;
  assignedTo?: string;
  createdAtIso: string;
  updatedAtIso?: string;
};

async function parseJson<T>(res: Response): Promise<T> {
  const j = (await res.json()) as T;
  return j;
}

export async function fetchGrowthSubscriptionStatus(_suite: string): Promise<{
  active: boolean;
  subscription: GrowthSubscriptionDto | null;
  plan?: { id?: string; monthlyUsd?: number; profitShareRate?: number };
}> {
  const res = await fetch(apiUrl(`${GROWTH_PROGRAM_CLIENT_API_BASE}/subscription-status`), {
    headers: jsonUserHeaders(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseJson(res);
}

export async function postSubscribeGrowthProgram(suite: string): Promise<{
  ok: boolean;
  subscription?: GrowthSubscriptionDto;
  balanceUsd?: number;
  error?: string;
  code?: string;
  requiredUsd?: number;
}> {
  const res = await fetch(apiUrl(`${GROWTH_PROGRAM_CLIENT_API_BASE}/subscribe`), {
    method: "POST",
    headers: jsonUserHeaders(),
    body: JSON.stringify({ suite }),
  });
  const j = await parseJson<{ ok?: boolean; subscription?: GrowthSubscriptionDto; balanceUsd?: number; error?: string; code?: string; requiredUsd?: number }>(res);
  if (!res.ok) return { ok: false, error: j.error ?? `HTTP ${res.status}`, code: j.code, requiredUsd: j.requiredUsd };
  return { ok: true, subscription: j.subscription, balanceUsd: j.balanceUsd };
}

export async function fetchGrowthRevenueReport(_suite: string): Promise<{
  summary: {
    totalSalesUsd: number;
    totalProfitUsd: number;
    commissionPendingUsd: number;
    commissionPaidUsd: number;
    revenueCount: number;
  };
  revenue: RevenueRowDto[];
  profitShares: ProfitShareDto[];
}> {
  const res = await fetch(apiUrl(`${GROWTH_PROGRAM_CLIENT_API_BASE}/revenue-report`), {
    headers: jsonUserHeaders(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseJson(res);
}

export async function postGrowthServiceRequest(input: {
  suite: string;
  type: string;
  body: string;
  subject?: string;
}): Promise<{ ok: true; request: GrowthRequestDto } | { ok: false; error: string }> {
  const res = await fetch(apiUrl(`${GROWTH_PROGRAM_CLIENT_API_BASE}/service-request`), {
    method: "POST",
    headers: jsonUserHeaders(),
    body: JSON.stringify(input),
  });
  const j = await parseJson<{ ok?: boolean; request?: GrowthRequestDto; error?: string }>(res);
  if (!res.ok || !j.request) return { ok: false, error: j.error ?? `HTTP ${res.status}` };
  return { ok: true, request: j.request };
}

export async function fetchGrowthClientDashboard(_suite: string): Promise<{
  subscription: GrowthSubscriptionDto | null | undefined;
  requests: GrowthRequestDto[];
  tasks: GrowthTaskDto[];
  summary: {
    totalSalesUsd: number;
    totalProfitUsd: number;
    commissionPendingUsd: number;
    commissionPaidUsd: number;
    revenueCount: number;
  };
}> {
  const res = await fetch(apiUrl(`${GROWTH_PROGRAM_CLIENT_API_BASE}/dashboard`), {
    headers: jsonUserHeaders(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseJson(res);
}

export type GrowthStrategyAiResponse =
  | { ok: true; mode: "live" | "demo"; aiMode: GrowthStrategyAiMode; result: GrowthStrategyAiResult; warn?: string }
  | { ok: false; error: string };

function parseStrategyResult(data: Record<string, unknown>): GrowthStrategyAiResult | null {
  const r = data.result;
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  const diagnosis = typeof o.diagnosis === "string" ? o.diagnosis.trim() : "";
  const marketReality = typeof o.marketReality === "string" ? o.marketReality.trim() : "";
  const executiveMemo = typeof o.executiveMemo === "string" ? o.executiveMemo.trim() : "";
  const scalingStrategy = typeof o.scalingStrategy === "string" ? o.scalingStrategy.trim() : "";
  const steps = o.actionSteps;
  if (!diagnosis || !marketReality || !executiveMemo || !Array.isArray(steps)) return null;
  const actionSteps = steps.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean);
  if (actionSteps.length < 3) return null;
  return { diagnosis, marketReality, actionSteps, scalingStrategy, executiveMemo };
}

export async function postGrowthStrategyAi(payload: {
  mode: GrowthStrategyAiMode;
  question: string;
  context?: string;
}): Promise<GrowthStrategyAiResponse> {
  const res = await fetch(apiUrl(`${GROWTH_PROGRAM_CLIENT_API_BASE}/strategy-ai`), {
    method: "POST",
    headers: jsonUserHeaders(),
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = typeof data.error === "string" ? data.error : `HTTP ${res.status}`;
    return { ok: false, error: err };
  }
  const result = parseStrategyResult(data);
  if (!result) {
    return { ok: false, error: "Resposta inválida do servidor." };
  }
  const mode = data.mode === "live" ? "live" : "demo";
  const aiMode = (typeof data.aiMode === "string" ? data.aiMode : payload.mode) as GrowthStrategyAiMode;
  const warn = typeof data.warn === "string" ? data.warn : undefined;
  return { ok: true, mode, aiMode, result, warn };
}

/** --- Admin --- */

export async function fetchGrowthAdminSnapshot(): Promise<{
  subscriptions: GrowthSubscriptionDto[];
  revenueRows: RevenueRowDto[];
  profitShares: ProfitShareDto[];
  tasks: GrowthTaskDto[];
  requests: GrowthRequestDto[];
  landingCopyOverrides?: Record<string, string>;
  leadIntakes?: GrowthLeadIntakeDto[];
}> {
  const res = await fetch(apiUrl(`${GROWTH_PROGRAM_ADMIN_API_BASE}/snapshot`), { headers: jsonAdminHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseJson(res);
}

export async function postGrowthLeadIntake(body: {
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
  goals?: string;
  marketplaceFocus?: string;
}): Promise<{ ok: true; lead: GrowthLeadIntakeDto } | { ok: false; error: string }> {
  const res = await fetch(apiUrl(`${GROWTH_PROGRAM_CLIENT_API_BASE}/lead-intake`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await parseJson<{ ok?: boolean; lead?: GrowthLeadIntakeDto; error?: string }>(res);
  if (!res.ok || !j.lead) return { ok: false, error: j.error ?? `HTTP ${res.status}` };
  return { ok: true, lead: j.lead };
}

export async function fetchGrowthAdminLeadIntakes(): Promise<{ leads: GrowthLeadIntakeDto[] }> {
  const res = await fetch(apiUrl(`${GROWTH_PROGRAM_ADMIN_API_BASE}/lead-intakes`), { headers: jsonAdminHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseJson(res);
}

export async function patchGrowthAdminLeadIntake(
  id: string,
  patch: { status?: GrowthLeadIntakeStatusDto; adminNote?: string; assignedTo?: string | null },
): Promise<{ ok: boolean; error?: string; lead?: GrowthLeadIntakeDto }> {
  const res = await fetch(apiUrl(`${GROWTH_PROGRAM_ADMIN_API_BASE}/lead-intakes/${encodeURIComponent(id)}`), {
    method: "PATCH",
    headers: jsonAdminHeaders(),
    body: JSON.stringify(patch),
  });
  const j = await parseJson<{ ok?: boolean; error?: string; lead?: GrowthLeadIntakeDto }>(res);
  if (!res.ok) return { ok: false, error: j.error ?? `HTTP ${res.status}` };
  return { ok: true, lead: j.lead };
}

export async function postGrowthAdminRevenueEntry(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(apiUrl(`${GROWTH_PROGRAM_ADMIN_API_BASE}/revenue-entry`), {
    method: "POST",
    headers: jsonAdminHeaders(),
    body: JSON.stringify(body),
  });
  const j = await parseJson<{ ok?: boolean; error?: string }>(res);
  if (!res.ok) return { ok: false, error: j.error ?? `HTTP ${res.status}` };
  return { ok: true };
}

export async function postGrowthAdminRevenueCsv(csv: string): Promise<{ ok: number; errors: string[] }> {
  const res = await fetch(apiUrl(`${GROWTH_PROGRAM_ADMIN_API_BASE}/revenue-import-csv`), {
    method: "POST",
    headers: jsonAdminHeaders(),
    body: JSON.stringify({ csv }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseJson(res);
}

export async function patchGrowthProfitSharePaid(id: string, paidNote?: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(apiUrl(`${GROWTH_PROGRAM_ADMIN_API_BASE}/profit-share/pay`), {
    method: "PATCH",
    headers: jsonAdminHeaders(),
    body: JSON.stringify({ id, paid_note: paidNote }),
  });
  const j = await parseJson<{ ok?: boolean; error?: string }>(res);
  if (!res.ok) return { ok: false, error: j.error ?? `HTTP ${res.status}` };
  return { ok: true };
}

export async function postGrowthAdminTask(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(apiUrl(`${GROWTH_PROGRAM_ADMIN_API_BASE}/tasks`), {
    method: "POST",
    headers: jsonAdminHeaders(),
    body: JSON.stringify(body),
  });
  const j = await parseJson<{ ok?: boolean; error?: string }>(res);
  if (!res.ok) return { ok: false, error: j.error ?? `HTTP ${res.status}` };
  return { ok: true };
}

export async function patchGrowthAdminTask(id: string, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(apiUrl(`${GROWTH_PROGRAM_ADMIN_API_BASE}/tasks/${encodeURIComponent(id)}`), {
    method: "PATCH",
    headers: jsonAdminHeaders(),
    body: JSON.stringify(body),
  });
  const j = await parseJson<{ ok?: boolean; error?: string }>(res);
  if (!res.ok) return { ok: false, error: j.error ?? `HTTP ${res.status}` };
  return { ok: true };
}

export async function patchGrowthSubscription(id: string, status: "active" | "paused" | "cancelled"): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(apiUrl(`${GROWTH_PROGRAM_ADMIN_API_BASE}/subscriptions/${encodeURIComponent(id)}`), {
    method: "PATCH",
    headers: jsonAdminHeaders(),
    body: JSON.stringify({ status }),
  });
  const j = await parseJson<{ ok?: boolean; error?: string }>(res);
  if (!res.ok) return { ok: false, error: j.error ?? `HTTP ${res.status}` };
  return { ok: true };
}

export async function fetchGrowthAudit(limit = 100): Promise<{ entries: { id: string; atIso: string; action: string; suite?: string; detail?: string; amountUsd?: number }[] }> {
  const res = await fetch(apiUrl(`${GROWTH_PROGRAM_ADMIN_API_BASE}/audit?limit=${limit}`), {
    headers: jsonAdminHeaders(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseJson(res);
}

export async function postGrowthBillingRunDue(): Promise<{ renewed: number; errors: string[] }> {
  const res = await fetch(apiUrl(`${GROWTH_PROGRAM_ADMIN_API_BASE}/billing/run-due`), {
    method: "POST",
    headers: jsonAdminHeaders(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseJson(res);
}

export async function fetchGrowthLandingContent(): Promise<{ overrides: Record<string, string> }> {
  const res = await fetch(apiUrl(`${GROWTH_PROGRAM_CLIENT_API_BASE}/landing-content`));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseJson(res);
}

/** Rastreio de conversão (CTA / scroll) — best-effort, não bloqueia navegação. */
export function postGrowthLandingConversionEvent(placement: string, suite?: string): void {
  void fetch(apiUrl(`${GROWTH_PROGRAM_CLIENT_API_BASE}/conversion-event`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ placement: placement.slice(0, 160), suite: suite?.trim() || undefined }),
    keepalive: true,
  }).catch(() => {});
}

export async function fetchGrowthAdminLandingCopy(): Promise<{ overrides: Record<string, string> }> {
  const res = await fetch(apiUrl(`${GROWTH_PROGRAM_ADMIN_API_BASE}/landing-copy`), { headers: jsonAdminHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseJson(res);
}

export async function patchGrowthAdminLandingCopy(overrides: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(apiUrl(`${GROWTH_PROGRAM_ADMIN_API_BASE}/landing-copy`), {
    method: "PATCH",
    headers: jsonAdminHeaders(),
    body: JSON.stringify({ overrides }),
  });
  const j = await parseJson<{ ok?: boolean; error?: string }>(res);
  if (!res.ok) return { ok: false, error: j.error ?? `HTTP ${res.status}` };
  return { ok: true };
}
