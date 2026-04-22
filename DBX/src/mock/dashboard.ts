/** KPIs e contagens — estado «dia zero» (primeira conta / sem histórico). */
export const mockHeaderStats = {
  totalInventory: 0,
  inTransit: 0,
  issues: 0,
  completedOrders: 0,
};

export const mockShipmentsLast7Days = [0, 0, 0, 0, 0, 0, 0];

export const mockTopProducts: { name: string; units: number }[] = [];

export const mockPipeline = [
  { id: "received", label: "Recebido", count: 0, tone: "zinc" as const },
  { id: "production", label: "Em produção", count: 0, tone: "violet" as const },
  { id: "labeling", label: "Rotulagem", count: 0, tone: "blue" as const },
  { id: "shipped", label: "Enviado", count: 0, tone: "amber" as const },
  { id: "completed", label: "Concluído", count: 0, tone: "emerald" as const },
];

/** Série curta para sparkline nos KPIs (sem gradiente no card — só na linha do gráfico). */
export function mockSparkSeries(seed: number, len = 10): { v: number }[] {
  return Array.from({ length: len }, (_, i) => ({
    v: Math.max(0, Math.round(seed * 0.15 + 2 * Math.sin(i / 3))),
  }));
}

/** Contadores nos cards de ações rápidas — dia zero. */
export const mockQuickActionCards = {
  productDrafts: 0,
  shipmentsQueue: 0,
  activeSkus: 0,
  announcementsUnread: 0,
  financePending: 0,
} as const;

export const mockReadyShipments: readonly { id: string; units: number; channel: string; eta: string }[] = [];

export const mockInsights: {
  id: string;
  title: string;
  body: string;
  tone: "amber" | "emerald" | "violet";
}[] = [];

export const mockBusinessSnapshot = {
  activeProducts: 0,
  estimatedRevenueUsd: 0,
  growthPct: 0,
};
