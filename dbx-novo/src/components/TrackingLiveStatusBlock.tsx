import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientOrder, ShippingTrackingPhase } from "../types";
import { resolvedShippingTracking } from "../lib/orderTrackingDisplay";
import { requestTrackingLookup } from "../lib/requestTrackingLookup";
import { updateClientOrder, type OrderPatchContext } from "../lib/clientOrdersStorage";
import { cn } from "../lib/cn";

function phaseBadgeClass(phase: ShippingTrackingPhase | undefined): string {
  switch (phase) {
    case "delivered":
      return "border-emerald-300 bg-emerald-100 text-emerald-950";
    case "out_for_delivery":
    case "available_pickup":
      return "border-amber-300 bg-amber-100 text-amber-950";
    case "in_transit":
    case "info_received":
    case "pending":
      return "border-sky-300 bg-sky-100 text-sky-950";
    case "exception":
    case "expired":
    case "not_found":
      return "border-rose-300 bg-rose-100 text-rose-950";
    default:
      return "border-zinc-300 bg-zinc-100 text-zinc-800";
  }
}

type Props = {
  order: ClientOrder;
  variant: "client" | "admin";
  orderPatchCtx: OrderPatchContext;
  t: (k: string, v?: Record<string, string | number>) => string;
};

export function TrackingLiveStatusBlock({ order, variant, orderPatchCtx, t }: Props) {
  const orderRef = useRef(order);
  orderRef.current = order;

  const r = resolvedShippingTracking(order);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const runLookup = useCallback(async () => {
    const o = orderRef.current;
    const rNow = resolvedShippingTracking(o);
    if (!rNow.trackingNumber) return;
    setLoading(true);
    setErr(null);
    setHint(null);
    try {
      const out = await requestTrackingLookup(rNow.trackingNumber, o.shippingTrackingCarrierId);
      if (!out.ok) {
        setErr(out.error);
        return;
      }
      if (!out.configured) {
        setHint(out.hint);
        const nextUrl = out.trackingUrl || rNow.url;
        if (nextUrl && nextUrl !== o.shippingTrackingUrl) {
          void updateClientOrder(o.id, { shippingTrackingUrl: nextUrl }, orderPatchCtx);
        }
        return;
      }
      void updateClientOrder(
        o.id,
        {
          shippingTrackingPhase: out.phase,
          shippingTrackingSummary: out.summary,
          shippingTrackingCheckedAtIso: new Date().toISOString(),
          shippingTrackingEvents: out.events.slice(0, 8),
          shippingTrackingUrl: out.trackingUrl || rNow.url || o.shippingTrackingUrl,
        },
        orderPatchCtx,
      );
    } finally {
      setLoading(false);
    }
  }, [orderPatchCtx]);

  useEffect(() => {
    if (!resolvedShippingTracking(order).trackingNumber) return;
    void runLookup();
  }, [order.id, order.shippingTrackingNumber, order.shippingTrackingCarrierId, runLookup]);

  if (!r.trackingNumber) return null;

  const phase = order.shippingTrackingPhase ?? "unknown";
  const checked = order.shippingTrackingCheckedAtIso;

  return (
    <div
      className={cn(
        "rounded-ds-btn border p-3 text-sm",
        variant === "admin" ? "border-zinc-200 bg-white" : "border-ds-border bg-ds-bg/80",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          className={cn(
            "text-[11px] font-bold uppercase tracking-wide",
            variant === "admin" ? "text-zinc-500" : "text-ds-muted",
          )}
        >
          {t("tracking.liveTitle")}
        </p>
        <button
          type="button"
          disabled={loading}
          onClick={() => void runLookup()}
          className={cn(
            "rounded-lg px-2.5 py-1 text-[11px] font-bold disabled:opacity-50",
            variant === "admin"
              ? "border border-zinc-300 bg-zinc-50 text-zinc-800 hover:bg-zinc-100"
              : "border border-ds-border bg-ds-surface text-ds-text hover:bg-ds-bg",
          )}
        >
          {loading ? t("tracking.refreshing") : t("tracking.refresh")}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold",
            phaseBadgeClass(phase),
          )}
        >
          {t(`tracking.phase.${phase}`)}
        </span>
        {checked ? (
          <span className={cn("text-[10px] font-medium", variant === "admin" ? "text-zinc-500" : "text-ds-muted")}>
            {t("tracking.lastChecked", { datetime: new Date(checked).toLocaleString() })}
          </span>
        ) : null}
      </div>

      {order.shippingTrackingSummary ? (
        <p className={cn("mt-2 text-xs leading-relaxed", variant === "admin" ? "text-zinc-800" : "text-ds-text")}>
          {order.shippingTrackingSummary}
        </p>
      ) : hint ? (
        <p className={cn("mt-2 text-xs leading-relaxed", variant === "admin" ? "text-zinc-600" : "text-ds-muted")}>{hint}</p>
      ) : !loading && phase === "unknown" && !hint ? (
        <p className={cn("mt-2 text-xs leading-relaxed", variant === "admin" ? "text-zinc-600" : "text-ds-muted")}>
          {t("tracking.summaryPending")}
        </p>
      ) : null}

      {order.shippingTrackingEvents && order.shippingTrackingEvents.length > 0 ? (
        <div
          className={cn(
            "mt-3 max-h-40 overflow-y-auto rounded-lg border p-2",
            variant === "admin" ? "border-zinc-200 bg-zinc-50" : "border-ds-border/60 bg-ds-surface/50",
          )}
        >
          <p className={cn("text-[10px] font-bold uppercase", variant === "admin" ? "text-zinc-500" : "text-ds-muted")}>
            {t("tracking.eventsTitle")}
          </p>
          <ul className="mt-1 space-y-2">
            {order.shippingTrackingEvents.map((ev, i) => (
              <li
                key={`${i}-${ev.at ?? ""}-${ev.description.slice(0, 24)}`}
                className={cn("text-[11px] leading-snug", variant === "admin" ? "text-zinc-800" : "text-ds-text")}
              >
                {ev.at ? (
                  <span className={cn("font-mono", variant === "admin" ? "text-zinc-500" : "text-ds-muted")}>{ev.at} · </span>
                ) : null}
                {ev.location ? (
                  <span className={variant === "admin" ? "text-zinc-500" : "text-ds-muted"}>{ev.location} — </span>
                ) : null}
                {ev.description}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {err ? (
        <p className={cn("mt-2 text-xs font-medium", variant === "admin" ? "text-rose-700" : "text-ds-error")}>{err}</p>
      ) : null}

      {r.url ? (
        <a
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "mt-3 inline-flex rounded-lg px-3 py-1.5 text-xs font-bold text-white",
            variant === "admin" ? "bg-teal-600 hover:bg-teal-700" : "bg-ds-primary hover:opacity-95",
          )}
        >
          {t("admin.orders.detail.trackingOpen")}
        </a>
      ) : null}
    </div>
  );
}
