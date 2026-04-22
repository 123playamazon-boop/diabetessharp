import type { PrepCenterPlan } from "./prepCenterPricing";

export type RegisterProductDraftV1 = {
  v: 1;
  mode: "manual" | "link";
  asin: string;
  supplierUrl: string;
  productName: string;
  supplier: string;
  condition: string;
  quantity: string;
  poNumber: string;
  arrivalDate: string;
  color: string;
  size: string;
  brand: string;
  model: string;
  upc: string;
  tracking: string;
  notes: string;
  /** Só URLs http(s) — arquivos locais não são salvos. */
  photoPreviewUrl?: string | null;
  prepPlan: PrepCenterPlan;
  prepServiceId: string;
  premiumSubTab: "rates" | "subscribe";
  productCost: string;
  platformPct: string;
  labelUsd: string;
  marginPct: string;
  previewQty: string;
};

export const REGISTER_PRODUCT_DRAFT_UPDATED_EVENT = "dbx-register-product-draft-updated";

export function registerProductDraftKey(suite: string | undefined): string {
  return `dbx.register-product.draft.${suite?.trim() || "anon"}`;
}

export function notifyRegisterProductDraftUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(REGISTER_PRODUCT_DRAFT_UPDATED_EVENT));
}

export function parseRegisterProductDraft(raw: string | null): RegisterProductDraftV1 | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as RegisterProductDraftV1;
    if (j?.v !== 1 || typeof j.mode !== "string") return null;
    return j;
  } catch {
    return null;
  }
}

export function hasMeaningfulDraftContent(d: Partial<RegisterProductDraftV1>): boolean {
  const s = (x: unknown) => typeof x === "string" && x.trim() !== "";
  return (
    s(d.productName) ||
    s(d.asin) ||
    s(d.supplierUrl) ||
    s(d.supplier) ||
    s(d.notes) ||
    s(d.productCost) ||
    s(d.poNumber) ||
    s(d.tracking) ||
    s(d.upc) ||
    s(d.brand) ||
    s(d.photoPreviewUrl)
  );
}
