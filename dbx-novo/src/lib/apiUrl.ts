/**
 * URL da API no browser.
 * - Com `VITE_API_URL`: usa essa base (produção / túnel).
 * - Sem env: caminho relativo `/api/...` — no dev/preview o Vite encaminha com `dbxApiProxyPlugin` (stream, POST grandes).
 */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const fromEnv = import.meta.env.VITE_API_URL;
  if (typeof fromEnv === "string" && fromEnv.trim()) {
    return `${fromEnv.trim().replace(/\/$/, "")}${p}`;
  }
  return p;
}
