import type { ClientProfile } from "../types";
import { getMergedInventoryView } from "./clientInventoryStorage";
import { inventoryRowsForSuite, ordersForSuite, getMergedClientOrders } from "./clientDashboardMetrics";
import { storageUrgency } from "./storageFreeTier";

const DISMISS_KEY = "dbx.notify.dismissed";

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    const j = JSON.parse(raw) as unknown;
    if (!Array.isArray(j)) return new Set();
    return new Set(j.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

/** Para filtrar cartões na UI (ex.: tickets de suporte dispensados). */
export function getDismissedNotificationIds(): Set<string> {
  return loadDismissed();
}

export function supportTicketNotificationDismissId(ticketId: string): string {
  return `support-${ticketId}`;
}

export function dismissNotification(id: string): void {
  const s = loadDismissed();
  s.add(id);
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify([...s]));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("dbx:notifications-updated"));
}

export type SyncNotificationItem = {
  id: string;
  severity: "info" | "warning" | "danger";
  titleKey: string;
  bodyKey: string;
  bodyParams?: Record<string, string | number>;
  href: string;
};

export function buildSyncNotificationItems(profile: ClientProfile, suite: string): SyncNotificationItem[] {
  const dismissed = loadDismissed();
  const out: SyncNotificationItem[] = [];
  const s = suite.trim();

  if (profile.balanceUsd < 25 && !dismissed.has("balance-low")) {
    out.push({
      id: "balance-low",
      severity: "warning",
      titleKey: "client.notify.balanceTitle",
      bodyKey: "client.notify.balanceBody",
      bodyParams: { bal: profile.balanceUsd.toFixed(2) },
      href: "/app/financial",
    });
  }

  const inv = inventoryRowsForSuite(getMergedInventoryView(), s);
  for (const row of inv) {
    if (row.qty <= 0) continue;
    const u = storageUrgency(row);
    const nid = `storage-${row.id}`;
    if ((u === "warning" || u === "critical" || u === "expired") && !dismissed.has(nid)) {
      out.push({
        id: nid,
        severity: u === "expired" ? "danger" : "warning",
        titleKey: "client.notify.storageTitle",
        bodyKey: "client.notify.storageBody",
        bodyParams: { title: row.title, asin: row.asin },
        href: "/app/estoque",
      });
    }
  }

  const orders = ordersForSuite(getMergedClientOrders(), s);
  const awaiting = orders.filter((o) => o.status === "aguardando_cliente");
  for (const o of awaiting) {
    const nid = `order-await-${o.id}`;
    if (!dismissed.has(nid)) {
      out.push({
        id: nid,
        severity: "danger",
        titleKey: "client.notify.orderAwaitTitle",
        bodyKey: "client.notify.orderAwaitBody",
        bodyParams: { id: o.id },
        href: "/app/pedidos",
      });
    }
  }

  const problems = inv.filter((r) => r.kind === "problema" && r.qty > 0);
  if (problems.length > 0 && !dismissed.has("inventory-problems")) {
    out.push({
      id: "inventory-problems",
      severity: "danger",
      titleKey: "client.notify.problemsTitle",
      bodyKey: "client.notify.problemsBody",
      bodyParams: { n: problems.length },
      href: "/app/estoque?aba=problemas",
    });
  }

  return out;
}

export function countSyncUrgentNotifications(profile: ClientProfile, suite: string): number {
  return buildSyncNotificationItems(profile, suite).length;
}
