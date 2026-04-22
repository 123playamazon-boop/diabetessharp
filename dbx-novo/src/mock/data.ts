import type { AdminClientCard, AdminOrderRow, ClientOrder, InventoryRow, ReceiptRow } from "../types";

/** Estoque mock vazio — só entra stock por cadastro real ou API. */
export const mockInventory: InventoryRow[] = [];

export const mockClientOrders: ClientOrder[] = [];

export const mockAdminKpis = {
  aguardandoPagamento: 0,
  labelEnviada: 0,
  confirmacaoPgto: 0,
  pago: 0,
  aguardandoLabel: 0,
};

export const mockAdminNewOrders: AdminOrderRow[] = [];

export const mockAdminClients: AdminClientCard[] = [];

export const mockReceipts: ReceiptRow[] = [];
