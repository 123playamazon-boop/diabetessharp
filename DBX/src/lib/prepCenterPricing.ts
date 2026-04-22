/** Plano mensal do prep (tabela Direct Box — valores USD). */
export type PrepCenterPlan = "basic" | "premium";

export type PrepPricingLine = {
  id: string;
  label: string;
  /** Básico (grátis). */
  basicUsd: number;
  /** Direct Premium (US$49,99/mês). */
  premiumUsd: number;
};

const CM_PER_IN = 2.54;
const KG_PER_LB = 0.45359237;

/** Polegadas → centímetros, 1 casa decimal, vírgula decimal (rótulos PT-BR). */
export function formatCmFromInches(inches: number): string {
  const v = Math.round(inches * CM_PER_IN * 10) / 10;
  return v.toFixed(1).replace(".", ",");
}

/** Libras → quilogramas, 1 casa decimal, vírgula decimal (rótulos PT-BR). */
export function formatKgFromLb(lb: number): string {
  const v = Math.round(lb * KG_PER_LB * 10) / 10;
  return v.toFixed(1).replace(".", ",");
}

/**
 * Modalidades principais FBA/FBM (simulador de preço — escolha por rádio).
 * Valores alinhados às tabelas Básico / Direct Premium em anexo.
 */
export const PREP_CENTER_PRICING_MAIN: PrepPricingLine[] = [
  { id: "fba-prep-unit", label: "FBA — Preparo unitário (Amazon EUA)", basicUsd: 1.4, premiumUsd: 1.25 },
  { id: "fba-prep-pack2", label: "FBA — Preparo pack 2 (Amazon EUA)", basicUsd: 2.5, premiumUsd: 2.25 },
  { id: "fba-prep-pack3", label: "FBA — Preparo pack 3 (Amazon EUA)", basicUsd: 3.75, premiumUsd: 3.15 },
  { id: "fba-prep-pack4-6", label: "FBA — Preparo pack 4 a 6 (Amazon EUA)", basicUsd: 5.65, premiumUsd: 5.0 },
  {
    id: "fba-prep-pack-range",
    label: "FBA — Preparo pack grande (Amazon EUA · Básico: 6–12 un. · Premium: 7–12 un.)",
    basicUsd: 8.15,
    premiumUsd: 7.5,
  },
  // FBM = envio direto com etiqueta sua; vale para qualquer marketplace (não só Amazon).
  { id: "fbm-additional", label: "FBM — Produtos adicionais (qualquer plataforma)", basicUsd: 0.65, premiumUsd: 0.65 },
  { id: "fbm-extra-unit", label: "FBM — Unidade adicional (qualquer plataforma)", basicUsd: 0.65, premiumUsd: 0.65 },
  {
    id: "fbm-unit-to14",
    label: `FBM — Unitário até 14" (≈ ${formatCmFromInches(14)} cm · qualquer plataforma)`,
    basicUsd: 3.15,
    premiumUsd: 2.5,
  },
  {
    id: "fbm-unit-14-30",
    label: `FBM — Unitário 14" a 30" (≈ ${formatCmFromInches(14)} cm a ${formatCmFromInches(30)} cm · qualquer plataforma)`,
    basicUsd: 5.45,
    premiumUsd: 5.0,
  },
  {
    id: "fbm-over-20lbs",
    label: `FBM — Peso > 20 lbs (≈ ${formatKgFromLb(20)} kg · qualquer plataforma)`,
    basicUsd: 10.65,
    premiumUsd: 9.4,
  },
];

/** Serviços extra (referência; não entram na lista principal do simulador). */
export const PREP_CENTER_PRICING_EXTRA: PrepPricingLine[] = [
  { id: "photo-inspection", label: "Foto — Conferência", basicUsd: 6.25, premiumUsd: 0 },
  { id: "photo-unblock", label: "Foto — Desbloqueio", basicUsd: 6.25, premiumUsd: 0 },
  { id: "photo-return", label: "Foto — Retorno", basicUsd: 6.25, premiumUsd: 0 },
  { id: "pallet-assembly", label: "Pallet — Montagem", basicUsd: 56.25, premiumUsd: 50.0 },
  { id: "removal-box", label: "Remoção — Produtos / caixa", basicUsd: 12.5, premiumUsd: 11.25 },
  { id: "return-merch", label: "Retorno — Mercadoria", basicUsd: 6.25, premiumUsd: 1.5 },
  { id: "fee-unregistered", label: "Taxa — Produtos não cadastrados", basicUsd: 6.25, premiumUsd: 5.65 },
];

