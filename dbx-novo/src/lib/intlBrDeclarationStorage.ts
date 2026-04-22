import type { IntlBrCustomsDeclaration } from "../types";

const KEY = "dbx.client.intlBr.declarations";

export type StoredIntlBrDeclaration = {
  orderId: string;
  createdAtIso: string;
  declaration: IntlBrCustomsDeclaration;
};

export function saveIntlBrDeclaration(orderId: string, declaration: IntlBrCustomsDeclaration) {
  if (typeof window === "undefined") return;
  let list: StoredIntlBrDeclaration[] = [];
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as unknown;
      if (Array.isArray(p)) list = p as StoredIntlBrDeclaration[];
    }
  } catch {
    list = [];
  }
  list.unshift({
    orderId,
    createdAtIso: new Date().toISOString(),
    declaration,
  });
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
}

export function removeIntlBrDeclarationByOrderId(orderId: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return;
    const list = (p as StoredIntlBrDeclaration[]).filter((x) => x.orderId !== orderId);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}
