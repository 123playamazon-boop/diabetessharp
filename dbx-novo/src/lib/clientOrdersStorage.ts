import type { ClientOrder } from "../types";
import { apiUrl } from "./apiUrl";
import { jsonAdminHeaders, jsonUserHeaders } from "./authHeaders";
import { normalizeOrderFbaMasterBoxDims } from "./fbaMasterBoxDimsMigrate";
import { inferCreatedAtIsoFromLabel, parseEnvOrderIdToMs } from "./orderTimeline";

export const CLIENT_ORDERS_ADDITIONS_KEY = "dbx.client.orders.additions";
const ORDERS_KEY = CLIENT_ORDERS_ADDITIONS_KEY;

export const ORDERS_UPDATED_EVENT = "dbx-orders-updated";

export type OrderPatchContext = { role: "admin" } | { role: "client"; suite: string };

function isStoredOrder(x: unknown): x is ClientOrder {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.status === "string" &&
    typeof o.service === "string" &&
    typeof o.createdLabel === "string"
  );
}

function hydrateMissingCreatedAtIso(list: ClientOrder[]): ClientOrder[] {
  let changed = false;
  const out = list.map((o) => {
    if (o.createdAtIso && Number.isFinite(Date.parse(o.createdAtIso))) return o;
    const fromLabel = inferCreatedAtIsoFromLabel(o.createdLabel);
    if (fromLabel) {
      changed = true;
      return { ...o, createdAtIso: fromLabel };
    }
    const fromId = parseEnvOrderIdToMs(o.id);
    if (fromId !== undefined) {
      changed = true;
      return { ...o, createdAtIso: new Date(fromId).toISOString() };
    }
    return o;
  });
  if (changed) {
    try {
      localStorage.setItem(ORDERS_KEY, JSON.stringify(out));
      window.dispatchEvent(new CustomEvent(ORDERS_UPDATED_EVENT));
    } catch {
      return list;
    }
  }
  return out;
}

function hydrateFbaMasterBoxDimsLb(list: ClientOrder[]): ClientOrder[] {
  let changed = false;
  const out = list.map((o) => {
    const r = normalizeOrderFbaMasterBoxDims(o);
    if (r.changed) changed = true;
    return r.order;
  });
  if (changed) {
    try {
      localStorage.setItem(ORDERS_KEY, JSON.stringify(out));
      window.dispatchEvent(new CustomEvent(ORDERS_UPDATED_EVENT));
    } catch {
      return list;
    }
  }
  return out;
}

function persistLocalOrders(list: ClientOrder[]): void {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(ORDERS_UPDATED_EVENT));
}

/** Junta lista do servidor com pedidos locais da mesma suite que ainda não existem no servidor (sem misturar outras suites). */
function mergeAfterClientPull(serverOrders: ClientOrder[], localAll: ClientOrder[], suite: string): ClientOrder[] {
  const q = suite.trim();
  const serverIds = new Set(serverOrders.map((o) => o.id));
  const sameSuiteLocalOnly = localAll.filter((o) => (o.suite ?? "").trim() === q && !serverIds.has(o.id));
  const merged = [...serverOrders, ...sameSuiteLocalOnly];
  merged.sort((a, b) => {
    const da = Date.parse(a.createdAtIso ?? "") || 0;
    const db = Date.parse(b.createdAtIso ?? "") || 0;
    return db - da;
  });
  return merged;
}

function mergeAfterAdminPull(serverOrders: ClientOrder[], localAll: ClientOrder[]): ClientOrder[] {
  const serverIds = new Set(serverOrders.map((o) => o.id));
  const localOnly = localAll.filter((o) => !serverIds.has(o.id));
  const merged = [...serverOrders, ...localOnly];
  merged.sort((a, b) => {
    const da = Date.parse(a.createdAtIso ?? "") || 0;
    const db = Date.parse(b.createdAtIso ?? "") || 0;
    return db - da;
  });
  return merged;
}

export function loadAddedClientOrders(): ClientOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const list = parsed.filter(isStoredOrder);
    return hydrateFbaMasterBoxDimsLb(hydrateMissingCreatedAtIso(list));
  } catch {
    return [];
  }
}

function upsertOrderInLocalStorage(order: ClientOrder): void {
  const list = loadAddedClientOrders();
  const i = list.findIndex((o) => o.id === order.id);
  const next = i < 0 ? [order, ...list] : (() => {
    const copy = [...list];
    copy[i] = order;
    return copy;
  })();
  persistLocalOrders(next);
}

