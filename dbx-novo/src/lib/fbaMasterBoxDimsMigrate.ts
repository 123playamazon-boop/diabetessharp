import type { ClientOrder } from "../types";

const KG_TO_LB = 2.2046226218;

export type FbaMasterBoxDims = NonNullable<ClientOrder["fbaMasterBoxDims"]>;

/** Converte registo antigo (kg) para lb e remove campos legados ao gravar de novo. */
export function normalizeOrderFbaMasterBoxDims(o: ClientOrder): { order: ClientOrder; changed: boolean } {
  const d = o.fbaMasterBoxDims;
  if (!d || typeof d !== "object") return { order: o, changed: false };

  const raw = d as FbaMasterBoxDims & { weightKg?: number };
  const legacyKg =
    typeof raw.weightKg === "number" && Number.isFinite(raw.weightKg) && raw.weightKg > 0 ? raw.weightKg : undefined;
  const fromLb =
    typeof raw.weightLb === "number" && Number.isFinite(raw.weightLb) && raw.weightLb > 0 ? raw.weightLb : undefined;

  let weightLb: number | undefined;
  if (fromLb !== undefined) {
    weightLb = Math.round(fromLb * 100) / 100;
  } else if (legacyKg !== undefined) {
    weightLb = Math.round(legacyKg * KG_TO_LB * 100) / 100;
  } else {
    return { order: o, changed: false };
  }

  const next: FbaMasterBoxDims = {
    lengthCm: raw.lengthCm,
    widthCm: raw.widthCm,
    heightCm: raw.heightCm,
    weightLb,
    recordedAtIso: raw.recordedAtIso,
  };

  const hadLegacyField = "weightKg" in raw;
  const same =
    !hadLegacyField &&
    raw.weightLb === next.weightLb &&
    raw.lengthCm === next.lengthCm &&
    raw.widthCm === next.widthCm &&
    raw.heightCm === next.heightCm &&
    raw.recordedAtIso === next.recordedAtIso;

  if (same) return { order: o, changed: false };

  return { order: { ...o, fbaMasterBoxDims: next }, changed: true };
}
