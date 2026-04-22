import type { ShippingTrackingEvent, ShippingTrackingPhase } from "../src/types";
import { buildCarrierTrackingUrl } from "../src/lib/shippingTrackingDetect";

const BASE = "https://api.17track.net/track/v1";

/** Códigos «e» do campo package status na API v1 (17TRACK). */
export function map17TrackPackageCode(e: number): ShippingTrackingPhase {
  const v = Number(e);
  if (!Number.isFinite(v)) return "unknown";
  switch (v) {
    case 0:
      return "not_found";
    case 1:
    case 5:
      return "info_received";
    case 10:
      return "in_transit";
    case 20:
      return "expired";
    case 30:
      return "available_pickup";
    case 35:
      return "exception";
    case 40:
      return "delivered";
    case 50:
      return "exception";
    default:
      if (v > 0 && v < 40) return "in_transit";
      return "unknown";
  }
}

function parseZEvent(z: unknown): ShippingTrackingEvent | null {
  if (!z || typeof z !== "object") return null;
  const o = z as Record<string, unknown>;
  const desc = typeof o.z === "string" ? o.z.trim() : "";
  if (!desc) return null;
  const c = typeof o.c === "string" ? o.c.trim() : "";
  const d = typeof o.d === "string" ? o.d.trim() : "";
  const loc = [c, d].filter(Boolean).join(" · ");
  return {
    at: typeof o.a === "string" ? o.a.trim() : undefined,
    location: loc || undefined,
    description: desc,
  };
}

function collectEvents(track: Record<string, unknown>, limit: number): ShippingTrackingEvent[] {
  const out: ShippingTrackingEvent[] = [];
  const pushArr = (arr: unknown) => {
    if (!Array.isArray(arr)) return;
    for (const item of arr) {
      const ev = parseZEvent(item);
      if (ev) out.push(ev);
      if (out.length >= limit) return;
    }
  };
  pushArr(track.z1);
  if (out.length < limit) pushArr(track.z2);
  if (out.length < limit) pushArr(track.z9);
  return out.slice(0, limit);
}

function summaryFromTrack(track: Record<string, unknown>, events: ShippingTrackingEvent[]): string {
  const z0 = track.z0;
  if (z0 && typeof z0 === "object") {
    const ev = parseZEvent(z0);
    if (ev) {
      const bits = [ev.at, ev.location, ev.description].filter(Boolean);
      if (bits.length) return bits.join(" — ");
    }
  }
  if (events[0]) {
    const ev = events[0];
    return [ev.at, ev.location, ev.description].filter(Boolean).join(" — ");
  }
  return "";
}

async function post17(token: string, path: "register" | "gettrackinfo", body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "17token": token,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let j: Record<string, unknown> = {};
  try {
    j = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Resposta inválida da API de rastreio (HTTP ${res.status}).`);
  }
  if (!res.ok) {
    const msg = typeof j.message === "string" ? j.message : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return j;
}

export type TrackingLookupServerResult =
  | {
      ok: true;
      configured: true;
      phase: ShippingTrackingPhase;
      summary: string;
      trackingUrl: string;
      events: ShippingTrackingEvent[];
      providerCode?: number;
    }
  | { ok: true; configured: false; phase: "unknown"; trackingUrl: string; hint: string }
  | { ok: false; error: string };

export async function lookupShippingTrackingOnServer(input: {
  tracking: string;
  carrierId?: string;
}): Promise<TrackingLookupServerResult> {
  const tracking = input.tracking.trim();
  if (!tracking) {
    return { ok: false, error: "Número de rastreio em falta." };
  }
  const token = (process.env.SEVENTEEN_TRACK_TOKEN ?? process.env.TRACK17_TOKEN ?? "").trim();
  const trackingUrl = input.carrierId
    ? buildCarrierTrackingUrl(input.carrierId, tracking)
    : buildCarrierTrackingUrl("unknown", tracking);

  if (!token) {
    return {
      ok: true,
      configured: false,
      phase: "unknown",
      trackingUrl,
      hint:
        "Para ver o estado oficial (transito, saiu para entrega, entregue) nesta app, configure a variável de ambiente SEVENTEEN_TRACK_TOKEN com uma chave da API 17TRACK (https://www.17track.net/en/api). Até lá, use o link da transportadora.",
    };
  }

  try {
    const reg = await post17(token, "register", [{ number: tracking, auto_detection: true }]);
    if (typeof reg.code === "number" && reg.code !== 0) {
      const msg = typeof reg.message === "string" ? reg.message : `Erro API 17TRACK (register) código ${reg.code}`;
      return { ok: false, error: msg };
    }
    const regData = reg.data as Record<string, unknown> | undefined;
    const rejList = (regData?.rejected as unknown[] | undefined) ?? [];
    for (const item of rejList) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      if (String(row.number) !== tracking) continue;
      const err = row.error && typeof row.error === "object" ? (row.error as Record<string, unknown>) : {};
      const msg = typeof err.message === "string" ? err.message : "Rastreio rejeitado pelo 17TRACK.";
      return { ok: false, error: msg };
    }
    const accList = (regData?.accepted as unknown[] | undefined) ?? [];
    if (!accList.some((x) => x && typeof x === "object" && String((x as Record<string, unknown>).number) === tracking)) {
      return { ok: false, error: "Não foi possível registar o rastreio no 17TRACK." };
    }

    let lastErr: string | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 900));
      const info = await post17(token, "gettrackinfo", [{ number: tracking }]);
      if (typeof info.code === "number" && info.code !== 0) {
        lastErr = typeof info.message === "string" ? info.message : `Código ${info.code}`;
        continue;
      }
      const data = info.data;
      if (!data || typeof data !== "object") {
        lastErr = "Resposta sem dados.";
        continue;
      }
      const rej2 = (data as Record<string, unknown>).rejected as unknown[] | undefined;
      if (Array.isArray(rej2) && rej2.length) {
        const hit = rej2.find((x) => x && typeof x === "object" && String((x as Record<string, unknown>).number) === tracking);
        if (hit && typeof hit === "object") {
          const err = (hit as Record<string, unknown>).error;
          const msg =
            err && typeof err === "object" && typeof (err as Record<string, unknown>).message === "string"
              ? String((err as Record<string, unknown>).message)
              : "Rastreio rejeitado na consulta.";
          return { ok: false, error: msg };
        }
      }
      const accepted = (data as Record<string, unknown>).accepted;
      if (!Array.isArray(accepted) || accepted.length === 0) {
        lastErr = "Ainda sem informação de rastreio (tente «Atualizar» dentro de instantes).";
        continue;
      }
      const first = accepted[0] as Record<string, unknown>;
      const tr = first.track;
      if (!tr || typeof tr !== "object") {
        lastErr = "Transportadora ainda a processar o número.";
        continue;
      }
      const track = tr as Record<string, unknown>;
      const eRaw = track.e;
      const e = typeof eRaw === "number" ? eRaw : Number(eRaw);
      const phase = map17TrackPackageCode(Number.isFinite(e) ? e : NaN);
      const events = collectEvents(track, 8);
      const summary = summaryFromTrack(track, events) || phase;
      const w1 = track.w1;
      const providerCode = typeof w1 === "number" ? w1 : typeof w1 === "string" ? Number(w1) : undefined;

      return {
        ok: true,
        configured: true,
        phase,
        summary,
        trackingUrl,
        events,
        providerCode: Number.isFinite(providerCode) ? providerCode : undefined,
      };
    }
    return { ok: false, error: lastErr ?? "Não foi possível obter o estado do envio." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao consultar 17TRACK." };
  }
}