export async function pullClientOrdersFromServer(suite: string): Promise<boolean> {
  const q = suite.trim();
  if (!q || typeof window === "undefined") return false;
  try {
    const res = await fetch(apiUrl("/api/client/orders"), { headers: jsonUserHeaders() });
    if (!res.ok) return false;
    const j = (await res.json()) as { orders?: unknown[] };
    let serverList = (Array.isArray(j.orders) ? j.orders : []).filter(isStoredOrder);
    const local = loadAddedClientOrders();
    const serverIds = new Set(serverList.map((o) => o.id));
    const orphanLocal = local.filter((o) => (o.suite ?? "").trim() === q && !serverIds.has(o.id));
    for (const o of orphanLocal) {
      try {
        const post = await fetch(apiUrl("/api/client/orders"), {
          method: "POST",
          headers: jsonUserHeaders(),
          body: JSON.stringify({ order: o }),
        });
        if (post.ok) serverIds.add(o.id);
      } catch {
        /* ignore */
      }
    }
    if (orphanLocal.length) {
      const res2 = await fetch(apiUrl("/api/client/orders"), { headers: jsonUserHeaders() });
      if (res2.ok) {
        const j2 = (await res2.json()) as { orders?: unknown[] };
        serverList = (Array.isArray(j2.orders) ? j2.orders : []).filter(isStoredOrder);
      }
    }
    const merged = mergeAfterClientPull(serverList, loadAddedClientOrders(), q);
    persistLocalOrders(merged);
    return true;
  } catch {
    return false;
  }
}

export async function pullAdminClientOrdersFromServer(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const res = await fetch(apiUrl("/api/admin/client-orders"), { headers: jsonAdminHeaders() });
    if (!res.ok) return false;
    const j = (await res.json()) as { orders?: unknown[] };
    const serverList = (Array.isArray(j.orders) ? j.orders : []).filter(isStoredOrder);
    const local = loadAddedClientOrders();
    const merged = mergeAfterAdminPull(serverList, local);
    persistLocalOrders(merged);
    return true;
  } catch {
    return false;
  }
}

export async function prependClientOrder(order: ClientOrder): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const res = await fetch(apiUrl("/api/client/orders"), {
      method: "POST",
      headers: jsonUserHeaders(),
      body: JSON.stringify({ order }),
    });
    if (res.ok) {
      const j = (await res.json()) as { order?: unknown };
      if (j.order && isStoredOrder(j.order)) {
        upsertOrderInLocalStorage(j.order);
        return;
      }
    }
  } catch {
    /* API off — local only */
  }
  try {
    persistLocalOrders([order, ...loadAddedClientOrders()]);
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      throw new Error("QUOTA_EXCEEDED");
    }
    throw e;
  }
}

export async function removeClientOrder(id: string, suite: string): Promise<boolean> {
  const q = suite.trim();
  if (!q) return false;
  try {
    const res = await fetch(apiUrl(`/api/client/orders/${encodeURIComponent(id)}`), {
      method: "DELETE",
      headers: jsonUserHeaders(),
    });
    if (res.ok) {
      const list = loadAddedClientOrders().filter((o) => o.id !== id);
      persistLocalOrders(list);
      return true;
    }
  } catch {
    /* fallback */
  }
  const list = loadAddedClientOrders();
  const next = list.filter((o) => o.id !== id);
  if (next.length === list.length) return false;
  try {
    persistLocalOrders(next);
  } catch {
    return false;
  }
  return true;
}

export async function updateClientOrder(
  id: string,
  patch: Partial<ClientOrder>,
  ctx?: OrderPatchContext,
): Promise<boolean> {
  const list = loadAddedClientOrders();
  const idx = list.findIndex((o) => o.id === id);

  if (ctx && typeof window !== "undefined") {
    try {
      const url =
        ctx.role === "admin"
          ? apiUrl(`/api/admin/client-orders/${encodeURIComponent(id)}`)
          : apiUrl(`/api/client/orders/${encodeURIComponent(id)}`);
      const body =
        ctx.role === "admin" ? JSON.stringify({ patch }) : JSON.stringify({ suite: ctx.suite, patch });
      const res = await fetch(url, {
        method: "PATCH",
        headers: ctx.role === "admin" ? jsonAdminHeaders() : jsonUserHeaders(),
        body,
      });
      if (res.ok) {
        const j = (await res.json()) as { order?: unknown };
        if (j.order && isStoredOrder(j.order)) {
          upsertOrderInLocalStorage(j.order);
          return true;
        }
      }
    } catch {
      /* fallback local */
    }
  }

  if (idx < 0) return false;
  const next = [...list];
  const cur = { ...(next[idx] as unknown as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    if (v === undefined) continue;
    if (v === null) delete cur[k];
    else cur[k] = v;
  }
  next[idx] = cur as unknown as ClientOrder;
  try {
    persistLocalOrders(next);
  } catch {
    return false;
  }
  return true;
}
