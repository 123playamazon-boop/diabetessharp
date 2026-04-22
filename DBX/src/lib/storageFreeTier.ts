import type { InventoryRow } from "../types";

const MS_PER_DAY = 86_400_000;

/** Início do dia civil local (00:00) — usado para contar «dias de armazenagem» como calendário, não blocos de 24h. */
function localMidnightMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Dias corridos entre a data local do cadastro e hoje (0 no mesmo dia civil). */
export function calendarStorageDaysUsed(startMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((localMidnightMs(new Date(nowMs)) - localMidnightMs(new Date(startMs))) / MS_PER_DAY));
}

/** `YYYY-MM-DD` no fuso local (útil para `<input type="date">`). */
export function ymdInLocalTimezone(d = new Date()): string {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

/** Converte valor de `<input type="date">` em ISO (meio-dia local) para `storageFreeStartIso`. */
export function localDateInputToStorageStartIso(ymd: string): string | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return undefined;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
  return new Date(y, mo - 1, d, 12, 0, 0, 0).toISOString();
}

function parseArrivalDateToStorageStartIso(arrivalDate?: string): string | undefined {
  const t = arrivalDate?.trim();
  if (!t) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return undefined;
    return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0)).toISOString();
  }
  const p = Date.parse(t);
  if (!Number.isFinite(p)) return undefined;
  return new Date(p).toISOString();
}

/** Fallback: IDs de cadastro do portal (`inv-epochMs`) carregam a data/hora do registo. */
function storageStartIsoFromInventoryId(id: string | undefined): string | undefined {
  const invTs = id?.trim() ? /^inv-(\d+)$/.exec(id.trim()) : null;
  if (!invTs) return undefined;
  const ts = Number(invTs[1]);
  if (!Number.isFinite(ts) || ts < 946684800000) return undefined;
  return new Date(ts).toISOString();
}

export function effectiveStorageFreeStartIso(row: InventoryRow): string | undefined {
  const iso = row.storageFreeStartIso?.trim();
  if (iso && Number.isFinite(Date.parse(iso))) return iso;
  const fromArrival = parseArrivalDateToStorageStartIso(row.arrivalDate);
  if (fromArrival) return fromArrival;
  return storageStartIsoFromInventoryId(row.id);
}

/** Data de início dos 30 dias grátis (cadastro), quando existir ISO ou data de chegada parseável. */
export function storageRegistrationDate(row: InventoryRow): Date | null {
  const iso = effectiveStorageFreeStartIso(row);
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t) : null;
}

export type StorageFreeSummary = {
  /** `calendar` = dias desde `storageFreeStartIso`; `estimated` = só contador guardado (cadastro antigo). */
  mode: "calendar" | "estimated";
  daysUsed: number;
  limitDays: number;
  daysLeft: number;
  expired: boolean;
};

/**
 * Período grátis de 30 dias a partir do cadastro (`storageFreeStartIso`).
 * Linhas antigas sem ISO usam `storageDays` / `storageLimitDays` guardados.
 */
export function summarizeStorageFree(row: InventoryRow, nowMs = Date.now()): StorageFreeSummary {
  const limitDays = Math.max(1, Math.floor(row.storageLimitDays ?? 30));
  const iso = effectiveStorageFreeStartIso(row);
  if (iso) {
    const start = Date.parse(iso);
    if (Number.isFinite(start)) {
      const daysUsed = calendarStorageDaysUsed(start, nowMs);
      const daysLeft = Math.max(0, limitDays - daysUsed);
      return {
        mode: "calendar",
        daysUsed,
        limitDays,
        daysLeft,
        expired: daysUsed > limitDays,
      };
    }
  }
  const daysUsed = Math.max(0, Math.floor(row.storageDays ?? 0));
  const daysLeft = Math.max(0, limitDays - daysUsed);
  return {
    mode: "estimated",
    daysUsed,
    limitDays,
    daysLeft,
    expired: daysUsed > limitDays,
  };
}

export type StorageUrgency = "ok" | "warning" | "critical" | "expired";

export function storageUrgency(row: InventoryRow, nowMs = Date.now()): StorageUrgency {
  const s = summarizeStorageFree(row, nowMs);
  if (s.expired) return "expired";
  if (s.daysLeft <= 0) return "critical";
  if (s.daysLeft <= 7) return "warning";
  return "ok";
}
