import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useClientProfile } from "../../context/ClientProfileContext";
import { useI18n } from "../../i18n/context";
import {
  fetchGrowthClientDashboard,
  fetchGrowthRevenueReport,
  fetchGrowthSubscriptionStatus,
  GROWTH_PROGRAM_MONTHLY_USD,
  GROWTH_PROGRAM_PROFIT_SHARE_RATE,
  postGrowthServiceRequest,
  postSubscribeGrowthProgram,
  type GrowthRequestDto,
  type GrowthSubscriptionDto,
  type GrowthTaskDto,
  type ProfitShareDto,
  type RevenueRowDto,
} from "../../lib/growthProgramApi";
import { pullClientProfileFromServer } from "../../lib/clientProfileStorage";

export function ClientGrowthProgramDashboardPage() {
  const { t } = useI18n();
  const { profile } = useClientProfile();
  const suite = profile.suite;
  const usd = String(GROWTH_PROGRAM_MONTHLY_USD);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(false);
  const [subscription, setSubscription] = useState<GrowthSubscriptionDto | null>(null);
  const [summary, setSummary] = useState({
    totalSalesUsd: 0,
    totalProfitUsd: 0,
    commissionPendingUsd: 0,
    commissionPaidUsd: 0,
    revenueCount: 0,
  });
  const [revenue, setRevenue] = useState<RevenueRowDto[]>([]);
  const [profitShares, setProfitShares] = useState<ProfitShareDto[]>([]);
  const [requests, setRequests] = useState<GrowthRequestDto[]>([]);
  const [tasks, setTasks] = useState<GrowthTaskDto[]>([]);

  const [reqType, setReqType] = useState("ungating");
  const [reqBody, setReqBody] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [st, rep, dash] = await Promise.all([
        fetchGrowthSubscriptionStatus(suite),
        fetchGrowthRevenueReport(suite),
        fetchGrowthClientDashboard(suite),
      ]);
      setActive(!!st.active);
      setSubscription(st.subscription);
      setSummary(rep.summary);
      setRevenue(rep.revenue);
      setProfitShares(rep.profitShares);
      setRequests(dash.requests);
      setTasks(dash.tasks);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }, [suite]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSubscribe = async () => {
    setBusy(true);
    try {
      const r = await postSubscribeGrowthProgram(suite);
      if (!r.ok) {
        toast.error(r.error ?? "Falha na subscrição.");
        return;
      }
      toast.success(t("growth.client.subscribed"));
      await pullClientProfileFromServer();
      await load();
    } finally {
      setBusy(false);
    }
  };

  const onSubmitRequest = async () => {
    if (!reqBody.trim()) {
      toast.error("Preencha os detalhes.");
      return;
    }
    setBusy(true);
    try {
      const r = await postGrowthServiceRequest({ suite, type: reqType, body: reqBody.trim() });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Pedido enviado.");
      setReqBody("");
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            to="/app/growth-program"
            className="inline-flex items-center gap-1 text-sm font-semibold text-ds-muted transition hover:text-ds-primary"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Growth Program
          </Link>
          <Link
            to="/app/growth-program/strategy-ai"
            className="text-sm font-bold text-ds-primary underline-offset-2 hover:underline"
          >
            {t("growth.strategyAi.navLink")}
          </Link>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 text-xs font-bold uppercase tracking-wide text-ds-text disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
          {t("growth.admin.refresh")}
        </button>
      </div>

      <header className="space-y-2">
        <h1 className="text-2xl font-black tracking-tight text-ds-text sm:text-3xl">{t("growth.client.dashboardTitle")}</h1>
        <p className="text-sm text-ds-muted">
          Suite <span className="font-bold text-ds-text">{suite}</span> · Saldo US$ {profile.balanceUsd.toFixed(2)}
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-ds-muted">{t("growth.client.loading")}</p>
      ) : (
        <>
          <div className="grid gap-4 rounded-ds-card border border-ds-border bg-ds-surface p-6 shadow-ds lg:grid-cols-2">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wide text-ds-muted">{t("growth.client.subscribed")}</h2>
              {active && subscription ? (
                <div className="mt-3 space-y-2 text-sm">
                  <p className="font-semibold text-emerald-700">{t("growth.client.subscribed")}</p>
                  <p className="text-ds-muted">
                    {t("growth.client.nextRenewal")}:{" "}
                    <span className="font-mono text-ds-text">{subscription.currentPeriodEndIso?.slice(0, 10) ?? "—"}</span>
                  </p>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-ds-muted">
                    US$ {usd}/mês debitados da carteira (demo). Comissão sobre lucro: {Math.round(GROWTH_PROGRAM_PROFIT_SHARE_RATE * 100)}%.
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onSubscribe()}
                    className="rounded-ds-btn bg-ds-primary px-4 py-2.5 text-sm font-black uppercase tracking-wide text-white disabled:opacity-50"
                  >
                    {t("growth.client.subscribe", { usd })}
                  </button>
                </div>
              )}
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wide text-ds-muted">{t("growth.client.summary")}</h2>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-ds-btn border border-ds-border bg-ds-bg p-3">
                  <dt className="text-xs font-bold text-ds-muted">{t("growth.client.sales")}</dt>
                  <dd className="font-mono font-bold text-ds-text">US$ {summary.totalSalesUsd.toFixed(2)}</dd>
                </div>
                <div className="rounded-ds-btn border border-ds-border bg-ds-bg p-3">
                  <dt className="text-xs font-bold text-ds-muted">{t("growth.client.profit")}</dt>
                  <dd className="font-mono font-bold text-ds-text">US$ {summary.totalProfitUsd.toFixed(2)}</dd>
                </div>
                <div className="rounded-ds-btn border border-ds-border bg-ds-bg p-3">
                  <dt className="text-xs font-bold text-ds-muted">{t("growth.client.pending")}</dt>
                  <dd className="font-mono font-bold text-amber-800">US$ {summary.commissionPendingUsd.toFixed(2)}</dd>
                </div>
                <div className="rounded-ds-btn border border-ds-border bg-ds-bg p-3">
                  <dt className="text-xs font-bold text-ds-muted">{t("growth.client.paid")}</dt>
                  <dd className="font-mono font-bold text-emerald-800">US$ {summary.commissionPaidUsd.toFixed(2)}</dd>
                </div>
              </dl>
            </div>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-black text-ds-text">{t("growth.client.requests")}</h2>
            <div className="rounded-ds-card border border-ds-border bg-ds-surface p-4 shadow-ds">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-xs font-bold uppercase text-ds-muted">
                  {t("growth.client.type")}
                  <select
                    value={reqType}
                    onChange={(e) => setReqType(e.target.value)}
                    className="mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-bg px-2 py-2 text-sm"
                  >
                    <option value="ungating">Ungating</option>
                    <option value="listing_optimization">Listing optimization</option>
                    <option value="product_setup">Product setup</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="sm:col-span-2 text-xs font-bold uppercase text-ds-muted">
                  {t("growth.client.message")}
                  <textarea
                    value={reqBody}
                    onChange={(e) => setReqBody(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-bg px-2 py-2 text-sm"
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onSubmitRequest()}
                className="mt-3 rounded-ds-btn border border-ds-border bg-ds-bg px-4 py-2 text-xs font-black uppercase tracking-wide text-ds-text disabled:opacity-50"
              >
                {t("growth.client.submit")}
              </button>
            </div>
            <ul className="divide-y divide-ds-border rounded-ds-card border border-ds-border bg-ds-surface text-sm">
              {requests.length === 0 ? (
                <li className="px-4 py-6 text-ds-muted">—</li>
              ) : (
                requests.map((r) => (
                  <li key={r.id} className="px-4 py-3">
                    <span className="font-bold text-ds-text">{r.type}</span> · {r.status}
                    <p className="mt-1 text-ds-muted">{r.body}</p>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-black text-ds-text">{t("growth.client.tasks")}</h2>
            <ul className="rounded-ds-card border border-ds-border bg-ds-surface text-sm divide-y divide-ds-border">
              {tasks.length === 0 ? (
                <li className="px-4 py-6 text-ds-muted">—</li>
              ) : (
                tasks.map((tk) => (
                  <li key={tk.id} className="px-4 py-3">
                    <span className="font-bold">{tk.title}</span> · <span className="text-ds-muted">{tk.status}</span>
                    {tk.description ? <p className="mt-1 text-ds-muted">{tk.description}</p> : null}
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-black text-ds-text">Revenue lines</h2>
            <div className="max-w-full overflow-x-auto rounded-ds-card border border-ds-border bg-ds-surface">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="border-b border-ds-border bg-ds-bg font-bold uppercase text-ds-muted">
                  <tr>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Sales</th>
                    <th className="px-3 py-2">Profit</th>
                    <th className="px-3 py-2">Commission</th>
                    <th className="px-3 py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {revenue.map((r) => (
                    <tr key={r.id} className="border-b border-ds-border">
                      <td className="px-3 py-2 font-mono">{r.productSku}</td>
                      <td className="px-3 py-2 font-mono">{r.salesAmountUsd.toFixed(2)}</td>
                      <td className="px-3 py-2 font-mono">{r.profitAmountUsd.toFixed(2)}</td>
                      <td className="px-3 py-2 font-mono">{r.commissionDueUsd.toFixed(2)}</td>
                      <td className="px-3 py-2 text-ds-muted">{r.createdAtIso.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-black text-ds-text">Profit share</h2>
            <div className="max-w-full overflow-x-auto rounded-ds-card border border-ds-border bg-ds-surface">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="border-b border-ds-border bg-ds-bg font-bold uppercase text-ds-muted">
                  <tr>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Due US$</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {profitShares.map((p) => (
                    <tr key={p.id} className="border-b border-ds-border">
                      <td className="px-3 py-2 font-mono text-[10px]">{p.id}</td>
                      <td className="px-3 py-2 font-mono">{p.commissionDueUsd.toFixed(2)}</td>
                      <td className="px-3 py-2">{p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
