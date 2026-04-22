import type { Express, Request, Response } from "express";
import { requireAdmin, requireUser, userSuite } from "./authMiddleware";
import { applyWalletDelta, findBySuite } from "./clientRegistryStore";
import { appendWalletLedger } from "./walletLedger";
import {
  GROWTH_PROGRAM_ADMIN_API_BASE,
  GROWTH_PROGRAM_CLIENT_API_BASE,
  GROWTH_PROGRAM_MONTHLY_USD,
} from "../shared/growthProgramRoutes";
import {
  addAdminTask,
  addGrowthLeadIntake,
  addRevenueEntry,
  addServiceRequest,
  aggregateSuiteReport,
  getActiveSubscriptionForSuite,
  importRevenueCsv,
  insertActiveSubscription,
  listAllForAdmin,
  listAudit,
  listGrowthLeadIntakesAdmin,
  listRequestsForSuite,
  listSubscriptions,
  listTasksForSuite,
  markProfitSharePaid,
  patchAdminTask,
  patchGrowthLeadIntake,
  patchSubscriptionStatus,
  renewDueGrowthSubscriptions,
  getLandingCopyOverrides,
  mergeLandingCopyOverrides,
  recordGrowthLandingConversionEvent,
} from "./growthProgramStore";

function parseBody(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
}

