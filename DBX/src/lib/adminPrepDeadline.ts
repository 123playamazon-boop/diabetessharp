import type { ClientOrder } from "../types";
import { orderPrepAnchorMs } from "./orderTimeline";

/** Início do prazo prep — alinhado com `orderPrepAnchorMs` (ISO, label, id ENV-…). */
export function orderCreatedMs(order: ClientOrder): number {
  return orderPrepAnchorMs(order);
}

export function endOfLocalCalendarDayMs(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
}

export type PrepRule = "fbm" | "fba" | "other";

export function prepRuleForOrder(order: ClientOrder): PrepRule {
  if (order.service === "FBM" || order.service === "PREP_KIT") return "fbm";
  if (order.service === "FBA") return "fba";
  return "other";
}

/** FBM = até fim do dia civil de criação; FBA = +48h; restantes = +24h. */
export function prepDispatchDeadlineMs(order: ClientOrder): number {
  const start = orderCreatedMs(order);
  const rule = prepRuleForOrder(order);
  if (rule === "fbm") return endOfLocalCalendarDayMs(start);
  if (rule === "fba") return start + 48 * 60 * 60 * 1000;
  return start + 24 * 60 * 60 * 1000;
}

export function formatPrepCountdown(
  deadlineMs: number,
  nowMs: number,
  t: (k: string, v?: Record<string, string | number>) => string,
): { text: string; late: boolean; warn: boolean } {
  const diff = deadlineMs - nowMs;
  if (diff <= 0) {
    const late = Math.abs(diff);
    const h = Math.floor(late / 3600000);
    const m = Math.floor((late % 3600000) / 60000);
    return { text: t("admin.orders.prepLate", { h, m }), late: true, warn: true };
  }
  const warn = diff < 4 * 3600000;
  if (diff >= 48 * 3600000) {
    const d = Math.ceil(diff / 86400000);
    return { text: t("admin.orders.prepRemainingDaysOnly", { d }), late: false, warn };
  }
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return { text: t("admin.orders.prepRemainingHm", { h, m }), late: false, warn };
}
