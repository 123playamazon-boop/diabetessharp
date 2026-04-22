import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useI18n } from "../../i18n/context";
import { PageHeader } from "../../ui/PageHeader";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import {
  fetchGrowthAdminLandingCopy,
  fetchGrowthAdminSnapshot,
  fetchGrowthAudit,
  patchGrowthAdminLandingCopy,
  patchGrowthAdminLeadIntake,
  patchGrowthAdminTask,
  patchGrowthProfitSharePaid,
  patchGrowthSubscription,
  postGrowthAdminRevenueEntry,
  postGrowthAdminRevenueCsv,
  postGrowthAdminTask,
  postGrowthBillingRunDue,
  type GrowthLeadIntakeDto,
  type GrowthLeadIntakeStatusDto,
  type GrowthSubscriptionDto,
  type GrowthTaskDto,
  type ProfitShareDto,
  type RevenueRowDto,
} from "../../lib/growthProgramApi";
import { jsonAdminHeaders } from "../../lib/authHeaders";
import { apiUrl } from "../../lib/apiUrl";
import { GROWTH_BUSINESS_MODELS, GROWTH_REVENUE_BANDS } from "../../../shared/growthLeadQualification";

type Tab = "subs" | "leads" | "revenue" | "tasks" | "audit" | "landing";

function leadOptLabel(t: (key: string) => string, prefix: string, slug?: string): string {
  if (!slug) return "—";
  const key = `${prefix}.${slug}`;
  const s = t(key);
  return s === key ? slug : s;
}

