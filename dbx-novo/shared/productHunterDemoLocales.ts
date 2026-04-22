/**
 * Textos demo do Product Hunter (sem OpenAI), por locale de UI.
 * Conteúdo congelado por geração — não retrofits em candidatos já guardados.
 */

import type { ProductHunterExperienceLevel, ProductHunterIdea } from "./productHunter";

export type ProductHunterUiLocale = "pt-BR" | "en" | "es";

export function normalizeProductHunterUiLocale(v: unknown): ProductHunterUiLocale {
  if (v === "pt-BR" || v === "en" || v === "es") return v;
  return "pt-BR";
}

type Seed = Omit<ProductHunterIdea, "opportunityScore">;

const EN: Seed[] = [
  {
    idea: "Problem-solving kitchen gadget bundle (narrow SKU, clear use case)",
    demandLevel: "high",
    competitionLevel: "medium",
    estimatedProfitMargin: "22–35%",
    bestMarketplace: "Amazon USA",
    logisticsFeasibility:
      "Small parcel, sub-2 lb — FBA-friendly if inbound discipline is tight; avoid oversized during first PO.",
    whyTrending:
      "Search volume up on “time saved / counter clutter” queries; short-form demos convert impulse buyers when the hook is visual proof in 3 seconds.",
    sellingStrategy:
      "Lead with a single hero SKU + variation matrix after proof; use A+ comparison table vs generic alternatives; tighten COGS before scaling ads.",
  },
  {
    idea: "Pet accessory with replaceable consumable (subscription tail)",
    demandLevel: "high",
    competitionLevel: "high",
    estimatedProfitMargin: "15–24%",
    bestMarketplace: "Amazon USA + Shopify landing for LTV",
    logisticsFeasibility:
      "Moderate — packaging dims matter; bundle inserts for repurchase; watch hazmat flags if any liquid.",
    whyTrending:
      "Pet spend holds in soft consumer cycles; “refill” framing increases repeat purchase rate vs one-off novelty.",
    sellingStrategy:
      "Anchor price to cost-per-use; Subscribe & Save where eligible; collect emails on insert for DTC second purchase.",
  },
  {
    idea: "Industrial-adjacent home office SKU (B2B-lite demand on consumer channels)",
    demandLevel: "medium",
    competitionLevel: "low",
    estimatedProfitMargin: "28–40%",
    bestMarketplace: "Amazon USA",
    logisticsFeasibility:
      "Strong — dense SKU, palletizable; fewer returns if spec sheet is explicit; watch MAP policies if brand gated.",
    whyTrending:
      "Hybrid work stabilized baseline category demand; fewer trendy spikes but steadier sell-through for operators who like inventory predictability.",
    sellingStrategy:
      "Spec-forward listing, compatibility callouts, B2B keywords where allowed; avoid hype; win on trust and measurable outcomes.",
  },
  {
    idea: "Seasonal outdoor micro-category (6–10 week sprint window)",
    demandLevel: "medium",
    competitionLevel: "medium",
    estimatedProfitMargin: "18–30%",
    bestMarketplace: "TikTok Shop USA",
    logisticsFeasibility:
      "Timing risk — inbound must clear before demand peak; air vs ocean tradeoff; keep MOQ tight until sell-through proves.",
    whyTrending:
      "Short-window categories reward operators who can read search lift early; losers overbuy after the spike.",
    sellingStrategy:
      "Pre-launch content bank; kill losers fast with inventory caps; use bundles to lift AOV without doubling logistics SKUs.",
  },
  {
    idea: "Health-adjacent consumable with clear dosage ritual (compliance-forward copy)",
    demandLevel: "medium",
    competitionLevel: "high",
    estimatedProfitMargin: "12–22%",
    bestMarketplace: "Amazon USA",
    logisticsFeasibility:
      "Labeling and claims discipline required; avoid medical positioning; consider lot tracking if multi-batch.",
    whyTrending:
      "Wellness routines stay sticky; winners differentiate on transparency and third-party testing messaging where appropriate.",
    sellingStrategy:
      "Education-first landing; comparison to alternatives on spec not hype; tighten refund policy to protect margin on opened units.",
  },
];

