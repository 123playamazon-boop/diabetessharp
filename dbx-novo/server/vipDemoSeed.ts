import type { VipAnnouncement } from "./vipAnnouncementsStore";
import { replaceAllVipAnnouncements } from "./vipAnnouncementsStore";
import type { VipStoreProduct, VipStoreSnapshot } from "./vipStoreStore";
import { replaceAllVipStore } from "./vipStoreStore";

const now = () => new Date().toISOString();

function seedAnnouncements(): VipAnnouncement[] {
  const t = Date.now();
  return [
    {
      id: `vip-seed-a-${t}`,
      title: "Listagem: fotos que convertem (Amazon)",
      body: "Use as 7 primeiras imagens como história do produto: hero + infográfico + escala + comparação + lifestyle + embalagem + selo. Evite texto ilegível no mobile — o algoritmo privilegia CTR e tempo na página.",
      channel: "amazon",
      audience: "all",
      pinned: true,
      publishedAtIso: now(),
      active: true,
    },
    {
      id: `vip-seed-b-${t}`,
      title: "Buy Box e preço dinâmico",
      body: "Revise mínimos automáticos semanalmente. Se o MAP ou o fornecedor mudar, ajuste regras no repricer antes de perder giro de capital parado em SKU sem vitória.",
      channel: "amazon",
      audience: "premium_only",
      pinned: false,
      publishedAtIso: new Date(Date.now() - 86_400_000).toISOString(),
      active: true,
    },
  ];
}

function seedProducts(): VipStoreProduct[] {
  const t = Date.now();
  return [
    {
      id: `sku-pack-${t}`,
      title: "Pack 50 etiquetas térmicas 4×6 (prep)",
      shortDescription: "Compatível com impressoras de etiquetas comuns — custo baixo para FBM e FNSKU auxiliar.",
      unitPriceUsd: 12.9,
      referenceCostUsd: 7.5,
      stockQty: 40,
      active: true,
      category: "Consumíveis",
      createdAtIso: now(),
    },
    {
      id: `sku-cinta-${t}`,
      title: "Fita adesiva reforçada (caixa master)",
      shortDescription: "Rolo padrão para fechamento de caixas enviadas ao prep — preço de revenda agressivo.",
      unitPriceUsd: 4.5,
      referenceCostUsd: 2.2,
      stockQty: 120,
      active: true,
      category: "Embalagem",
      createdAtIso: now(),
    },
  ];
}

/** Repõe conteúdo demo de Grupo VIP + Loja (chamado no reset global). */
export function resetVipDemoContent(): void {
  replaceAllVipAnnouncements(seedAnnouncements());
  const snap: VipStoreSnapshot = {
    platformFeePct: 0.05,
    products: seedProducts(),
    orders: [],
  };
  replaceAllVipStore(snap);
}

/** Loja + anúncios VIP vazios (piloto / clientes reais). */
export function clearVipCommerceForPilot(): void {
  replaceAllVipAnnouncements([]);
  replaceAllVipStore({ platformFeePct: 0.05, products: [], orders: [] });
}