export function registerGrowthProgramRoutes(app: Express): void {
  const C = GROWTH_PROGRAM_CLIENT_API_BASE;
  const A = GROWTH_PROGRAM_ADMIN_API_BASE;

  const subscribeHandler = (req: Request, res: Response): void => {
    const authSuite = userSuite(req);
    const b = parseBody(req);
    const bodySuite = typeof b.suite === "string" ? b.suite.trim() : "";
    if (bodySuite && bodySuite !== authSuite) {
      res.status(403).json({ error: "Não pode subscrever noutra suite." });
      return;
    }
    const suite = authSuite;
    if (getActiveSubscriptionForSuite(suite)) {
      res.status(409).json({ error: "Já existe uma subscrição activa.", code: "already_subscribed" });
      return;
    }
    const client = findBySuite(suite);
    if (!client) {
      res.status(404).json({ error: "Cliente não encontrado." });
      return;
    }
    const charge = applyWalletDelta(suite, -GROWTH_PROGRAM_MONTHLY_USD);
    if (!charge.ok) {
      res.status(402).json({
        error: charge.error || "Saldo insuficiente para US$ 400/mês.",
        code: "insufficient_balance",
        requiredUsd: GROWTH_PROGRAM_MONTHLY_USD,
      });
      return;
    }
    appendWalletLedger({
      suite,
      deltaUsd: -GROWTH_PROGRAM_MONTHLY_USD,
      balanceAfter: charge.balanceUsd,
      reason: "growth_program_subscription",
      reference: `growth_${suite}_${Date.now()}`,
    });
    const sub = insertActiveSubscription({ suite, clientName: client.name });
    res.json({ ok: true, subscription: sub, balanceUsd: charge.balanceUsd });
  };

  app.post(`${C}/subscribe-growth-program`, requireUser, subscribeHandler);
  app.post(`${C}/subscribe`, requireUser, subscribeHandler);

  app.get(`${C}/subscription-status`, requireUser, (req, res) => {
    const suite = userSuite(req);
    const sub = getActiveSubscriptionForSuite(suite);
    const history = listSubscriptions()
      .filter((x) => x.suite === suite)
      .sort((a, b) => b.startedAtIso.localeCompare(a.startedAtIso));
    const latest = sub ?? history[0] ?? null;
    res.json({
      active: !!sub,
      subscription: latest,
      plan: {
        id: latest?.planId,
        monthlyUsd: GROWTH_PROGRAM_MONTHLY_USD,
        profitShareRate: latest?.profitShareRate,
      },
    });
  });

  app.get(`${C}/revenue-report`, requireUser, (req, res) => {
    const suite = userSuite(req);
    const agg = aggregateSuiteReport(suite);
    const s = listAllForAdmin();
    const revenue = s.revenueRows.filter((r) => r.suite === suite).sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
    const profitShares = s.profitShares
      .filter((p) => p.suite === suite)
      .sort((a, b) => b.id.localeCompare(a.id));
    res.json({ summary: agg, revenue, profitShares });
  });

  app.post(`${C}/service-request`, requireUser, (req, res) => {
    const b = parseBody(req);
    const authSuite = userSuite(req);
    const bodySuite = typeof b.suite === "string" ? b.suite.trim() : "";
    if (bodySuite && bodySuite !== authSuite) {
      res.status(403).json({ error: "Não pode abrir pedidos noutra suite." });
      return;
    }
    const suite = authSuite;
    const type = typeof b.type === "string" ? b.type : "";
    const body = typeof b.body === "string" ? b.body : typeof b.message === "string" ? b.message : "";
    const subject = typeof b.subject === "string" ? b.subject : undefined;
    const r = addServiceRequest({ suite, type, body, subject });
    if (!r.ok) {
      res.status(400).json({ error: r.error });
      return;
    }
    res.json({ ok: true, request: r.request });
  });

  app.get(`${C}/landing-content`, (_req, res) => {
    res.json({ overrides: getLandingCopyOverrides() });
  });

  app.post(`${C}/conversion-event`, (req, res) => {
    const b = parseBody(req);
    const placement = typeof b.placement === "string" ? b.placement : "";
    const suite = typeof b.suite === "string" ? b.suite.trim() : undefined;
    recordGrowthLandingConversionEvent(placement, suite);
    res.json({ ok: true });
  });

  app.post(`${C}/lead-intake`, (req, res) => {
    const b = parseBody(req);
    const r = addGrowthLeadIntake({
      fullName: typeof b.fullName === "string" ? b.fullName : typeof b.full_name === "string" ? b.full_name : "",
      email: typeof b.email === "string" ? b.email : "",
      whatsapp: typeof b.whatsapp === "string" ? b.whatsapp : "",
      phone: typeof b.phone === "string" ? b.phone : undefined,
      suite: typeof b.suite === "string" ? b.suite : undefined,
      storeOrBrand: typeof b.storeOrBrand === "string" ? b.storeOrBrand : typeof b.store_or_brand === "string" ? b.store_or_brand : undefined,
      businessModel: typeof b.businessModel === "string" ? b.businessModel : typeof b.business_model === "string" ? b.business_model : "",
      monthlyRevenueBand:
        typeof b.monthlyRevenueBand === "string" ? b.monthlyRevenueBand : typeof b.monthly_revenue_band === "string" ? b.monthly_revenue_band : "",
      productCountBand:
        typeof b.productCountBand === "string" ? b.productCountBand : typeof b.product_count_band === "string" ? b.product_count_band : "",
      biggestChallenge:
        typeof b.biggestChallenge === "string" ? b.biggestChallenge : typeof b.biggest_challenge === "string" ? b.biggest_challenge : "",
      prepCenterUsage:
        typeof b.prepCenterUsage === "string" ? b.prepCenterUsage : typeof b.prep_center_usage === "string" ? b.prep_center_usage : "",
      investmentReadiness:
        typeof b.investmentReadiness === "string" ? b.investmentReadiness : typeof b.investment_readiness === "string" ? b.investment_readiness : "",
      blockerSummary: typeof b.blockerSummary === "string" ? b.blockerSummary : typeof b.blocker_summary === "string" ? b.blocker_summary : undefined,
      goals: typeof b.goals === "string" ? b.goals : undefined,
      marketplaceFocus:
        typeof b.marketplaceFocus === "string" ? b.marketplaceFocus : typeof b.marketplace_focus === "string" ? b.marketplace_focus : undefined,
    });
    if (!r.ok) {
      res.status(400).json({ error: r.error });
      return;
    }
    res.json({ ok: true, lead: r.lead });
  });

  app.get(`${C}/dashboard`, requireUser, (req, res) => {
    const suite = userSuite(req);
    const sub = getActiveSubscriptionForSuite(suite);
    const requests = listRequestsForSuite(suite).sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
    const tasks = listTasksForSuite(suite).sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso));
    res.json({ subscription: sub, requests, tasks: tasks.slice(0, 50), summary: aggregateSuiteReport(suite) });
  });

  app.get(`${A}/subscriptions`, requireAdmin, (_req, res) => {
    const subs = listSubscriptions().sort((a, b) => b.startedAtIso.localeCompare(a.startedAtIso));
    res.json({ subscriptions: subs });
  });

  app.get(`${A}/snapshot`, requireAdmin, (_req, res) => {
    res.json(listAllForAdmin());
  });

  app.get(`${A}/lead-intakes`, requireAdmin, (_req, res) => {
    res.json({ leads: listGrowthLeadIntakesAdmin() });
  });

  app.patch(`${A}/lead-intakes/:id`, requireAdmin, (req, res) => {
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const b = parseBody(req);
    const statusRaw = typeof b.status === "string" ? b.status.trim() : "";
    const status =
      statusRaw === "new" || statusRaw === "contacted" || statusRaw === "qualified" || statusRaw === "closed" ? statusRaw : undefined;
    const adminNote = typeof b.adminNote === "string" ? b.adminNote : typeof b.admin_note === "string" ? b.admin_note : undefined;
    let assignedTo: string | null | undefined = undefined;
    if (Object.prototype.hasOwnProperty.call(b, "assignedTo") || Object.prototype.hasOwnProperty.call(b, "assigned_to")) {
      const raw = typeof b.assignedTo === "string" ? b.assignedTo : typeof b.assigned_to === "string" ? b.assigned_to : "";
      assignedTo = raw.trim() === "" ? null : raw.trim().slice(0, 200);
    }
    const r = patchGrowthLeadIntake(id, { status, adminNote, assignedTo });
    if (!r.ok) {
      res.status(404).json({ error: r.error });
      return;
    }
    res.json({ ok: true, lead: r.lead });
  });

  app.get(`${A}/landing-copy`, requireAdmin, (_req, res) => {
    res.json({ overrides: getLandingCopyOverrides() });
  });

  app.patch(`${A}/landing-copy`, requireAdmin, (req, res) => {
    const b = parseBody(req);
    const raw = b.overrides;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      res.status(400).json({ error: "overrides deve ser um objecto JSON." });
      return;
    }
    const patch: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === "string") patch[k] = v;
    }
    mergeLandingCopyOverrides(patch);
    res.json({ ok: true, overrides: getLandingCopyOverrides() });
  });

  app.post(`${A}/revenue-entry`, requireAdmin, (req, res) => {
    const b = parseBody(req);
    const r = addRevenueEntry({
      suite: typeof b.suite === "string" ? b.suite : "",
      productSku: typeof b.product_sku === "string" ? b.product_sku : typeof b.productSku === "string" ? b.productSku : "",
      salesAmountUsd: Number(b.sales_amount ?? b.salesAmountUsd),
      profitAmountUsd: Number(b.profit_amount ?? b.profitAmountUsd),
      platform: typeof b.platform === "string" ? b.platform : "Amazon",
      periodStartIso: typeof b.period_start === "string" ? b.period_start : typeof b.periodStartIso === "string" ? b.periodStartIso : undefined,
      periodEndIso: typeof b.period_end === "string" ? b.period_end : typeof b.periodEndIso === "string" ? b.periodEndIso : undefined,
      note: typeof b.note === "string" ? b.note : undefined,
    });
    if (!r.ok) {
      res.status(400).json({ error: r.error });
      return;
    }
    res.json({ ok: true, revenue: r.revenue, profitShare: r.profitShare });
  });

  app.post(`${A}/revenue-import-csv`, requireAdmin, (req, res) => {
    const b = parseBody(req);
    const csv = typeof b.csv === "string" ? b.csv : typeof b.text === "string" ? b.text : "";
    if (!csv.trim()) {
      res.status(400).json({ error: "csv ou text obrigatório." });
      return;
    }
    res.json(importRevenueCsv(csv));
  });

  app.patch(`${A}/profit-share/pay`, requireAdmin, (req, res) => {
    const b = parseBody(req);
    const id = typeof b.id === "string" ? b.id : typeof b.profit_share_id === "string" ? b.profit_share_id : "";
    if (!id.trim()) {
      res.status(400).json({ error: "id do profit share obrigatório." });
      return;
    }
    const note = typeof b.paid_note === "string" ? b.paid_note : typeof b.paidNote === "string" ? b.paidNote : undefined;
    const r = markProfitSharePaid(id.trim(), note);
    if (!r.ok) {
      res.status(400).json({ error: r.error });
      return;
    }
    res.json({ ok: true, profitShare: r.row });
  });

  app.post(`${A}/tasks`, requireAdmin, (req, res) => {
    const b = parseBody(req);
    const r = addAdminTask({
      suite: typeof b.suite === "string" ? b.suite : "",
      title: typeof b.title === "string" ? b.title : "",
      description: typeof b.description === "string" ? b.description : undefined,
      assignee: typeof b.assignee === "string" ? b.assignee : undefined,
      dueAtIso: typeof b.due_at === "string" ? b.due_at : typeof b.dueAtIso === "string" ? b.dueAtIso : undefined,
    });
    if (!r.ok) {
      res.status(400).json({ error: r.error });
      return;
    }
    res.json({ ok: true, task: r.task });
  });

  app.patch(`${A}/tasks/:id`, requireAdmin, (req, res) => {
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const b = parseBody(req);
    const r = patchAdminTask(id, {
      title: typeof b.title === "string" ? b.title : undefined,
      description: typeof b.description === "string" ? b.description : undefined,
      assignee: typeof b.assignee === "string" ? b.assignee : undefined,
      status: typeof b.status === "string" ? (b.status as "open" | "in_progress" | "done" | "blocked") : undefined,
      dueAtIso: typeof b.due_at === "string" ? b.due_at : typeof b.dueAtIso === "string" ? b.dueAtIso : undefined,
    });
    if (!r.ok) {
      res.status(404).json({ error: r.error });
      return;
    }
    res.json({ ok: true, task: r.task });
  });

  app.patch(`${A}/subscriptions/:id`, requireAdmin, (req, res) => {
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const b = parseBody(req);
    const status = typeof b.status === "string" ? b.status.trim() : "";
    if (!["active", "paused", "cancelled"].includes(status)) {
      res.status(400).json({ error: "status deve ser active, paused ou cancelled." });
      return;
    }
    const r = patchSubscriptionStatus(id, status as "active" | "paused" | "cancelled");
    if (!r.ok) {
      res.status(404).json({ error: r.error });
      return;
    }
    res.json({ ok: true, subscription: r.subscription });
  });

  app.get(`${A}/audit`, requireAdmin, (req, res) => {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    res.json({ entries: listAudit(limit) });
  });

  app.post(`${A}/billing/run-due`, requireAdmin, (_req, res) => {
    res.json(renewDueGrowthSubscriptions());
  });
}
