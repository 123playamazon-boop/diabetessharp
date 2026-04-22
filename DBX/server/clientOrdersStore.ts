import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findBySuite } from "./clientRegistryStore";
import { queueDemoEmail } from "./emailOutbox";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data", "client-orders.json");

type Snapshot = { orders: Record<string, unknown>[] };

function empty(): Snapshot {
  return { orders: [] };
}

function loadSnapshot(): Snapshot {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return empty();
    const o = j as Record<string, unknown>;
    if (!Array.isArray(o.orders)) return empty();
    return { orders: o.orders.filter((x) => x && typeof x === "object") as Record<string, unknown>[] };
  } catch {
    return empty();
  }
}

function persist(s: Snapshot): void {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(s, null, 0), "utf8");
}

export function readAllClientOrders(): Record<string, unknown>[] {
  return loadSnapshot().orders;
}

export function replaceAllClientOrders(orders: Record<string, unknown>[]): void {
  persist({ orders: [...orders] });
}

export function clearClientOrders(): void {
  persist(empty());
}

export function listClientOrdersBySuite(suite: string): Record<string, unknown>[] {
  const q = suite.trim();
  if (!q) return [];
  return loadSnapshot().orders.filter((o) => typeof o.suite === "string" && o.suite.trim() === q);
}

export function prependClientOrder(order: Record<string, unknown>): Record<string, unknown> {
  const id = typeof order.id === "string" ? order.id : "";
  if (!id) throw new Error("Pedido sem id.");
  const s = loadSnapshot();
  const next = s.orders.filter((o) => o.id !== id);
  persist({ orders: [order, ...next] });
  return order;
}

function mergePatch(existing: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out = { ...existing };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (v === null) {
      delete out[k];
      continue;
    }
    out[k] = v;
  }
  return out;
}

export function patchClientOrder(id: string, patch: Record<string, unknown>): Record<string, unknown> | null {
  const s = loadSnapshot();
  const i = s.orders.findIndex((o) => o.id === id);
  if (i < 0) return null;
  const prev = s.orders[i]!;
  const merged = mergePatch({ ...prev }, patch);
  const prevStatus = String(prev.status ?? "");
  const nextStatus = String(merged.status ?? "");
  if (nextStatus === "aguardando_cliente" && prevStatus !== "aguardando_cliente") {
    merged.movedToAwaitingClientAtIso = new Date().toISOString();
    merged.awaitingClientReminderSentAtIso = undefined;
  }
  const next = [...s.orders];
  next[i] = merged;
  persist({ orders: next });
  return merged;
}

const AWAITING_REMINDER_MS = 24 * 60 * 60 * 1000;

/** Enfileira e-mail de lembrete (demo) para pedidos «Aguardando o cliente» há mais de 24h. */
export function runAwaitingClientReminderScan(): number {
  const beforeMigrate = readAllClientOrders();
  for (const row of beforeMigrate) {
    if (String(row.status) !== "aguardando_cliente") continue;
    if (typeof row.movedToAwaitingClientAtIso === "string" && row.movedToAwaitingClientAtIso.trim()) continue;
    const id = String(row.id ?? "");
    if (!id) continue;
    const fallback =
      typeof row.opsAcceptedAtIso === "string" && row.opsAcceptedAtIso.trim()
        ? row.opsAcceptedAtIso.trim()
        : typeof row.createdAtIso === "string" && row.createdAtIso.trim()
          ? row.createdAtIso.trim()
          : "";
    if (fallback) patchClientOrder(id, { movedToAwaitingClientAtIso: fallback });
  }

  const rows = readAllClientOrders();
  const pending: { id: string; to: string; name: string }[] = [];
  for (const row of rows) {
    if (String(row.status) !== "aguardando_cliente") continue;
    const moved = typeof row.movedToAwaitingClientAtIso === "string" ? row.movedToAwaitingClientAtIso.trim() : "";
    if (!moved) continue;
    if (typeof row.awaitingClientReminderSentAtIso === "string" && row.awaitingClientReminderSentAtIso.trim()) continue;
    const t0 = Date.parse(moved);
    if (!Number.isFinite(t0) || Date.now() - t0 < AWAITING_REMINDER_MS) continue;
    const suite = typeof row.suite === "string" ? row.suite.trim() : "";
    if (!suite) continue;
    const c = findBySuite(suite);
    const to = c?.email?.trim();
    if (!to) continue;
    const id = String(row.id ?? "");
    if (!id) continue;
    const name = typeof row.clientName === "string" ? row.clientName.trim() : "";
    pending.push({ id, to, name });
  }
  let sent = 0;
  for (const p of pending) {
    queueDemoEmail({
      to: p.to,
      subject: `[Direct Box / demo] Lembrete: pedido ${p.id} aguarda a sua ação`,
      text: `Olá${p.name ? ` ${p.name}` : ""},\n\nO pedido ${p.id} está «Aguardando o cliente» há mais de 24 horas. Entre no portal em Pedidos → separador «Aguardando o cliente» para corrigir etiquetas ou informações pedidas pela equipa.\n\n(demo — e-mail simulado; ver ficheiro email-outbox.json no servidor)\n`,
      meta: { type: "awaiting_client_reminder", orderId: p.id },
    });
    patchClientOrder(p.id, { awaitingClientReminderSentAtIso: new Date().toISOString() });
    sent++;
  }
  return sent;
}

export function deleteClientOrder(id: string): boolean {
  const s = loadSnapshot();
  const next = s.orders.filter((o) => o.id !== id);
  if (next.length === s.orders.length) return false;
  persist({ orders: next });
  return true;
}