export const DEFAULT_PREP_SERVICE_ID = "fba-prep-unit";

/** Assinatura Direct Premium (USD / mês) — alinhado à tabela e ao portal. */
export const PREMIUM_SUBSCRIPTION_USD_PER_MONTH = 49.99;

/** Simulador landing: fotos de produto (tabela «Foto — Conferência») por mês no Básico vs US$0 no Premium. */
export const PREMIUM_LANDING_DEFAULT_MONTHLY_PRODUCT_PHOTOS = 4;
export const PREMIUM_LANDING_PRODUCT_PHOTO_SERVICE_ID = "photo-inspection" as const;

export type AnnualPrepComparison = {
  monthlyUnits: number;
  serviceId: string;
  monthlyProductPhotos: number;
  basicPerUnit: number;
  premiumPerUnit: number;
  basicPrepYearUsd: number;
  premiumPrepYearUsd: number;
  basicPhotosYearUsd: number;
  premiumPhotosYearUsd: number;
  premiumSubscriptionYearUsd: number;
  /** Prep + fotos (Básico) vs prep + fotos + sub (Premium). */
  basicTotalYearUsd: number;
  premiumTotalYearUsd: number;
  /** Positivo = no ano, o pacote Premium custa menos que o Básico com o mesmo volume e fotos. */
  savingsYearUsd: number;
};

/**
 * Compara custo anual: prep (linha escolhida) + fotos de produto/mês + assinatura Premium (só lado Premium).
 */
export function compareAnnualPrepSpend(params: {
  monthlyUnits: number;
  serviceId: string;
  /** Fotos «Conferência» por mês (tabela extra). Default: 4. */
  monthlyProductPhotos?: number;
  /** Override do id da linha de foto (default: conferência). */
  productPhotoServiceId?: string;
}): AnnualPrepComparison {
  const monthlyUnits = Number.isFinite(params.monthlyUnits) ? Math.max(0, params.monthlyUnits) : 0;
  const monthlyProductPhotos = Number.isFinite(params.monthlyProductPhotos)
    ? Math.max(0, params.monthlyProductPhotos ?? PREMIUM_LANDING_DEFAULT_MONTHLY_PRODUCT_PHOTOS)
    : PREMIUM_LANDING_DEFAULT_MONTHLY_PRODUCT_PHOTOS;
  const photoId = params.productPhotoServiceId ?? PREMIUM_LANDING_PRODUCT_PHOTO_SERVICE_ID;
  const line =
    PREP_CENTER_PRICING_MAIN.find((l) => l.id === params.serviceId) ??
    PREP_CENTER_PRICING_EXTRA.find((l) => l.id === params.serviceId);
  const basicPerUnit = line?.basicUsd ?? 0;
  const premiumPerUnit = line?.premiumUsd ?? 0;
  const u = monthlyUnits * 12;
  const basicPrepYearUsd = Math.round(basicPerUnit * u * 100) / 100;
  const premiumPrepYearUsd = Math.round(premiumPerUnit * u * 100) / 100;
  const photoLine = PREP_CENTER_PRICING_EXTRA.find((l) => l.id === photoId);
  const basicPhotoEach = photoLine?.basicUsd ?? 0;
  const premiumPhotoEach = photoLine?.premiumUsd ?? 0;
  const basicPhotosYearUsd = Math.round(basicPhotoEach * monthlyProductPhotos * 12 * 100) / 100;
  const premiumPhotosYearUsd = Math.round(premiumPhotoEach * monthlyProductPhotos * 12 * 100) / 100;
  const premiumSubscriptionYearUsd = Math.round(PREMIUM_SUBSCRIPTION_USD_PER_MONTH * 12 * 100) / 100;
  const basicTotalYearUsd = Math.round((basicPrepYearUsd + basicPhotosYearUsd) * 100) / 100;
  const premiumTotalYearUsd = Math.round(
    (premiumPrepYearUsd + premiumPhotosYearUsd + premiumSubscriptionYearUsd) * 100,
  ) / 100;
  const savingsYearUsd = Math.round((basicTotalYearUsd - premiumTotalYearUsd) * 100) / 100;
  return {
    monthlyUnits,
    serviceId: params.serviceId,
    monthlyProductPhotos,
    basicPerUnit,
    premiumPerUnit,
    basicPrepYearUsd,
    premiumPrepYearUsd,
    basicPhotosYearUsd,
    premiumPhotosYearUsd,
    premiumSubscriptionYearUsd,
    basicTotalYearUsd,
    premiumTotalYearUsd,
    savingsYearUsd,
  };
}

