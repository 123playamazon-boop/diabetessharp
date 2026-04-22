import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Boxes, CheckCircle2, Plus, Sparkles, Truck } from "lucide-react";
import { AlertBanner } from "../../components/ds/AlertBanner";
import { DashboardSkeleton } from "../../components/ds/DashboardSkeleton";
import { KPICard } from "../../components/ds/KPICard";
import { QuickActionCards } from "../../components/ds/QuickActionCards";
import { ShipmentCenter } from "../../components/ds/ShipmentCenter";
import { ShipmentPipeline } from "../../components/ds/ShipmentPipeline";
import { ShipmentSidePanel } from "../../components/ds/ShipmentSidePanel";
import { useClientProfile } from "../../context/ClientProfileContext";
import { useVipUnread } from "../../context/VipUnreadContext";
import { computeClientDashboardMetrics } from "../../lib/clientDashboardMetrics";
import { computeWeeklySummary } from "../../lib/clientWeeklySummary";
import {
  CLIENT_INVENTORY_ADDITIONS_KEY,
  CLIENT_INVENTORY_DEDUCTIONS_KEY,
  INVENTORY_UPDATED_EVENT,
} from "../../lib/clientInventoryStorage";
import { CLIENT_ORDERS_ADDITIONS_KEY, ORDERS_UPDATED_EVENT } from "../../lib/clientOrdersStorage";
import { mockSparkSeries } from "../../mock/dashboard";
import { REGISTER_PRODUCT_DRAFT_UPDATED_EVENT } from "../../lib/registerProductDraft";
import { useI18n } from "../../i18n/context";

