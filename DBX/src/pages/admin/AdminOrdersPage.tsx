import { Fragment, useEffect, useMemo, useState } from "react";
import { PackageSearch } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { TrackingLiveStatusBlock } from "../../components/TrackingLiveStatusBlock";
import { DeliveryConfirmPanel, ManualTrackingForm } from "../../components/ManualTrackingForm";
import { OrderLineThumb } from "../../components/OrderLineThumb";
import { useI18n } from "../../i18n/context";
import { mockAdminNewOrders } from "../../mock/data";
import type { AppLocale } from "../../i18n/catalog";
import type { AdminOrderRow, ClientOrder, ClientOrderShipmentLine, InventoryRow } from "../../types";
import { adminClientOrderServiceLabel as adminServiceLabel, adminClientOrderStatusLabel as orderStatusLabel } from "../../lib/adminClientOrderLabels";
import { PageHeader } from "../../ui/PageHeader";
import { FbaPrepPlanMissingNote, FbaPrepPlanPanel } from "../../ui/FbaPrepPlanPanel";
import { hasFbaBoxPlan } from "../../lib/fbaOrderPlan";
import { getMergedInventoryView, INVENTORY_UPDATED_EVENT } from "../../lib/clientInventoryStorage";
import {
  loadAddedClientOrders,
  ORDERS_UPDATED_EVENT,
  pullAdminClientOrdersFromServer,
  updateClientOrder,
  type OrderPatchContext,
} from "../../lib/clientOrdersStorage";
import { resolveLabelTrackingMatch } from "../../lib/requestShippingLabelParse";
import { resolvedShippingTracking } from "../../lib/orderTrackingDisplay";
import { isDeliveryOrder } from "../../lib/deliveryOrder";
import { enrichShipmentLinesWithInventory, shipmentLinesForOrder } from "../../lib/orderShipmentLines";
import { lineTitleForUi } from "../../lib/orderUi";
import { formatPrepCountdown, prepDispatchDeadlineMs, prepRuleForOrder } from "../../lib/adminPrepDeadline";
import { decodeHtmlEntities } from "../../lib/decodeHtmlEntities";
import { openDataUrlInNewWindow, printDataUrlInNewWindow } from "../../lib/printDataUrl";
import { postAcceptProduction, postNotifyShipped, postPrepKitDeliver } from "../../lib/adminOrderOpsApi";
import { pullInventoryFromServer } from "../../lib/clientInventoryStorage";

const ADMIN_ORDER_TABLE_COLS = 10;
const ADMIN_ORDER_PATCH_CTX: OrderPatchContext = { role: "admin" };

