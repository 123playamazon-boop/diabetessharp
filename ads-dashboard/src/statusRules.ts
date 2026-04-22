import type { AccountRow, StatusTone } from "./types";

export interface DerivedAccount extends AccountRow {
  convIc: number | null;
  cpa: number | null;
  profit: number;
  roas: number;
  statusLabel: string;
  statusTone: StatusTone;
}

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

/**
 * Regras inspiradas no teu painel — ajusta thresholds quando ligares dados reais.
 */
export function deriveAccount(
  row: AccountRow,
  meta: { roasFloor: number; cpaCeil: number },
  bestRoasToday: number
): DerivedAccount {
  const convIc = row.ic > 0 ? row.conv / row.ic : null;
  const cpa = row.conv > 0 ? row.gasto / row.conv : null;
  const profit = row.revenue - row.gasto;
  const roas = row.gasto > 0 ? row.revenue / row.gasto : 0;

  let statusLabel = "Estável";
  let statusTone: StatusTone = "neutral";

  if (row.ic >= 5 && row.conv === 0) {
    statusLabel = `⚠️ ${row.ic} IC · 0 conv`;
    statusTone = "warning";
  } else if (cpa !== null && cpa > meta.cpaCeil * 1.15 && row.conv > 0) {
    statusLabel = "⚠️ CPA alto";
    statusTone = "danger";
  } else if (roas >= meta.roasFloor * 1.2 && row.conv >= 3 && roas >= bestRoasToday * 0.98) {
    statusLabel = "🔥🔥 MVP do dia";
    statusTone = "success";
  } else if (row.daysRunning === 2 && row.conv < 2) {
    statusLabel = "Dia 2 · aguarda";
    statusTone = "info";
  } else if (roas < 1 && row.gasto > 200 && row.conv === 0) {
    statusLabel = "🔴 Matar hoje";
    statusTone = "danger";
  } else if (roas < meta.roasFloor && row.conv > 0) {
    statusLabel = "Atenção";
    statusTone = "warning";
  }

  return { ...row, convIc, cpa, profit, roas, statusLabel, statusTone };
}

export function pctConvIc(v: number | null): string {
  if (v === null) return "—";
  return `${(v * 100).toFixed(0)}%`;
}

export { formatMoney };
