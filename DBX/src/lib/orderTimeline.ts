import type { ClientOrder } from "../types";

/**
 * Pedidos criados no portal usam id `ENV-{Date.now().toString(36)}` — recupera o instante
 * quando `createdAtIso` / label falham (migração / dados antigos).
 */
export function parseEnvOrderIdToMs(id: string): number | undefined {
  const m = /^ENV-([0-9a-z]+)$/i.exec(id.trim());
  if (!m) return undefined;
  const n = parseInt(m[1], 36);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

/** Tenta obter ISO 8601 a partir de `createdLabel` (vários formatos regionais). */
export function inferCreatedAtIsoFromLabel(label: string): string | undefined {
  const t = label.trim();
  if (!t) return undefined;

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t)) {
    const p = Date.parse(t);
    if (Number.isFinite(p)) return new Date(p).toISOString();
  }

  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:,\s*(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(t);
  if (br) {
    const d = Number(br[1]);
    const mo = Number(br[2]) - 1;
    let y = Number(br[3]);
    if (y < 100) y += 2000;
    const h = br[4] !== undefined ? Number(br[4]) : 0;
    const min = br[5] !== undefined ? Number(br[5]) : 0;
    const sec = br[6] !== undefined ? Number(br[6]) : 0;
    const dt = new Date(y, mo, d, h, min, sec);
    const x = dt.getTime();
    if (Number.isFinite(x)) return new Date(x).toISOString();
  }

  const p = Date.parse(t);
  if (Number.isFinite(p)) return new Date(p).toISOString();
  return undefined;
}

/** Milissegundos de referência para SLA de prep (criação real do pedido). */
export function orderPrepAnchorMs(order: ClientOrder): number {
  if (order.createdAtIso) {
    const t = Date.parse(order.createdAtIso);
    if (Number.isFinite(t)) return t;
  }
  const fromLabel = inferCreatedAtIsoFromLabel(order.createdLabel);
  if (fromLabel) {
    const t = Date.parse(fromLabel);
    if (Number.isFinite(t)) return t;
  }
  const fromId = parseEnvOrderIdToMs(order.id);
  if (fromId !== undefined) return fromId;
  return Date.now();
}
