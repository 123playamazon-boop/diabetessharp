import type { ClientOrder } from "../types";
import { resolvedShippingTracking } from "./orderTrackingDisplay";

export type OrderChecklistItem = {
  id: string;
  /** i18n key under `client.orders.checklist.*` */
  labelKey: string;
  done: boolean;
  hintKey?: string;
};

export function buildOrderClientChecklist(order: ClientOrder, isUserOrder: boolean): OrderChecklistItem[] {
  const items: OrderChecklistItem[] = [];
  const track = resolvedShippingTracking(order);

  if (order.service === "FBA") {
    const hasFnsku = (order.fbaFnskuLabels?.length ?? 0) > 0;
    items.push({
      id: "fba_fnsku",
      labelKey: "fbaFnsku",
      done: hasFnsku,
      hintKey: hasFnsku ? undefined : "fbaFnskuHint",
    });
    const dims = order.fbaMasterBoxDims;
    items.push({
      id: "fba_dims",
      labelKey: "fbaDims",
      done: Boolean(dims),
      hintKey: dims ? undefined : "fbaDimsHint",
    });
    const hasAmazon = Boolean(order.fbaAmazonBoxLabel?.dataUrl);
    const hasCarrier = Boolean(order.fbaCarrierLabel?.dataUrl);
    const needMasterLabels = Boolean(dims);
    items.push({
      id: "fba_master_labels",
      labelKey: "fbaMasterLabels",
      done: !needMasterLabels || (hasAmazon && hasCarrier),
      hintKey: needMasterLabels && (!hasAmazon || !hasCarrier) ? "fbaMasterLabelsHint" : undefined,
    });
  } else if (order.service === "INTL_ML") {
    const hasSplit =
      Boolean(order.intlMlAmericasLabelDataUrl?.trim()) && Boolean(order.intlMlCarrierLabelDataUrl?.trim());
    const hasLegacy = Boolean(order.shippingLabelDataUrl?.trim());
    items.push({
      id: "ship_label",
      labelKey: "intlMlLabels",
      done: hasSplit || hasLegacy,
      hintKey: hasSplit || hasLegacy ? undefined : "intlMlLabelsHint",
    });
  } else {
    const hasLabel = Boolean(order.shippingLabelDataUrl?.trim());
    items.push({
      id: "ship_label",
      labelKey: "shippingLabel",
      done: hasLabel,
      hintKey: hasLabel ? undefined : "shippingLabelHint",
    });
  }

  items.push({
    id: "tracking",
    labelKey: "tracking",
    done: Boolean(track.trackingNumber?.trim() || track.url),
    hintKey: track.trackingNumber || track.url ? undefined : "trackingHint",
  });

  if (isUserOrder && order.status === "aguardando_cliente" && order.prepClientNotice?.trim()) {
    items.push({
      id: "prep_reply",
      labelKey: "prepReply",
      done: false,
      hintKey: "prepReplyHint",
    });
  }

  return items;
}
