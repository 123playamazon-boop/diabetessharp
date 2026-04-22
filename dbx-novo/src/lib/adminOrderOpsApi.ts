import { apiUrl } from "./apiUrl";
import { jsonAdminHeaders } from "./authHeaders";

export async function postAcceptProduction(body: {
  orderId: string;
  suite?: string;
  clientName?: string;
  acceptedAtIso: string;
}): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(apiUrl("/api/admin/orders/accept-production"), {
      method: "POST",
      headers: jsonAdminHeaders(),
      body: JSON.stringify(body),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

export async function postPrepKitDeliver(
  orderId: string,
  outputs: { id: string; title: string; qty: number }[],
): Promise<{ ok: boolean; order?: unknown; error?: string }> {
  try {
    const res = await fetch(apiUrl(`/api/admin/client-orders/${encodeURIComponent(orderId)}/prep-kit-deliver`), {
      method: "POST",
      headers: jsonAdminHeaders(),
      body: JSON.stringify({ outputs }),
    });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; order?: unknown; error?: string };
    if (!res.ok) return { ok: false, error: typeof j.error === "string" ? j.error : "Falha ao disponibilizar stock." };
    return { ok: true, order: j.order };
  } catch {
    return { ok: false, error: "Rede indisponível." };
  }
}

export async function postNotifyShipped(body: {
  orderId: string;
  suite?: string;
  clientName?: string;
  service?: string;
  units: number;
  productSummary: string;
  trackingUrl?: string;
  shippedAtIso: string;
}): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(apiUrl("/api/admin/orders/notify-shipped"), {
      method: "POST",
      headers: jsonAdminHeaders(),
      body: JSON.stringify(body),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}