export const MARGIN_PCT_MIN = 10;
export const MARGIN_PCT_MAX = 45;

export function prepFeeUsd(plan: PrepCenterPlan, serviceId: string): number {
  const line =
    PREP_CENTER_PRICING_MAIN.find((l) => l.id === serviceId) ??
    PREP_CENTER_PRICING_EXTRA.find((l) => l.id === serviceId);
  if (!line) return 0;
  return plan === "premium" ? line.premiumUsd : line.basicUsd;
}

export function prepLineLabel(serviceId: string): string | undefined {
  return (
    PREP_CENTER_PRICING_MAIN.find((l) => l.id === serviceId)?.label ??
    PREP_CENTER_PRICING_EXTRA.find((l) => l.id === serviceId)?.label
  );
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

/** Garante margem desejada dentro do intervalo do produto (10–45%). */
export function clampMarginPct(value: number): number {
  if (!Number.isFinite(value)) return 25;
  return Math.min(MARGIN_PCT_MAX, Math.max(MARGIN_PCT_MIN, value));
}

export type UnitPricingResult =
  | {
      ok: true;
      landedPerUnit: number;
      /** Lucro alvo em US$ = (margem % × custo do produto). Prep e etiqueta são só custo, não entram na margem. */
      profitTargetUsd: number;
      salePrice: number;
      /** Taxa da plataforma em US$ (percentagem do preço de venda). */
      platformFeeOnSale: number;
      /** Lucro por unidade após vender a `salePrice` e pagar custos + taxa (≈ profitTargetUsd). */
      profitPerUnit: number;
    }
  | { ok: false; reason: string };

/**
 * Preço sugerido: custo produto + prep + etiqueta + **lucro alvo** (margem % só sobre o custo do produto);
 * a taxa da plataforma é **custo** em % do preço de venda.
 * `salePrice = (landed + (marginPct/100) * custo) / (1 - platformFeePct/100)`.
 */
export function computeSuggestedUnitSalePrice(params: {
  productCostUsd: number;
  prepFeeUsd: number;
  labelFeeUsd: number;
  platformFeePct: number;
  marginPct: number;
}): UnitPricingResult {
  const { productCostUsd: C, prepFeeUsd: P, labelFeeUsd: L, platformFeePct: pRaw, marginPct: mRaw } = params;
  const landed = C + P + L;
  if (!Number.isFinite(landed) || landed < 0 || !Number.isFinite(C) || C < 0) {
    return { ok: false, reason: "Custo do produto, prep ou etiqueta inválidos." };
  }
  const p = Number.isFinite(pRaw) && pRaw >= 0 ? pRaw : 0;
  const m = clampMarginPct(mRaw);
  const profitTargetUsd = C * (m / 100);
  const denom = 1 - p / 100;
  if (denom <= 0.0001) {
    return { ok: false, reason: "A taxa da plataforma tem de ser inferior a 100%." };
  }
  const salePriceRaw = (landed + profitTargetUsd) / denom;
  const salePrice = Math.round(salePriceRaw * 100) / 100;
  const platformFeeOnSale = Math.round(salePrice * (p / 100) * 100) / 100;
  const profitPerUnit = Math.round((salePrice - platformFeeOnSale - landed) * 100) / 100;
  return {
    ok: true,
    landedPerUnit: landed,
    profitTargetUsd: Math.round(profitTargetUsd * 100) / 100,
    salePrice,
    platformFeeOnSale,
    profitPerUnit,
  };
}
