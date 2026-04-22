import { ASSISTED_PURCHASE_ADMIN_API_BASE, ASSISTED_PURCHASE_CLIENT_API_BASE } from "../../shared/assistedPurchaseRoutes";
import { apiUrl } from "./apiUrl";
import { jsonAdminHeaders, jsonUserHeaders } from "./authHeaders";

export type AssistedPurchaseStatus =
  | "pending_review"
  | "waiting_customer_approval"
  | "approved"
  | "purchasing"
  | "purchased"
  | "in_transit"
  | "received"
  | "cancelled";

export type AssistedPurchaseClientAlertType =
  | "price_higher_than_declared"
  | "product_out_of_stock"
  | "characteristics_mismatch"
  | "shipping_timeframe_mismatch";

export type AssistedPurchaseAdminChecklistDto = {
  valueMatchesSupplierScreen: boolean;
  characteristicsMatchLink: boolean;
  shippingMatchesSupplier: boolean;
};

export type AssistedPurchaseDto = {
  id: string;
  suite: string;
  clientName?: string;
  productUrl: string;
  productTitle: string;
  quantity: number;
  notes: string;
  estimatedUnitPriceUsd: number;
  estimatedProductSubtotalUsd: number;
  serviceFeeRate: number;
  estimatedServiceFeeUsd: number;
  floridaTaxRate?: number;
  floridaTaxUsd?: number;
  estimatedTotalUsd: number;
  productImageUrl?: string;
  registeredUnitPriceUsd?: number;
  linkScrapeUnitPriceUsd?: number;
  linkScrapeAtIso?: string;
  finalUnitPriceUsd?: number;
  finalProductSubtotalUsd?: number;
  finalServiceFeeUsd?: number;
  finalFloridaTaxUsd?: number;
  finalTotalUsd?: number;
  status: AssistedPurchaseStatus;
  adminNotes?: string;
  storeName?: string;
  storeOrderId?: string;
  trackingNumber?: string;
  debitedUsd?: number;
  debitedAtIso?: string;
  customerApprovedAtIso?: string;
  auditLog?: { atIso: string; actor: "client" | "admin"; action: string; detail?: string }[];
  requiredDeliveryByDate?: string;
  clientNotifications?: { type: AssistedPurchaseClientAlertType; atIso: string }[];
  adminChecklist?: AssistedPurchaseAdminChecklistDto;
  createdAtIso: string;
  updatedAtIso: string;
};

