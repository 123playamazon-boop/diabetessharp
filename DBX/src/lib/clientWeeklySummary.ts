import type { ClientProfile } from "../types";
import { getMergedInventoryView } from "./clientInventoryStorage";
import { getMergedClientOrders, inventoryRowsForSuite, ordersForSuite } from "./clientDashboardMetrics";

const WEEK_MS = 7 * 86_400_000;

export type WeeklySummaryBullet = {
  key: string;
  value: number;
};

export function computeWeeklySummary(_profile: ClientProfile, suite: string): WeeklySummaryBullet[] {
  const s = suite.trim();
  const now = Date.now();
  const since = now - WEEK_MS;
  const orders = ordersForSuite(getMergedClientOrders(), s);
  const created = orders.filter((o) => {
    const t = o.createdAtIso ? Date.parse(o.createdAtIso) : NaN;
    return Number.isFinite(t) && t >= since;
  }).length;

  const inv = inventoryRowsForSuite(getMergedInventoryView(), s);
  const storageRisk = inv.filter((r) => {
    if (r.qty <= 0) return false;
    const st = r.storageFreeStartIso ?? r.arrivalDate;
    if (!st) return false;
    const used = Math.floor((now - Date.parse(st)) / 86_400_000);
    const lim = Math.max(1, Math.floor(r.storageLimitDays ?? 30));
    const left = lim - used;
    return left <= 7 && left >= 0;
  }).length;

  return [
    { key: "shipmentsCreated", value: created },
    { key: "storageRiskLines", value: storageRisk },
    { key: "openOrders", value: orders.filter((o) => o.status !== "concluido").length },
    { key: "activeSkus", value: inv.filter((r) => r.qty > 0).length },
  ];
}
