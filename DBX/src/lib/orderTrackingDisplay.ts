import type { ClientOrder } from "../types";
import { buildCarrierTrackingUrl } from "./shippingTrackingDetect";

export type ResolvedOrderTracking = {
  url: string | undefined;
  trackingNumber: string | undefined;
  carrierLabel: string | undefined;
  carrierId: string | undefined;
};

/** URL guardada no pedido ou reconstruída a partir de transportadora + número. */
export function resolvedShippingTracking(order: ClientOrder): ResolvedOrderTracking {
  const num = order.shippingTrackingNumber?.trim() || undefined;
  const carrierId = order.shippingTrackingCarrierId?.trim() || undefined;
  const carrierLabel = order.shippingTrackingCarrierLabel?.trim() || undefined;
  let url = order.shippingTrackingUrl?.trim() || undefined;
  if (!url && carrierId && num) {
    url = buildCarrierTrackingUrl(carrierId, num);
  }
  return {
    url,
    trackingNumber: num,
    carrierLabel: carrierLabel ?? carrierId,
    carrierId,
  };
}
