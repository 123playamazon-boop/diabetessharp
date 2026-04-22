import type { ClientProfile, ClientRegisterPayload } from "../types";
import { apiUrl } from "./apiUrl";
import { jsonUserHeaders, saveClientAccessToken } from "./authHeaders";
import { CLIENT_INVENTORY_ADDITIONS_KEY, CLIENT_INVENTORY_DEDUCTIONS_KEY, INVENTORY_UPDATED_EVENT } from "./clientInventoryStorage";
import { CLIENT_ORDERS_ADDITIONS_KEY, ORDERS_UPDATED_EVENT } from "./clientOrdersStorage";

const PROFILE_KEY = "dbx.client.profile";

const INTL_BR_KEY = "dbx.client.intlBr.declarations";
const VIP_READ_IDS_KEY = "dbx.vip.announcementReadIds";

/** Apaga caches locais do portal (inventário, pedidos, etc.) — outra suite ou reset no servidor. */
export function clearClientBrowserCaches(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CLIENT_INVENTORY_ADDITIONS_KEY);
    localStorage.removeItem(CLIENT_INVENTORY_DEDUCTIONS_KEY);
    localStorage.removeItem(CLIENT_ORDERS_ADDITIONS_KEY);
    localStorage.removeItem(INTL_BR_KEY);
    localStorage.removeItem(VIP_READ_IDS_KEY);
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(INVENTORY_UPDATED_EVENT));
    window.dispatchEvent(new CustomEvent(ORDERS_UPDATED_EVENT));
  } catch {
    /* ignore */
  }
}

export const CLIENT_PROFILE_UPDATED_EVENT = "dbx-client-profile-updated";

function isProfile(x: unknown): x is ClientProfile {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  if (
    typeof r.suite !== "string" ||
    typeof r.name !== "string" ||
    typeof r.balanceUsd !== "number" ||
    typeof r.planLabel !== "string"
  ) {
    return false;
  }
  if (r.email !== undefined && typeof r.email !== "string") return false;
  if (r.phone !== undefined && typeof r.phone !== "string") return false;
  if (r.addressLine1 !== undefined && typeof r.addressLine1 !== "string") return false;
  if (r.addressLine2 !== undefined && typeof r.addressLine2 !== "string") return false;
  if (r.city !== undefined && typeof r.city !== "string") return false;
  if (r.region !== undefined && typeof r.region !== "string") return false;
  if (r.postalCode !== undefined && typeof r.postalCode !== "string") return false;
  if (r.country !== undefined && typeof r.country !== "string") return false;
  if (r.street !== undefined && typeof r.street !== "string") return false;
  if (r.stateUs !== undefined && typeof r.stateUs !== "string") return false;
  if (r.zipUs !== undefined && typeof r.zipUs !== "string") return false;
  if (
    r.verificationStatus !== undefined &&
    r.verificationStatus !== "pending_review" &&
    r.verificationStatus !== "approved"
  ) {
    return false;
  }
  if (r.premiumActive !== undefined && typeof r.premiumActive !== "boolean") return false;
  if (r.amazonLeadsProActive !== undefined && typeof r.amazonLeadsProActive !== "boolean") return false;
  if (r.repriceProActive !== undefined && typeof r.repriceProActive !== "boolean") return false;
  if (r.aiListingStarterActive !== undefined && typeof r.aiListingStarterActive !== "boolean") return false;
  if (r.aiListingProActive !== undefined && typeof r.aiListingProActive !== "boolean") return false;
  return true;
}

async function parseApiResponse(res: Response): Promise<{ data: unknown; message?: string }> {
  const text = await res.text();
  const trimmed = text.trimStart();
  if (trimmed.startsWith("<!") || trimmed.startsWith("<html") || trimmed.startsWith("<")) {
    return {
      data: null,
      message:
        "A API devolveu HTML em vez de JSON. Reinicie «npm run dev» (plugin de proxy em streaming para /api). Confirme http://127.0.0.1:8787/health. Na pasta DBX_NOVO: «npm run scrape-server» + «npm run dev:web» se usar os dois separados.",
    };
  }
  try {
    return { data: JSON.parse(text) as unknown };
  } catch {
    return { data: null, message: "Resposta inválida do servidor." };
  }
}

export function loadClientProfile(): ClientProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const j: unknown = JSON.parse(raw);
    return isProfile(j) ? j : null;
  } catch {
    return null;
  }
}

export function saveClientProfile(profile: ClientProfile): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  window.dispatchEvent(new CustomEvent(CLIENT_PROFILE_UPDATED_EVENT));
}

export function clearClientProfile(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PROFILE_KEY);
  saveClientAccessToken(null);
  clearClientBrowserCaches();
  window.dispatchEvent(new CustomEvent(CLIENT_PROFILE_UPDATED_EVENT));
}

export async function registerClientRemote(payload: ClientRegisterPayload): Promise<ClientProfile> {
  const res = await fetch(apiUrl("/api/client/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const { data, message } = await parseApiResponse(res);
  if (message && data === null) throw new Error(message);
  const obj = data as Record<string, unknown> | null;
  if (!res.ok) {
    const err = obj && typeof obj.error === "string" ? obj.error : "Falha ao registar.";
    throw new Error(err);
  }
  const prof = obj?.profile;
  if (!isProfile(prof)) throw new Error("Resposta inválida do servidor.");
  clearClientBrowserCaches();
  saveClientProfile(prof);
  if (typeof obj?.accessToken === "string" && obj.accessToken.trim()) {
    saveClientAccessToken(obj.accessToken);
  }
  return prof;
}

export async function loginClientRemote(email: string, password: string): Promise<ClientProfile> {
  const res = await fetch(apiUrl("/api/client/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  const { data, message } = await parseApiResponse(res);
  if (message && data === null) throw new Error(message);
  const obj = data as Record<string, unknown> | null;
  if (!res.ok) {
    const err = obj && typeof obj.error === "string" ? obj.error : "Não foi possível entrar.";
    throw new Error(err);
  }
  const prof = obj?.profile;
  if (!isProfile(prof)) throw new Error("Resposta inválida do servidor.");
  clearClientBrowserCaches();
  saveClientProfile(prof);
  if (typeof obj?.accessToken === "string" && obj.accessToken.trim()) {
    saveClientAccessToken(obj.accessToken);
  }
  return prof;
}

export type PullClientProfileResult =
  | { ok: true }
  | { ok: false; reason: "no_local_profile" | "not_found" | "error" };

/**
 * Alinha o perfil local com `GET /api/client/me`.
 * Após repor a demo no servidor, a suite guardada no browser pode deixar de existir → `not_found`.
 */
export async function pullClientProfileFromServer(): Promise<PullClientProfileResult> {
  const p = loadClientProfile();
  if (!p) return { ok: false, reason: "no_local_profile" };
  try {
    const res = await fetch(apiUrl("/api/client/me"), { headers: jsonUserHeaders() });
    if (res.status === 404) {
      return { ok: false, reason: "not_found" };
    }
    if (res.status === 401) {
      return { ok: false, reason: "error" };
    }
    const { data, message } = await parseApiResponse(res);
    if (!res.ok || message) return { ok: false, reason: "error" };
    const obj = data as Record<string, unknown> | null;
    const prof = obj?.profile;
    if (!isProfile(prof)) return { ok: false, reason: "error" };
    saveClientProfile(prof);
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}
