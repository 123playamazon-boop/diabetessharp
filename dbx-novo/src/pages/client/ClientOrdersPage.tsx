import { useCallback, useEffect, useMemo, useState } from "react";
import { PackageSearch } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { OrderLineThumb } from "../../components/OrderLineThumb";
import { TrackingLiveStatusBlock } from "../../components/TrackingLiveStatusBlock";
import { DeliveryConfirmPanel, ManualTrackingForm } from "../../components/ManualTrackingForm";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { useI18n } from "../../i18n/context";
import type { AppLocale } from "../../i18n/catalog";
import { mockClientOrders } from "../../mock/data";
import type { ClientOrder, ClientOrderStatus, InventoryRow, ServiceType } from "../../types";
import { NON_AMAZON_MARKETPLACE_LABEL } from "../../types";
import { useClientProfile } from "../../context/ClientProfileContext";
import { inventoryRowsForSuite, ordersForSuite } from "../../lib/clientDashboardMetrics";
import { PageHeader } from "../../ui/PageHeader";
import { FbaPrepPlanMissingNote, FbaPrepPlanPanel } from "../../ui/FbaPrepPlanPanel";
import { cn } from "../../lib/cn";
import { getMergedInventoryView, removeInventoryDeductions } from "../../lib/clientInventoryStorage";
import { removeIntlBrDeclarationByOrderId } from "../../lib/intlBrDeclarationStorage";
import { enrichShipmentLinesWithInventory, shipmentLinesForOrder } from "../../lib/orderShipmentLines";
import { lineTitleForUi } from "../../lib/orderUi";
import { openDataUrlInNewWindow, printDataUrlInNewWindow } from "../../lib/printDataUrl";
import {
  CLIENT_ORDERS_ADDITIONS_KEY,
  loadAddedClientOrders,
  ORDERS_UPDATED_EVENT,
  removeClientOrder,
  updateClientOrder,
} from "../../lib/clientOrdersStorage";
import { resolveLabelTrackingMatch } from "../../lib/requestShippingLabelParse";
import { resolvedShippingTracking } from "../../lib/orderTrackingDisplay";
import { isDeliveryOrder } from "../../lib/deliveryOrder";
import { OrderChecklistPanel } from "../../components/OrderChecklistPanel";

function labelStatus(s: ClientOrderStatus, t: (k: string) => string) {
  switch (s) {
    case "aguardando_cliente":
      return t("client.orders.status.waitingYou");
    case "em_fila":
      return t("client.orders.status.queue");
    case "em_producao":
      return t("client.orders.status.production");
    case "concluido":
      return t("client.orders.status.done");
    default:
      return s;
  }
}

function serviceLabel(o: ClientOrder, t: (k: string) => string): string {
  if (o.service === "FBM") return t("admin.service.fbm");
  if (o.service === "FBA") return t("admin.service.fba");
  if (o.service === "USA_DOMESTIC") return t("admin.service.usa");
  if (o.service === "WALMART_CUSTOMER") return t("admin.service.walmartCustomer");
  if (o.service === "WALMART_WAREHOUSE") return t("admin.service.walmartWarehouse");
  if (o.service === "EBAY") return t("admin.service.ebay");
  if (o.service === "INTL_ML") return t("admin.service.intlMl");
  if (o.service === "INTL_BR") return t("admin.service.intlBr");
  if (o.service === "PREP_KIT") return t("admin.service.prepKit");
  if (o.service === "OUTRO") {
    if (o.nonAmazonMarketplace === "other" && o.otherPlatformName?.trim()) return o.otherPlatformName.trim();
    if (o.nonAmazonMarketplace) return NON_AMAZON_MARKETPLACE_LABEL[o.nonAmazonMarketplace];
    if (o.otherPlatformName?.trim()) return o.otherPlatformName.trim();
    return t("admin.service.other");
  }
  return o.service;
}

function badgeClass(s: ClientOrderStatus) {
  if (s === "concluido") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (s === "aguardando_cliente") return "border-red-300 bg-red-50 text-red-900";
  if (s === "em_fila") return "border-ds-warning/40 bg-ds-soft-amber text-ds-soft-amber-icon";
  return "border-ds-border bg-ds-bg text-ds-text";
}

const CANCEL_WINDOW_MS = 60 * 60 * 1000;

function orderNeedsClientAdjust(o: ClientOrder): boolean {
  if (o.status === "aguardando_cliente") return true;
  if (o.prepClientNotice?.trim() || o.prepLabelPrintIssue?.trim()) return true;
  return false;
}

function deductionSnapshot(o: ClientOrder): { id: string; qty: number }[] {
  if (o.inventoryDeductions?.length) return o.inventoryDeductions;
  if (o.shipmentLines?.length) {
    return o.shipmentLines.map((l) => ({ id: l.inventoryId, qty: l.qty }));
  }
  if (o.fbaItemsSnapshot?.length) {
    return o.fbaItemsSnapshot.map((x) => ({ id: x.inventoryId, qty: x.totalQty }));
  }
  return [];
}

function withinCancelWindow(o: ClientOrder): boolean {
  if (!o.createdAtIso) return false;
  const t0 = new Date(o.createdAtIso).getTime();
  if (!Number.isFinite(t0)) return false;
  return Date.now() - t0 < CANCEL_WINDOW_MS;
}

function cancelTimeRemainingLabel(o: ClientOrder): string {
  if (!o.createdAtIso) return "";
  const deadline = new Date(o.createdAtIso).getTime() + CANCEL_WINDOW_MS;
  const left = Math.max(0, deadline - Date.now());
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return `${m} min ${s} s`;
}