function PrepShippingBlock({
  order,
  nowMs,
  t,
}: {
  order: ClientOrder;
  nowMs: number;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  const done = order.status === "concluido";
  const track = resolvedShippingTracking(order);
  const serviceEl = (
    <span className="inline-flex min-w-0 max-w-full whitespace-normal break-words rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-[10px] font-semibold leading-snug text-zinc-800 sm:text-[11px]">
      {adminServiceLabel(order, t)}
    </span>
  );
  if (done) {
    return (
      <div className="flex min-w-0 w-full max-w-full flex-col gap-1">
        {serviceEl}
        {track.url ? (
          <a
            href={track.url}
            target="_blank"
            rel="noopener noreferrer"
            title={t("admin.orders.detail.trackingOpen")}
            aria-label={t("admin.orders.detail.trackingOpen")}
            className="inline-flex w-fit rounded-lg border border-teal-200 bg-white p-1.5 text-teal-700 hover:bg-teal-50"
            onClick={(e) => e.stopPropagation()}
          >
            <PackageSearch className="h-3.5 w-3.5" aria-hidden />
          </a>
        ) : null}
      </div>
    );
  }

  const deadline = prepDispatchDeadlineMs(order);
  const rule = prepRuleForOrder(order);
  const cd = formatPrepCountdown(deadline, nowMs, t);
  const tone = cd.late ? "text-rose-700" : cd.warn ? "text-amber-800" : "text-emerald-800";

  return (
    <div className="flex min-w-0 w-full max-w-full flex-col gap-1">
      {serviceEl}
      <p className="break-words text-[10px] font-bold uppercase leading-tight tracking-wide text-zinc-500">
        {t(`admin.orders.prepPolicy.${rule}`)}
      </p>
      <p className={`break-words text-[10px] font-bold tabular-nums leading-tight ${tone}`}>{cd.text}</p>
    </div>
  );
}

type UnifiedRow =
  | { source: "client"; order: ClientOrder }
  | { source: "mock"; order: AdminOrderRow };

function formatDateTimeLocale(ms: number, locale: AppLocale): string {
  const tag = locale === "pt-BR" ? "pt-BR" : locale === "es" ? "es" : "en-US";
  return new Intl.DateTimeFormat(tag, { dateStyle: "short", timeStyle: "short" }).format(new Date(ms));
}

function AdminOrderDetailModal({
  order,
  lines,
  onClose,
  nowMs,
  locale,
  t,
  onOrderUpdated,
}: {
  order: ClientOrder;
  lines: ClientOrderShipmentLine[];
  onClose: () => void;
  nowMs: number;
  locale: AppLocale;
  t: (k: string, v?: Record<string, string | number>) => string;
  onOrderUpdated?: (order: ClientOrder) => void;
}) {
  const [detailTab, setDetailTab] = useState<"summary" | "tracking">("summary");
  const [prepNotice, setPrepNotice] = useState(() => order.prepClientNotice ?? "");
  const [prepLabelIssue, setPrepLabelIssue] = useState(() => order.prepLabelPrintIssue ?? "");
  const [prepKitOutLines, setPrepKitOutLines] = useState(() => [{ id: "", title: "", qty: "1" }]);
  const [prepKitDelivering, setPrepKitDelivering] = useState(false);
  const done = order.status === "concluido" && Boolean(order.opsShippedAtIso);
  const orderTracking = useMemo(() => resolvedShippingTracking(order), [
    order.id,
    order.shippingTrackingUrl,
    order.shippingTrackingNumber,
    order.shippingTrackingCarrierId,
    order.shippingTrackingCarrierLabel,
  ]);
  const totalUnits = useMemo(
    () => lines.reduce((acc, l) => acc + (Number.isFinite(l.qty) ? l.qty : 0), 0),
    [lines],
  );

  const d0 = order.fbaMasterBoxDims;
  const [lenCm, setLenCm] = useState(() => (d0 ? String(d0.lengthCm) : ""));
  const [widCm, setWidCm] = useState(() => (d0 ? String(d0.widthCm) : ""));
  const [heiCm, setHeiCm] = useState(() => (d0 ? String(d0.heightCm) : ""));
  const [wtLb, setWtLb] = useState(() => (d0 ? String(d0.weightLb) : ""));
  useEffect(() => {
    const d = order.fbaMasterBoxDims;
    setLenCm(d ? String(d.lengthCm) : "");
    setWidCm(d ? String(d.widthCm) : "");
    setHeiCm(d ? String(d.heightCm) : "");
    setWtLb(d ? String(d.weightLb) : "");
  }, [
    order.id,
    order.fbaMasterBoxDims?.lengthCm,
    order.fbaMasterBoxDims?.widthCm,
    order.fbaMasterBoxDims?.heightCm,
    order.fbaMasterBoxDims?.weightLb,
    order.fbaMasterBoxDims?.recordedAtIso,
  ]);

  const saveClientPrepNotices = async () => {
    const ok = await updateClientOrder(
      order.id,
      {
        prepClientNotice: prepNotice.trim() ? prepNotice.trim() : (null as unknown as string | undefined),
        prepLabelPrintIssue: prepLabelIssue.trim() ? prepLabelIssue.trim() : (null as unknown as string | undefined),
      } as Partial<ClientOrder>,
      ADMIN_ORDER_PATCH_CTX,
    );
    if (!ok) toast.error(t("common.errorUpdate"));
    else toast.success(t("admin.orders.detail.clientAlertsSaved"));
  };

  const markNoClientActionNeeded = async () => {
    setPrepNotice("");
    setPrepLabelIssue("");
    const ok = await updateClientOrder(
      order.id,
      {
        prepClientNotice: null as unknown as string | undefined,
        prepLabelPrintIssue: null as unknown as string | undefined,
      } as Partial<ClientOrder>,
      ADMIN_ORDER_PATCH_CTX,
    );
    if (!ok) toast.error(t("common.errorUpdate"));
    else toast.success(t("admin.orders.detail.clientAlertsNoActionOk"));
  };

  const moveOrderToAwaitingClient = async () => {
    if (order.status === "aguardando_cliente") return;
    if (order.service === "FBA" && !order.fbaMasterBoxDims) {
      toast.error(t("admin.orders.detail.awaitingNeedsBoxDims"));
      return;
    }
    if (!window.confirm(t("admin.orders.detail.confirmAwaitingClient"))) return;
    const ok = await updateClientOrder(order.id, { status: "aguardando_cliente" }, ADMIN_ORDER_PATCH_CTX);
    if (!ok) toast.error(t("common.errorUpdate"));
    else toast.success(t("admin.orders.detail.awaitingClientToast"));
  };

  const saveFbaBoxDims = async () => {
    const parse = (s: string) => Number(String(s).replace(",", ".").trim());
    const l = parse(lenCm);
    const w = parse(widCm);
    const h = parse(heiCm);
    const wt = parse(wtLb);
    if (![l, w, h, wt].every((n) => Number.isFinite(n) && n > 0)) {
      toast.error(t("admin.orders.detail.boxDimsInvalid"));
      return;
    }
    const dims = {
      lengthCm: Math.round(l * 10) / 10,
      widthCm: Math.round(w * 10) / 10,
      heightCm: Math.round(h * 10) / 10,
      weightLb: Math.round(wt * 100) / 100,
      recordedAtIso: new Date().toISOString(),
    };
    const patch: Partial<ClientOrder> = { fbaMasterBoxDims: dims };
    const movesToAwaitingTab = order.service === "FBA" && order.status === "em_producao";
    if (movesToAwaitingTab) {
      patch.status = "aguardando_cliente";
    }
    const ok = await updateClientOrder(order.id, patch, ADMIN_ORDER_PATCH_CTX);
    if (!ok) {
      toast.error(t("common.errorUpdate"));
      return;
    }
    const fresh = loadAddedClientOrders().find((o) => o.id === order.id);
    if (fresh) onOrderUpdated?.(fresh);
    void pullAdminClientOrdersFromServer();
    toast.success(
      movesToAwaitingTab ? t("admin.orders.detail.boxDimsSavedFbaAwaiting") : t("admin.orders.detail.boxDimsSaved"),
    );
  };

  const acceptProduction = async () => {
    if (!window.confirm(t("admin.orders.detail.confirmAcceptProduction"))) return;
    const acceptedAtIso = new Date().toISOString();
    const ok = await updateClientOrder(
      order.id,
      {
        status: "em_producao",
        opsAcceptedAtIso: acceptedAtIso,
      },
      ADMIN_ORDER_PATCH_CTX,
    );
    if (!ok) {
      toast.error(t("common.errorUpdate"));
      return;
    }
    const log = await postAcceptProduction({
      orderId: order.id,
      suite: order.suite,
      clientName: order.clientName,
      acceptedAtIso,
    });
    if (!log.ok) {
      toast.message(t("admin.orders.detail.acceptedToast"), {
        description: t("admin.orders.detail.opsLogWarn"),
      });
    } else {
      toast.success(t("admin.orders.detail.acceptedToast"));
    }
  };

  const deliverPrepKit = async () => {
    if (order.service !== "PREP_KIT" || order.status !== "em_producao") return;
    const outs = prepKitOutLines
      .map((l) => ({
        id: l.id.trim().toUpperCase(),
        title: l.title.trim(),
        qty: Math.floor(Number(l.qty) || 0),
      }))
      .filter((l) => l.id.length >= 2 && l.title.length >= 2 && l.qty >= 1);
    if (!outs.length) {
      toast.error(t("admin.orders.prepKit.outputsInvalid"));
      return;
    }
    if (!window.confirm(t("admin.orders.prepKit.confirmDeliver"))) return;
    setPrepKitDelivering(true);
    const r = await postPrepKitDeliver(order.id, outs);
    setPrepKitDelivering(false);
    if (!r.ok) {
      toast.error(r.error ?? t("common.errorUpdate"));
      return;
    }
    await pullAdminClientOrdersFromServer();
    await pullInventoryFromServer();
    window.dispatchEvent(new CustomEvent(ORDERS_UPDATED_EVENT));
    window.dispatchEvent(new CustomEvent(INVENTORY_UPDATED_EVENT));
    if (r.order && typeof r.order === "object") {
      onOrderUpdated?.(r.order as ClientOrder);
    }
    const shippedAtIso = new Date().toISOString();
    void postNotifyShipped({
      orderId: order.id,
      suite: order.suite,
      clientName: order.clientName,
      service: "PREP_KIT",
      units: outs.reduce((a, x) => a + x.qty, 0),
      productSummary: outs.map((x) => `${x.title} ×${x.qty}`).join("; "),
      shippedAtIso,
    });
    toast.success(t("admin.orders.prepKit.deliverOk"));
  };

  const finalize = async () => {
    const canFinalize =
      order.status === "em_producao" ||
      (order.service === "FBA" && order.status === "aguardando_cliente" && Boolean(order.fbaMasterBoxDims));
    if (!canFinalize) {
      toast.error(t("admin.orders.detail.finalizeNeedsProduction"));
      return;
    }
    if (order.service === "PREP_KIT") {
      toast.error(t("admin.orders.prepKit.useDeliverButton"));
      return;
    }
    if (order.service === "FBA" && !order.fbaMasterBoxDims) {
      toast.error(t("admin.orders.detail.finalizeNeedsBoxDims"));
      return;
    }
    if (!window.confirm(t("admin.orders.detail.confirmFinalize"))) return;
    const shippedAtIso = new Date().toISOString();
    const ok = await updateClientOrder(
      order.id,
      {
        status: "concluido",
        opsShippedAtIso: shippedAtIso,
      },
      ADMIN_ORDER_PATCH_CTX,
    );
    if (!ok) {
      toast.error(t("common.errorUpdate"));
      return;
    }
    const fresh = loadAddedClientOrders().find((o) => o.id === order.id) ?? order;
    const track = resolvedShippingTracking(fresh);
    const productSummary = lines.map((l) => `${l.title} ×${l.qty}`).join("; ");
    const emailRes = await postNotifyShipped({
      orderId: order.id,
      suite: order.suite,
      clientName: order.clientName,
      service: order.service,
      units: totalUnits,
      productSummary,
      trackingUrl: track.url,
      shippedAtIso,
    });
    if (track.url) {
      window.open(track.url, "_blank", "noopener,noreferrer");
    }
    if (emailRes.ok) {
      toast.success(t("admin.orders.detail.finalizedWithEmailToast"));
    } else {
      toast.message(t("admin.orders.detail.finalizedToast"), {
        description: t("admin.orders.detail.emailQueueFailed"),
      });
    }
    onClose();
  };

  const printFnsku = () => {
    const u = order.fbaFnskuLabels?.[0]?.dataUrl;
    if (u) printDataUrlInNewWindow(u, order.fbaFnskuLabels![0]!.name ?? "FNSKU");
  };
  const printAmazon = () => {
    if (order.fbaAmazonBoxLabel?.dataUrl) printDataUrlInNewWindow(order.fbaAmazonBoxLabel.dataUrl, order.fbaAmazonBoxLabel.name);
  };
  const printCarrier = () => {
    if (order.fbaCarrierLabel?.dataUrl) printDataUrlInNewWindow(order.fbaCarrierLabel.dataUrl, order.fbaCarrierLabel.name);
  };
  const printShipping = () => {
    if (order.shippingLabelDataUrl) printDataUrlInNewWindow(order.shippingLabelDataUrl, order.shippingLabelFileName ?? "label");
  };

  const saveShippingLabel = () => {
    const u = order.shippingLabelDataUrl;
    if (!u) return;
    const name = order.shippingLabelFileName?.trim() || "etiqueta-envio.pdf";
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

  const prepSlaUi = useMemo(() => {
    if (order.status === "concluido") return null;
    const deadline = prepDispatchDeadlineMs(order);
    const cd = formatPrepCountdown(deadline, nowMs, t);
    return { deadline, cd, rule: prepRuleForOrder(order) };
  }, [order.id, order.status, order.service, order.createdAtIso, order.createdLabel, nowMs, t]);

  useEffect(() => {
    const r = resolvedShippingTracking(order);
    if (r.url && !order.shippingTrackingUrl?.trim() && order.shippingTrackingCarrierId && order.shippingTrackingNumber) {
      void updateClientOrder(order.id, { shippingTrackingUrl: r.url }, ADMIN_ORDER_PATCH_CTX);
    }
  }, [order.id, order.shippingTrackingUrl, order.shippingTrackingCarrierId, order.shippingTrackingNumber]);

  useEffect(() => {
    let alive = true;
    const intlMlCarrierPdf =
      order.service === "INTL_ML" &&
      order.intlMlCarrierLabelDataUrl?.trim() &&
      order.intlMlAmericasLabelDataUrl?.trim()
        ? order.intlMlCarrierLabelDataUrl
        : null;
    const pdf =
      order.service === "FBA"
        ? order.fbaCarrierLabel?.dataUrl ?? order.shippingLabelDataUrl
        : intlMlCarrierPdf ?? order.shippingLabelDataUrl;
    const labelFileName =
      order.service === "FBA" && order.fbaCarrierLabel != null && order.fbaCarrierLabel.dataUrl === pdf
        ? order.fbaCarrierLabel.name
        : order.service === "INTL_ML" && intlMlCarrierPdf
          ? order.intlMlCarrierLabelFileName
          : order.shippingLabelFileName;
    if (!pdf?.startsWith("data:application/pdf") || resolvedShippingTracking(order).url) return;
    void (async () => {
      const r = await resolveLabelTrackingMatch(pdf, labelFileName);
      if (!alive || !r.ok || !r.match) return;
      void updateClientOrder(
        order.id,
        {
          shippingTrackingCarrierId: r.match.carrierId,
          shippingTrackingCarrierLabel: r.match.carrierLabel,
          shippingTrackingNumber: r.match.tracking,
          shippingTrackingUrl: r.match.trackingUrl,
        },
        ADMIN_ORDER_PATCH_CTX,
      );
    })();
    return () => {
      alive = false;
    };
  }, [
    order.id,
    order.service,
    order.shippingLabelDataUrl,
    order.shippingLabelFileName,
    order.intlMlCarrierLabelDataUrl,
    order.intlMlCarrierLabelFileName,
    order.intlMlAmericasLabelDataUrl,
    order.fbaCarrierLabel?.dataUrl,
    order.fbaCarrierLabel?.name,
    order.shippingTrackingNumber,
    order.shippingTrackingUrl,
    order.shippingTrackingCarrierId,
  ]);

  useEffect(() => {
    setDetailTab("summary");
  }, [order.id]);

  useEffect(() => {
    setPrepNotice(order.prepClientNotice ?? "");
    setPrepLabelIssue(order.prepLabelPrintIssue ?? "");
  }, [order.id, order.prepClientNotice, order.prepLabelPrintIssue]);

  useEffect(() => {
    setPrepKitOutLines([{ id: "", title: "", qty: "1" }]);
  }, [order.id]);

  const trackingTabHasLink = Boolean(orderTracking.url);
  const formatOrderIso = (iso: string) => {
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return iso;
    return formatDateTimeLocale(ms, locale);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-zinc-900/50" aria-label={t("common.close")} onClick={onClose} />
      <div className="relative flex max-h-[min(92vh,880px)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-zinc-900">{t("admin.orders.detail.title", { id: order.id })}</h2>
            <p className="mt-1 text-xs text-zinc-500">{t("admin.orders.detail.subtitle")}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {trackingTabHasLink ? (
              <a
                href={orderTracking.url}
                target="_blank"
                rel="noopener noreferrer"
                title={t("admin.orders.detail.trackingOpen")}
                aria-label={t("admin.orders.detail.trackingOpen")}
                className="rounded-xl p-2 text-teal-700 hover:bg-teal-50"
              >
                <PackageSearch className="h-5 w-5" aria-hidden />
              </a>
            ) : null}
            <button type="button" className="rounded-xl px-3 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100" onClick={onClose}>
              {t("common.close")}
            </button>
          </div>
        </div>

        <div className="flex shrink-0 gap-1 border-b border-zinc-100 px-3 pt-1" role="tablist" aria-label={t("admin.orders.detail.tabsAria")}>
          <button
            type="button"
            role="tab"
            aria-selected={detailTab === "summary"}
            onClick={() => setDetailTab("summary")}
            className={`rounded-t-lg px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
              detailTab === "summary"
                ? "bg-white text-zinc-900 ring-1 ring-zinc-200 ring-b-white"
                : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
            }`}
          >
            {t("admin.orders.detail.tabSummary")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={detailTab === "tracking"}
            onClick={() => setDetailTab("tracking")}
            className={`rounded-t-lg px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
              detailTab === "tracking"
                ? "bg-white text-teal-900 ring-1 ring-zinc-200 ring-b-white"
                : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
            }`}
          >
            {t("admin.orders.detail.tabTracking")}
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 text-sm">
          {detailTab === "summary" ? (
            <>
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-950">{t("admin.orders.detail.opsTitle")}</p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs font-medium leading-relaxed text-amber-950/95">
              <li>{t("admin.orders.detail.opsStep1")}</li>
              <li>{t("admin.orders.detail.opsStep2")}</li>
              <li>{t("admin.orders.detail.opsStep3")}</li>
              <li>{t("admin.orders.detail.opsStep4")}</li>
            </ol>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{t("admin.orders.detail.packTitle")}</p>
            <p className="mt-2 text-sm font-semibold text-zinc-900">
              {t("admin.orders.detail.packSummary", { lines: lines.length, units: totalUnits })}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600">{t("admin.orders.detail.packHint")}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t("admin.orders.detail.client")}</p>
              <p className="mt-1 font-medium text-zinc-900">{order.clientName ?? "—"}</p>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t("admin.orders.detail.suite")}</p>
              <p className="mt-1 font-mono font-semibold text-zinc-900">{order.suite ?? "—"}</p>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t("admin.orders.detail.service")}</p>
              <p className="mt-1 font-medium text-zinc-900">{adminServiceLabel(order, t)}</p>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t("admin.orders.detail.status")}</p>
              <p className="mt-1 font-medium text-zinc-900">{orderStatusLabel(order.status, t)}</p>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-3 sm:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t("admin.orders.detail.created")}</p>
              <p className="mt-1 text-zinc-800">{order.createdLabel}</p>
            </div>
            {order.opsAcceptedAtIso ? (
              <div className="rounded-2xl border border-teal-100 bg-teal-50/50 p-3 sm:col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-800">
                  {t("admin.orders.detail.acceptedAt")}
                </p>
                <p className="mt-1 font-medium text-teal-950">{formatOrderIso(order.opsAcceptedAtIso)}</p>
              </div>
            ) : null}
          </div>

          {order.service === "PREP_KIT" && order.prepKitWork ? (
            <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-violet-900">{t("admin.orders.prepKit.briefTitle")}</p>
              <p className="mt-1 text-xs font-semibold text-violet-950">
                {t(`admin.orders.prepKit.workType.${order.prepKitWork.workType ?? "custom"}`)}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-900">{order.prepKitWork.instructions}</p>
              {order.prepKitWork.outputsRequested?.trim() ? (
                <p className="mt-3 text-xs text-zinc-700">
                  <span className="font-bold text-zinc-900">{t("admin.orders.prepKit.outputsRequested")}</span>{" "}
                  {order.prepKitWork.outputsRequested.trim()}
                </p>
              ) : null}
              {order.prepKitWork.outputsDelivered?.length ? (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-950">
                  <p className="font-bold uppercase tracking-wide">{t("admin.orders.prepKit.deliveredTitle")}</p>
                  <ul className="mt-2 list-inside list-disc space-y-1">
                    {order.prepKitWork.outputsDelivered.map((x) => (
                      <li key={x.id}>
                        <span className="font-mono font-semibold">{x.id}</span> — {x.title} ×{x.qty}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {done ? (
            <p className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2 text-xs font-medium text-emerald-900">
              {orderTracking.url ? t("admin.orders.detail.doneSeeTrackingTab") : t("admin.orders.detail.alreadyDone")}
            </p>
          ) : null}

          {prepSlaUi ? (
            <div className="rounded-2xl border border-teal-100 bg-teal-50/40 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-teal-900">{t("admin.orders.detail.prepSlaTitle")}</p>
              <p className="mt-1 text-xs font-semibold text-teal-950">{t(`admin.orders.prepPolicy.${prepSlaUi.rule}`)}</p>
              <p className="mt-2 text-sm font-bold tabular-nums text-teal-950">
                {t("admin.orders.detail.prepSlaUntil", {
                  datetime: formatDateTimeLocale(prepSlaUi.deadline, locale),
                })}
              </p>
              <p className={`mt-1 text-sm font-bold tabular-nums ${prepSlaUi.cd.late ? "text-rose-700" : "text-teal-900"}`}>
                {prepSlaUi.cd.text}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-teal-900/85">{t("admin.orders.detail.prepSlaHint")}</p>
            </div>
          ) : null}

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">{t("admin.orders.detail.lines")}</p>
            <ul className="mt-3 space-y-3">
              {lines.map((line) => (
                <li key={`${line.inventoryId}-${line.asin}-${line.title}`} className="flex gap-3 rounded-2xl border border-zinc-100 p-3">
                  <OrderLineThumb line={line} size={56} zoomable />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug text-zinc-900">{lineTitleForUi(line.title, t)}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {t("admin.orders.asinPrefix")} {line.asin} · {t("admin.orders.col.qty")} {line.qty}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {!done ? (
            <div className="space-y-3 rounded-2xl border-2 border-red-200 bg-red-50/50 p-4">
              <p className="text-xs font-bold uppercase text-red-950">{t("admin.orders.detail.clientAlertsTitle")}</p>
              <p className="text-[11px] leading-relaxed text-red-900/90">{t("admin.orders.detail.clientAlertsHint")}</p>
              <label className="block text-[11px] font-semibold text-red-950">
                {t("admin.orders.detail.clientAlertsNotice")}
                <textarea
                  value={prepNotice}
                  onChange={(e) => setPrepNotice(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-red-200 bg-white px-2 py-1.5 text-sm text-zinc-900"
                  placeholder={t("admin.orders.detail.clientAlertsNoticePh")}
                />
              </label>
              <label className="block text-[11px] font-semibold text-red-950">
                {t("admin.orders.detail.clientAlertsLabels")}
                <textarea
                  value={prepLabelIssue}
                  onChange={(e) => setPrepLabelIssue(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-red-200 bg-white px-2 py-1.5 text-sm text-zinc-900"
                  placeholder={t("admin.orders.detail.clientAlertsLabelsPh")}
                />
              </label>
              <button
                type="button"
                onClick={() => void markNoClientActionNeeded()}
                className="w-full rounded-xl border-2 border-emerald-500 bg-emerald-50 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-emerald-950 hover:bg-emerald-100"
              >
                {t("admin.orders.detail.clientAlertsNoAction")}
              </button>
              <button
                type="button"
                onClick={() => void saveClientPrepNotices()}
                className="w-full rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-800"
              >
                {t("admin.orders.detail.clientAlertsSave")}
              </button>
              {order.status === "em_producao" || order.status === "em_fila" ? (
                <button
                  type="button"
                  onClick={() => void moveOrderToAwaitingClient()}
                  className="w-full rounded-xl border border-red-400 bg-white px-4 py-2.5 text-sm font-bold text-red-900 hover:bg-red-100"
                >
                  {t("admin.orders.detail.moveToAwaitingClient")}
                </button>
              ) : null}
            </div>
          ) : null}

          {order.service === "FBA" ? (
            <div className="space-y-2 rounded-2xl border border-teal-100 bg-teal-50/40 p-4">
              <p className="text-xs font-bold uppercase text-teal-900">FBA</p>
              <div className="flex flex-wrap gap-2">
                {order.fbaFnskuLabels?.[0]?.dataUrl ? (
                  <>
                    <button
                      type="button"
                      onClick={printFnsku}
                      className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-teal-800 ring-1 ring-teal-200 hover:bg-teal-50"
                    >
                      {t("admin.orders.detail.printFnsku")}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        openDataUrlInNewWindow(order.fbaFnskuLabels![0]!.dataUrl, order.fbaFnskuLabels![0]!.name ?? "FNSKU")
                      }
                      className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-teal-800 ring-1 ring-teal-200 hover:bg-teal-50"
                    >
                      {t("admin.orders.detail.openFnsku")}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        saveDataUrlFile(
                          order.fbaFnskuLabels![0]!.dataUrl,
                          order.fbaFnskuLabels![0]!.name ?? "fnsku.pdf",
                        )
                      }
                      className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-bold text-zinc-800 hover:bg-zinc-50"
                    >
                      {t("admin.orders.detail.labelSave")}
                    </button>
                  </>
                ) : null}
                {order.fbaAmazonBoxLabel?.dataUrl ? (
                  <>
                    <button
                      type="button"
                      onClick={printAmazon}
                      className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-teal-800 ring-1 ring-teal-200 hover:bg-teal-50"
                    >
                      {t("admin.orders.detail.printAmazon")}
                    </button>
                    <button
                      type="button"
                      onClick={() => openDataUrlInNewWindow(order.fbaAmazonBoxLabel!.dataUrl, order.fbaAmazonBoxLabel!.name ?? "amazon-caixa.pdf")}
                      className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-teal-800 ring-1 ring-teal-200 hover:bg-teal-50"
                    >
                      {t("admin.orders.detail.openAmazon")}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        saveDataUrlFile(order.fbaAmazonBoxLabel!.dataUrl, order.fbaAmazonBoxLabel!.name ?? "amazon-caixa.pdf")
                      }
                      className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-bold text-zinc-800 hover:bg-zinc-50"
                    >
                      {t("admin.orders.detail.labelSave")}
                    </button>
                  </>
                ) : null}
                {order.fbaCarrierLabel?.dataUrl ? (
                  <>
                    <button
                      type="button"
                      onClick={printCarrier}
                      className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-teal-800 ring-1 ring-teal-200 hover:bg-teal-50"
                    >
                      {t("admin.orders.detail.printCarrier")}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        openDataUrlInNewWindow(order.fbaCarrierLabel!.dataUrl, order.fbaCarrierLabel!.name ?? "transportadora.pdf")
                      }
                      className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-teal-800 ring-1 ring-teal-200 hover:bg-teal-50"
                    >
                      {t("admin.orders.detail.openCarrier")}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        saveDataUrlFile(order.fbaCarrierLabel!.dataUrl, order.fbaCarrierLabel!.name ?? "transportadora.pdf")
                      }
                      className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-bold text-zinc-800 hover:bg-zinc-50"
                    >
                      {t("admin.orders.detail.labelSave")}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ) : order.service === "INTL_ML" &&
            order.intlMlAmericasLabelDataUrl?.trim() &&
            order.intlMlCarrierLabelDataUrl?.trim() ? (
            <div className="space-y-4 rounded-2xl border border-zinc-100 p-4">
              <div>
                <p className="text-xs font-bold uppercase text-zinc-600">{t("admin.orders.detail.intlMlAmericasTitle")}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      printDataUrlInNewWindow(
                        order.intlMlAmericasLabelDataUrl!,
                        order.intlMlAmericasLabelFileName ?? "mercado-livre-americas.pdf",
                      )
                    }
                    className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700"
                  >
                    {t("admin.orders.detail.printShipping")}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      saveDataUrlFile(
                        order.intlMlAmericasLabelDataUrl!,
                        order.intlMlAmericasLabelFileName?.trim() || "mercado-livre-americas.pdf",
                      )
                    }
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-bold text-zinc-800 hover:bg-zinc-50"
                  >
                    {t("admin.orders.detail.labelSave")}
                  </button>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-zinc-600">{t("admin.orders.detail.intlMlCarrierTitle")}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      printDataUrlInNewWindow(
                        order.intlMlCarrierLabelDataUrl!,
                        order.intlMlCarrierLabelFileName ?? "transportadora.pdf",
                      )
                    }
                    className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700"
                  >
                    {t("admin.orders.detail.printCarrier")}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      saveDataUrlFile(
                        order.intlMlCarrierLabelDataUrl!,
                        order.intlMlCarrierLabelFileName?.trim() || "transportadora.pdf",
                      )
                    }
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-bold text-zinc-800 hover:bg-zinc-50"
                  >
                    {t("admin.orders.detail.labelSave")}
                  </button>
                </div>
              </div>
            </div>
          ) : order.shippingLabelDataUrl ? (
            <div className="rounded-2xl border border-zinc-100 p-4">
              <p className="text-xs font-bold uppercase text-zinc-600">{t("admin.orders.col.label")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={printShipping}
                  className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700"
                >
                  {t("admin.orders.detail.printShipping")}
                </button>
                <button
                  type="button"
                  onClick={saveShippingLabel}
                  className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-bold text-zinc-800 hover:bg-zinc-50"
                >
                  {t("admin.orders.detail.labelSave")}
                </button>
              </div>
            </div>
          ) : null}

          {order.service === "FBA" ? (
            <>
              <FbaPrepPlanPanel order={order} variant="admin" />
              <FbaPrepPlanMissingNote order={order} />
            </>
          ) : null}

          {order.service === "FBA" && done && order.fbaMasterBoxDims ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
              <p className="text-xs font-bold uppercase text-emerald-900">{t("admin.orders.detail.boxDimsReadonly")}</p>
              <p className="mt-2 text-sm font-semibold text-emerald-950">
                {order.fbaMasterBoxDims.lengthCm} × {order.fbaMasterBoxDims.widthCm} × {order.fbaMasterBoxDims.heightCm}{" "}
                cm · {order.fbaMasterBoxDims.weightLb} lb
              </p>
              <p className="mt-1 text-[11px] text-emerald-900/90">
                {(() => {
                  const ts = Date.parse(order.fbaMasterBoxDims.recordedAtIso);
                  return formatDateTimeLocale(Number.isFinite(ts) ? ts : Date.now(), locale);
                })()}
              </p>
            </div>
          ) : null}

          {order.service === "FBA" && (order.status === "em_producao" || order.status === "aguardando_cliente") && !done ? (
            <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-4">
              <p className="text-xs font-bold uppercase text-teal-900">{t("admin.orders.detail.boxDimsTitle")}</p>
              <p className="mt-1 text-xs leading-relaxed text-teal-900/90">{t("admin.orders.detail.boxDimsHint")}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="block text-[11px] font-semibold text-teal-950">
                  {t("admin.orders.detail.boxLengthCm")}
                  <input
                    value={lenCm}
                    onChange={(e) => setLenCm(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-teal-200 bg-white px-2 py-1.5 text-sm text-zinc-900"
                    inputMode="decimal"
                    autoComplete="off"
                  />
                </label>
                <label className="block text-[11px] font-semibold text-teal-950">
                  {t("admin.orders.detail.boxWidthCm")}
                  <input
                    value={widCm}
                    onChange={(e) => setWidCm(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-teal-200 bg-white px-2 py-1.5 text-sm text-zinc-900"
                    inputMode="decimal"
                    autoComplete="off"
                  />
                </label>
                <label className="block text-[11px] font-semibold text-teal-950">
                  {t("admin.orders.detail.boxHeightCm")}
                  <input
                    value={heiCm}
                    onChange={(e) => setHeiCm(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-teal-200 bg-white px-2 py-1.5 text-sm text-zinc-900"
                    inputMode="decimal"
                    autoComplete="off"
                  />
                </label>
                <label className="block text-[11px] font-semibold text-teal-950">
                  {t("admin.orders.detail.boxWeightLb")}
                  <input
                    value={wtLb}
                    onChange={(e) => setWtLb(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-teal-200 bg-white px-2 py-1.5 text-sm text-zinc-900"
                    inputMode="decimal"
                    autoComplete="off"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => void saveFbaBoxDims()}
                className="mt-4 w-full rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800"
              >
                {t("admin.orders.detail.boxDimsSave")}
              </button>
            </div>
          ) : null}

          {!done ? (
            <div className="space-y-4 border-t border-zinc-100 pt-4">
              {order.status === "em_fila" ? (
                <div>
                  <p className="text-xs leading-relaxed text-zinc-600">{t("admin.orders.detail.acceptProductionHint")}</p>
                  <button
                    type="button"
                    onClick={() => void acceptProduction()}
                    className="mt-3 w-full rounded-2xl bg-teal-600 px-4 py-3 text-sm font-bold text-white hover:bg-teal-700"
                  >
                    {t("admin.orders.detail.acceptProduction")}
                  </button>
                </div>
              ) : null}
              {order.status === "em_producao" ||
              (order.service === "FBA" && order.status === "aguardando_cliente" && order.fbaMasterBoxDims) ? (
                <div>
                  {order.service === "PREP_KIT" ? (
                    <div className="space-y-3">
                      <p className="text-xs leading-relaxed text-zinc-600">{t("admin.orders.prepKit.deliverHint")}</p>
                      <div className="space-y-2">
                        {prepKitOutLines.map((row, idx) => (
                          <div key={idx} className="grid gap-2 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 sm:grid-cols-3">
                            <label className="block text-[11px] font-semibold text-zinc-600">
                              SKU (stock)
                              <input
                                value={row.id}
                                onChange={(e) =>
                                  setPrepKitOutLines((prev) =>
                                    prev.map((x, i) => (i === idx ? { ...x, id: e.target.value } : x)),
                                  )
                                }
                                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 font-mono text-sm text-zinc-900"
                                placeholder="MEU-SKU-01"
                              />
                            </label>
                            <label className="block text-[11px] font-semibold text-zinc-600 sm:col-span-2">
                              {t("admin.orders.prepKit.colTitle")}
                              <input
                                value={row.title}
                                onChange={(e) =>
                                  setPrepKitOutLines((prev) =>
                                    prev.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)),
                                  )
                                }
                                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900"
                                placeholder={t("admin.orders.prepKit.titlePlaceholder")}
                              />
                            </label>
                            <label className="block text-[11px] font-semibold text-zinc-600">
                              {t("admin.orders.col.qty")}
                              <input
                                value={row.qty}
                                onChange={(e) =>
                                  setPrepKitOutLines((prev) =>
                                    prev.map((x, i) => (i === idx ? { ...x, qty: e.target.value } : x)),
                                  )
                                }
                                inputMode="numeric"
                                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900"
                              />
                            </label>
                            <div className="flex items-end sm:col-span-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setPrepKitOutLines((prev) =>
                                    prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx),
                                  )
                                }
                                className="text-xs font-bold text-rose-700 underline"
                              >
                                {t("admin.orders.prepKit.removeLine")}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setPrepKitOutLines((prev) => [...prev, { id: "", title: "", qty: "1" }])}
                        className="text-xs font-bold text-violet-800 underline"
                      >
                        {t("admin.orders.prepKit.addLine")}
                      </button>
                      <button
                        type="button"
                        disabled={prepKitDelivering}
                        onClick={() => void deliverPrepKit()}
                        className="w-full rounded-2xl bg-violet-700 px-4 py-3 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-60"
                      >
                        {t("admin.orders.prepKit.deliverCta")}
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs leading-relaxed text-zinc-600">{t("admin.orders.detail.finalizeHint")}</p>
                      {order.service === "FBA" && !order.fbaMasterBoxDims ? (
                        <p className="mt-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950">
                          {t("admin.orders.detail.finalizeNeedsBoxDims")}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void finalize()}
                        className="mt-3 w-full rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white hover:bg-zinc-800"
                      >
                        {t("admin.orders.detail.finalize")}
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
            </>
          ) : (
            <div className="space-y-5">
              <p className="text-xs leading-relaxed text-zinc-600">{t("admin.orders.detail.trackingTabIntro")}</p>
              <ManualTrackingForm order={order} variant="admin" orderPatchCtx={ADMIN_ORDER_PATCH_CTX} t={t} />
              {!resolvedShippingTracking(order).trackingNumber && !orderTracking.url ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 p-4 text-sm text-zinc-700">
                  {t("admin.orders.detail.trackingEmpty")}
                </div>
              ) : null}
              {done && order.opsShippedAtIso && !orderTracking.url ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
                  {t("admin.orders.detail.alreadyDone")}
                </div>
              ) : null}
              {orderTracking.url ? (
                <div
                  className={`rounded-2xl border p-4 ${
                    done && order.opsShippedAtIso ? "border-emerald-200 bg-emerald-50/80" : "border-zinc-200 bg-white"
                  }`}
                >
                  {done && order.opsShippedAtIso ? (
                    <p className="text-sm font-semibold text-emerald-950">{t("admin.orders.detail.alreadyDone")}</p>
                  ) : null}
                  <p
                    className={`text-[11px] font-bold uppercase tracking-wide ${
                      done && order.opsShippedAtIso ? "mt-2 text-emerald-900" : "text-zinc-600"
                    }`}
                  >
                    {t("admin.orders.detail.trackingTitle")}
                  </p>
                  <p
                    className={`mt-1 text-sm font-semibold ${
                      done && order.opsShippedAtIso ? "text-emerald-950" : "text-zinc-900"
                    }`}
                  >
                    {(orderTracking.carrierLabel ?? "—") +
                      (orderTracking.trackingNumber ? ` · ${orderTracking.trackingNumber}` : "")}
                  </p>
                  <a
                    href={orderTracking.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`mt-3 inline-flex rounded-xl px-4 py-2 text-xs font-bold text-white ${
                      done && order.opsShippedAtIso ? "bg-emerald-700 hover:bg-emerald-800" : "bg-teal-600 hover:bg-teal-700"
                    }`}
                  >
                    {t("admin.orders.detail.trackingOpen")}
                  </a>
                </div>
              ) : null}
              {resolvedShippingTracking(order).trackingNumber ? (
                <TrackingLiveStatusBlock order={order} variant="admin" orderPatchCtx={ADMIN_ORDER_PATCH_CTX} t={t} />
              ) : null}
              <DeliveryConfirmPanel
                order={order}
                variant="admin"
                orderPatchCtx={ADMIN_ORDER_PATCH_CTX}
                t={t}
                formatDateTime={formatOrderIso}
              />
            </div>
          )}

          <div className="flex justify-end border-t border-zinc-100 pt-3">
            <Link to="/app/pedidos" className="text-xs font-semibold text-teal-700 underline" onClick={onClose}>
              {t("admin.orders.action.portal")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminOrdersPage() {
  const { t, locale } = useI18n();
  const [tick, setTick] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [adminDetail, setAdminDetail] = useState<ClientOrder | null>(null);
  const [listScope, setListScope] = useState<"all" | "active" | "awaiting_cliente" | "shipped" | "delivery">("all");

  useEffect(() => {
    const fn = () => setTick((x) => x + 1);
    window.addEventListener(ORDERS_UPDATED_EVENT, fn);
    window.addEventListener(INVENTORY_UPDATED_EVENT, fn);
    return () => {
      window.removeEventListener(ORDERS_UPDATED_EVENT, fn);
      window.removeEventListener(INVENTORY_UPDATED_EVENT, fn);
    };
  }, []);

  useEffect(() => {
    setNowMs(Date.now());
  }, [tick]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const invById = useMemo(() => {
    void tick;
    const m = new Map<string, InventoryRow>();
    for (const r of getMergedInventoryView()) m.set(r.id, r);
    return m;
  }, [tick]);

  const rows = useMemo((): UnifiedRow[] => {
    void tick;
    const fromClient: UnifiedRow[] = loadAddedClientOrders().map((order) => ({ source: "client", order }));
    const fromMock: UnifiedRow[] = mockAdminNewOrders.map((order) => ({ source: "mock", order }));
    return [...fromClient, ...fromMock];
  }, [tick]);

  const filteredRows = useMemo(() => {
    void tick;
    return rows.filter((row) => {
      if (row.source === "mock") return listScope === "all";
      const o = row.order;
      switch (listScope) {
        case "all":
          return true;
        case "active":
          return o.status !== "concluido";
        case "awaiting_cliente":
          return o.status === "aguardando_cliente";
        case "shipped":
          return o.status === "concluido" && !isDeliveryOrder(o);
        case "delivery":
          return isDeliveryOrder(o);
        default:
          return true;
      }
    });
  }, [rows, listScope, tick]);

  const listTabCounts = useMemo(() => {
    void tick;
    const client = loadAddedClientOrders();
    return {
      all: client.length,
      active: client.filter((o) => o.status !== "concluido").length,
      awaiting_cliente: client.filter((o) => o.status === "aguardando_cliente").length,
      shipped: client.filter((o) => o.status === "concluido" && !isDeliveryOrder(o)).length,
      delivery: client.filter(isDeliveryOrder).length,
    };
  }, [tick]);

  const detailLines = useMemo(() => {
    if (!adminDetail) return [];
    return enrichShipmentLinesWithInventory(shipmentLinesForOrder(adminDetail), invById);
  }, [adminDetail, invById]);

  useEffect(() => {
    if (!adminDetail) return;
    const sync = () => {
      const fresh = loadAddedClientOrders().find((x) => x.id === adminDetail.id);
      if (fresh) setAdminDetail(fresh);
    };
    window.addEventListener(ORDERS_UPDATED_EVENT, sync);
    return () => window.removeEventListener(ORDERS_UPDATED_EVENT, sync);
  }, [adminDetail?.id]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("admin.orders.eyebrow")}
        title={t("admin.orders.title")}
        subtitle={t("admin.orders.subtitle")}
        actions={<LanguageSwitcher />}
      />

      <div className="flex flex-wrap gap-2 rounded-3xl border border-zinc-200/80 bg-white p-3 shadow-sm">
        <input className="w-32 rounded-2xl border border-zinc-200 px-3 py-2 text-sm" placeholder={t("admin.orders.filterOrder")} readOnly />
        <input className="w-32 rounded-2xl border border-zinc-200 px-3 py-2 text-sm" placeholder={t("admin.orders.filterSuite")} readOnly />
        <span className="self-center text-xs text-zinc-500">{t("admin.orders.filtersSoon")}</span>
      </div>

      <div className="flex flex-wrap gap-1 rounded-3xl border border-zinc-200/80 bg-white p-2 shadow-sm" role="tablist" aria-label={t("admin.orders.title")}>
        {(["all", "active", "awaiting_cliente", "shipped", "delivery"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={listScope === id}
            onClick={() => setListScope(id)}
            className={`rounded-2xl px-3 py-2 text-xs font-bold uppercase tracking-wide transition ${
              listScope === id ? "bg-teal-600 text-white shadow-sm" : "text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {t(`admin.orders.listTab.${id}`)}
            {id === "all" && listTabCounts.all ? ` · ${listTabCounts.all}` : ""}
            {id === "active" && listTabCounts.active ? ` · ${listTabCounts.active}` : ""}
            {id === "awaiting_cliente" && listTabCounts.awaiting_cliente ? ` · ${listTabCounts.awaiting_cliente}` : ""}
            {id === "shipped" && listTabCounts.shipped ? ` · ${listTabCounts.shipped}` : ""}
            {id === "delivery" && listTabCounts.delivery ? ` · ${listTabCounts.delivery}` : ""}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-sm">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-0 table-fixed border-collapse text-left text-[11px] leading-snug text-zinc-800 sm:text-[12px]">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 sm:text-[11px]">
              <tr>
                <th className="w-[9%] min-w-0 px-2 py-3 sm:px-3">{t("admin.orders.col.order")}</th>
                <th className="w-[6%] min-w-0 px-2 py-3 sm:px-3">{t("admin.orders.col.suite")}</th>
                <th className="w-[10%] min-w-0 px-2 py-3 sm:px-3">{t("admin.orders.col.client")}</th>
                <th className="w-[22%] min-w-0 px-2 py-3 sm:px-3">{t("admin.orders.col.product")}</th>
                <th className="w-[4%] min-w-0 px-1 py-3 text-center sm:px-2">{t("admin.orders.col.qty")}</th>
                <th className="w-[5%] min-w-0 px-1 py-3 text-center sm:px-2">{t("admin.orders.col.photo")}</th>
                <th className="w-[16%] min-w-0 px-2 py-3 sm:px-3">{t("admin.orders.col.shipping")}</th>
                <th className="w-[8%] min-w-0 px-2 py-3 sm:px-3">{t("admin.orders.col.status")}</th>
                <th className="w-[10%] min-w-0 px-2 py-3 sm:px-3">{t("admin.orders.col.date")}</th>
                <th className="w-[10%] min-w-0 px-2 py-3 pr-3 text-right sm:px-3">{t("admin.orders.col.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={ADMIN_ORDER_TABLE_COLS} className="px-4 py-10 text-center text-sm text-zinc-500">
                    {listScope === "all" ? t("admin.orders.empty") : t("admin.orders.listTabEmpty")}
                  </td>
                </tr>
              ) : null}
              {filteredRows.map((row) => {
                if (row.source === "client") {
                  const o = row.order;
                  const lines = enrichShipmentLinesWithInventory(shipmentLinesForOrder(o), invById);
                  const rs = lines.length;
                  return (
                    <Fragment key={`c-${o.id}`}>
                      {lines.map((line, idx) => (
                        <tr key={`${o.id}-L${idx}`} className="odd:bg-zinc-50/50 hover:bg-teal-50/30">
                          {idx === 0 ? (
                            <td rowSpan={rs} className="min-w-0 align-top break-all px-2 py-3 font-semibold tracking-tight text-zinc-900 sm:px-3">
                              {o.id}
                            </td>
                          ) : null}
                          {idx === 0 ? (
                            <td rowSpan={rs} className="min-w-0 align-top px-2 py-3 sm:px-3">
                              <span className="inline-flex max-w-full rounded-full border border-teal-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-teal-900 sm:px-2 sm:text-[11px]">
                                {o.suite ?? "—"}
                              </span>
                            </td>
                          ) : null}
                          {idx === 0 ? (
                            <td rowSpan={rs} className="min-w-0 align-top px-2 py-3 font-medium text-zinc-800 sm:px-3">
                              <span className="line-clamp-2 break-words" title={o.clientName ?? ""}>
                                {o.clientName ?? "—"}
                              </span>
                            </td>
                          ) : null}
                          <td className="min-w-0 px-2 py-3 align-top sm:px-3">
                            <p className="line-clamp-3 break-words font-medium text-zinc-900" title={line.title}>
                              {lineTitleForUi(line.title, t)}
                            </p>
                            <p className="mt-0.5 truncate text-[10px] font-medium text-zinc-500 sm:text-[11px]" title={line.asin}>
                              {t("admin.orders.asinPrefix")} {line.asin}
                            </p>
                          </td>
                          <td className="min-w-0 px-1 py-3 text-center align-top font-semibold tabular-nums text-zinc-900 sm:px-2">
                            {line.qty}
                          </td>
                          <td className="min-w-0 px-1 py-3 align-top sm:px-2">
                            <div className="flex justify-center">
                              <OrderLineThumb line={line} size={44} zoomable />
                            </div>
                          </td>
                          {idx === 0 ? (
                            <td rowSpan={rs} className="min-w-0 align-top px-2 py-3 sm:px-3">
                              <PrepShippingBlock order={o} nowMs={nowMs} t={t} />
                            </td>
                          ) : null}
                          {idx === 0 ? (
                            <td rowSpan={rs} className="min-w-0 align-top px-2 py-3 sm:px-3">
                              <span className="inline-flex max-w-full rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 sm:px-2 sm:text-[11px]">
                                {orderStatusLabel(o.status, t)}
                              </span>
                            </td>
                          ) : null}
                          {idx === 0 ? (
                            <td rowSpan={rs} className="min-w-0 align-top break-words px-2 py-3 text-[10px] font-medium leading-snug text-zinc-600 sm:px-3 sm:text-[11px]">
                              {o.createdLabel}
                            </td>
                          ) : null}
                          {idx === 0 ? (
                            <td rowSpan={rs} className="min-w-0 align-top px-2 py-3 pr-3 text-right sm:px-3">
                              <button
                                type="button"
                                onClick={() => {
                                  const fresh = loadAddedClientOrders().find((x) => x.id === o.id);
                                  setAdminDetail(fresh ?? o);
                                }}
                                className="max-w-full rounded-lg border border-teal-200 bg-white px-2 py-1.5 text-[9px] font-bold uppercase leading-tight tracking-wide text-teal-800 hover:bg-teal-50 sm:text-[10px]"
                              >
                                {t("admin.orders.action.open")}
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                      {o.service === "FBA" && hasFbaBoxPlan(o) ? (
                        <tr className="bg-teal-50/20">
                          <td colSpan={ADMIN_ORDER_TABLE_COLS} className="px-4 pb-4 pt-0">
                            <FbaPrepPlanPanel order={o} variant="admin" />
                          </td>
                        </tr>
                      ) : o.service === "FBA" ? (
                        <tr className="bg-teal-50/20">
                          <td colSpan={ADMIN_ORDER_TABLE_COLS} className="px-4 pb-4 pt-0">
                            <FbaPrepPlanMissingNote order={o} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                }
                const o = row.order;
                return (
                  <tr key={`m-${o.id}-${o.productTitle}`} className="hover:bg-zinc-50/70">
                    <td className="min-w-0 break-all px-2 py-3 font-semibold sm:px-3">{o.id}</td>
                    <td className="min-w-0 px-2 py-3 sm:px-3">
                      <span className="inline-flex max-w-full rounded-full border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold sm:text-xs">
                        {o.suite}
                      </span>
                    </td>
                    <td className="min-w-0 px-2 py-3 sm:px-3">
                      <span className="line-clamp-2 break-words">{o.clientName}</span>
                    </td>
                    <td className="min-w-0 px-2 py-3 sm:px-3">
                      <p className="line-clamp-3 break-words font-medium text-zinc-900" title={decodeHtmlEntities(o.productTitle)}>
                        {decodeHtmlEntities(o.productTitle)}
                      </p>
                    </td>
                    <td className="min-w-0 px-1 py-3 text-center font-semibold tabular-nums sm:px-2">{o.qty}</td>
                    <td className="min-w-0 px-1 py-3 text-center text-xs text-zinc-400 sm:px-2">—</td>
                    <td className="min-w-0 px-2 py-3 sm:px-3">
                      <span className="line-clamp-2 break-words rounded-md border border-zinc-200 bg-white px-1.5 py-1 text-[10px] font-semibold sm:text-xs">
                        {o.service}
                      </span>
                    </td>
                    <td className="min-w-0 px-2 py-3 sm:px-3">
                      <span className="inline-flex max-w-full rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900 sm:text-xs">
                        {o.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="min-w-0 break-words px-2 py-3 text-[10px] text-zinc-600 sm:px-3 sm:text-xs">{o.orderDateLabel}</td>
                    <td className="min-w-0 px-2 py-3 pr-3 text-right sm:px-3">
                      <div className="flex flex-col items-end gap-1 sm:flex-row sm:justify-end">
                        <button
                          type="button"
                          className="w-full max-w-[5.5rem] rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[9px] font-semibold hover:bg-zinc-50 sm:w-auto sm:text-[10px]"
                        >
                          {t("admin.orders.mock.print")}
                        </button>
                        <button
                          type="button"
                          className="w-full max-w-[5.5rem] rounded-lg bg-teal-600 px-2 py-1 text-[9px] font-semibold text-white hover:bg-teal-700 sm:w-auto sm:text-[10px]"
                        >
                          {t("admin.orders.mock.view")}
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

      {adminDetail ? (
        <AdminOrderDetailModal
          order={adminDetail}
          lines={detailLines}
          onClose={() => setAdminDetail(null)}
          nowMs={nowMs}
          locale={locale}
          t={t}
          onOrderUpdated={(o) => setAdminDetail(o)}
        />
      ) : null}
    </div>
  );
}
