import type { RegistryClient } from "./clientRegistryStore";
import { replaceAllClients } from "./clientRegistryStore";
import { hashPassword } from "./passwordHash";
import { resetInventoryToEmpty } from "./inventoryStore";
import { clearOrderOpsLog } from "./orderOpsLog";
import { clearEmailOutbox } from "./emailOutbox";
import { clearSupportTickets } from "./supportTicketsStore";
import { clearWalletLedger } from "./walletLedger";
import { clearClientOrders } from "./clientOrdersStore";
import { clearAssistedPurchases } from "./assistedPurchaseStore";
import { clearAllAmazonLeadsEditions } from "./amazonLeadsDailyStore";
import { clearVipCommerceForPilot, resetVipDemoContent } from "./vipDemoSeed";
import { clearBundles } from "./bundleStore";
import { clearGrowthProgram } from "./growthProgramStore";

const MIN_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export type DemoFullResetOptions = {
  /** Suite de login após o reset (padrão 10001). Ignorado se `emptyClients`. */
  suite?: string;
  /** Nome exato para entrar (padrão «Conta Demo»). Ignorado se `emptyClients`. */
  name?: string;
  /** Saldo inicial em USD (padrão 100). Ignorado se `emptyClients`. */
  balanceUsd?: number;
  /** Senha do cliente demo após o reset (padrão demo1234). Ignorado se `emptyClients`. */
  demoPassword?: string;
  /**
   * Sem conta demo: `clients.json` fica vazio — novos clientes usam `POST /api/client/register`.
   * Por omissão também esvazia anúncios + loja VIP; passe `seedVipDemo: true` para repor conteúdo demo VIP.
   */
  emptyClients?: boolean;
  /** Só usado com `emptyClients: true`. Se `true`, repõe anúncios + produtos demo na loja VIP. */
  seedVipDemo?: boolean;
};

export type DemoFullResetResult =
  | { emptyRegistry: true }
  | {
      emptyRegistry?: false;
      loginSuite: string;
      loginName: string;
      /** E-mail da conta demo (entrada no portal: e-mail + senha). */
      loginEmail: string;
      /** Senha definida na conta demo (resposta só no endpoint de reset local). */
      loginPassword: string;
      balanceUsd: number;
    };

/**
 * Repõe o ambiente demo no servidor: um cliente aprovado com saldo, inventário vazio,
 * filas de e-mail / ops / ledger limpas.
 */
export function runDemoFullReset(opts: DemoFullResetOptions = {}): DemoFullResetResult {
  const emptyClients = opts.emptyClients === true;
  const loginSuite = (opts.suite ?? "10001").trim();
  const loginName = (opts.name ?? "Conta Demo").trim();
  const loginPassword = (opts.demoPassword ?? "demo1234").trim() || "demo1234";
  const balanceUsd =
    typeof opts.balanceUsd === "number" && Number.isFinite(opts.balanceUsd) ? Math.max(0, opts.balanceUsd) : 100;

  resetInventoryToEmpty();
  clearOrderOpsLog();
  clearEmailOutbox();
  clearSupportTickets();
  clearWalletLedger();
  clearClientOrders();
  clearAssistedPurchases();
  clearBundles();
  clearGrowthProgram();
  clearAllAmazonLeadsEditions();

  const seedVipDemo = typeof opts.seedVipDemo === "boolean" ? opts.seedVipDemo : !emptyClients;
  if (seedVipDemo) resetVipDemoContent();
  else clearVipCommerceForPilot();

  if (emptyClients) {
    replaceAllClients([]);
    return { emptyRegistry: true };
  }

  const seed: RegistryClient = {
    suite: loginSuite,
    name: loginName,
    email: `${loginSuite}@demo.dbx`,
    phone: "0000000000",
    addressLine1: "1 Demo Street",
    addressLine2: "",
    city: "Miami",
    region: "FL",
    postalCode: "33101",
    country: "United States",
    balanceUsd,
    planLabel: "Conta nova",
    premiumActive: false,
    amazonLeadsProActive: false,
    repriceProActive: false,
    aiListingStarterActive: false,
    aiListingProActive: false,
    createdAtIso: new Date().toISOString(),
    active: true,
    tier: "Starter",
    proofOfAddressDataUrl: MIN_PNG,
    idDocumentDataUrl: MIN_PNG,
    verificationStatus: "approved",
    onboardingQuiz: {
      productCategories: "Demo / reset",
      monthlyVolumeBand: "0-100",
      supplierRegion: "usa",
      businessModel: "private_label",
    },
    passwordHash: hashPassword(loginPassword),
  };

  replaceAllClients([seed]);

  return { emptyRegistry: false, loginSuite, loginName, loginEmail: seed.email, loginPassword, balanceUsd };
}
