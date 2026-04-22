import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { ClientOrder } from "../types";
import { buildCarrierTrackingUrl } from "../lib/shippingTrackingDetect";
import { updateClientOrder, type OrderPatchContext } from "../lib/clientOrdersStorage";
import { resolvedShippingTracking } from "../lib/orderTrackingDisplay";
import { cn } from "../lib/cn";

const CARRIER_IDS = ["ups", "fedex", "usps", "dhl", "amazon", "other"] as const;
export type ManualCarrierId = (typeof CARRIER_IDS)[number];

type Props = {
  order: ClientOrder;
  variant: "admin" | "client";
  /** Obrigatório para gravar no servidor (sincroniza portal ↔ admin). */
  orderPatchCtx: OrderPatchContext;
  t: (k: string, v?: Record<string, string | number>) => string;
};

export function ManualTrackingForm({ order, variant, orderPatchCtx, t }: Props) {
  const known = useMemo(() => new Set<string>(CARRIER_IDS), []);
  const [carrierId, setCarrierId] = useState<ManualCarrierId>("ups");
  const [num, setNum] = useState("");

  useEffect(() => {
    setNum(order.shippingTrackingNumber?.trim() ?? "");
    const c = order.shippingTrackingCarrierId?.trim();
    if (c && known.has(c)) {
      setCarrierId(c as ManualCarrierId);
    } else if (c === "unknown") {
      setCarrierId("other");
    } else if (c) {
      setCarrierId("ups");
    }
  }, [order.id, order.shippingTrackingNumber, order.shippingTrackingCarrierId, known]);

  const save = () => {
    void (async () => {
      const trimmed = num.trim();
      if (!trimmed) {
        toast.error(t("tracking.manualNumberRequired"));
        return;
      }
      const storeCarrierId = carrierId === "other" ? "unknown" : carrierId;
      const url = buildCarrierTrackingUrl(storeCarrierId, trimmed);
      const label = t(`tracking.carrier.${carrierId}`);
      const ok = await updateClientOrder(
        order.id,
        {
          shippingTrackingNumber: trimmed,
          shippingTrackingCarrierId: storeCarrierId,
          shippingTrackingCarrierLabel: label,
          shippingTrackingUrl: url,
        },
        orderPatchCtx,
      );
      if (!ok) {
        toast.error(t("common.errorUpdate"));
        return;
      }
      toast.success(t("tracking.manualSaved"));
    })();
  };

  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        variant === "admin" ? "border-zinc-200 bg-zinc-50/80" : "border-ds-border bg-ds-bg",
      )}
    >
      <p className={cn("text-[11px] font-bold uppercase tracking-wide", variant === "admin" ? "text-zinc-600" : "text-ds-muted")}>
        {t("tracking.manualTitle")}
      </p>
      <p className={cn("mt-1 text-xs leading-relaxed", variant === "admin" ? "text-zinc-600" : "text-ds-muted")}>{t("tracking.manualHint")}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={cn("text-[11px] font-semibold", variant === "admin" ? "text-zinc-700" : "text-ds-text")} htmlFor={`mt-carrier-${order.id}`}>
            {t("tracking.manualCarrier")}
          </label>
          <select
            id={`mt-carrier-${order.id}`}
            value={carrierId}
            onChange={(e) => setCarrierId(e.target.value as ManualCarrierId)}
            className={cn(
              "mt-1 block w-full rounded-lg border px-3 py-2 text-sm",
              variant === "admin" ? "border-zinc-300 bg-white text-zinc-900" : "border-ds-border bg-ds-surface text-ds-text",
            )}
          >
            {CARRIER_IDS.map((id) => (
              <option key={id} value={id}>
                {t(`tracking.carrier.${id}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={cn("text-[11px] font-semibold", variant === "admin" ? "text-zinc-700" : "text-ds-text")} htmlFor={`mt-num-${order.id}`}>
            {t("tracking.manualNumber")}
          </label>
          <input
            id={`mt-num-${order.id}`}
            type="text"
            value={num}
            onChange={(e) => setNum(e.target.value)}
            autoComplete="off"
            placeholder={t("tracking.manualNumberPlaceholder")}
            className={cn(
              "mt-1 block w-full rounded-lg border px-3 py-2 font-mono text-sm",
              variant === "admin" ? "border-zinc-300 bg-white text-zinc-900" : "border-ds-border bg-ds-surface text-ds-text",
            )}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={save}
        className={cn(
          "mt-3 w-full rounded-lg px-4 py-2.5 text-xs font-bold text-white shadow-sm sm:w-auto",
          variant === "admin" ? "bg-teal-600 hover:bg-teal-700" : "bg-ds-primary hover:opacity-95",
        )}
      >
        {t("tracking.manualSave")}
      </button>
    </div>
  );
}

type DeliveryPanelProps = {
  order: ClientOrder;
  variant: "admin" | "client";
  orderPatchCtx: OrderPatchContext;
  t: (k: string, v?: Record<string, string | number>) => string;
  formatDateTime: (iso: string) => string;
};

/** Marca entrega ao cliente final (lista «Delivery») quando já existe rastreio. */
export function DeliveryConfirmPanel({ order, variant, orderPatchCtx, t, formatDateTime }: DeliveryPanelProps) {
  if (order.status !== "concluido") return null;
  const r = resolvedShippingTracking(order);
  if (!r.trackingNumber?.trim() && !r.url) return null;
  const confirmed = order.customerDeliveryConfirmedAtIso?.trim();
  if (confirmed) {
    return (
      <div
        className={cn(
          "rounded-2xl border px-4 py-3 text-xs font-medium leading-relaxed",
          variant === "admin" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-emerald-200 bg-emerald-50/90 text-emerald-950",
        )}
      >
        {t("tracking.deliveredConfirmed", { datetime: formatDateTime(confirmed) })}
      </div>
    );
  }
  const mark = () => {
    void (async () => {
      if (!window.confirm(t("tracking.markDeliveredConfirm"))) return;
      const ok = await updateClientOrder(
        order.id,
        {
          customerDeliveryConfirmedAtIso: new Date().toISOString(),
          shippingTrackingPhase: "delivered",
        },
        orderPatchCtx,
      );
      if (!ok) {
        toast.error(t("common.errorUpdate"));
        return;
      }
      toast.success(t("tracking.markDeliveredToast"));
    })();
  };
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        variant === "admin" ? "border-teal-100 bg-teal-50/50" : "border-ds-border bg-ds-bg",
      )}
    >
      <p className={cn("text-[11px] font-bold uppercase tracking-wide", variant === "admin" ? "text-teal-900" : "text-ds-muted")}>
        {t("tracking.markDeliveredTitle")}
      </p>
      <p className={cn("mt-1 text-xs leading-relaxed", variant === "admin" ? "text-teal-900/90" : "text-ds-muted")}>
        {t("tracking.markDeliveredHint")}
      </p>
      <button
        type="button"
        onClick={mark}
        className={cn(
          "mt-3 w-full rounded-lg px-4 py-2.5 text-xs font-bold text-white shadow-sm sm:w-auto",
          variant === "admin" ? "bg-emerald-700 hover:bg-emerald-800" : "bg-emerald-700 hover:bg-emerald-800",
        )}
      >
        {t("tracking.markDeliveredButton")}
      </button>
    </div>
  );
}