export async function fetchClientAssistedPurchases(
  suite: string,
): Promise<{ ok: true; purchases: AssistedPurchaseDto[] } | { ok: false; error: string }> {
  try {
    const res = await fetch(apiUrl(`${ASSISTED_PURCHASE_CLIENT_API_BASE}?${new URLSearchParams({ suite })}`), {
      headers: jsonUserHeaders(),
    });
    const j = (await res.json()) as { purchases?: unknown; error?: string };
    if (!res.ok) return { ok: false, error: typeof j.error === "string" ? j.error : "Falha." };
    if (!Array.isArray(j.purchases)) return { ok: false, error: "Resposta inválida." };
    return { ok: true, purchases: j.purchases as AssistedPurchaseDto[] };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

export async function postClientAssistedPurchase(body: {
  suite: string;
  productUrl: string;
  productTitle: string;
  quantity: number;
  notes: string;
  unitPriceUsd: number;
  requiredDeliveryByDate: string;
}): Promise<
  { ok: true; purchase: AssistedPurchaseDto; scrapedPriceAboveRegistered?: boolean } | { ok: false; error: string }
> {
  try {
    const res = await fetch(apiUrl(ASSISTED_PURCHASE_CLIENT_API_BASE), {
      method: "POST",
      headers: jsonUserHeaders(),
      body: JSON.stringify(body),
    });
    const j = (await res.json()) as {
      ok?: boolean;
      purchase?: AssistedPurchaseDto;
      scrapedPriceAboveRegistered?: boolean;
      error?: string;
    };
    if (!res.ok || !j.purchase) return { ok: false, error: typeof j.error === "string" ? j.error : "Falha." };
    return { ok: true, purchase: j.purchase, scrapedPriceAboveRegistered: j.scrapedPriceAboveRegistered === true };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

export async function postClientAssistedPurchaseApprove(
  suite: string,
  id: string,
): Promise<{ ok: true; purchase: AssistedPurchaseDto; balanceUsd: number } | { ok: false; error: string }> {
  try {
    const res = await fetch(
      apiUrl(`${ASSISTED_PURCHASE_CLIENT_API_BASE}/${encodeURIComponent(id)}/approve?${new URLSearchParams({ suite })}`),
      { method: "POST", headers: jsonUserHeaders() },
    );
    const j = (await res.json()) as { purchase?: AssistedPurchaseDto; balanceUsd?: number; error?: string };
    if (!res.ok || !j.purchase || typeof j.balanceUsd !== "number") {
      return { ok: false, error: typeof j.error === "string" ? j.error : "Falha." };
    }
    return { ok: true, purchase: j.purchase, balanceUsd: j.balanceUsd };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

export async function postClientAssistedPurchaseCancel(
  suite: string,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(
      apiUrl(`${ASSISTED_PURCHASE_CLIENT_API_BASE}/${encodeURIComponent(id)}/cancel?${new URLSearchParams({ suite })}`),
      { method: "POST", headers: jsonUserHeaders() },
    );
    const j = (await res.json()) as { error?: string };
    if (!res.ok) return { ok: false, error: typeof j.error === "string" ? j.error : "Falha." };
    return { ok: true };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

export async function fetchAdminAssistedPurchases(
  status?: string,
): Promise<{ ok: true; purchases: AssistedPurchaseDto[] } | { ok: false; error: string }> {
  try {
    const q = status?.trim() ? new URLSearchParams({ status: status.trim() }) : "";
    const res = await fetch(apiUrl(`${ASSISTED_PURCHASE_ADMIN_API_BASE}${q ? `?${q}` : ""}`), {
      headers: jsonAdminHeaders(),
    });
    const j = (await res.json()) as { purchases?: unknown; error?: string };
    if (!res.ok) return { ok: false, error: typeof j.error === "string" ? j.error : "Falha." };
    if (!Array.isArray(j.purchases)) return { ok: false, error: "Resposta inválida." };
    return { ok: true, purchases: j.purchases as AssistedPurchaseDto[] };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

export async function patchAdminAssistedReview(
  id: string,
  body: { adminNotes?: string; productTitle?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(apiUrl(`${ASSISTED_PURCHASE_ADMIN_API_BASE}/${encodeURIComponent(id)}/review`), {
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

export async function patchAdminAssistedChecklist(
  id: string,
  body: AssistedPurchaseAdminChecklistDto,
): Promise<{ ok: true; purchase: AssistedPurchaseDto } | { ok: false; error: string }> {
  try {
    const res = await fetch(apiUrl(`${ASSISTED_PURCHASE_ADMIN_API_BASE}/${encodeURIComponent(id)}/checklist`), {
      method: "PATCH",
      headers: jsonAdminHeaders(),
      body: JSON.stringify(body),
    });
    const j = (await res.json()) as { purchase?: AssistedPurchaseDto; error?: string };
    if (!res.ok || !j.purchase) return { ok: false, error: typeof j.error === "string" ? j.error : "Falha." };
    return { ok: true, purchase: j.purchase };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

export async function postAdminAssistedNotifyClient(
  id: string,
  body: { type: AssistedPurchaseClientAlertType },
): Promise<{ ok: true; purchase: AssistedPurchaseDto } | { ok: false; error: string }> {
  try {
    const res = await fetch(apiUrl(`${ASSISTED_PURCHASE_ADMIN_API_BASE}/${encodeURIComponent(id)}/notify-client`), {
      method: "POST",
      headers: jsonAdminHeaders(),
      body: JSON.stringify(body),
    });
    const j = (await res.json()) as { purchase?: AssistedPurchaseDto; error?: string };
    if (!res.ok || !j.purchase) return { ok: false, error: typeof j.error === "string" ? j.error : "Falha." };
    return { ok: true, purchase: j.purchase };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

export async function postAdminAssistedRefreshLink(
  id: string,
): Promise<
  | { ok: true; purchase: AssistedPurchaseDto; scrapedPriceAboveRegistered?: boolean }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch(apiUrl(`${ASSISTED_PURCHASE_ADMIN_API_BASE}/${encodeURIComponent(id)}/refresh-link`), {
      method: "POST",
      headers: jsonAdminHeaders(),
    });
    const j = (await res.json()) as {
      ok?: boolean;
      purchase?: AssistedPurchaseDto;
      scrapedPriceAboveRegistered?: boolean;
      error?: string;
    };
    if (!res.ok || !j.purchase) return { ok: false, error: typeof j.error === "string" ? j.error : "Falha." };
    return { ok: true, purchase: j.purchase, scrapedPriceAboveRegistered: j.scrapedPriceAboveRegistered === true };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

export async function patchAdminAssistedUpdatePrice(
  id: string,
  body: { finalUnitPriceUsd?: number; acceptEstimate?: boolean },
): Promise<
  | { ok: true; debited?: boolean; needsClientApproval?: boolean; balanceUsd?: number }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch(apiUrl(`${ASSISTED_PURCHASE_ADMIN_API_BASE}/${encodeURIComponent(id)}/update-price`), {
      method: "PATCH",
      headers: jsonAdminHeaders(),
      body: JSON.stringify(body),
    });
    const j = (await res.json()) as { debited?: boolean; needsClientApproval?: boolean; balanceUsd?: number; error?: string };
    if (!res.ok) return { ok: false, error: typeof j.error === "string" ? j.error : "Falha." };
    return { ok: true, debited: j.debited, needsClientApproval: j.needsClientApproval, balanceUsd: j.balanceUsd };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

export async function postAdminAssistedPurchaseOps(
  id: string,
  body: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(apiUrl(`${ASSISTED_PURCHASE_ADMIN_API_BASE}/${encodeURIComponent(id)}/purchase`), {
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
