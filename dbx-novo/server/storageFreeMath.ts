/** Cálculo de armazenagem grátis (servidor) — alinhado com `src/lib/storageFreeTier.ts`. */

export type StorageRowLike = {
  id?: string;
  storageDays: number;
  storageLimitDays: number;
  storageFreeStartIso?: string;
  arrivalDate?: string;
};

const MS_PER_DAY = 86_400_000;

function localMidnightMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function calendarStorageDaysUsed(startMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((localMidnightMs(new Date(nowMs)) - localMidnightMs(new Date(startMs))) / MS_PER_DAY));
}

export function parseArrivalDateToStorageStartIso(arrivalDate?: string): string | undefined {
  const t = arrivalDate?.trim();
  if (!t) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return undefined;
    const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
    return dt.toISOString();
  }
  const p = Date.parse(t);
  if (!Number.isFinite(p)) return undefined;
  return new Date(p).toISOString();
}

function storageStartIsoFromInventoryId(id: string | undefined): string | undefined {
  const invTs = id?.trim() ? /^inv-(\d+)$/.exec(id.trim()) : null;
  if (!invTs) return undefined;
  const ts = Number(invTs[1]);
  if (!Number.isFinite(ts) || ts < 946684800000) return undefined;
  return new Date(ts).toISOString();
}

export function effectiveStorageFreeStartIso(row: StorageRowLike): string | undefined {
  const iso = row.storageFreeStartIso?.trim();
  if (iso && Number.isFinite(Date.parse(iso))) return iso;
  const fromArrival = parseArrivalDateToStorageStartIso(row.arrivalDate);
  if (fromArrival) return fromArrival;
  return storageStartIsoFromInventoryId(row.id);
}

export function summarizeStorageFreeServer(
  row: StorageRowLike,
  nowMs: number,
): { mode: "calendar" | "estimated"; daysUsed: number; limitDays: number; daysLeft: number; expired: boolean } {
  const limitDays = Math.max(1, Math.floor(row.storageLimitDays ?? 30));
  const startIso = effectiveStorageFreeStartIso(row);
  if (startIso) {
    const start = Date.parse(startIso);
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

export function migrateStorageStartFromArrival<T extends StorageRowLike>(row: T): T | null {
  const cur = row.storageFreeStartIso?.trim();
  if (cur && Number.isFinite(Date.parse(cur))) return null;
  const iso = parseArrivalDateToStorageStartIso(row.arrivalDate);
  if (!iso) return null;
  return { ...row, storageFreeStartIso: iso };
}
