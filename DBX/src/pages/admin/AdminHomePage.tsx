import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { mockAdminKpis } from "../../mock/data";
import { PageHeader } from "../../ui/PageHeader";
import { useI18n } from "../../i18n/context";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { OrderLineThumb } from "../../components/OrderLineThumb";
import { getMergedInventoryView, INVENTORY_UPDATED_EVENT } from "../../lib/clientInventoryStorage";
import { loadAddedClientOrders, ORDERS_UPDATED_EVENT, pullAdminClientOrdersFromServer } from "../../lib/clientOrdersStorage";
import { enrichShipmentLinesWithInventory, shipmentLinesForOrder } from "../../lib/orderShipmentLines";
import { lineTitleForUi } from "../../lib/orderUi";
import { decodeHtmlEntities } from "../../lib/decodeHtmlEntities";
import { clearDemoBrowserState } from "../../lib/demoSessionReset";
import { postDemoFullReset } from "../../lib/walletApi";
import { parseEnvOrderIdToMs } from "../../lib/orderTimeline";
import { adminClientOrderServiceLabel, adminClientOrderStatusLabel } from "../../lib/adminClientOrderLabels";
import type { ClientOrder, ClientOrderStatus, InventoryRow } from "../../types";
import { toast } from "sonner";

function orderUnits(o: ClientOrder): number {
  return shipmentLinesForOrder(o).reduce((s, l) => s + (Number.isFinite(l.qty) ? l.qty : 0), 0);
}

function orderSortMs(o: ClientOrder): number {
  if (o.createdAtIso) {
    const p = Date.parse(o.createdAtIso);
    if (Number.isFinite(p)) return p;
  }
  return parseEnvOrderIdToMs(o.id) ?? 0;
}

function statusBadgeClass(s: ClientOrderStatus): string {
  if (s === "em_fila") return "border-amber-300 bg-amber-50 text-amber-950";
  if (s === "aguardando_cliente") return "border-rose-300 bg-rose-50 text-rose-950";
  if (s === "em_producao") return "border-sky-400 bg-sky-50 text-sky-950";
  if (s === "concluido") return "border-emerald-300 bg-emerald-50 text-emerald-950";
  return "border-zinc-200 bg-zinc-50 text-zinc-800";
}

function prepKitSummaryLine(o: ClientOrder): string | null {
  if (o.service !== "PREP_KIT") return null;
  const w = o.prepKitWork;
  if (!w) return null;
  const parts = [w.instructions?.trim(), w.outputsRequested?.trim()].filter(Boolean);
  if (!parts.length) return null;
  const raw = parts.join(" · ");
  return raw.length > 140 ? `${raw.slice(0, 137)}…` : raw;
}

