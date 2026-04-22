export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export interface AccountRow {
  id: string;
  conta: string;
  nicho: string;
  gasto: number;
  conv: number;
  ic: number;
  revenue: number;
  /** opcional: dias desde o lançamento para regras tipo "Dia 2 · aguarda" */
  daysRunning?: number;
}

export interface DaySnapshot {
  label: string;
  dateLabel: string;
  vendas: number;
  gasto: number;
  profit: number;
  roas: number;
  cpa: number;
  /** true se ainda é parcial (ex.: hoje) */
  partial?: boolean;
}

export interface SummarySnapshot {
  vendas: number;
  vendasAtMorning?: number;
  revenue: number;
  gasto: number;
  gastoAtMorning?: number;
  profit: number;
  roas: number;
  cpa: number;
  /** ticket médio para exibir "26 × $230" */
  avgOrderValue: number;
  metaRoas: number;
  metaCpa: number;
}

export interface DashboardPayload {
  updatedAt: string;
  summary: SummarySnapshot;
  comparison: DaySnapshot[];
  accounts: AccountRow[];
}
