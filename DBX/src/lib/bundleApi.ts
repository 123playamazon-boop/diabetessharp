import { apiUrl } from "./apiUrl";
import { jsonAdminHeaders, jsonUserHeaders } from "./authHeaders";

export type BundleOrderStatus =
  | "pending"
  | "picking"
  | "assembling"
  | "quality_check"
  | "completed"
  | "cancelled";

export type BundleItem = { productSku: string; qtyPerBundle: number };

export type BundleRecord = {
  id: string;
  suite: string;
  name: string;
  bundleSku: string;
  clientDescription?: string;
  assemblyFeeUsd: number;
  setupFeeUsd: number;
  items: BundleItem[];
  createdAtIso: string;
  updatedAtIso: string;
};

export type BundleOrderLog = {
  id: string;
  bundleOrderId: string;
  status: BundleOrderStatus;
  changedBy: "system" | "client" | "admin";
  note?: string;
  atIso: string;
};

export type BundleOrder = {
  id: string;
  suite: string;
  bundleId: string;
  bundleSku?: string;
  bundleName?: string;
  quantity: number;
  status: BundleOrderStatus;
  totalFeeUsd: number;
  labelFnsku?: string;
  qcPhotoDataUrl?: string;
  pickingNotes?: string;
  batchSize?: number;
  lineNotes?: string;
  assemblyGroupId?: string;
  groupLineIndex?: number;
  groupLineCount?: number;
  /** Presente nos pedidos novos: reserva de stock na criação. */
  reservedDeductions?: { id: string; qty: number }[];
  createdAtIso: string;
  updatedAtIso: string;
  logs: BundleOrderLog[];
};

export type BundleOrderLinePayload = { bundleId: string; quantity: number; lineNotes?: string };

async function parseJson<T>(res: Response): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const raw = await res.text();
  const trimmed = raw.trimStart();
  if (trimmed.startsWith("<!") || trimmed.startsWith("<html")) {
    return {
      ok: false,
      error:
        "A API devolveu HTML em vez de JSON. Confirme o servidor em /health e o proxy Vite para /api.",
    };
  }
  try {
    return { ok: true, data: JSON.parse(raw) as T };
  } catch {
    return { ok: false, error: "Resposta inválida da API." };
  }
}

export async function fetchBundles(suite: string): Promise<{ ok: true; bundles: BundleRecord[] } | { ok: false; error: string }> {
  const q = new URLSearchParams({ suite: suite.trim() });
  const res = await fetch(apiUrl(`/api/client/bundles?${q}`), { headers: jsonUserHeaders() });
  const p = await parseJson<{ bundles?: BundleRecord[]; error?: string }>(res);
  if (!p.ok) return p;
  const j = p.data;
  if (!res.ok) return { ok: false, error: typeof j.error === "string" ? j.error : "Falha ao listar kits." };
  return { ok: true, bundles: Array.isArray(j.bundles) ? j.bundles : [] };
}

export async function fetchBundleById(
  suite: string,
  id: string,
): Promise<{ ok: true; bundle: BundleRecord } | { ok: false; error: string }> {
  const q = new URLSearchParams({ suite: suite.trim() });
  const res = await fetch(apiUrl(`/api/client/bundles/${encodeURIComponent(id)}?${q}`), {
    headers: jsonUserHeaders(),
  });
  const p = await parseJson<{ bundle?: BundleRecord; error?: string }>(res);
  if (!p.ok) return p;
  const j = p.data;
  if (!res.ok || !j.bundle) return { ok: false, error: typeof j.error === "string" ? j.error : "Kit não encontrado." };
  return { ok: true, bundle: j.bundle };
}

export async function postCreateBundle(body: {
  suite: string;
  name: string;
  bundleSku: string;
  items: BundleItem[];
  clientDescription?: string;
  assemblyFeeUsd?: number;
  setupFeeUsd?: number;
}): Promise<{ ok: true; bundle: BundleRecord } | { ok: false; error: string }> {
  const res = await fetch(apiUrl("/api/client/bundles"), {
    method: "POST",
    headers: jsonUserHeaders(),
    body: JSON.stringify(body),
  });
  const p = await parseJson<{ ok?: boolean; bundle?: BundleRecord; error?: string }>(res);
  if (!p.ok) return p;
  const j = p.data;
  if (!res.ok || !j.bundle) return { ok: false, error: typeof j.error === "string" ? j.error : "Não foi possível criar o kit." };
  return { ok: true, bundle: j.bundle };
}

export async function fetchBundleOrders(
  suite: string,
): Promise<{ ok: true; orders: BundleOrder[] } | { ok: false; error: string }> {
  const q = new URLSearchParams({ suite: suite.trim() });
  const res = await fetch(apiUrl(`/api/client/bundle-orders?${q}`), { headers: jsonUserHeaders() });
  const p = await parseJson<{ orders?: BundleOrder[]; error?: string }>(res);
  if (!p.ok) return p;
  const j = p.data;
  if (!res.ok) return { ok: false, error: typeof j.error === "string" ? j.error : "Falha ao listar pedidos." };
  return { ok: true, orders: Array.isArray(j.orders) ? j.orders : [] };
}