const PT_BR: Seed[] = [
  {
    idea: "Kit compacto de gadget de cozinha que resolve uma dor específica (SKU enxuto, uso óbvio)",
    demandLevel: "high",
    competitionLevel: "medium",
    estimatedProfitMargin: "22–35%",
    bestMarketplace: "Amazon USA",
    logisticsFeasibility:
      "Pacote pequeno, abaixo de ~900 g — entra bem no FBA se você segurar cubagem e não estourar oversize no primeiro lote.",
    whyTrending:
      "Busca cresce em variações de “ganhar tempo / tirar bagunça da bancada”; vídeo curto que mostra o antes/depois em poucos segundos vira gatilho de compra por impulso.",
    sellingStrategy:
      "Começa com um SKU herói e só depois abre variação; A+ comparando com genérico fraco; fecha custo antes de escalar mídia.",
  },
  {
    idea: "Acessório pet com refil ou consumível (gancho de recompra recorrente)",
    demandLevel: "high",
    competitionLevel: "high",
    estimatedProfitMargin: "15–24%",
    bestMarketplace: "Amazon USA + página Shopify para LTV",
    logisticsFeasibility:
      "Médio — dimensão de embalagem importa; insert com incentivo à recompra; cuidado com líquidos e possíveis flags de hazmat.",
    whyTrending:
      "Gasto com pet segue firme mesmo com consumidor mais seletor; narrativa de “refil” puxa recompra melhor que produto “one hit”.",
    sellingStrategy:
      "Preço ancorado no custo por uso; Subscribe & Save onde couber; captura e-mail no insert para segunda compra no DTC.",
  },
  {
    idea: "SKU de home office com cara “semi profissional” (demanda B2B leve em canal B2C)",
    demandLevel: "medium",
    competitionLevel: "low",
    estimatedProfitMargin: "28–40%",
    bestMarketplace: "Amazon USA",
    logisticsFeasibility:
      "Forte — SKU denso, palletizável; menos devolução se a ficha técnica for honesta; atenção a MAP se categoria tiver marca sensível.",
    whyTrending:
      "Trabalho híbrido estabilizou demanda de base; menos surpresa viral, mas giro mais previsível para quem gosta de prever estoque.",
    sellingStrategy:
      "Listagem “spec-first”, compatibilidades explícitas, keywords B2B onde der; evita hype — ganha com confiança e promessa mensurável.",
  },
  {
    idea: "Microcategoria outdoor sazonal (janela de sprint 6–10 semanas)",
    demandLevel: "medium",
    competitionLevel: "medium",
    estimatedProfitMargin: "18–30%",
    bestMarketplace: "TikTok Shop USA",
    logisticsFeasibility:
      "Risco de timing — inbound precisa chegar antes do pico; equilíbrio aéreo vs marítimo; MOQ enxuto até provar sell-through.",
    whyTrending:
      "Categorias de janela curta pagam quem lê levantada de busca cedo; quem compra tarde demais fica com sobra depois do pico.",
    sellingStrategy:
      "Banco de conteúdo pré-lançamento; mata rápido o que não vira com teto de estoque; bundles sobem ticket sem dobrar SKU logístico.",
  },
  {
    idea: "Consumível de bem-estar com ritual de dosagem claro (copy compliance-first, sem prometer cura)",
    demandLevel: "medium",
    competitionLevel: "high",
    estimatedProfitMargin: "12–22%",
    bestMarketplace: "Amazon USA",
    logisticsFeasibility:
      "Disciplina de rótulo e claims; evita posicionamento médico; se tiver lote em série, vale rastrear lote/lote.",
    whyTrending:
      "Rotina de bem-estar gruda quando o produto “faz sentido no dia a dia”; quem ganha empurra transparência e prova/teste quando couber.",
    sellingStrategy:
      "Landing educativa; comparação por especificação, não por milagre; política de devolução apertada em item aberto para proteger margem.",
  },
];