function serviceBadgeClass(s: ServiceType) {
  if (s === "FBA") return "border-ds-primary/30 bg-ds-soft-violet text-ds-soft-violet-icon";
  if (s === "FBM") return "border-ds-border bg-ds-bg text-ds-muted";
  if (s === "INTL_ML") return "border-ds-warning/40 bg-ds-soft-amber text-ds-soft-amber-icon";
  if (s === "INTL_BR") return "border-ds-soft-emerald-border bg-ds-soft-emerald text-ds-soft-emerald-icon";
  if (s === "USA_DOMESTIC") return "border-ds-primary/25 bg-ds-bg text-ds-primary";
  if (s === "WALMART_CUSTOMER" || s === "WALMART_WAREHOUSE")
    return "border-ds-primary/35 bg-ds-soft-violet/80 text-ds-soft-violet-icon";
  if (s === "EBAY") return "border-ds-warning/45 bg-ds-soft-amber/90 text-ds-soft-amber-icon";
  if (s === "PREP_KIT") return "border-violet-300 bg-violet-50 text-violet-900";
  return "border-ds-soft-sky-border bg-ds-soft-sky text-ds-soft-sky-icon";
}

const SHIP_TOAST_WINDOW_MS = 3 * 60 * 1000;

type ClientOrdersTab = ClientOrderStatus | "delivery";

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function downloadOrdersCsv(rows: ClientOrder[], filename: string) {
  const header = ["id", "status", "service", "createdLabel", "suite"];
  const lines = [
    header.join(","),
    ...rows.map((o) =>
      [o.id, o.status, o.service, o.createdLabel ?? "", o.suite ?? ""].map((x) => escapeCsvCell(String(x))).join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function formatDateTimeLocale(iso: string, locale: AppLocale): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  const tag = locale === "pt-BR" ? "pt-BR" : locale === "es" ? "es" : "en-US";
  return new Intl.DateTimeFormat(tag, { dateStyle: "short", timeStyle: "short" }).format(new Date(ms));
}

export function ClientOrdersPage() {
  const { profile } = useClientProfile();
  const orderPatchCtx = useMemo(() => ({ role: "client" as const, suite: profile.suite }), [profile.suite]);
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<ClientOrdersTab>("em_fila");
  const [orderTick, setOrderTick] = useState(0);
  const [detail, setDetail] = useState<ClientOrder | null>(null);
  const [clientDetailTab, setClientDetailTab] = useState<"detail" | "tracking">("detail");

  const tabs = useMemo(
    (): { id: ClientOrdersTab; label: string }[] => [
      { id: "aguardando_cliente", label: t("client.orders.tabWithYou") },
      { id: "em_fila", label: t("client.orders.tabQueue") },
      { id: "em_producao", label: t("client.orders.tabProduction") },
      { id: "concluido", label: t("client.orders.tabDone") },
      { id: "delivery", label: t("client.orders.tabDelivery") },
    ],
    [t],
  );

  useEffect(() => {
    const fn = () => setOrderTick((x) => x + 1);
    window.addEventListener(ORDERS_UPDATED_EVENT, fn);
    return () => window.removeEventListener(ORDERS_UPDATED_EVENT, fn);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CLIENT_ORDERS_ADDITIONS_KEY || e.key === null) setOrderTick((x) => x + 1);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const orders = loadAddedClientOrders();
    const now = Date.now();
    for (const o of orders) {
      if (o.status !== "concluido" || !o.opsShippedAtIso) continue;
      const ts = new Date(o.opsShippedAtIso).getTime();
      if (!Number.isFinite(ts) || now - ts > SHIP_TOAST_WINDOW_MS) continue;
      const key = `dbx-ship-toast:${o.id}:${o.opsShippedAtIso}`;
      try {
        if (sessionStorage.getItem(key)) continue;
        sessionStorage.setItem(key, "1");
      } catch {
        continue;
      }
      toast.success(t("client.orders.shippedToast"), { description: t("client.orders.shippedToastDesc", { id: o.id }) });
      const trackUrl = resolvedShippingTracking(o).url;
      if (trackUrl) {
        const tk = `dbx-track-auto:${o.id}:${o.opsShippedAtIso}`;
        try {
          if (!sessionStorage.getItem(tk)) {
            sessionStorage.setItem(tk, "1");
            window.open(trackUrl, "_blank", "noopener,noreferrer");
          }
        } catch {
          /* ignore */
        }
      }
    }
  }, [orderTick, t]);

  const invById = useMemo(() => {
    void orderTick;
    const m = new Map<string, InventoryRow>();
    for (const r of inventoryRowsForSuite(getMergedInventoryView(), profile.suite)) m.set(r.id, r);
    return m;
  }, [orderTick, profile.suite]);

  const userOrderIds = useMemo(() => {
    void orderTick;
    return new Set(ordersForSuite(loadAddedClientOrders(), profile.suite).map((o) => o.id));
  }, [orderTick, profile.suite]);

  const allOrders = useMemo(() => {
    void orderTick;
    return [...ordersForSuite(loadAddedClientOrders(), profile.suite), ...mockClientOrders];
  }, [orderTick, profile.suite]);

  const rows = useMemo(() => {
    if (tab === "delivery") return allOrders.filter(isDeliveryOrder);
    return allOrders.filter((o) => o.status === tab);
  }, [allOrders, tab]);

  const countInTab = useMemo(() => {
    if (tab === "delivery") return allOrders.filter(isDeliveryOrder).length;
    return allOrders.filter((o) => o.status === tab).length;
  }, [allOrders, tab]);

  const detailLines = useMemo(() => {
    if (!detail) return [];
    return enrichShipmentLinesWithInventory(shipmentLinesForOrder(detail), invById);
  }, [detail, invById]);

  /** Linhas com foto/título para cada pedido (lista + rastreio). */
  const shipmentLinesByOrderId = useMemo(() => {
    void orderTick;
    const m = new Map<string, ReturnType<typeof enrichShipmentLinesWithInventory>>();
    for (const o of allOrders) {
      m.set(o.id, enrichShipmentLinesWithInventory(shipmentLinesForOrder(o), invById));
    }
    return m;
  }, [allOrders, invById, orderTick]);

  const detailTracking = useMemo(
    () => (detail ? resolvedShippingTracking(detail) : null),
    [
      detail?.id,
      detail?.shippingTrackingUrl,
      detail?.shippingTrackingNumber,
      detail?.shippingTrackingCarrierId,
      detail?.shippingTrackingCarrierLabel,
    ],
  );

  useEffect(() => {
    if (!detail) return;
    const sync = () => {
      const fresh = loadAddedClientOrders().find((x) => x.id === detail.id);
      if (fresh) setDetail(fresh);
    };
    window.addEventListener(ORDERS_UPDATED_EVENT, sync);
    return () => window.removeEventListener(ORDERS_UPDATED_EVENT, sync);
  }, [detail?.id]);

  useEffect(() => {
    setClientDetailTab("detail");
  }, [detail?.id]);

  useEffect(() => {
    if (!detail) return;
    const fromUser = loadAddedClientOrders().some((x) => x.id === detail.id);
    if (!fromUser) return;
    const r = resolvedShippingTracking(detail);
    if (r.url && !detail.shippingTrackingUrl?.trim() && detail.shippingTrackingCarrierId && detail.shippingTrackingNumber) {
      void updateClientOrder(detail.id, { shippingTrackingUrl: r.url }, orderPatchCtx);
    }
  }, [
    detail?.id,
    detail?.shippingTrackingUrl,
    detail?.shippingTrackingCarrierId,
    detail?.shippingTrackingNumber,
    orderPatchCtx,
  ]);

  useEffect(() => {
    let alive = true;
    if (!detail) return;
    const fromUser = loadAddedClientOrders().some((x) => x.id === detail.id);
    if (!fromUser) return;
    const intlMlCarrierPdf =
      detail.service === "INTL_ML" &&
      detail.intlMlCarrierLabelDataUrl?.trim() &&
      detail.intlMlAmericasLabelDataUrl?.trim()
        ? detail.intlMlCarrierLabelDataUrl
        : null;
    const pdf =
      detail.service === "FBA"
        ? detail.fbaCarrierLabel?.dataUrl ?? detail.shippingLabelDataUrl
        : intlMlCarrierPdf ?? detail.shippingLabelDataUrl;
    const labelFileName =
      detail.service === "FBA" && detail.fbaCarrierLabel != null && detail.fbaCarrierLabel.dataUrl === pdf
        ? detail.fbaCarrierLabel.name
        : detail.service === "INTL_ML" && intlMlCarrierPdf
          ? detail.intlMlCarrierLabelFileName
          : detail.shippingLabelFileName;
    if (!pdf?.startsWith("data:application/pdf") || resolvedShippingTracking(detail).url) return;
    void (async () => {
      const r = await resolveLabelTrackingMatch(pdf, labelFileName);
      if (!alive || !r.ok || !r.match) return;
      void updateClientOrder(
        detail.id,
        {
          shippingTrackingCarrierId: r.match.carrierId,
          shippingTrackingCarrierLabel: r.match.carrierLabel,
          shippingTrackingNumber: r.match.tracking,
          shippingTrackingUrl: r.match.trackingUrl,
        },
        orderPatchCtx,
      );
    })();
    return () => {
      alive = false;
    };
  }, [
    detail?.id,
    detail?.service,
    detail?.shippingLabelDataUrl,
    detail?.shippingLabelFileName,
    detail?.intlMlCarrierLabelDataUrl,
    detail?.intlMlCarrierLabelFileName,
    detail?.intlMlAmericasLabelDataUrl,
    detail?.fbaCarrierLabel?.dataUrl,
    detail?.fbaCarrierLabel?.name,
    detail?.shippingTrackingNumber,
    detail?.shippingTrackingUrl,
    detail?.shippingTrackingCarrierId,
    orderPatchCtx,
  ]);

  const canCancelOrder = useCallback(
    (o: ClientOrder) => {
      if (!userOrderIds.has(o.id)) return false;
      if (o.status !== "em_fila" && o.status !== "aguardando_cliente") return false;
      return withinCancelWindow(o);
    },
    [userOrderIds],
  );

  const requestCancelOrder = useCallback(
    async (o: ClientOrder) => {
      const left = cancelTimeRemainingLabel(o);
      const ok = window.confirm(t("client.orders.cancelConfirm", { time: left }));
      if (!ok) return;
      const items = deductionSnapshot(o);
      if (items.length) await removeInventoryDeductions(items);
      if (o.service === "INTL_BR") removeIntlBrDeclarationByOrderId(o.id);
      if (!(await removeClientOrder(o.id, o.suite ?? profile.suite))) {
        toast.error(t("client.orders.cancelError"));
        return;
      }
      toast.success(t("client.orders.cancelSuccess"), { description: t("client.orders.cancelSuccessDesc") });
      setDetail(null);
    },
    [t, profile.suite],
  );

  const printShipping = (o: ClientOrder) => {
    if (o.shippingLabelDataUrl) printDataUrlInNewWindow(o.shippingLabelDataUrl, o.shippingLabelFileName ?? "label");
  };

  const saveShippingLabel = (o: ClientOrder) => {
    const u = o.shippingLabelDataUrl;
    if (!u) return;
    const name = o.shippingLabelFileName?.trim() || "etiqueta-envio.pdf";
    const a = document.createElement("a");
    a.href = u;
    a.download = /\.pdf$/i.test(name) ? name : `${name.replace(/\.[^/.]+$/, "")}.pdf`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success(t("admin.orders.detail.labelSaved"));
  };

  const saveDataUrlFile = (dataUrl: string, filename: string) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename || "arquivo.pdf";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success(t("admin.orders.detail.labelSaved"));
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        eyebrow={t("client.orders.eyebrow")}
        title={t("client.orders.title")}
        subtitle={t("client.orders.subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LanguageSwitcher />
            <button
              type="button"
              disabled={rows.length === 0}
              onClick={() => {
                const stamp = new Date().toISOString().slice(0, 10);
                downloadOrdersCsv(rows, `pedidos-${tab}-${stamp}.csv`);
                toast.success(t("client.orders.exportCsvOk"));
              }}
              className="rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-ds-text shadow-ds hover:bg-ds-bg disabled:opacity-50"
            >
              {t("client.orders.exportCsv")}
            </button>
            <Link
              to="/app/pedidos/criar"
              className="inline-flex items-center justify-center gap-2 rounded-ds-btn bg-cta-gradient px-4 py-2.5 text-sm font-bold text-white shadow-ds focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
            >
              {t("client.orders.create")}
            </Link>
          </div>
        }
      />

      <div className="flex flex-col gap-3 rounded-ds-card border border-ds-border bg-ds-surface p-3 shadow-ds sm:flex-row sm:items-center sm:justify-between">
        <div
          className={cn(
            "flex flex-wrap gap-1 rounded-ds-btn bg-ds-bg p-1",
            allOrders.some((o) => o.status === "aguardando_cliente") && "ring-2 ring-red-200/90",
          )}
          role="tablist"
          aria-label={t("client.orders.title")}
        >
          {tabs.map((tb) => (
            <button
              key={tb.id}
              type="button"
              role="tab"
              aria-selected={tab === tb.id}
              onClick={() => setTab(tb.id)}
              className={cn(
                "rounded-ds-btn px-3 py-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary",
                tb.id === "aguardando_cliente"
                  ? tab === tb.id
                    ? "bg-red-600 text-white shadow-ds ring-2 ring-red-700"
                    : "border border-red-300/90 bg-red-50 text-red-900 hover:bg-red-100"
                  : tab === tb.id
                    ? "bg-ds-surface text-ds-text shadow-ds ring-1 ring-ds-border"
                    : "text-ds-muted hover:text-ds-text",
              )}
            >
              {tb.label}
              {tb.id === "delivery"
                ? allOrders.some(isDeliveryOrder)
                  ? ` · ${allOrders.filter(isDeliveryOrder).length}`
                  : ""
                : allOrders.some((o) => o.status === tb.id)
                  ? ` · ${allOrders.filter((o) => o.status === tb.id).length}`
                  : ""}
            </button>
          ))}
        </div>
        <div className="text-xs font-semibold text-ds-muted">
          {countInTab ? t("client.orders.count", { n: countInTab }) : t("client.orders.emptyTab")}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-ds-card border border-dashed border-ds-border bg-ds-surface px-6 py-12 text-center text-sm font-medium text-ds-muted shadow-ds">
          {t("client.orders.empty")}{" "}
          <Link to="/app/pedidos/criar" className="font-semibold text-ds-primary underline-offset-2 hover:underline">
            {t("client.orders.createLink")}
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-ds-card border border-ds-border bg-ds-surface shadow-ds">
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full text-sm">
              <thead className="bg-ds-bg text-left text-xs font-semibold uppercase tracking-wide text-ds-muted">
                <tr>
                  <th className="px-3 py-3">{t("client.orders.col.photo")}</th>
                  <th className="px-4 py-3">{t("admin.orders.col.order")}</th>
                  <th className="px-4 py-3">{t("admin.orders.col.status")}</th>
                  <th className="px-4 py-3">{t("admin.orders.col.shipping")}</th>
                  <th className="px-4 py-3">{t("client.orders.col.updated")}</th>
                  <th className="px-4 py-3 text-right"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ds-border">
                {rows.map((o) => {
                  const rawLines = shipmentLinesByOrderId.get(o.id) ?? [];
                  const meaningful = rawLines.filter((l) => l.inventoryId && l.inventoryId !== "—");
                  const thumbLines = meaningful.length ? meaningful : rawLines.slice(0, 1);
                  const maxThumbs = 3;
                  const shown = thumbLines.slice(0, maxThumbs);
                  const more = thumbLines.length - shown.length;
                  return (
                  <tr key={o.id} className="hover:bg-ds-bg/80">
                    <td className="px-3 py-3 align-middle">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {shown.map((line, idx) => (
                          <OrderLineThumb key={`${o.id}-t-${line.inventoryId}-${idx}`} line={line} size={48} zoomable />
                        ))}
                        {more > 0 ? (
                          <span
                            className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-ds-btn border border-ds-border bg-ds-bg text-[11px] font-bold text-ds-muted"
                            title={t("client.orders.moreSkus", { n: more })}
                          >
                            +{more}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-base font-bold tracking-tight text-ds-text">{o.id}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full border px-2 py-1 text-xs font-semibold", badgeClass(o.status))}>
                        {labelStatus(o.status, t)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span
                          className={cn(
                            "inline-flex w-fit rounded-full border px-2 py-1 text-xs font-semibold",
                            serviceBadgeClass(o.service),
                          )}
                        >
                          {serviceLabel(o, t)}
                        </span>
                        {o.service === "FBA" ? (
                          <div className="flex min-w-0 max-w-[min(100%,32rem)] flex-col gap-2 text-[11px]">
                            <div className="flex flex-col gap-1">
                              {o.fbaFnskuLabels && o.fbaFnskuLabels.length > 0 ? (
                                <span className="font-medium text-ds-text">
                                  FNSKU: {o.fbaFnskuLabels.length}{" "}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openDataUrlInNewWindow(
                                        o.fbaFnskuLabels![0]!.dataUrl,
                                        o.fbaFnskuLabels![0]!.name ?? "FNSKU",
                                      )
                                    }
                                    className="text-ds-primary underline"
                                  >
                                    {t("client.orders.view")}
                                  </button>
                                </span>
                              ) : null}
                              {o.status === "aguardando_cliente" && (o.prepClientNotice || o.prepLabelPrintIssue) ? (
                                <div className="rounded-ds-btn border border-red-300/90 bg-red-50 px-2 py-1.5 text-[11px] text-red-950">
                                  <p className="font-bold uppercase tracking-wide text-red-900">{t("client.orders.prepAlertTitle")}</p>
                                  {o.prepClientNotice ? (
                                    <p className="mt-1 whitespace-pre-wrap font-medium leading-relaxed">{o.prepClientNotice}</p>
                                  ) : null}
                                  {o.prepLabelPrintIssue ? (
                                    <p className="mt-1.5 border-t border-red-200/80 pt-1.5 font-medium leading-relaxed">
                                      <span className="font-bold">{t("client.orders.prepLabelIssuePrefix")}</span> {o.prepLabelPrintIssue}
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}
                              {o.service === "FBA" &&
                              o.fbaMasterBoxDims &&
                              (o.status === "aguardando_cliente" || o.status === "em_producao" || o.status === "em_fila") ? (
                                <div className="rounded-ds-btn border border-emerald-200/90 bg-emerald-50 px-2 py-1.5 text-[11px] text-emerald-950">
                                  <p className="font-bold uppercase tracking-wide text-emerald-900/90">
                                    {t("client.orders.fbaBoxDimsTitle")}
                                  </p>
                                  <p className="mt-1 font-semibold tabular-nums">
                                    {t("client.orders.fbaBoxDimsShort", {
                                      l: String(o.fbaMasterBoxDims.lengthCm),
                                      w: String(o.fbaMasterBoxDims.widthCm),
                                      h: String(o.fbaMasterBoxDims.heightCm),
                                      lb: String(o.fbaMasterBoxDims.weightLb),
                                    })}
                                  </p>
                                  {!(o.fbaAmazonBoxLabel && o.fbaCarrierLabel) ? (
                                    <p className="mt-1.5 leading-relaxed text-emerald-900/95">
                                      {t("client.orders.fbaBoxDimsAmazonHint")}
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}
                              {o.fbaAmazonBoxLabel && o.fbaCarrierLabel ? (
                                <span className="flex flex-col gap-0.5">
                                  <span className="font-medium text-emerald-800">Caixa master</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openDataUrlInNewWindow(o.fbaAmazonBoxLabel!.dataUrl, o.fbaAmazonBoxLabel!.name ?? "amazon-caixa.pdf")
                                    }
                                    className="text-left text-ds-primary underline"
                                  >
                                    Amazon
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openDataUrlInNewWindow(o.fbaCarrierLabel!.dataUrl, o.fbaCarrierLabel!.name ?? "transportadora.pdf")
                                    }
                                    className="text-left text-ds-primary underline"
                                  >
                                    Transportadora
                                  </button>
                                </span>
                              ) : (
                                <Link
                                  to={`/app/pedidos/${o.id}/fba-caixa-master`}
                                  className="font-semibold text-ds-primary underline-offset-2 hover:underline"
                                >
                                  {t("client.orders.completeBoxLabels")}
                                </Link>
                              )}
                            </div>
                            <FbaPrepPlanPanel order={o} variant="client" />
                            <FbaPrepPlanMissingNote order={o} />
                          </div>
                        ) : o.service === "INTL_ML" &&
                          o.intlMlAmericasLabelDataUrl?.trim() &&
                          o.intlMlCarrierLabelDataUrl?.trim() ? (
                          <span className="flex max-w-[220px] flex-col gap-1 text-[11px] font-semibold text-ds-primary">
                            <a
                              href={o.intlMlAmericasLabelDataUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate underline-offset-2 hover:underline"
                              title={o.intlMlAmericasLabelFileName ?? t("admin.orders.detail.intlMlAmericasTitle")}
                            >
                              {t("admin.orders.detail.intlMlAmericasTitle")}
                            </a>
                            <a
                              href={o.intlMlCarrierLabelDataUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate underline-offset-2 hover:underline"
                              title={o.intlMlCarrierLabelFileName ?? t("admin.orders.detail.intlMlCarrierTitle")}
                            >
                              {t("admin.orders.detail.intlMlCarrierTitle")}
                            </a>
                          </span>
                        ) : o.shippingLabelDataUrl ? (
                          <a
                            href={o.shippingLabelDataUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="max-w-[220px] truncate text-[11px] font-semibold text-ds-primary underline-offset-2 hover:underline"
                            title={o.shippingLabelFileName ?? t("admin.orders.col.label")}
                          >
                            {o.shippingLabelFileName ?? t("admin.orders.labelOpen")}
                          </a>
                        ) : o.service === "USA_DOMESTIC" && o.usaDeliveryNotes ? (
                          <span className="max-w-[220px] truncate text-[11px] text-ds-muted" title={o.usaDeliveryNotes}>
                            {o.usaDeliveryNotes}
                          </span>
                        ) : (o.service === "WALMART_CUSTOMER" || o.service === "WALMART_WAREHOUSE") && o.walmartNotes ? (
                          <span className="max-w-[220px] truncate text-[11px] text-ds-muted" title={o.walmartNotes}>
                            {o.walmartNotes}
                          </span>
                        ) : o.service === "EBAY" && o.ebayNotes ? (
                          <span className="max-w-[220px] truncate text-[11px] text-ds-muted" title={o.ebayNotes}>
                            {o.ebayNotes}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-ds-muted">{o.createdLabel}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-row items-center justify-end gap-2">
                        {resolvedShippingTracking(o).url ? (
                          <a
                            href={resolvedShippingTracking(o).url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={t("client.orders.trackingIconAria")}
                            aria-label={t("client.orders.trackingIconAria")}
                            className="inline-flex rounded-ds-btn border border-ds-primary/30 bg-ds-primary/10 p-2 text-ds-primary shadow-ds hover:bg-ds-primary/15"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <PackageSearch className="h-4 w-4" aria-hidden />
                          </a>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            const fresh = loadAddedClientOrders().find((x) => x.id === o.id);
                            setDetail(fresh ?? o);
                          }}
                          className="rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 text-xs font-semibold text-ds-text shadow-ds transition hover:bg-ds-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
                        >
                          {t("client.orders.open")}
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detail ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-detail-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-ds-text/50"
            aria-label={t("common.close")}
            onClick={() => setDetail(null)}
          />
          <div className="relative flex max-h-[min(92vh,820px)] w-full max-w-2xl flex-col overflow-hidden rounded-ds-card border border-ds-border bg-ds-surface shadow-ds">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-ds-border px-4 py-3">
              <h2 id="order-detail-title" className="min-w-0 flex-1 text-base font-bold text-ds-text">
                {t("client.orders.detailTitle", { id: detail.id })}
              </h2>
              <div className="flex shrink-0 items-center gap-1">
                {detailTracking?.url ? (
                  <a
                    href={detailTracking.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={t("client.orders.trackingIconAria")}
                    aria-label={t("client.orders.trackingIconAria")}
                    className="inline-flex rounded-ds-btn border border-ds-primary/30 bg-ds-primary/10 p-2 text-ds-primary hover:bg-ds-primary/15"
                  >
                    <PackageSearch className="h-5 w-5" aria-hidden />
                  </a>
                ) : (
                  <button
                    type="button"
                    title={t("client.orders.tabTracking")}
                    aria-label={t("client.orders.tabTracking")}
                    onClick={() => setClientDetailTab("tracking")}
                    className="inline-flex rounded-ds-btn border border-ds-border bg-ds-bg p-2 text-ds-muted hover:bg-ds-surface hover:text-ds-primary"
                  >
                    <PackageSearch className="h-5 w-5" aria-hidden />
                  </button>
                )}
                <button
                  type="button"
                  className="rounded-ds-btn px-2 py-1 text-sm font-semibold text-ds-muted hover:bg-ds-bg"
                  onClick={() => setDetail(null)}
                >
                  {t("client.orders.close")}
                </button>
              </div>
            </div>

            <div className="flex shrink-0 gap-1 border-b border-ds-border px-2 pt-1" role="tablist" aria-label={t("admin.orders.detail.tabsAria")}>
              <button
                type="button"
                role="tab"
                aria-selected={clientDetailTab === "detail"}
                onClick={() => setClientDetailTab("detail")}
                className={cn(
                  "rounded-t-lg px-3 py-2 text-xs font-bold uppercase tracking-wide transition",
                  clientDetailTab === "detail"
                    ? "bg-ds-surface text-ds-text ring-1 ring-ds-border ring-b-ds-surface"
                    : "text-ds-muted hover:bg-ds-bg hover:text-ds-text",
                )}
              >
                {t("client.orders.tabDetail")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={clientDetailTab === "tracking"}
                onClick={() => setClientDetailTab("tracking")}
                className={cn(
                  "rounded-t-lg px-3 py-2 text-xs font-bold uppercase tracking-wide transition",
                  clientDetailTab === "tracking"
                    ? "bg-ds-surface text-ds-primary ring-1 ring-ds-border ring-b-ds-surface"
                    : "text-ds-muted hover:bg-ds-bg hover:text-ds-text",
                )}
              >
                {t("client.orders.tabTracking")}
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
              {clientDetailTab === "tracking" ? (
                <div className="space-y-4">
                  {detailLines.length ? (
                    <div className="rounded-ds-btn border border-ds-border bg-ds-bg/60 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-ds-muted">{t("client.orders.col.photo")}</p>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {detailLines.map((line, idx) => (
                          <li key={`${detail.id}-tk-${line.inventoryId}-${idx}`} className="flex items-center gap-2 rounded-ds-btn border border-ds-border bg-ds-surface px-2 py-1.5 pr-3 shadow-sm">
                            <OrderLineThumb line={line} size={44} zoomable />
                            <span className="max-w-[10rem] truncate text-xs font-medium text-ds-text" title={lineTitleForUi(line.title, t)}>
                              {lineTitleForUi(line.title, t)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <p className="text-xs leading-relaxed text-ds-muted">{t("client.orders.trackingIntro")}</p>
                  {userOrderIds.has(detail.id) ? (
                    <ManualTrackingForm order={detail} variant="client" orderPatchCtx={orderPatchCtx} t={t} />
                  ) : null}
                  {!resolvedShippingTracking(detail).trackingNumber && !detailTracking?.url ? (
                    <div className="rounded-ds-btn border border-dashed border-ds-border bg-ds-bg px-3 py-3 text-sm text-ds-muted">
                      {t("admin.orders.detail.trackingEmpty")}
                    </div>
                  ) : null}
                  {detailTracking?.url ? (
                    <div
                      className={cn(
                        "rounded-ds-btn border p-3",
                        detail.status === "concluido" && detail.opsShippedAtIso
                          ? "border-emerald-200 bg-emerald-50/90"
                          : "border-ds-border bg-ds-bg",
                      )}
                    >
                      {detail.status === "concluido" && detail.opsShippedAtIso ? (
                        <p className="text-xs font-semibold text-emerald-900">{t("admin.orders.detail.alreadyDone")}</p>
                      ) : null}
                      <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-ds-muted">{t("admin.orders.detail.trackingTitle")}</p>
                      <p className="mt-1 text-sm font-semibold text-ds-text">
                        {(detailTracking.carrierLabel ?? "—") +
                          (detailTracking.trackingNumber ? ` · ${detailTracking.trackingNumber}` : "")}
                      </p>
                      <a
                        href={detailTracking.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "mt-2 inline-flex rounded-ds-btn px-4 py-2 text-xs font-bold text-white shadow-ds",
                          detail.status === "concluido" && detail.opsShippedAtIso
                            ? "bg-emerald-700 hover:bg-emerald-800"
                            : "bg-ds-primary hover:opacity-95",
                        )}
                      >
                        {t("admin.orders.detail.trackingOpen")}
                      </a>
                    </div>
                  ) : null}
                  {resolvedShippingTracking(detail).trackingNumber ? (
                    <TrackingLiveStatusBlock order={detail} variant="client" orderPatchCtx={orderPatchCtx} t={t} />
                  ) : null}
                  {userOrderIds.has(detail.id) ? (
                    <DeliveryConfirmPanel
                      order={detail}
                      variant="client"
                      orderPatchCtx={orderPatchCtx}
                      t={t}
                      formatDateTime={(iso) => formatDateTimeLocale(iso, locale)}
                    />
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4">
              <OrderChecklistPanel order={detail} isUserOrder={userOrderIds.has(detail.id)} />
              {detail.status === "concluido" && detail.opsShippedAtIso ? (
                <div className="rounded-ds-btn border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs font-semibold text-emerald-900">
                  <p>{t("client.orders.shippedBanner")}</p>
                  <p className="mt-2 text-[11px] font-normal leading-relaxed text-emerald-950/90">
                    {t("client.orders.shippedBannerTrackingHint")}
                  </p>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">{t("admin.orders.col.status")}</p>
                  <p className="mt-1 font-medium text-ds-text">{labelStatus(detail.status, t)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">{t("admin.orders.col.shipping")}</p>
                  <p className="mt-1 font-medium text-ds-text">{serviceLabel(detail, t)}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">{t("admin.orders.detail.created")}</p>
                  <p className="mt-1 text-ds-text">{detail.createdLabel}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-ds-primary">{t("client.orders.linesTitle")}</p>
                <ul className="mt-3 space-y-3">
                  {detailLines.map((line) => (
                    <li
                      key={`${detail.id}-${line.inventoryId}-${line.asin}`}
                      className="flex gap-3 rounded-ds-btn border border-ds-border bg-ds-bg/50 p-3"
                    >
                      <OrderLineThumb line={line} size={56} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold leading-snug text-ds-text">{lineTitleForUi(line.title, t)}</p>
                        <p className="mt-1 text-xs text-ds-muted">
                          {t("admin.orders.asinPrefix")} {line.asin} · {t("admin.orders.col.qty")} {line.qty}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {detail.service === "FBA" ? (
                <div className="space-y-3 rounded-ds-btn border border-ds-border bg-ds-bg p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-ds-primary">FBA</p>
                  {detail.prepClientNotice || detail.prepLabelPrintIssue ? (
                    <div className="rounded-ds-btn border border-red-300/90 bg-red-50 px-3 py-2 text-xs font-medium text-red-950">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-red-900">{t("client.orders.prepAlertTitle")}</p>
                      {detail.prepClientNotice ? (
                        <p className="mt-1 whitespace-pre-wrap leading-relaxed">{detail.prepClientNotice}</p>
                      ) : null}
                      {detail.prepLabelPrintIssue ? (
                        <p className="mt-2 border-t border-red-200/80 pt-2 leading-relaxed">
                          <span className="font-bold">{t("client.orders.prepLabelIssuePrefix")}</span> {detail.prepLabelPrintIssue}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {detail.status === "em_producao" && !detail.fbaMasterBoxDims ? (
                    <div className="rounded-ds-btn border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950">
                      {t("client.orders.fbaDimsWaiting")}
                    </div>
                  ) : null}
                  {detail.fbaMasterBoxDims ? (
                    <div className="rounded-ds-btn border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-950">
                      {t("client.orders.fbaDimsReady", {
                        l: String(detail.fbaMasterBoxDims.lengthCm),
                        w: String(detail.fbaMasterBoxDims.widthCm),
                        h: String(detail.fbaMasterBoxDims.heightCm),
                        wt: String(detail.fbaMasterBoxDims.weightLb),
                        when: formatDateTimeLocale(detail.fbaMasterBoxDims!.recordedAtIso, locale),
                      })}
                    </div>
                  ) : null}
                  {detail.fbaFnskuLabels && detail.fbaFnskuLabels.length > 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        openDataUrlInNewWindow(
                          detail.fbaFnskuLabels![0]!.dataUrl,
                          detail.fbaFnskuLabels![0]!.name ?? "FNSKU",
                        )
                      }
                      className="font-semibold text-ds-primary underline"
                    >
                      {t("admin.orders.detail.openFnsku")} ({detail.fbaFnskuLabels.length})
                    </button>
                  ) : null}
                  {detail.fbaAmazonBoxLabel && detail.fbaCarrierLabel ? (
                    <div className="flex flex-col gap-2 text-xs">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            printDataUrlInNewWindow(
                              detail.fbaAmazonBoxLabel!.dataUrl,
                              detail.fbaAmazonBoxLabel!.name ?? "amazon-caixa.pdf",
                            )
                          }
                          className="rounded-ds-btn bg-ds-primary px-3 py-1.5 text-[11px] font-bold text-white shadow-ds hover:opacity-95"
                        >
                          {t("admin.orders.detail.printAmazon")}
                        </button>
                        <button
                          type="button"
                          onClick={() => saveDataUrlFile(detail.fbaAmazonBoxLabel!.dataUrl, detail.fbaAmazonBoxLabel!.name ?? "amazon-caixa.pdf")}
                          className="rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-1.5 text-[11px] font-semibold text-ds-primary shadow-ds hover:bg-ds-bg"
                        >
                          {t("admin.orders.detail.labelSave")}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            printDataUrlInNewWindow(detail.fbaCarrierLabel!.dataUrl, detail.fbaCarrierLabel!.name ?? "transportadora.pdf")
                          }
                          className="rounded-ds-btn bg-ds-primary px-3 py-1.5 text-[11px] font-bold text-white shadow-ds hover:opacity-95"
                        >
                          {t("admin.orders.detail.printCarrier")}
                        </button>
                        <button
                          type="button"
                          onClick={() => saveDataUrlFile(detail.fbaCarrierLabel!.dataUrl, detail.fbaCarrierLabel!.name ?? "transportadora.pdf")}
                          className="rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-1.5 text-[11px] font-semibold text-ds-primary shadow-ds hover:bg-ds-bg"
                        >
                          {t("admin.orders.detail.labelSave")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <Link
                      to={`/app/pedidos/${detail.id}/fba-caixa-master`}
                      className="inline-block font-semibold text-ds-primary underline-offset-2 hover:underline"
                      onClick={() => setDetail(null)}
                    >
                      {t("client.orders.completeBoxLabels")}
                    </Link>
                  )}
                  <FbaPrepPlanPanel order={detail} variant="client" />
                  <FbaPrepPlanMissingNote order={detail} />
                </div>
              ) : detail.service === "INTL_ML" &&
                detail.intlMlAmericasLabelDataUrl?.trim() &&
                detail.intlMlCarrierLabelDataUrl?.trim() ? (
                <div className="space-y-3 rounded-ds-btn border border-ds-border bg-ds-bg p-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">
                      {t("admin.orders.detail.intlMlAmericasTitle")}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          printDataUrlInNewWindow(
                            detail.intlMlAmericasLabelDataUrl!,
                            detail.intlMlAmericasLabelFileName ?? "mercado-livre-americas.pdf",
                          )
                        }
                        className="rounded-ds-btn bg-ds-primary px-4 py-2 text-xs font-bold text-white shadow-ds hover:opacity-95"
                      >
                        {t("client.orders.printLabel")}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          saveDataUrlFile(
                            detail.intlMlAmericasLabelDataUrl!,
                            detail.intlMlAmericasLabelFileName?.trim() || "mercado-livre-americas.pdf",
                          )
                        }
                        className="rounded-ds-btn border border-ds-border bg-ds-surface px-4 py-2 text-xs font-semibold text-ds-primary shadow-ds hover:bg-ds-bg"
                      >
                        {t("admin.orders.detail.labelSave")}
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">
                      {t("admin.orders.detail.intlMlCarrierTitle")}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          printDataUrlInNewWindow(
                            detail.intlMlCarrierLabelDataUrl!,
                            detail.intlMlCarrierLabelFileName ?? "transportadora.pdf",
                          )
                        }
                        className="rounded-ds-btn bg-ds-primary px-4 py-2 text-xs font-bold text-white shadow-ds hover:opacity-95"
                      >
                        {t("client.orders.printLabel")}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          saveDataUrlFile(
                            detail.intlMlCarrierLabelDataUrl!,
                            detail.intlMlCarrierLabelFileName?.trim() || "transportadora.pdf",
                          )
                        }
                        className="rounded-ds-btn border border-ds-border bg-ds-surface px-4 py-2 text-xs font-semibold text-ds-primary shadow-ds hover:bg-ds-bg"
                      >
                        {t("admin.orders.detail.labelSave")}
                      </button>
                    </div>
                  </div>
                </div>
              ) : detail.shippingLabelDataUrl ? (
                <div className="rounded-ds-btn border border-ds-border bg-ds-bg p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">{t("admin.orders.col.label")}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => printShipping(detail)}
                      className="rounded-ds-btn bg-ds-primary px-4 py-2 text-xs font-bold text-white shadow-ds hover:opacity-95"
                    >
                      {t("client.orders.printLabel")}
                    </button>
                    <button
                      type="button"
                      onClick={() => saveShippingLabel(detail)}
                      className="rounded-ds-btn border border-ds-border bg-ds-surface px-4 py-2 text-xs font-semibold text-ds-primary shadow-ds hover:bg-ds-bg"
                    >
                      {t("admin.orders.detail.labelSave")}
                    </button>
                  </div>
                </div>
              ) : null}

              {userOrderIds.has(detail.id) && orderNeedsClientAdjust(detail) ? (
                <div className="rounded-ds-btn border border-ds-primary/35 bg-ds-soft-violet/25 p-3 text-xs text-ds-text shadow-ds">
                  <p className="font-bold uppercase tracking-wide text-ds-primary">{t("client.orders.adjustHeading")}</p>
                  <p className="mt-2 leading-relaxed text-ds-text">{t("client.orders.adjustBlurb")}</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {detail.service === "FBA" ? (
                      <Link
                        to={`/app/pedidos/${detail.id}/fba-caixa-master`}
                        onClick={() => setDetail(null)}
                        className="inline-flex flex-1 items-center justify-center rounded-ds-btn bg-ds-primary px-3 py-2.5 text-center text-sm font-bold text-white shadow-ds hover:opacity-95"
                      >
                        {t("client.orders.adjustButtonFba")}
                      </Link>
                    ) : null}
                    <Link
                      to="/app/suporte"
                      onClick={() => setDetail(null)}
                      className="inline-flex flex-1 items-center justify-center rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2.5 text-center text-sm font-bold text-ds-primary shadow-ds hover:bg-ds-bg"
                    >
                      {t("client.orders.adjustSupportCta")}
                    </Link>
                  </div>
                </div>
              ) : null}

              {canCancelOrder(detail) ? (
                <div
                  className={
                    orderNeedsClientAdjust(detail)
                      ? "rounded-ds-btn border border-ds-border bg-ds-bg p-3 text-xs text-ds-muted"
                      : "rounded-ds-btn border border-ds-error/25 bg-red-50/90 p-3 text-xs text-ds-text"
                  }
                >
                  <p className={orderNeedsClientAdjust(detail) ? "font-semibold text-ds-text" : "font-semibold text-ds-error"}>
                    {orderNeedsClientAdjust(detail) ? t("client.orders.cancelSecondaryHeading") : t("client.orders.cancelHeading")}
                  </p>
                  <p className="mt-2 leading-relaxed">
                    {orderNeedsClientAdjust(detail)
                      ? t("client.orders.cancelSecondaryBlurb", { time: cancelTimeRemainingLabel(detail) })
                      : t("client.orders.cancelBlurb", { time: cancelTimeRemainingLabel(detail) })}
                  </p>
                  <button
                    type="button"
                    onClick={() => void requestCancelOrder(detail)}
                    className={
                      orderNeedsClientAdjust(detail)
                        ? "mt-3 w-full rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 text-sm font-bold text-ds-text shadow-ds hover:bg-white"
                        : "mt-3 w-full rounded-ds-btn border border-ds-error/40 bg-white px-3 py-2 text-sm font-bold text-ds-error shadow-ds hover:bg-red-50"
                    }
                  >
                    {t("client.orders.cancelButton")}
                  </button>
                </div>
              ) : userOrderIds.has(detail.id) &&
                (detail.status === "em_fila" || detail.status === "aguardando_cliente") &&
                !detail.createdAtIso ? (
                <p className="rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-2 text-xs text-ds-muted">
                  {t("client.orders.cancelNoIso")}
                </p>
              ) : userOrderIds.has(detail.id) &&
                (detail.status === "em_fila" || detail.status === "aguardando_cliente") &&
                !withinCancelWindow(detail) ? (
                <p className="rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-2 text-xs text-ds-muted">
                  {t("client.orders.cancelExpired")}
                </p>
              ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
