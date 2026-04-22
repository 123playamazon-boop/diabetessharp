import { apiUrl } from "./apiUrl";
import { jsonAdminHeaders, jsonUserHeaders } from "./authHeaders";

export type VipStoreProductDto = {
  id: string;
  title: string;
  shortDescription: string;
  unitPriceUsd: number;
  referenceCostUsd?: number;
  stockQty: number;
  imageUrl?: string;
  supplierUrl?: string;
  observationsDetail?: string;
  designerNotes?: string;
  active: boolean;
  category: string;
  createdAtIso: string;
};

export type VipStoreImportPreviewOk = {
  ok: true;
  scraped: {
    title: string | null;
    description: string | null;
    imageUrl: string | null;
    brand: string | null;
    supplier: string;
    sourceUrl: string;
    priceUsd: number | null;
  };
  referenceCostUsd: number | null;
  unitPriceUsdSuggested: number | null;
  minMarkupPct: number;
};

export type VipStoreOrderDto = {
  id: string;
  suite: string;
  clientName?: string;
  items: { productId: string; title: string; qty: number; unitPriceUsd: number; lineTotalUsd: number }[];
  subtotalUsd: number;
  platformFeeUsd: number;
  totalUsd: number;
  status: string;
  noteAdmin?: string;
  createdAtIso: string;
  updatedAtIso: string;
};

export async function fetchVipStoreCatalog(): Promise<
  | { ok: true; feePct: number; products: VipStoreProductDto[] }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch(apiUrl("/api/client/vip-store/catalog"));
    const j = (await res.json()) as { feePct?: unknown; products?: unknown; error?: string };
    if (!res.ok) return { ok: false, error: typeof j.error === "string" ? j.error : "Falha." };
    const feePct = typeof j.feePct === "number" && Number.isFinite(j.feePct) ? j.feePct : 0.05;
    if (!Array.isArray(j.products)) return { ok: false, error: "Resposta inválida." };
    return { ok: true, feePct, products: j.products as VipStoreProductDto[] };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

export async function fetchVipStoreOrders(
  _suite: string,
): Promise<{ ok: true; orders: VipStoreOrderDto[] } | { ok: false; error: string }> {
  try {
    const res = await fetch(apiUrl("/api/client/vip-store/orders"), {
      headers: jsonUserHeaders(),
    });
    const j = (await res.json()) as { orders?: unknown; error?: string };
    if (!res.ok) return { ok: false, error: typeof j.error === "string" ? j.error : "Falha." };
    if (!Array.isArray(j.orders)) return { ok: false, error: "Resposta inválida." };
    return { ok: true, orders: j.orders as VipStoreOrderDto[] };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

export async function postVipStoreCheckout(
  suite: string,
  lines: { productId: string; qty: number }[],
): Promise<
  { ok: true; order: VipStoreOrderDto; balanceUsd: number } | { ok: false; error: string }
> {
  try {
    const res = await fetch(apiUrl("/api/client/vip-store/checkout"), {
      method: "POST",
      headers: jsonUserHeaders(),
      body: JSON.stringify({ suite, lines }),
    });
    const j = (await res.json()) as { ok?: boolean; order?: VipStoreOrderDto; balanceUsd?: number; error?: string };
    if (!res.ok || !j.order || typeof j.balanceUsd !== "number") {
      return { ok: false, error: typeof j.error === "string" ? j.error : "Checkout falhou." };
    }
    return { ok: true, order: j.order, balanceUsd: j.balanceUsd };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

export async function fetchAdminVipStore(): Promise<
  | { ok: true; platformFeePct: number; products: VipStoreProductDto[]; orders: VipStoreOrderDto[] }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch(apiUrl("/api/admin/vip-store"), { headers: jsonAdminHeaders() });
    const j = (await res.json()) as {
      platformFeePct?: unknown;
      products?: unknown;
      orders?: unknown;
      error?: string;
    };
    if (!res.ok) return { ok: false, error: typeof j.error === "string" ? j.error : "Falha." };
    const platformFeePct = typeof j.platformFeePct === "number" ? j.platformFeePct : 0.05;
    if (!Array.isArray(j.products) || !Array.isArray(j.orders)) return { ok: false, error: "Resposta inválida." };
    return {
      ok: true,
      platformFeePct,
      products: j.products as VipStoreProductDto[],
      orders: j.orders as VipStoreOrderDto[],
    };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

export async function patchAdminVipStoreFee(pct: number): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(apiUrl("/api/admin/vip-store/settings"), {
      method: "PATCH",
      headers: jsonAdminHeaders(),
      body: JSON.stringify({ platformFeePct: pct }),
    });
    const j = (await res.json()) as { error?: string };
    if (!res.ok) return { ok: false, error: typeof j.error === "string" ? j.error : "Falha." };
    return { ok: true };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

export async function postAdminVipStorePreviewImport(
  url: string,
): Promise<{ ok: true; data: VipStoreImportPreviewOk } | { ok: false; error: string }> {
  try {
    const res = await fetch(apiUrl("/api/admin/vip-store/preview-import"), {
      method: "POST",
      headers: jsonAdminHeaders(),
      body: JSON.stringify({ url }),
    });
    const j = (await res.json()) as { ok?: boolean; error?: string } & Partial<VipStoreImportPreviewOk>;
    if (!res.ok || !j.ok || !j.scraped) {
      return { ok: false, error: typeof j.error === "string" ? j.error : "Falha na importação." };
    }
    return {
      ok: true,
      data: {
        ok: true,
        scraped: j.scraped,
        referenceCostUsd: typeof j.referenceCostUsd === "number" ? j.referenceCostUsd : null,
        unitPriceUsdSuggested: typeof j.unitPriceUsdSuggested === "number" ? j.unitPriceUsdSuggested : null,
        minMarkupPct: typeof j.minMarkupPct === "number" ? j.minMarkupPct : 0.15,
      },
    };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

export async function postAdminVipStoreProduct(body: Record<string, unknown>): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(apiUrl("/api/admin/vip-store/products"), {
      method: "POST",
      headers: jsonAdminHeaders(),
      body: JSON.stringify(body),
    });
    const j = (await res.json()) as { error?: string };
    if (!res.ok) return { ok: false, error: typeof j.error === "string" ? j.error : "Falha." };
    return { ok: true };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

export async function patchAdminVipStoreProduct(
  id: string,
  body: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(apiUrl(`/api/admin/vip-store/products/${encodeURIComponent(id)}`), {
      method: "PATCH",
      headers: jsonAdminHeaders(),
      body: JSON.stringify(body),
    });
    const j = (await res.json()) as { error?: string };
    if (!res.ok) return { ok: false, error: typeof j.error === "string" ? j.error : "Falha." };
    return { ok: true };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

export async function patchAdminVipStoreOrder(
  id: string,
  body: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(apiUrl(`/api/admin/vip-store/orders/${encodeURIComponent(id)}`), {
      method: "PATCH",
      headers: jsonAdminHeaders(),
      body: JSON.stringify(body),
    });
    const j = (await res.json()) as { error?: string };
    if (!res.ok) return { ok: false, error: typeof j.error === "string" ? j.error : "Falha." };
    return { ok: true };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

export async function postAdminVipStoreRefund(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(apiUrl(`/api/admin/vip-store/orders/${encodeURIComponent(id)}/refund`), {
      method: "POST",
      headers: jsonAdminHeaders(),
    });
    const j = (await res.json()) as { error?: string };
    if (!res.ok) return { ok: false, error: typeof j.error === "string" ? j.error : "Falha." };
    return { ok: true };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}
