/**
 * Registo demo de «retorno de comprador» — recepção no armazém, inspecção e cobrança.
 * Persistido no browser (admin); o débito real do saldo usa a API wallet.
 */

export type CustomerReturnDisposition = "resellable" | "damaged" | "mixed";

export type CustomerReturnIntakeRecord = {
  id: string;
  recordedAtIso: string;
  suite: string;
  inventoryId: string;
  asin: string;
  title: string;
  qtyProcessed: number;
  disposition: CustomerReturnDisposition;
  inspectionNotes?: string;
  feeUsd: number;
  planUsed: "basic" | "premium";
  walletDebited: boolean;
  stockUpdated: boolean;
};

const KEY = "dbx.admin.customerReturns";

export const CUSTOMER_RETURNS_UPDATED_EVENT = "dbx-customer-returns-updated";

export function loadCustomerReturnIntakes(): CustomerReturnIntakeRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is CustomerReturnIntakeRecord => {
      if (!x || typeof x !== "object") return false;
      const r = x as Record<string, unknown>;
      return (
        typeof r.id === "string" &&
        typeof r.recordedAtIso === "string" &&
        typeof r.suite === "string" &&
        typeof r.inventoryId === "string" &&
        typeof r.qtyProcessed === "number" &&
        (r.disposition === "resellable" || r.disposition === "damaged" || r.disposition === "mixed") &&
        typeof r.feeUsd === "number" &&
        (r.planUsed === "basic" || r.planUsed === "premium") &&
        typeof r.walletDebited === "boolean" &&
        typeof r.stockUpdated === "boolean"
      );
    });
  } catch {
    return [];
  }
}

export function appendCustomerReturnIntake(record: CustomerReturnIntakeRecord): void {
  if (typeof window === "undefined") return;
  const next = [record, ...loadCustomerReturnIntakes()];
  try {
    localStorage.setItem(KEY, JSON.stringify(next.slice(0, 200)));
    window.dispatchEvent(new CustomEvent(CUSTOMER_RETURNS_UPDATED_EVENT));
  } catch {
    /* quota */
  }
}
