export type InventoryKind = "novo" | "retorno" | "transito" | "problema" | "cadastro_pendente";

export type ClientOrderStatus =
  | "aguardando_cliente"
  | "em_fila"
  | "em_producao"
  | "concluido";

/** Estado agregado do envio (API 17TRACK ou desconhecido). */
export type ShippingTrackingPhase =
  | "unknown"
  | "not_found"
  | "pending"
  | "info_received"
  | "in_transit"
  | "available_pickup"
  | "out_for_delivery"
  | "delivered"
  | "exception"
  | "expired";

export type ShippingTrackingEvent = {
  at?: string;
  location?: string;
  description: string;
};

export type AdminOrderStatus =
  | "aguardando_pagamento"
  | "label_enviada"
  | "confirmacao_pgto"
  | "pago"
  | "aguardando_label"
  | "em_producao"
  | "finalizado";

/**
 * Serviço do pedido. `FBA` = estoque a entrar na rede Amazon (EUA). `FBM` = fulfillment pelo vendedor (etiqueta sua,
 * envio direto ao comprador) — na operação aplica-se também a TikTok, Mercado Livre, Shopify, eBay, etc., conforme o
 * tipo de envio escolhido no portal (não é exclusivo da Amazon).
 */
export type ServiceType =
  | "FBM"
  | "FBA"
  | "OUTRO"
  | "INTL_ML"
  | "INTL_BR"
  | "USA_DOMESTIC"
  | "WALMART_CUSTOMER"
  | "WALMART_WAREHOUSE"
  | "EBAY"
  /** Montagem / separação no prep — resultado fica no estoque do cliente (sem etiqueta de envio neste pedido). */
  | "PREP_KIT";

/** Pedido criado em «Criar envio» — tipo de trabalho no armazém. */
export type PrepKitWorkType = "split_bulk" | "combine_stock" | "custom";

/** Instruções de montagem/prep ligadas a um pedido `PREP_KIT`. */
export interface ClientOrderPrepKitWork {
  workType: PrepKitWorkType;
  /** O que o prep deve fazer (separar caixa, juntar SKUs, etc.). */
  instructions: string;
  /** Pedido do cliente: SKUs/packs esperados (texto livre). */
  outputsRequested?: string;
  /** Preenchido pelo admin ao disponibilizar stock. */
  outputsDelivered?: { id: string; title: string; qty: number }[];
  deliveredAtIso?: string;
}

/** Marketplaces não-Amazon no fluxo «Outra plataforma». */
export type NonAmazonMarketplace = "tiktok" | "shopify" | "etsy" | "aliexpress" | "alibaba" | "other";

export const NON_AMAZON_MARKETPLACE_LABEL: Record<NonAmazonMarketplace, string> = {
  tiktok: "TikTok Shop",
  shopify: "Shopify",
  etsy: "Etsy",
  aliexpress: "AliExpress",
  alibaba: "Alibaba",
  other: "Outra plataforma",
};

/** Dados recolhidos no fluxo «Envio internacional Brasil» (baseado em DIR / remessas postais — Receita Federal). */
export interface IntlBrCustomsDeclaration {
  recipientFullName: string;
  recipientCpf: string;
  addressLine: string;
  cityStateCep: string;
  goodsDescriptionPt: string;
  quantityPieces: string;
  unitValueUsd: string;
  totalValueUsd: string;
  freightUsd: string;
  insuranceUsd: string;
  ncm: string;
  grossWeightKg: string;
  /** Fatura / invoice / recibo (opcional) — comprova valor e descrição perante a alfândega quando existir. */
  commercialInvoiceFileName?: string;
  commercialInvoiceDataUrl?: string;
  /** Confirmou leitura das restrições de envio (Correios / remessas). */
  correiosRestrictionsAcknowledged: boolean;
  /** Ciência de que tributos e desembaraço no Brasil são do importador/destinatário, conforme canais oficiais. */
  importerTaxesResponsibilityAccepted: boolean;
  truthfulnessAccepted: boolean;
  signerFullName: string;
  signatureAccepted: boolean;
  signedAtIso: string;
}

