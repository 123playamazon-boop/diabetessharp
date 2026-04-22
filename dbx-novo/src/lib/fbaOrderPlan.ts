import type { ClientOrder, ClientOrderFbaBoxGroup, ClientOrderFbaBoxSplits, ClientOrderFbaItemSnapshot } from "../types";

export type FbaPrepBoxLine = { asin: string; title: string; qty: number };

export type FbaPrepBoxBlock = {
  index: number;
  id: string;
  label: string;
  lines: FbaPrepBoxLine[];
};

export function hasFbaBoxPlan(o: ClientOrder): boolean {
  return (
    o.service === "FBA" &&
    Array.isArray(o.fbaItemsSnapshot) &&
    o.fbaItemsSnapshot.length > 0 &&
    Array.isArray(o.fbaBoxGroups) &&
    o.fbaBoxGroups.length > 0 &&
    !!o.fbaBoxSplits &&
    typeof o.fbaBoxSplits === "object"
  );
}

/** Uma entrada por grupo (Inbound), só com linhas onde qty > 0. */
export function fbaPlanPerBox(
  groups: ClientOrderFbaBoxGroup[] | undefined,
  splits: ClientOrderFbaBoxSplits | undefined,
  items: ClientOrderFbaItemSnapshot[] | undefined,
): FbaPrepBoxBlock[] {
  if (!groups?.length || !splits || !items?.length) return [];
  return groups.map((g, i) => ({
    index: i + 1,
    id: g.id,
    label: g.label,
    lines: items
      .map((it) => {
        const qty = splits[it.inventoryId]?.[g.id] ?? 0;
        return qty > 0 ? { asin: it.asin, title: it.title, qty } : null;
      })
      .filter((x): x is FbaPrepBoxLine => x != null),
  }));
}

/** Devolve mensagem se totais por grupo não batem com o snapshot (dados corrompidos ou pedido antigo). */
export function fbaPlanConsistencyMessage(o: ClientOrder): string | null {
  if (!hasFbaBoxPlan(o)) return null;
  const { fbaItemsSnapshot: items, fbaBoxSplits: splits, fbaBoxGroups: groups } = o;
  if (!items || !splits || !groups) return null;
  for (const it of items) {
    const sum = groups.reduce((acc, g) => acc + (splits[it.inventoryId]?.[g.id] ?? 0), 0);
    if (sum !== it.totalQty) {
      return `«${it.title}»: nos grupos aparecem ${sum} u, mas o total do pedido é ${it.totalQty} u — rever dados.`;
    }
  }
  return null;
}
