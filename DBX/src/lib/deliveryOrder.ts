import type { ClientOrder } from "../types";

/** Pedido despachado e considerado «entregue ao cliente final» (API ou confirmação manual). */
export function isDeliveryOrder(o: ClientOrder): boolean {
  if (o.status !== "concluido") return false;
  if (o.customerDeliveryConfirmedAtIso?.trim()) return true;
  return o.shippingTrackingPhase === "delivered";
}