export async function fetchBundleOrderById(
  suite: string,
  id: string,
): Promise<{ ok: true; order: BundleOrder } | { ok: false; error: string }> {
  const q = new URLSearchParams({ suite: suite.trim() });
  const res = await fetch(apiUrl(`/api/client/bundle-orders/${encodeURIComponent(id)}?${q}`), {
    headers: jsonUserHeaders(),
  });
  const p = await parseJson<{ order?: BundleOrder; error?: string }>(res);
  if (!p.ok) return p;
  const j = p.data;
  if (!res.ok || !j.order) return { ok: false, error: typeof j.error === "string" ? j.error : "Pedido não encontrado." };
  return { ok: true, order: j.order };
}

export type PostBundleOrderResult =
  | { ok: true; order: BundleOrder; balanceUsd: number }
  | { ok: true; orders: BundleOrder[]; balanceUsd: number; assemblyGroupId?: string }
  | { ok: false; error: string };

export async function postCreateBundleOrder(body: {
  suite: string;
  bundleId?: string;
  quantity?: number;
  lines?: BundleOrderLinePayload[];
  labelFnsku?: string;
  pickingNotes?: string;
  batchSize?: number;
  lineNotes?: string;
}): Promise<PostBundleOrderResult> {
  const res = await fetch(apiUrl("/api/client/bundle-orders"), {
    method: "POST",
    headers: jsonUserHeaders(),
    body: JSON.stringify(body),
  });
  const p = await parseJson<{
    ok?: boolean;
    order?: BundleOrder;
    orders?: BundleOrder[];
    balanceUsd?: number;
    assemblyGroupId?: string;
    error?: string;
  }>(res);
  if (!p.ok) return p;
  const j = p.data;
  if (!res.ok || typeof j.balanceUsd !== "number") {
    return { ok: false, error: typeof j.error === "string" ? j.error : "Não foi possível criar o pedido." };
  }
  if (Array.isArray(j.orders) && j.orders.length > 0) {
    return { ok: true, orders: j.orders, balanceUsd: j.balanceUsd, assemblyGroupId: j.assemblyGroupId };
  }
  if (j.order) {
    return { ok: true, order: j.order, balanceUsd: j.balanceUsd };
  }
  return { ok: false, error: typeof j.error === "string" ? j.error : "Resposta inesperada da API." };
}

export async function adminFetchBundleOrders(
  status?: BundleOrderStatus,
): Promise<{ ok: true; orders: BundleOrder[] } | { ok: false; error: string }> {
  const q = status ? new URLSearchParams({ status }) : "";
  const res = await fetch(apiUrl(`/api/admin/bundle-orders${q ? `?${q}` : ""}`), { headers: jsonAdminHeaders() });
  const p = await parseJson<{ orders?: BundleOrder[]; error?: string }>(res);
  if (!p.ok) return p;
  const j = p.data;
  if (!res.ok) return { ok: false, error: typeof j.error === "string" ? j.error : "Falha ao listar (admin)." };
  return { ok: true, orders: Array.isArray(j.orders) ? j.orders : [] };
}

export async function adminPatchBundleOrderStatus(
  id: string,
  status: BundleOrderStatus,
): Promise<{ ok: true; order: BundleOrder } | { ok: false; error: string }> {
  const res = await fetch(apiUrl(`/api/admin/bundle-orders/${encodeURIComponent(id)}/status`), {
    method: "PATCH",
    headers: jsonAdminHeaders(),
    body: JSON.stringify({ status }),
  });
  const p = await parseJson<{ ok?: boolean; order?: BundleOrder; error?: string }>(res);
  if (!p.ok) return p;
  const j = p.data;
  if (!res.ok || !j.order) return { ok: false, error: typeof j.error === "string" ? j.error : "Atualização rejeitada." };
  return { ok: true, order: j.order };
}

export async function adminCompleteBundleOrder(
  id: string,
): Promise<{ ok: true; order: BundleOrder } | { ok: false; error: string }> {
  const res = await fetch(apiUrl(`/api/admin/bundle-orders/${encodeURIComponent(id)}/complete`), {
    method: "POST",
    headers: jsonAdminHeaders(),
  });
  const p = await parseJson<{ ok?: boolean; order?: BundleOrder; error?: string }>(res);
  if (!p.ok) return p;
  const j = p.data;
  if (!res.ok || !j.order) return { ok: false, error: typeof j.error === "string" ? j.error : "Conclusão rejeitada." };
  return { ok: true, order: j.order };
}

export async function adminPatchBundleOrderMeta(
  id: string,
  body: { labelFnsku?: string; qcPhotoDataUrl?: string },
): Promise<{ ok: true; order: BundleOrder } | { ok: false; error: string }> {
  const res = await fetch(apiUrl(`/api/admin/bundle-orders/${encodeURIComponent(id)}/meta`), {
    method: "PATCH",
    headers: jsonAdminHeaders(),
    body: JSON.stringify(body),
  });
  const p = await parseJson<{ ok?: boolean; order?: BundleOrder; error?: string }>(res);
  if (!p.ok) return p;
  const j = p.data;
  if (!res.ok || !j.order) return { ok: false, error: typeof j.error === "string" ? j.error : "Meta inválida." };
  return { ok: true, order: j.order };
}
