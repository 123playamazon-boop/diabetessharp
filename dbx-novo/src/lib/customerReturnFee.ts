import { PREP_CENTER_PRICING_EXTRA } from "./prepCenterPricing";

/** Id da linha extra «Retorno — Mercadoria» (Direct Box). */
export const CUSTOMER_RETURN_MERCHANDISE_SERVICE_ID = "return-merch" as const;

/** Taxa por unidade de mercadoria de retorno (comprador final → armazém), conforme plano da suite. */
export function getCustomerReturnMerchandiseFeePerUnitUsd(plan: "basic" | "premium"): number {
  const line = PREP_CENTER_PRICING_EXTRA.find((x) => x.id === CUSTOMER_RETURN_MERCHANDISE_SERVICE_ID);
  if (!line) return plan === "premium" ? 1.5 : 6.25;
  return plan === "premium" ? line.premiumUsd : line.basicUsd;
}