function AllPortalOrdersTable({
  orders,
  invById,
  emptyText,
  t,
}: {
  orders: ClientOrder[];
  invById: Map<string, InventoryRow>;
  emptyText: string;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  const units = orders.reduce((a, o) => a + orderUnits(o), 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-zinc-200 bg-gradient-to-r from-violet-600 to-violet-700 px-4 py-3 text-xs font-bold text-white sm:text-sm">
        <span className="uppercase tracking-wide">{t("admin.dashboard.allPortalOrders")}</span>
        <div className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums opacity-95">
          <span>
            {t("admin.dashboard.nOrders")}: {orders.length}
          </span>
          <span>
            {t("admin.dashboard.units")}: {units}
          </span>
        </div>
      </div>
      <p className="border-b border-zinc-100 bg-zinc-50/80 px-4 py-2 text-[11px] leading-snug text-zinc-600 sm:text-xs">{t("admin.dashboard.syncHint")}</p>
      <div className="max-h-[min(70vh,520px)] max-w-full overflow-x-auto overflow-y-auto">
        <table className="w-full table-fixed border-collapse text-left text-[11px] leading-snug text-zinc-800 sm:text-[12px]">
          <thead className="sticky top-0 z-[1] border-b border-zinc-200 bg-zinc-50 text-[10px] font-bold uppercase tracking-wide text-zinc-600 sm:text-[11px]">
            <tr>
              <th className="w-[8%] min-w-0 px-2 py-2.5 pl-3">{t("admin.orders.col.order")}</th>
              <th className="w-[6%] min-w-0 px-2 py-2.5">{t("admin.orders.col.suite")}</th>
              <th className="w-[9%] min-w-0 px-2 py-2.5">{t("admin.orders.col.client")}</th>
              <th className="w-[11%] min-w-0 px-2 py-2.5">{t("admin.orders.col.status")}</th>
              <th className="w-[11%] min-w-0 px-2 py-2.5">{t("admin.orders.col.shipping")}</th>
              <th className="w-[22%] min-w-0 px-2 py-2.5">{t("admin.orders.col.product")}</th>
              <th className="w-[5%] min-w-0 px-1 py-2.5 text-center">{t("admin.orders.col.qty")}</th>
              <th className="w-[6%] min-w-0 px-1 py-2.5 text-center">{t("admin.orders.col.photo")}</th>
              <th className="w-[10%] min-w-0 px-2 py-2.5">{t("admin.orders.col.date")}</th>
              <th className="w-[12%] min-w-0 px-2 py-2.5 pr-3 text-right">{t("admin.orders.col.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-sm text-zinc-500">
                  {emptyText}
                </td>
              </tr>
            ) : (
              orders.map((o) => {
                const lines = enrichShipmentLinesWithInventory(shipmentLinesForOrder(o), invById);
                const first = lines[0]!;
                const extra = lines.length > 1 ? ` +${lines.length - 1}` : "";
                const prepLine = prepKitSummaryLine(o);
                return (
                  <tr key={o.id} className="hover:bg-zinc-50/80">
                    <td className="min-w-0 break-all px-2 py-2.5 pl-3 align-top font-semibold text-zinc-900">{o.id}</td>
                    <td className="min-w-0 px-2 py-2.5 align-top">
                      <span className="inline-flex max-w-full rounded-full border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-zinc-800">
                        {o.suite ?? "—"}
                      </span>
                    </td>
                    <td className="min-w-0 px-2 py-2.5 align-top">
                      <span className="line-clamp-2 break-words font-medium text-zinc-800" title={o.clientName ?? ""}>
                        {o.clientName ?? "—"}
                      </span>
                    </td>
                    <td className="min-w-0 px-2 py-2.5 align-top">
                      <span
                        className={`inline-flex max-w-full rounded-full border px-2 py-0.5 text-[10px] font-bold leading-tight ${statusBadgeClass(o.status)}`}
                        title={adminClientOrderStatusLabel(o.status, t)}
                      >
                        {adminClientOrderStatusLabel(o.status, t)}
                      </span>
                    </td>
                    <td className="min-w-0 px-2 py-2.5 align-top">
                      <span className="line-clamp-3 break-words rounded-md border border-zinc-200 bg-white px-1.5 py-1 text-[10px] font-semibold text-zinc-800">
                        {adminClientOrderServiceLabel(o, t)}
                      </span>
                    </td>
                    <td className="min-w-0 px-2 py-2.5 align-top">
                      <p className="line-clamp-2 break-words font-medium text-zinc-900" title={decodeHtmlEntities(first.title)}>
                        {lineTitleForUi(first.title, t)}
                        {extra ? <span className="text-zinc-500">{extra}</span> : null}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] font-medium text-zinc-500" title={first.asin}>
                        {t("admin.orders.asinPrefix")} {first.asin}
                      </p>
                      {prepLine ? (
                        <p className="mt-1 line-clamp-2 break-words text-[10px] italic text-zinc-600" title={prepLine}>
                          {prepLine}
                        </p>
                      ) : null}
                    </td>
                    <td className="min-w-0 px-1 py-2.5 text-center align-top font-bold tabular-nums text-zinc-900">{orderUnits(o)}</td>
                    <td className="min-w-0 px-1 py-2.5 align-top">
                      <div className="flex justify-center">
                        <OrderLineThumb line={first} size={44} zoomable />
                      </div>
                    </td>
                    <td className="min-w-0 break-words px-2 py-2.5 align-top text-[10px] font-medium text-zinc-600">{o.createdLabel}</td>
                    <td className="min-w-0 px-2 py-2.5 pr-3 text-right align-top">
                      <Link
                        to="/admin/pedidos"
                        className="inline-block rounded-lg bg-teal-600 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white hover:bg-teal-700"
                      >
                        {t("admin.orders.action.open")}
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminHomePage() {
  const { t } = useI18n();
  const [resetBusy, setResetBusy] = useState(false);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((x) => x + 1), []);

  useEffect(() => {
    void pullAdminClientOrdersFromServer();
  }, []);

  useEffect(() => {
    const on = () => refresh();
    window.addEventListener(ORDERS_UPDATED_EVENT, on);
    window.addEventListener(INVENTORY_UPDATED_EVENT, on);
    return () => {
      window.removeEventListener(ORDERS_UPDATED_EVENT, on);
      window.removeEventListener(INVENTORY_UPDATED_EVENT, on);
    };
  }, [refresh]);

  const invById = useMemo(() => {
    void tick;
    const m = new Map<string, ReturnType<typeof getMergedInventoryView>[number]>();
    for (const r of getMergedInventoryView()) m.set(r.id, r);
    return m;
  }, [tick]);

  const { allOrdersSorted, statQueue, statAwaitClient, statProduction, statDone } = useMemo(() => {
    void tick;
    const all = loadAddedClientOrders();
    const sorted = [...all].sort((a, b) => orderSortMs(b) - orderSortMs(a));
    const statQueue = all.filter((o) => o.status === "em_fila").length;
    const statAwaitClient = all.filter((o) => o.status === "aguardando_cliente").length;
    const statProduction = all.filter((o) => o.status === "em_producao").length;
    const statDone = all.filter((o) => o.status === "concluido").length;
    return { allOrdersSorted: sorted, statQueue, statAwaitClient, statProduction, statDone };
  }, [tick]);

  const kpiCards = useMemo(
    () =>
      [
        { labelKey: "admin.dashboard.kpi.awaitingPayment", value: mockAdminKpis.aguardandoPagamento, tone: "from-sky-50 to-white border-sky-200" },
        { labelKey: "admin.dashboard.kpi.labelSent", value: mockAdminKpis.labelEnviada, tone: "from-emerald-50 to-white border-emerald-200" },
        {
          labelKey: "admin.dashboard.kpi.paymentConfirm",
          value: mockAdminKpis.confirmacaoPgto,
          tone: "from-violet-50 to-white border-violet-200",
        },
        { labelKey: "admin.dashboard.kpi.paid", value: mockAdminKpis.pago, tone: "from-blue-50 to-white border-blue-200" },
        { labelKey: "admin.dashboard.kpi.awaitingLabel", value: mockAdminKpis.aguardandoLabel, tone: "from-amber-50 to-white border-amber-200" },
      ] as const,
    [],
  );

  const onDemoReset = async () => {
    if (!window.confirm(`${t("admin.demo.resetCardTitle")}\n\n${t("admin.demo.resetCardBody")}`)) return;
    setResetBusy(true);
    try {
      const r = await postDemoFullReset();
      if (!r.ok) {
        toast.error(r.error || t("admin.demo.resetFail"));
        return;
      }
      clearDemoBrowserState();
      toast.success(
        t("admin.demo.resetToast", {
          suite: r.loginSuite,
          name: r.loginName,
          email: r.loginEmail,
          password: r.loginPassword,
          balance: String(r.balanceUsd),
        }),
      );
    } finally {
      setResetBusy(false);
    }
  };

  const nTotal = allOrdersSorted.length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("admin.nav.home")}
        title={t("admin.dashboard.title")}
        subtitle={t("admin.dashboard.subtitle")}
        actions={<LanguageSwitcher />}
      />

      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 shadow-sm">
        <p className="text-sm font-bold text-amber-950">{t("admin.demo.resetCardTitle")}</p>
        <p className="mt-2 text-xs leading-relaxed text-amber-950/90">{t("admin.demo.resetCardBody")}</p>
        <button
          type="button"
          disabled={resetBusy}
          onClick={() => void onDemoReset()}
          className="mt-3 rounded-xl border border-amber-400 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-amber-950 hover:bg-amber-100 disabled:opacity-50"
        >
          {t("admin.demo.resetButton")}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {kpiCards.map((k) => (
          <div key={k.labelKey} className={`rounded-2xl border bg-gradient-to-b p-4 shadow-sm ${k.tone}`}>
            <div className="text-xs font-semibold text-zinc-600">{t(k.labelKey)}</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-zinc-200/90 bg-zinc-50/80 p-3 shadow-sm">
        {[
          { label: t("admin.dashboard.statAll"), count: nTotal, tone: "border-zinc-300 bg-white text-zinc-900" },
          { label: t("admin.dashboard.statQueue"), count: statQueue, tone: "border-amber-300 bg-amber-50 text-amber-950" },
          { label: t("admin.dashboard.statAwaitClient"), count: statAwaitClient, tone: "border-rose-300 bg-rose-50 text-rose-950" },
          { label: t("admin.dashboard.statProduction"), count: statProduction, tone: "border-sky-400 bg-sky-50 text-sky-950" },
          { label: t("admin.dashboard.statDone"), count: statDone, tone: "border-emerald-300 bg-emerald-50 text-emerald-950" },
        ].map((chip) => (
          <div
            key={chip.label}
            className={`inline-flex min-w-[7.5rem] flex-1 flex-col rounded-xl border px-3 py-2 sm:min-w-0 sm:flex-initial ${chip.tone}`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">{chip.label}</span>
            <span className="text-xl font-bold tabular-nums">{chip.count}</span>
          </div>
        ))}
      </div>

      <AllPortalOrdersTable orders={allOrdersSorted} invById={invById} emptyText={t("admin.dashboard.emptyAll")} t={t} />

      <p className="text-sm leading-relaxed text-zinc-600">
        {t("admin.dashboard.receiptsVsOrdersHint")}{" "}
        <Link to="/admin/recebimentos" className="font-semibold text-violet-700 underline-offset-2 hover:underline">
          {t("admin.nav.receipts")}
        </Link>
        {" · "}
        <Link to="/admin/pedidos" className="font-semibold text-violet-700 underline-offset-2 hover:underline">
          {t("admin.nav.orders")}
        </Link>
      </p>

      <details className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700 shadow-sm">
        <summary className="cursor-pointer font-bold text-zinc-900">{t("admin.dashboard.improvementsSummary")}</summary>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-relaxed sm:text-sm">
          <li>{t("admin.dashboard.improvement1")}</li>
          <li>{t("admin.dashboard.improvement2")}</li>
          <li>{t("admin.dashboard.improvement3")}</li>
          <li>{t("admin.dashboard.improvement4")}</li>
          <li>{t("admin.dashboard.improvement5")}</li>
        </ul>
      </details>

      <p className="text-sm text-zinc-600">{t("admin.dashboard.focusHint")}</p>
    </div>
  );
}
