import { decodeHtmlEntities } from "./decodeHtmlEntities";

/** Título de linha de pedido para mostrar na UI (traduz placeholder PT guardado). */
export function lineTitleForUi(title: string, t: (k: string) => string): string {
  if (!title || title === "—" || title.startsWith("Sem detalhe")) return t("client.orders.oldOrderNoDetail");
  return decodeHtmlEntities(title);
}