export function ClientDashboardPage() {
  const { t } = useI18n();
  const { profile } = useClientProfile();
  const { unreadCount } = useVipUnread();
  const suite = profile.suite?.trim() ?? "";
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);

  const bump = () => setTick((n) => n + 1);

  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 120);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const onInv = () => bump();
    const onOrd = () => bump();
    const onDraft = () => bump();
    window.addEventListener(INVENTORY_UPDATED_EVENT, onInv);
    window.addEventListener(ORDERS_UPDATED_EVENT, onOrd);
    window.addEventListener(REGISTER_PRODUCT_DRAFT_UPDATED_EVENT, onDraft);
    const onStorage = (e: StorageEvent) => {
      const k = e.key;
      if (!k) return;
      if (
        k === CLIENT_INVENTORY_ADDITIONS_KEY ||
        k === CLIENT_INVENTORY_DEDUCTIONS_KEY ||
        k === CLIENT_ORDERS_ADDITIONS_KEY ||
        k.startsWith("dbx.register-product.draft.")
      ) {
        bump();
      }
    };
    window.addEventListener("storage", onStorage);
    const onFocus = () => bump();
    window.addEventListener("focus", onFocus);
    const onVis = () => {
      if (document.visibilityState === "visible") bump();
    };
    const onNotify = () => bump();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("dbx:notifications-updated", onNotify);
    window.addEventListener("dbx:vip-announcements", onNotify);
    return () => {
      window.removeEventListener(INVENTORY_UPDATED_EVENT, onInv);
      window.removeEventListener(ORDERS_UPDATED_EVENT, onOrd);
      window.removeEventListener(REGISTER_PRODUCT_DRAFT_UPDATED_EVENT, onDraft);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("dbx:notifications-updated", onNotify);
      window.removeEventListener("dbx:vip-announcements", onNotify);
    };
  }, []);

  const { kpis, quick, pipeline } = useMemo(
    () => computeClientDashboardMetrics(suite, { balanceUsd: profile.balanceUsd, vipUnread: unreadCount }),
    [suite, tick, profile.balanceUsd, unreadCount],
  );

  const weekly = useMemo(() => computeWeeklySummary(profile, suite), [profile, suite, tick]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <AlertBanner issuesCount={kpis.problemLineCount} balanceUsd={profile.balanceUsd} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-ds-muted">Bem-vindo de volta</p>
          <h1 className="text-2xl font-bold tracking-tight text-ds-text sm:text-3xl">
            {profile.name} <span aria-hidden>👋</span>
          </h1>
          <p className="mt-1 max-w-xl text-sm text-ds-muted">
            Resumo operacional — estoque, risco e envio no mesmo fluxo de atenção.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link
            to="/app/listing-generator"
            className="inline-flex items-center justify-center gap-2 rounded-ds-btn border border-ds-border bg-ds-surface px-4 py-3 text-sm font-bold text-ds-text shadow-ds hover:bg-ds-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
          >
            <Sparkles className="size-5 text-ds-primary" strokeWidth={2} aria-hidden />
            {t("client.dashboard.listingGeneratorCardCta")}
          </Link>
          <Link
            to="/app/pedidos/criar"
            className="inline-flex items-center justify-center gap-2 rounded-ds-btn bg-cta-gradient px-5 py-3 text-sm font-bold text-white shadow-ds focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
            aria-label="Criar novo envio"
          >
            <Plus className="size-5" strokeWidth={2.5} aria-hidden />
            Criar envio
          </Link>
        </div>
      </div>

      <Link
        to="/app/listing-generator"
        className="flex flex-col gap-2 rounded-ds-card border border-ds-border bg-gradient-to-br from-ds-surface to-ds-bg p-4 shadow-ds ring-1 ring-ds-primary/15 transition hover:ring-ds-primary/30 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-ds-btn bg-ds-primary/10 text-ds-primary">
            <Sparkles className="size-6" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-bold text-ds-text">{t("client.dashboard.listingGeneratorCardTitle")}</p>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ds-muted">{t("client.dashboard.listingGeneratorCardDesc")}</p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center justify-center rounded-ds-btn bg-ds-primary px-4 py-2 text-xs font-bold uppercase tracking-wide text-white">
          {t("client.dashboard.listingGeneratorCardCta")}
        </span>
      </Link>

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <section className="space-y-4" aria-labelledby="viz-rapida-heading">
            <header className="space-y-1">
              <h2 id="viz-rapida-heading" className="text-lg font-bold tracking-tight text-ds-text">
                Visualização rápida
              </h2>
              <p className="max-w-2xl text-sm text-ds-muted">
                Indicadores do momento e atalhos para as tarefas que você abre com mais frequência.
              </p>
            </header>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KPICard
                title="Estoque total"
                value={kpis.totalInventoryQty}
                to="/app/estoque"
                icon={Boxes}
                sparkline={mockSparkSeries(Math.max(1, Math.min(20, kpis.totalInventoryQty || 1)))}
              />
              <KPICard
                title="Em trânsito"
                value={kpis.inTransitQty}
                to="/app/estoque"
                icon={Truck}
                sparkline={mockSparkSeries(Math.max(1, Math.min(20, kpis.inTransitQty || 1)))}
              />
              <KPICard
                title="Problemas"
                value={kpis.problemQty}
                to="/app/estoque"
                icon={AlertTriangle}
                sparkline={mockSparkSeries(Math.max(1, Math.min(20, kpis.problemQty || 1)))}
                variant={kpis.problemQty > 0 ? "danger" : "default"}
              />
              <KPICard
                title="Pedidos concluídos"
                value={kpis.completedOrders}
                to="/app/pedidos"
                icon={CheckCircle2}
                sparkline={mockSparkSeries(Math.max(1, Math.min(20, kpis.completedOrders || 1)))}
              />
            </div>

            <QuickActionCards counts={quick} />

            <section className="rounded-ds-card border border-ds-border bg-ds-surface p-4 shadow-ds" aria-labelledby="weekly-heading">
              <h2 id="weekly-heading" className="text-sm font-bold text-ds-text">
                {t("client.dashboard.weeklyTitle")}
              </h2>
              <p className="mt-1 text-xs text-ds-muted">{t("client.dashboard.weeklyIntro")}</p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {weekly.map((b) => (
                  <li
                    key={b.key}
                    className="flex items-center justify-between rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-2 text-xs font-semibold text-ds-text"
                  >
                    <span className="text-ds-muted">{t(`client.dashboard.weekly.${b.key}`)}</span>
                    <span className="tabular-nums text-ds-text">{b.value}</span>
                  </li>
                ))}
              </ul>
            </section>
          </section>

          <ShipmentPipeline stages={pipeline} />

          <div className="grid items-start gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ShipmentCenter />
            </div>
            <div className="lg:col-span-1">
              <ShipmentSidePanel />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
