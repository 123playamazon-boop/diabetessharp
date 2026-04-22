import { apiUrl } from "./apiUrl";
import { jsonUserHeaders } from "./authHeaders";
import { detectTrackingWithFilenameHint, type ShippingTrackingMatch } from "./shippingTrackingDetect";

export type ParseLabelApiResult =
  | { ok: true; textLength: number; match: ShippingTrackingMatch | null }
  | { ok: false; error: string };

export async function requestShippingLabelParse(dataUrl: string, fileName?: string): Promise<ParseLabelApiResult> {
  try {
    const res = await fetch(apiUrl("/api/shipping-label/parse"), {
      method: "POST",
      headers: jsonUserHeaders(),
      body: JSON.stringify({ dataUrl, ...(fileName?.trim() ? { fileName: fileName.trim() } : {}) }),
    });
    const j = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      return { ok: false, error: typeof j.error === "string" ? j.error : `HTTP ${res.status}` };
    }
    if (j.ok === true && typeof j.textLength === "number") {
      const match = (j.match as ShippingTrackingMatch | null | undefined) ?? null;
      return { ok: true, textLength: j.textLength, match };
    }
    return { ok: false, error: "Resposta inválida do servidor." };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

/** Chama a API (PDF + nome opcional) e, se ainda não houver match, tenta só o nome do ficheiro no browser (ex.: `npm run dev:web` sem servidor). */
export async function resolveLabelTrackingMatch(dataUrl: string, fileName?: string | null): Promise<ParseLabelApiResult> {
  const api = await requestShippingLabelParse(dataUrl, fileName ?? undefined);
  if (api.ok && api.match) return api;
  const hint = detectTrackingWithFilenameHint("", fileName ?? undefined);
  if (hint) return { ok: true, textLength: api.ok ? api.textLength : 0, match: hint };
  return api;
}
