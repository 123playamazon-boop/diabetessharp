import type { ClientOrder, ClientOrderShipmentLine, InventoryRow } from "../types";

/** Linhas do envio a partir do pedido (snapshot ou legado). */
export function shipmentLinesForOrder(o: ClientOrder): ClientOrderShipmentLine[] {
  if (o.shipmentLines?.length) return o.shipmentLines;
  if (o.fbaLineDetails?.length) {
    return o.fbaLineDetails.map((l) => {
      const snap = o.fbaItemsSnapshot?.find((s) => s.inventoryId === l.inventoryId);
      return {
        inventoryId: l.inventoryId,
        asin: l.asin,
        title: l.title,
        qty: l.qty,
        imageUrl: snap?.imageUrl,
      };
    });
  }
  if (o.fbaItemsSnapshot?.length) {
    return o.fbaItemsSnapshot.map((s) => ({
      inventoryId: s.inventoryId,
      asin: s.asin,
      title: s.title,
      qty: s.totalQty,
      imageUrl: s.imageUrl,
    }));
  }
  /** Pedidos antigos só com baixa de stock — liga ao inventário para título / ASIN / foto no admin. */
  if (o.inventoryDeductions?.length) {
    return o.inventoryDeductions.map((d) => ({
      inventoryId: d.id,
      asin: "",
      title: "",
      qty: d.qty,
    }));
  }
  return [
    {
      inventoryId: "—",
      asin: "—",
      title: "Sem detalhe de produto (pedido antigo)",
      qty: 0,
    },
  ];
}

export function enrichShipmentLinesWithInventory(
  lines: ClientOrderShipmentLine[],
  invById: Map<string, InventoryRow>,
): ClientOrderShipmentLine[] {
  return lines.map((line) => {
    if (!line.inventoryId || line.inventoryId === "—") return line;
    const inv = invById.get(line.inventoryId);
    if (!inv) return line;
    const placeholder = !line.title || line.title === "—" || line.title.startsWith("Sem detalhe");
    return {
      ...line,
      title: placeholder ? inv.title : line.title || inv.title,
      asin: !line.asin || line.asin === "—" ? inv.asin : line.asin,
      imageUrl: line.imageUrl ?? inv.imageUrl,
    };
  });
}
