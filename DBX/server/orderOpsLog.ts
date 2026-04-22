import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data", "order-ops-log.json");

export type OrderOpsEvent = {
  atIso: string;
  type: "accept_production" | "notify_shipped";
  orderId: string;
  suite?: string;
  clientName?: string;
  units?: number;
  service?: string;
  productSummary?: string;
  trackingUrl?: string;
};

function readAll(): OrderOpsEvent[] {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const j = JSON.parse(raw) as unknown;
    return Array.isArray(j) ? (j as OrderOpsEvent[]) : [];
  } catch {
    return [];
  }
}

export function appendOrderOpsEvent(entry: Omit<OrderOpsEvent, "atIso"> & { atIso?: string }): OrderOpsEvent {
  const full: OrderOpsEvent = { ...entry, atIso: entry.atIso ?? new Date().toISOString() };
  const list = readAll();
  list.push(full);
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), "utf8");
  console.log(`[dbx-order-ops] ${full.type} order=${full.orderId}`);
  return full;
}

export function clearOrderOpsLog(): void {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, "[]", "utf8");
}
