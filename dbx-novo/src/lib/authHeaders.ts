const ACCESS_TOKEN_KEY = "dbx.client.accessToken";
const ADMIN_TOKEN_KEY = "dbx.admin.apiToken";

/** Igual ao default do servidor sem `ADMIN_API_TOKEN` — só para desenvolvimento local. */
export const DEV_DEFAULT_ADMIN_API_TOKEN = "dbx-local-admin-token-do-not-use-in-prod";

export function saveClientAccessToken(token: string | null | undefined): void {
  if (typeof sessionStorage === "undefined") return;
  const t = typeof token === "string" ? token.trim() : "";
  if (t) sessionStorage.setItem(ACCESS_TOKEN_KEY, t);
  else sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function loadClientAccessToken(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

/** Cabeçalhos para rotas `/api/client/*` autenticadas (JWT após login). */
export function userAuthHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json" };
  const t = loadClientAccessToken();
  if (t?.trim()) h.Authorization = `Bearer ${t.trim()}`;
  return h;
}

export function jsonUserHeaders(): Record<string, string> {
  return { ...userAuthHeaders(), "Content-Type": "application/json" };
}

/**
 * Token da consola admin: `sessionStorage.setItem("dbx.admin.apiToken", "...")` ou `VITE_ADMIN_API_TOKEN`
 * (deve coincidir com `ADMIN_API_TOKEN` no servidor).
 */
export function adminAuthHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json" };
  const env =
    typeof import.meta !== "undefined" && typeof import.meta.env?.VITE_ADMIN_API_TOKEN === "string"
      ? import.meta.env.VITE_ADMIN_API_TOKEN.trim()
      : "";
  const stored =
    typeof sessionStorage !== "undefined" ? (sessionStorage.getItem(ADMIN_TOKEN_KEY)?.trim() ?? "") : "";
  const token = stored || env;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export function jsonAdminHeaders(): Record<string, string> {
  return { ...adminAuthHeaders(), "Content-Type": "application/json" };
}

export function isAdminApiTokenConfigured(): boolean {
  return Boolean(adminAuthHeaders().Authorization);
}

export function saveAdminApiToken(token: string | null | undefined): void {
  if (typeof sessionStorage === "undefined") return;
  const t = typeof token === "string" ? token.trim() : "";
  if (t) sessionStorage.setItem(ADMIN_TOKEN_KEY, t);
  else sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}