export function AdminGrowthProgramPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("subs");
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<GrowthSubscriptionDto[]>([]);
  const [revenueRows, setRevenueRows] = useState<RevenueRowDto[]>([]);
  const [profitShares, setProfitShares] = useState<ProfitShareDto[]>([]);
  const [tasks, setTasks] = useState<GrowthTaskDto[]>([]);
  const [leads, setLeads] = useState<GrowthLeadIntakeDto[]>([]);
  const [leadFilterModel, setLeadFilterModel] = useState("");
  const [leadFilterRevenue, setLeadFilterRevenue] = useState("");
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [leadNoteDrafts, setLeadNoteDrafts] = useState<Record<string, string>>({});
  const [leadAssignDrafts, setLeadAssignDrafts] = useState<Record<string, string>>({});
  const [audit, setAudit] = useState<{ id: string; atIso: string; action: string; suite?: string; detail?: string; amountUsd?: number }[]>([]);

  const [revSuite, setRevSuite] = useState("");
  const [revSku, setRevSku] = useState("");
  const [revSales, setRevSales] = useState("");
  const [revProfit, setRevProfit] = useState("");
  const [revPlatform, setRevPlatform] = useState("Amazon");
  const [csvText, setCsvText] = useState("suite,product_sku,sales_usd,profit_usd,platform\n");

  const [taskSuite, setTaskSuite] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [landingJson, setLandingJson] = useState("{}");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await fetchGrowthAdminSnapshot();
      setSubscriptions(snap.subscriptions);
      setRevenueRows(snap.revenueRows.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso)));
      setProfitShares(snap.profitShares);
      setTasks(snap.tasks.sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso)));
      setLeads((snap.leadIntakes ?? []).slice().sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso)));
      const a = await fetchGrowthAudit(120);
      setAudit(a.entries);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void (async () => {
      try {
        const res = await fetch(apiUrl("/api/admin/clients"), { headers: jsonAdminHeaders() });
        const j = (await res.json()) as { clients?: { suite: string }[] };
        const first = j.clients?.[0]?.suite;
        if (first) {
          setRevSuite((s) => s || first);
          setTaskSuite((s) => s || first);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [load]);

  const profitByRevenueId = useMemo(() => {
    const m = new Map<string, ProfitShareDto>();
    for (const p of profitShares) m.set(p.revenueTrackingId, p);
    return m;
  }, [profitShares]);

  const filteredLeads = useMemo(() => {
    return leads.filter((L) => {
      if (leadFilterModel && L.businessModel !== leadFilterModel) return false;
      if (leadFilterRevenue && L.monthlyRevenueBand !== leadFilterRevenue) return false;
      return true;
    });
  }, [leads, leadFilterModel, leadFilterRevenue]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "subs", label: t("growth.admin.tab.subs") },
    { id: "leads", label: t("growth.admin.tab.leads") },
    { id: "revenue", label: t("growth.admin.tab.revenue") },
    { id: "tasks", label: t("growth.admin.tab.tasks") },
    { id: "audit", label: t("growth.admin.tab.audit") },
    { id: "landing", label: t("growth.admin.tab.landing") },
  ];

  useEffect(() => {
    if (tab !== "landing") return;
    void fetchGrowthAdminLandingCopy()
      .then((r) => setLandingJson(JSON.stringify(r.overrides ?? {}, null, 2)))
      .catch(() => setLandingJson("{}"));
  }, [tab]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title={t("growth.admin.title")}
        subtitle={t("growth.admin.subtitle")}
        actions={<LanguageSwitcher />}
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setTab(x.id)}
            className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide ${
              tab === x.id ? "bg-teal-600 text-white" : "border border-zinc-200 bg-white text-zinc-700"
            }`}
          >
            {x.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-bold uppercase text-zinc-700 disabled:opacity-50"
        >
          {t("growth.admin.refresh")}
        </button>
        <button
          type="button"
          onClick={async () => {
            try {
              const r = await postGrowthBillingRunDue();
              toast.success(`Renewed: ${r.renewed}${r.errors.length ? ` · errors: ${r.errors.length}` : ""}`);
              await load();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Erro");
            }
          }}
          className="rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold uppercase text-amber-950"
        >
          {t("growth.admin.runBilling")}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">…</p>
      ) : tab === "subs" ? (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="border-b border-zinc-200 bg-zinc-50 font-bold uppercase text-zinc-600">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">{t("growth.admin.col.suite")}</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Monthly</th>
                <th className="px-3 py-2">Period end</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((s) => (
                <tr key={s.id} className="border-b border-zinc-100">
                  <td className="px-3 py-2 font-mono text-[10px]">{s.id}</td>
                  <td className="px-3 py-2 font-semibold">{s.suite}</td>
                  <td className="px-3 py-2">{s.status}</td>
                  <td className="px-3 py-2">US$ {s.monthlyUsd}</td>
                  <td className="px-3 py-2 font-mono">{s.currentPeriodEndIso?.slice(0, 10) ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      {s.status === "active" ? (
                        <>
                          <button
                            type="button"
                            className="rounded-lg border border-zinc-200 px-2 py-1 text-[10px] font-bold uppercase"
                            onClick={() =>
                              void patchGrowthSubscription(s.id, "paused").then((r) => {
                                if (!r.ok) toast.error(r.error ?? "");
                                else void load();
                              })
                            }
                          >
                            Pause
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-rose-200 px-2 py-1 text-[10px] font-bold uppercase text-rose-800"
                            onClick={() =>
                              void patchGrowthSubscription(s.id, "cancelled").then((r) => {
                                if (!r.ok) toast.error(r.error ?? "");
                                else void load();
                              })
                            }
                          >
                            Cancel
                          </button>
                        </>
                      ) : s.status === "paused" ? (
                        <button
                          type="button"
                          className="rounded-lg border border-emerald-200 px-2 py-1 text-[10px] font-bold uppercase text-emerald-800"
                          onClick={() =>
                            void patchGrowthSubscription(s.id, "active").then((r) => {
                              if (!r.ok) toast.error(r.error ?? "");
                              else void load();
                            })
                          }
                        >
                          Resume
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === "leads" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h3 className="text-sm font-black uppercase text-zinc-800">{t("growth.admin.leadsTitle")}</h3>
            <div className="flex flex-wrap gap-2">
              <select
                className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-[11px] font-bold uppercase text-zinc-800"
                value={leadFilterModel}
                onChange={(e) => setLeadFilterModel(e.target.value)}
              >
                <option value="">{t("growth.admin.leadsFilterModel")}: {t("growth.admin.leadsFilterAll")}</option>
                {GROWTH_BUSINESS_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {leadOptLabel(t, "growth.lv2.funnel.opt.model", m)}
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-[11px] font-bold uppercase text-zinc-800"
                value={leadFilterRevenue}
                onChange={(e) => setLeadFilterRevenue(e.target.value)}
              >
                <option value="">{t("growth.admin.leadsFilterRevenue")}: {t("growth.admin.leadsFilterAll")}</option>
                {GROWTH_REVENUE_BANDS.map((r) => (
                  <option key={r} value={r}>
                    {leadOptLabel(t, "growth.lv2.funnel.opt.revenue", r)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {leads.length === 0 ? (
            <p className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-600">{t("growth.admin.leadsEmpty")}</p>
          ) : filteredLeads.length === 0 ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-8 text-center text-sm text-amber-950">{t("growth.admin.leadsNoMatch")}</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <table className="w-full min-w-[1100px] text-left text-xs">
                <thead className="border-b border-zinc-200 bg-zinc-50 font-bold uppercase text-zinc-600">
                  <tr>
                    <th className="px-3 py-2">{t("growth.admin.leadsColDate")}</th>
                    <th className="px-3 py-2">{t("growth.admin.leadsColName")}</th>
                    <th className="px-3 py-2">{t("growth.admin.leadsColEmail")}</th>
                    <th className="px-3 py-2">{t("growth.admin.leadsColWhatsapp")}</th>
                    <th className="px-3 py-2">{t("growth.admin.leadsColModel")}</th>
                    <th className="px-3 py-2">{t("growth.admin.leadsColRevenue")}</th>
                    <th className="px-3 py-2">{t("growth.admin.leadsColAssigned")}</th>
                    <th className="px-3 py-2">{t("growth.admin.leadsColStatus")}</th>
                    <th className="px-3 py-2 w-24" />
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((L) => (
                    <Fragment key={L.id}>
                      <tr className="border-b border-zinc-100 align-top">
                        <td className="px-3 py-2 font-mono whitespace-nowrap">{L.createdAtIso.slice(0, 16).replace("T", " ")}</td>
                        <td className="px-3 py-2 font-semibold">{L.fullName}</td>
                        <td className="px-3 py-2 font-mono text-[11px]">{L.email}</td>
                        <td className="px-3 py-2 font-mono text-[11px]">{L.whatsapp ?? L.phone ?? "—"}</td>
                        <td className="px-3 py-2 max-w-[120px] truncate" title={L.businessModel}>
                          {leadOptLabel(t, "growth.lv2.funnel.opt.model", L.businessModel)}
                        </td>
                        <td className="px-3 py-2 max-w-[120px] truncate" title={L.monthlyRevenueBand}>
                          {leadOptLabel(t, "growth.lv2.funnel.opt.revenue", L.monthlyRevenueBand)}
                        </td>
                        <td className="px-3 py-2 max-w-[100px] truncate">{L.assignedTo ?? "—"}</td>
                        <td className="px-3 py-2">
                          <select
                            className="max-w-[130px] rounded-lg border border-zinc-200 px-2 py-1 text-[10px] font-bold uppercase"
                            value={L.status}
                            onChange={(e) => {
                              const status = e.target.value as GrowthLeadIntakeStatusDto;
                              void patchGrowthAdminLeadIntake(L.id, { status }).then((r) => {
                                if (!r.ok) toast.error(r.error ?? "");
                                else void load();
                              });
                            }}
                          >
                            <option value="new">{t("growth.admin.leadsStatus.new")}</option>
                            <option value="contacted">{t("growth.admin.leadsStatus.contacted")}</option>
                            <option value="qualified">{t("growth.admin.leadsStatus.qualified")}</option>
                            <option value="closed">{t("growth.admin.leadsStatus.closed")}</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="rounded-lg border border-zinc-300 bg-zinc-50 px-2 py-1 text-[10px] font-bold uppercase text-zinc-800"
                            onClick={() => {
                              if (expandedLeadId === L.id) {
                                setExpandedLeadId(null);
                              } else {
                                setExpandedLeadId(L.id);
                                setLeadNoteDrafts((d) => ({ ...d, [L.id]: d[L.id] ?? L.adminNote ?? "" }));
                                setLeadAssignDrafts((d) => ({ ...d, [L.id]: d[L.id] ?? L.assignedTo ?? "" }));
                              }
                            }}
                          >
                            {expandedLeadId === L.id ? t("growth.admin.leadsCollapse") : t("growth.admin.leadsExpand")}
                          </button>
                        </td>
                      </tr>
                      {expandedLeadId === L.id ? (
                        <tr key={`${L.id}-detail`} className="border-b border-zinc-100 bg-zinc-50/90">
                          <td colSpan={9} className="px-4 py-4">
                            <div className="grid gap-4 lg:grid-cols-2">
                              <div className="space-y-2 text-[11px] text-zinc-700">
                                <p>
                                  <span className="font-bold text-zinc-900">{t("growth.admin.leadsColSuite")}:</span> {L.suite ?? "—"}
                                </p>
                                <p>
                                  <span className="font-bold text-zinc-900">{t("growth.lv2.formProductCount")}:</span>{" "}
                                  {leadOptLabel(t, "growth.lv2.funnel.opt.products", L.productCountBand)}
                                </p>
                                <p>
                                  <span className="font-bold text-zinc-900">{t("growth.lv2.formPrep")}:</span>{" "}
                                  {leadOptLabel(t, "growth.lv2.funnel.opt.prep", L.prepCenterUsage)}
                                </p>
                                <p>
                                  <span className="font-bold text-zinc-900">{t("growth.lv2.formInvestment")}:</span>{" "}
                                  {leadOptLabel(t, "growth.lv2.funnel.opt.investment", L.investmentReadiness)}
                                </p>
                                <p className="pt-2 font-bold text-zinc-900">{t("growth.admin.leadsColChallenge")}</p>
                                <p className="whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-3 text-[11px] leading-relaxed">
                                  {L.biggestChallenge ?? L.blockerSummary}
                                </p>
                              </div>
                              <div className="space-y-3">
                                <div>
                                  <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-600">{t("growth.admin.leadsNotesLabel")}</label>
                                  <textarea
                                    className="w-full rounded-lg border border-zinc-200 bg-white p-2 text-[11px] leading-relaxed"
                                    rows={4}
                                    placeholder={t("growth.admin.leadsNotesPlaceholder")}
                                    value={leadNoteDrafts[L.id] ?? L.adminNote ?? ""}
                                    onChange={(e) => setLeadNoteDrafts((d) => ({ ...d, [L.id]: e.target.value }))}
                                  />
                                  <button
                                    type="button"
                                    className="mt-2 rounded-lg bg-teal-600 px-3 py-1.5 text-[10px] font-bold uppercase text-white"
                                    onClick={() =>
                                      void patchGrowthAdminLeadIntake(L.id, { adminNote: leadNoteDrafts[L.id] ?? "" }).then((r) => {
                                        if (!r.ok) toast.error(r.error ?? "");
                                        else {
                                          toast.success("OK");
                                          void load();
                                        }
                                      })
                                    }
                                  >
                                    {t("growth.admin.leadsSaveNotes")}
                                  </button>
                                </div>
                                <div>
                                  <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-600">{t("growth.admin.leadsAssignPlaceholder")}</label>
                                  <div className="flex flex-wrap gap-2">
                                    <input
                                      className="min-w-[200px] flex-1 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-[11px]"
                                      value={leadAssignDrafts[L.id] ?? L.assignedTo ?? ""}
                                      onChange={(e) => setLeadAssignDrafts((d) => ({ ...d, [L.id]: e.target.value }))}
                                    />
                                    <button
                                      type="button"
                                      className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-[10px] font-bold uppercase text-zinc-800"
                                      onClick={() =>
                                        void patchGrowthAdminLeadIntake(L.id, {
                                          assignedTo: (leadAssignDrafts[L.id] ?? "").trim() || null,
                                        }).then((r) => {
                                          if (!r.ok) toast.error(r.error ?? "");
                                          else {
                                            toast.success("OK");
                                            void load();
                                          }
                                        })
                                      }
                                    >
                                      {t("growth.admin.leadsSaveAssign")}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : tab === "revenue" ? (
        <div className="space-y-6">
          <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-black uppercase text-zinc-800">{t("growth.admin.addRevenue")}</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input className="rounded-lg border px-2 py-1.5 text-sm" placeholder="Suite" value={revSuite} onChange={(e) => setRevSuite(e.target.value)} />
                <input className="rounded-lg border px-2 py-1.5 text-sm" placeholder="SKU" value={revSku} onChange={(e) => setRevSku(e.target.value)} />
                <input className="rounded-lg border px-2 py-1.5 text-sm" placeholder="Sales USD" value={revSales} onChange={(e) => setRevSales(e.target.value)} />
                <input className="rounded-lg border px-2 py-1.5 text-sm" placeholder="Profit USD" value={revProfit} onChange={(e) => setRevProfit(e.target.value)} />
                <input
                  className="sm:col-span-2 rounded-lg border px-2 py-1.5 text-sm"
                  placeholder="Platform"
                  value={revPlatform}
                  onChange={(e) => setRevPlatform(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="mt-3 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold uppercase text-white"
                onClick={() =>
                  void postGrowthAdminRevenueEntry({
                    suite: revSuite,
                    productSku: revSku,
                    salesAmountUsd: Number(revSales),
                    profitAmountUsd: Number(revProfit),
                    platform: revPlatform,
                  }).then((r) => {
                    if (!r.ok) toast.error(r.error ?? "");
                    else {
                      toast.success("OK");
                      void load();
                    }
                  })
                }
              >
                Save
              </button>
            </div>
            <div>
              <h3 className="text-sm font-black uppercase text-zinc-800">{t("growth.admin.importCsv")}</h3>
              <p className="mt-1 text-[11px] text-zinc-500">suite,product_sku,sales_usd,profit_usd,platform</p>
              <textarea className="mt-2 w-full rounded-lg border p-2 font-mono text-[11px]" rows={6} value={csvText} onChange={(e) => setCsvText(e.target.value)} />
              <button
                type="button"
                className="mt-2 rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-2 text-xs font-bold uppercase"
                onClick={() =>
                  void postGrowthAdminRevenueCsv(csvText).then((r) => {
                    toast.message(`Imported ${r.ok} rows`);
                    if (r.errors.length) toast.error(r.errors.slice(0, 3).join(" | "));
                    void load();
                  })
                }
              >
                Import
              </button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50 font-bold uppercase text-zinc-600">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">{t("growth.admin.col.suite")}</th>
                  <th className="px-3 py-2">{t("growth.admin.col.sku")}</th>
                  <th className="px-3 py-2">{t("growth.admin.col.sales")}</th>
                  <th className="px-3 py-2">{t("growth.admin.col.profit")}</th>
                  <th className="px-3 py-2">{t("growth.admin.col.commission")}</th>
                  <th className="px-3 py-2">{t("growth.admin.col.status")}</th>
                  <th className="px-3 py-2 text-right">Pay</th>
                </tr>
              </thead>
              <tbody>
                {revenueRows.map((r) => {
                  const ps = profitByRevenueId.get(r.id);
                  return (
                    <tr key={r.id} className="border-b border-zinc-100">
                      <td className="px-3 py-2 font-mono">{r.createdAtIso.slice(0, 10)}</td>
                      <td className="px-3 py-2 font-semibold">{r.suite}</td>
                      <td className="px-3 py-2 font-mono">{r.productSku}</td>
                      <td className="px-3 py-2 font-mono">{r.salesAmountUsd.toFixed(2)}</td>
                      <td className="px-3 py-2 font-mono">{r.profitAmountUsd.toFixed(2)}</td>
                      <td className="px-3 py-2 font-mono">{r.commissionDueUsd.toFixed(2)}</td>
                      <td className="px-3 py-2">{ps?.status ?? "—"}</td>
                      <td className="px-3 py-2 text-right">
                        {ps && ps.status === "pending" ? (
                          <button
                            type="button"
                            className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-bold uppercase text-white"
                            onClick={() =>
                              void patchGrowthProfitSharePaid(ps.id).then((x) => {
                                if (!x.ok) toast.error(x.error ?? "");
                                else void load();
                              })
                            }
                          >
                            {t("growth.admin.markPaid")}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === "tasks" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black uppercase text-zinc-800">{t("growth.admin.newTask")}</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input className="rounded-lg border px-2 py-1.5 text-sm" placeholder="Suite" value={taskSuite} onChange={(e) => setTaskSuite(e.target.value)} />
              <input className="rounded-lg border px-2 py-1.5 text-sm" placeholder="Title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
              <input
                className="rounded-lg border px-2 py-1.5 text-sm"
                placeholder="Assignee"
                value={taskAssignee}
                onChange={(e) => setTaskAssignee(e.target.value)}
              />
              <input className="sm:col-span-2 rounded-lg border px-2 py-1.5 text-sm" placeholder="Description" value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} />
            </div>
            <button
              type="button"
              className="mt-3 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold uppercase text-white"
              onClick={() =>
                void postGrowthAdminTask({ suite: taskSuite, title: taskTitle, description: taskDesc, assignee: taskAssignee }).then((r) => {
                  if (!r.ok) toast.error(r.error ?? "");
                  else {
                    toast.success("Task created");
                    setTaskTitle("");
                    setTaskDesc("");
                    void load();
                  }
                })
              }
            >
              Create
            </button>
          </div>
          <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white shadow-sm">
            {tasks.map((tk) => (
              <li key={tk.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <span className="font-bold text-zinc-900">{tk.title}</span>{" "}
                  <span className="text-zinc-500">
                    {tk.suite} · {tk.status}
                  </span>
                </div>
                <select
                  className="rounded-lg border px-2 py-1 text-xs font-bold uppercase"
                  value={tk.status}
                  onChange={(e) =>
                    void patchGrowthAdminTask(tk.id, { status: e.target.value as GrowthTaskDto["status"] }).then((r) => {
                      if (!r.ok) toast.error(r.error ?? "");
                      else void load();
                    })
                  }
                >
                  <option value="open">open</option>
                  <option value="in_progress">in_progress</option>
                  <option value="done">done</option>
                  <option value="blocked">blocked</option>
                </select>
              </li>
            ))}
          </ul>
        </div>
      ) : tab === "audit" ? (
        <ul className="max-h-[480px] space-y-2 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 text-xs shadow-sm">
          {audit.map((e) => (
            <li key={e.id} className="border-b border-zinc-100 pb-2 font-mono text-[11px] text-zinc-700">
              <span className="text-zinc-400">{e.atIso}</span> · {e.action} · {e.suite ?? "—"}{" "}
              {typeof e.amountUsd === "number" ? <span className="text-teal-700"> US$ {e.amountUsd.toFixed(2)}</span> : null}
              {e.detail ? <div className="mt-0.5 text-zinc-500">{e.detail}</div> : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-black uppercase text-zinc-900">{t("growth.admin.landingTitle")}</h3>
          <p className="text-xs leading-relaxed text-zinc-600">{t("growth.admin.landingHint")}</p>
          <textarea
            className="min-h-[280px] w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-[11px] leading-relaxed text-zinc-900"
            spellCheck={false}
            value={landingJson}
            onChange={(e) => setLandingJson(e.target.value)}
            placeholder={t("growth.admin.landingPlaceholder")}
          />
          <button
            type="button"
            className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-black uppercase text-white"
            onClick={() => {
              let parsed: unknown;
              try {
                parsed = JSON.parse(landingJson) as unknown;
              } catch {
                toast.error(t("growth.admin.landingInvalid"));
                return;
              }
              if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                toast.error(t("growth.admin.landingInvalid"));
                return;
              }
              void patchGrowthAdminLandingCopy(parsed as Record<string, string>).then((r) => {
                if (!r.ok) toast.error(r.error ?? "");
                else toast.success(t("growth.admin.landingSaved"));
              });
            }}
          >
            {t("growth.admin.landingSave")}
          </button>
        </div>
      )}
    </div>
  );
}
