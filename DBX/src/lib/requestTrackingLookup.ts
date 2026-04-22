import { apiUrl } from "./apiUrl";
import { jsonUserHeaders } from "./authHeaders";
import type { ShippingTrackingEvent, ShippingTrackingPhase } from "../types";

export type TrackingLookupResponse =
  | {
      ok: true;
      configured: true;
      phase: ShippingTrackingPhase;
      summary: string;
      trackingUrl: string;
      events: ShippingTrackingEvent[];
    }
  | { ok: true; configured: false; phase: "unknown"; trackingUrl: string; hint: string }
  | { ok: false; error: string };

export async function requestTrackingLookup(tracking: string, carrierId?: string): Promise<TrackingLookupResponse> {
  const trimmed = tracking.trim();
  if (!trimmed) return { ok: false, error: "Número de rastreio em falta." };
  try {
    const res = await fetch(apiUrl("/api/shipping-tracking/lookup"), {
      method: "POST",
      headers: jsonUserHeaders(),
      body: JSON.stringify({ tracking: trimmed, carrierId: carrierId?.trim() || undefined }),
    });
    const j = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      return { ok: false, error: typeof j.error === "string" ? j.error : `HTTP ${res.status}` };
    }
    if (j.ok !== true) {
      return { ok: false, error: "Resposta inválida do servidor." };
    }
    if (j.configured === true) {
      const rawEvents = Array.isArray(j.events) ? j.events : [];
      const events: ShippingTrackingEvent[] = [];
      for (const item of rawEvents) {
        if (!item || typeof item !== "object") continue;
        const o = item as Record<string, unknown>;
        const description = typeof o.description === "string" ? o.description : "";
        if (!description.trim()) continue;
        events.push({
          at: typeof o.at === "string" ? o.at : undefined,
          location: typeof o.location === "string" ? o.location : undefined,
          description: description.trim(),
        });
      }
      return {
        ok: true,
        configured: true,
        phase: (j.phase as ShippingTrackingPhase) ?? "unknown",
        summary: typeof j.summary === "string" ? j.summary : "",
        trackingUrl: typeof j.trackingUrl === "string" ? j.trackingUrl : "",
        events,
      };
    }
    if (j.configured === false) {
      return {
        ok: true,
        configured: false,
        phase: "unknown",
        trackingUrl: typeof j.trackingUrl === "string" ? j.trackingUrl : "",
        hint: typeof j.hint === "string" ? j.hint : "",
      };
    }
    return { ok: false, error: "Resposta inválida do servidor." };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}