const ES: Seed[] = [
  {
    idea: "Bundle de gadget de cocina que resuelve un problema concreto (SKU acotado, caso de uso claro)",
    demandLevel: "high",
    competitionLevel: "medium",
    estimatedProfitMargin: "22–35%",
    bestMarketplace: "Amazon USA",
    logisticsFeasibility:
      "Paquete pequeño (<~2 lb): encaja en FBA si controlas cubaje; evita oversize en el primer pedido.",
    whyTrending:
      "Suben búsquedas tipo “ahorrar tiempo / orden en la encimera”; demos cortas con prueba visual fuerte disparan compra por impulso.",
    sellingStrategy:
      "Empieza con un SKU héroe y luego matriz de variaciones; A+ comparando vs alternativas genéricas; aprieta COGS antes de escalar ads.",
  },
  {
    idea: "Accesorio pet con consumible reemplazable (cola de suscripción)",
    demandLevel: "high",
    competitionLevel: "high",
    estimatedProfitMargin: "15–24%",
    bestMarketplace: "Amazon USA + landing Shopify para LTV",
    logisticsFeasibility:
      "Moderado: importan medidas de empaque; insert para recompra; ojo a líquidos y posibles flags hazmat.",
    whyTrending:
      "El gasto pet se mantiene en ciclos blandos; el framing “recarga” empuja recompra vs novedad de un solo uso.",
    sellingStrategy:
      "Precio anclado a coste por uso; Subscribe & Save si aplica; captura email en insert para segunda compra DTC.",
  },
  {
    idea: "SKU de home office “semi industrial” (demanda B2B-lite en canales B2C)",
    demandLevel: "medium",
    competitionLevel: "low",
    estimatedProfitMargin: "28–40%",
    bestMarketplace: "Amazon USA",
    logisticsFeasibility:
      "Sólido — SKU denso, paletizable; menos devoluciones si la ficha técnica es explícita; cuidado con MAP si hay marca sensible.",
    whyTrending:
      "El trabajo híbrido estabilizó demanda base; menos picos virales pero giro más predecible para quien odia sorpresas de stock.",
    sellingStrategy:
      "Listado “spec-first”, compatibilidades claras, keywords B2B donde se permita; sin hype — gana confianza y resultados medibles.",
  },
  {
    idea: "Microcategoría outdoor estacional (ventana sprint 6–10 semanas)",
    demandLevel: "medium",
    competitionLevel: "medium",
    estimatedProfitMargin: "18–30%",
    bestMarketplace: "TikTok Shop USA",
    logisticsFeasibility:
      "Riesgo de timing: el inbound debe llegar antes del pico; tradeoff aire vs mar; MOQ ajustado hasta validar sell-through.",
    whyTrending:
      "Las categorías cortas premian a quien detecta subida de búsqueda temprano; el rezagado compra demasiado tarde y queda con exceso.",
    sellingStrategy:
      "Banco de contenido pre-lanzamiento; corta perdedores rápido con tope de stock; bundles suben AOV sin duplicar SKUs logísticos.",
  },
  {
    idea: "Consumible de bienestar con ritual de dosificación claro (copy compliance-first)",
    demandLevel: "medium",
    competitionLevel: "high",
    estimatedProfitMargin: "12–22%",
    bestMarketplace: "Amazon USA",
    logisticsFeasibility:
      "Disciplina de etiquetado y claims; evita posicionamiento médico; considera trazabilidad por lote si hay varios batches.",
    whyTrending:
      "Las rutinas de bienestar se mantienen si el producto encaja en el día a día; los ganadores destacan transparencia y pruebas cuando aplique.",
    sellingStrategy:
      "Landing educativa; compara por especificación, no por hype; política de devolución estricta en unidades abiertas para proteger margen.",
  },
];

const BY_LOCALE: Record<ProductHunterUiLocale, Seed[]> = {
  en: EN,
  "pt-BR": PT_BR,
  es: ES,
};

function expLabel(locale: ProductHunterUiLocale, experience: ProductHunterExperienceLevel): string {
  const m: Record<ProductHunterUiLocale, Record<ProductHunterExperienceLevel, string>> = {
    en: { beginner: "beginner", intermediate: "intermediate", advanced: "advanced" },
    "pt-BR": { beginner: "iniciante", intermediate: "intermediário", advanced: "avançado" },
    es: { beginner: "principiante", intermediate: "intermedio", advanced: "avanzado" },
  };
  return m[locale][experience];
}

export function getDemoProductHunterSeeds(locale: ProductHunterUiLocale): Seed[] {
  return BY_LOCALE[normalizeProductHunterUiLocale(locale)] ?? BY_LOCALE["pt-BR"];
}

export function buildDemoProductHunterSummary(
  locale: ProductHunterUiLocale,
  bNote: string,
  mp: string,
  experience: ProductHunterExperienceLevel,
): string {
  const exp = expLabel(locale, experience);
  const L = normalizeProductHunterUiLocale(locale);
  if (L === "en") {
    return `Demo mode: five structured opportunities tuned to budget "${bNote}", primary channel bias ${mp}, and ${exp} seller profile. With OPENAI_API_KEY, the server generates a bespoke ranked set from your inputs.`;
  }
  if (L === "es") {
    return `Modo demo: cinco oportunidades estructuradas según presupuesto «${bNote}», sesgo de canal principal ${mp} y perfil de vendedor ${exp}. Con OPENAI_API_KEY, el servidor genera un ranking a medida a partir de tus datos.`;
  }
  return `Modo demo: cinco oportunidades estruturadas com base no orçamento «${bNote}», viés de canal principal ${mp} e perfil de vendedor ${exp}. Com OPENAI_API_KEY no servidor, a lista ranqueada passa a ser gerada sob medida a partir dos seus inputs.`;
}