export type ClientSupplierRegion = "usa" | "international";

export type ClientBusinessModel = "dropshipping" | "online_arbitrage" | "private_label";

export type ClientVerificationStatus = "pending_review" | "approved";

export interface ClientOnboardingQuiz {
  productCategories: string;
  monthlyVolumeBand: string;
  supplierRegion: ClientSupplierRegion;
  businessModel: ClientBusinessModel;
}

/** Corpo do POST `/api/client/register` — morada internacional (texto livre). */
export type ClientRegisterPayload = {
  name: string;
  email: string;
  phone: string;
  /** Senha de acesso ao portal (mín. 8 caracteres no servidor). */
  password: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  proofOfAddressDataUrl: string;
  idDocumentDataUrl: string;
  onboardingQuiz: ClientOnboardingQuiz;
};

export interface ClientProfile {
  suite: string;
  name: string;
  balanceUsd: number;
  planLabel: string;
  /** Definido pelo admin (demo) — assinatura premium da conta. */
  premiumActive?: boolean;
  /** Direct Leads Pro — acesso à lista diária Amazon curada (US$ 49,99/mês na oferta comercial). */
  amazonLeadsProActive?: boolean;
  /** DBX Reprice — add-on repricing / margem Amazon (US$ 49,99/mês na oferta comercial). */
  repriceProActive?: boolean;
  /** AI Listing Starter — até 20 listagens/mês (admin). */
  aiListingStarterActive?: boolean;
  /** AI Listing Pro — até 100 listagens/mês (admin). */
  aiListingProActive?: boolean;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  verificationStatus?: ClientVerificationStatus;
  onboardingQuiz?: ClientOnboardingQuiz;
}

/** Ficheiro de etiqueta (PDF/imagem) em data URL — armazenamento local demo. */
export interface ShippingLabelFile {
  name: string;
  dataUrl: string;
}

/** Snapshot de um SKU no pedido FBA (título/ASIN fixos para o prep). */
export interface ClientOrderFbaItemSnapshot {
  inventoryId: string;
  asin: string;
  title: string;
  /** Quantidade total deste SKU no envio. */
  totalQty: number;
  /** Miniatura no admin (snapshot ao criar o pedido). */
  imageUrl?: string;
}

/** Linha de produto no envio — admin e cancelamento usam o mesmo snapshot. */
export interface ClientOrderShipmentLine {
  inventoryId: string;
  asin: string;
  title: string;
  qty: number;
  imageUrl?: string;
}

/** Grupo de inbound / envio Amazon definido pelo cliente no fluxo FBA (uma entrada = um agrupamento físico no prep). */
export interface ClientOrderFbaBoxGroup {
  id: string;
  label: string;
}

/** inventoryId → id do grupo → unidades nesse grupo. */
export type ClientOrderFbaBoxSplits = Record<string, Record<string, number>>;

export interface InventoryRow {
  id: string;
  asin: string;
  title: string;
  qty: number;
  kind: InventoryKind;
  /** Quem criou o cadastro (portal cliente) — visível no admin. */
  clientSuite?: string;
  clientName?: string;
  imageUrl?: string;
  /** Metadados do formulário de cadastro (popup «Detalhes»). */
  supplier?: string;
  brand?: string;
  condition?: string;
  poNumber?: string;
  arrivalDate?: string;
  notes?: string;
  color?: string;
  size?: string;
  model?: string;
  upc?: string;
  tracking?: string;
  /** Custo de aquisição (USD) — usado no simulador de preço sugerido. */
  productCostUsd?: number;
  /** Plano prep (tabela Básico vs Direct Premium). */
  prepCenterPlan?: "basic" | "premium";
  /** Id da linha em `PREP_CENTER_PRICING_MAIN` (modalidade de prep). */
  prepCenterServiceId?: string;
  /** % da taxa da plataforma sobre o preço de venda (ex.: 15). */
  platformFeePct?: number;
  /** % de lucro alvo sobre o custo do produto apenas (10–45); prep e etiqueta não entram na margem. */
  desiredMarginPct?: number;
  /** Taxa fixa de etiqueta (USD), ex. 8. */
  labelFeeUsd?: number;
  /** Taxa prep (USD) da linha escolhida — snapshot ao guardar. */
  prepCenterFeeUsd?: number;
  /** Quantidade na projeção «vender N unidades». */
  pricingPreviewQty?: number;
  /** Lucro estimado por unidade ao preço sugerido (após taxa plataforma e custos). */
  profitPerUnitUsd?: number;
  /** Lucro total = profitPerUnitUsd × pricingPreviewQty. */
  projectedProfitUsd?: number;
  /** Preço de venda unitário sugerido (snapshot ao guardar). */
  suggestedSaleUsd?: number;
  /** Preço unitário (USD) para total no pedido FBA — opcional na demo. */
  unitPriceUsd?: number;
  /** Início dos 30 dias grátis de armazenagem (ISO) — desde o cadastro do produto. */
  storageFreeStartIso?: string;
  storageDays: number;
  storageLimitDays: number;
  /** FBM: só itens com etiqueta de envio na unidade/caixa (prep já emitiu). */
  fbmUnitLabelReady?: boolean;
}

/** Linha detalhada do pedido FBA (uma linha = um SKU + grupo + opcional pack). */
export interface ClientOrderFbaLineDetail {
  key: string;
  inventoryId: string;
  asin: string;
  title: string;
  qty: number;
  groupId: string;
  groupLabel: string;
  pack: boolean;
  unitPriceUsd?: number;
  lineTotalUsd?: number;
}

export interface ClientOrder {
  id: string;
  status: ClientOrderStatus;
  service: ServiceType;
  createdLabel: string;
  /** ISO 8601 — criação real (cancelamento na 1ª hora, reversão de estoque na demo). */
  createdAtIso?: string;
  /** Baixa aplicada ao criar o envio (para reverter ao cancelar). */
  inventoryDeductions?: { id: string; qty: number }[];
  /** Linhas de produto (nome, foto, qty) — visível no admin para o prep. */
  shipmentLines?: ClientOrderShipmentLine[];
  /** Nome da conta no registo — mostrado no admin quando existe. */
  clientName?: string;
  /** Quando service é OUTRO — marketplace escolhido (TikTok, Shopify, etc.). */
  nonAmazonMarketplace?: NonAmazonMarketplace;
  /** Quando OUTRO e nonAmazonMarketplace é "other" — nome da plataforma em texto livre. */
  otherPlatformName?: string;
  /** Suite do cliente (demo) — útil no admin. */
  suite?: string;
  /** Etiqueta de envio gerada pelo cliente (ex. Pirate Ship) — obrigatória para serviços que não são FBA. */
  shippingLabelFileName?: string;
  shippingLabelDataUrl?: string;
  /** INTL_ML — etiqueta Mercado Livre Américas (PDF/imagem). */
  intlMlAmericasLabelFileName?: string;
  intlMlAmericasLabelDataUrl?: string;
  /** INTL_ML — etiqueta da transportadora (ex. USPS). */
  intlMlCarrierLabelFileName?: string;
  intlMlCarrierLabelDataUrl?: string;
  /** Leitura automática do PDF da etiqueta (UPS, FedEx, USPS, Amazon TBA, DHL…). */
  shippingTrackingCarrierId?: string;
  shippingTrackingCarrierLabel?: string;
  shippingTrackingNumber?: string;
  shippingTrackingUrl?: string;
  /** Última fase conhecida (consulta 17TRACK ou heurística futura). */
  shippingTrackingPhase?: ShippingTrackingPhase;
  /** Último evento / resumo curto para UI. */
  shippingTrackingSummary?: string;
  shippingTrackingCheckedAtIso?: string;
  shippingTrackingEvents?: ShippingTrackingEvent[];
  /** FBA — etapa 1: etiquetas FNSKU nas unidades (uma ou mais). */
  fbaFnskuLabels?: ShippingLabelFile[];
  /** FBA — etapa 2: etiqueta Amazon na caixa master (após peso/medidas do prep). */
  fbaAmazonBoxLabel?: ShippingLabelFile;
  /** FBA — etapa 2: etiqueta UPS/FedEx na caixa master. */
  fbaCarrierLabel?: ShippingLabelFile;
  /**
   * FBA — medidas da caixa master registadas pelo prep (cm + peso em lb, formato Seller Central).
   * O cliente deve consultá-las no portal antes de gerar etiquetas Amazon + transportadora; o admin não deve concluir o envio sem isto guardado.
   */
  fbaMasterBoxDims?: {
    lengthCm: number;
    widthCm: number;
    heightCm: number;
    /** Peso total da caixa fechada em libras (Amazon inbound). */
    weightLb: number;
    recordedAtIso: string;
  };
  /** FBA — grupos nomeados pelo cliente (Inbound / envio Amazon; uma entrada = um agrupamento no prep). */
  fbaBoxGroups?: ClientOrderFbaBoxGroup[];
  /** FBA — distribuição por grupo no momento do pedido. */
  fbaBoxSplits?: ClientOrderFbaBoxSplits;
  /** FBA — produtos e totais no momento do pedido (para o admin não depender do inventário atual). */
  fbaItemsSnapshot?: ClientOrderFbaItemSnapshot[];
  /** FBA — linhas tal como o cliente montou (grupo, pack, totais). */
  fbaLineDetails?: ClientOrderFbaLineDetail[];
  /** Admin aceitou o pedido e colocou em produção (prep). */
  opsAcceptedAtIso?: string;
  /**
   * Mensagem do prep/admin ao cliente (conformidade, problema no envio, o que ajustar).
   * Destacada na aba «Aguardando o cliente».
   */
  prepClientNotice?: string;
  /**
   * Etiqueta(s) que não imprimiram ou precisam ser reenviadas — texto curto para o cliente actuar.
   */
  prepLabelPrintIssue?: string;
  /**
   * Quando o pedido entrou em «Aguardando o cliente» (para lembrete por e-mail após 24h na demo).
   * Definido no servidor ao mudar o estado.
   */
  movedToAwaitingClientAtIso?: string;
  /** Demo: lembrete por e-mail (fila) já enviado após 24h em «Aguardando o cliente». */
  awaitingClientReminderSentAtIso?: string;
  /** Quando a operação (admin) marcou o envio como despachado — aviso ao cliente na demo. */
  opsShippedAtIso?: string;
  /** Entrega ao cliente final confirmada (manual ou fase «delivered» da API) — lista «Delivery». */
  customerDeliveryConfirmedAtIso?: string;
  /** @deprecated Pedidos antigos — preferir shippingLabelDataUrl. */
  usaDeliveryNotes?: string;
  /** @deprecated */
  walmartNotes?: string;
  /** @deprecated */
  ebayNotes?: string;
  /** Serviço PREP_KIT — trabalho de prep; stock de saída registado pelo admin. */
  prepKitWork?: ClientOrderPrepKitWork;
}

export interface AdminOrderRow {
  id: string;
  suite: string;
  clientName: string;
  productTitle: string;
  qty: number;
  service: ServiceType;
  status: AdminOrderStatus;
  orderDateLabel: string;
}

export interface AdminClientCard {
  suite: string;
  name: string;
  email: string;
  /** Saldo em USD (servidor). */
  balanceUsd?: number;
  active: boolean;
  tier: string;
  premiumActive?: boolean;
  amazonLeadsProActive?: boolean;
  repriceProActive?: boolean;
  aiListingStarterActive?: boolean;
  aiListingProActive?: boolean;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  verificationStatus?: ClientVerificationStatus;
  hasProofOfAddress?: boolean;
  hasIdDocument?: boolean;
  supplierRegion?: ClientSupplierRegion;
  businessModel?: ClientBusinessModel;
  /** Resumo do quiz (onboarding). */
  productCategories?: string;
  monthlyVolumeBand?: string;
}

export interface ReceiptRow {
  id: string;
  suite: string;
  clientName: string;
  productTitle: string;
  supplier: string;
  qty: number;
  registeredLabel: string;
}
