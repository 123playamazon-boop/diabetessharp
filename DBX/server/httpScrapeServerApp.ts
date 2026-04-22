import cors from "cors";
import express from "express";
import type { ClientRegisterPayload } from "../src/types";
import {
  approveClientSuite,
  applyWalletDelta,
  findBySuite,
  listClients,
  patchClientBySuite,
  tryClientLogin,
  tryClientLoginBySuiteAndNameOrEmail,
  tryClientLoginBySuitePassword,
  setClientPasswordBySuite,
  registerClientFull,
  removeClientBySuite,
  setClientPremiumActive,
  setClientAmazonLeadsProActive,
  setClientRepriceProActive,
  setClientAiListingStarterActive,
  setClientAiListingProActive,
  toPublicProfile,
} from "./clientRegistryStore";
import { runDemoFullReset } from "./demoFullReset";
import {
  deleteClientOrder,
  listClientOrdersBySuite,
  patchClientOrder,
  prependClientOrder,
  readAllClientOrders,
  runAwaitingClientReminderScan,
} from "./clientOrdersStore";
import {
  addDeductions,
  additionBelongsToSuite,
  appendRow,
  bootstrapAdditionsIfEmpty,
  confirmInventoryReceipt,
  filterInventorySnapshotForSuite,
  isRow,
  loadSnapshot,
  patchRow,
  removeDeductions,
  type InventoryJsonRow,
} from "./inventoryStore";
import { signUserAccessToken } from "./accessToken";
import { requireAdmin, requireUser, userSuite } from "./authMiddleware";
import { queueDemoEmail } from "./emailOutbox";
import { appendWalletLedger, readWalletLedger } from "./walletLedger";
import { registerSupportRoutes } from "./supportHttpRoutes";
import { registerAmazonLeadsRoutes } from "./amazonLeadsHttpRoutes";
import { registerBundleRoutes } from "./bundleHttpRoutes";
import { registerAssistedPurchaseRoutes } from "./assistedPurchaseHttpRoutes";
import { apiNotFoundStaleHint } from "./apiNotFoundHints";
import { registerVipRoutes } from "./vipHttpRoutes";
import { registerGrowthProgramRoutes } from "./growthProgramHttpRoutes";
import { registerGrowthStrategyAiRoutes } from "./growthStrategyAiHttpRoutes";
import { registerAiListingRoutes } from "./aiListingHttpRoutes";
import { registerListingAnalysisRoutes } from "./listingAnalysisHttpRoutes";
import { registerListingComplianceRoutes } from "./listingComplianceHttpRoutes";
import { registerListingMultiPlatformRoutes } from "./listingMultiPlatformHttpRoutes";
import { registerProductHunterRoutes } from "./productHunterHttpRoutes";
import { appendOrderOpsEvent } from "./orderOpsLog";
import { adminDeliverPrepKitOrder } from "./prepKitOrderDeliver";
import { parseShippingLabelPdfDataUrl } from "./shippingLabelParse";
import { lookupShippingTrackingOnServer } from "./shippingTrackingLookup";
import { scrapeSupplierPage } from "./scrapeSupplier";

export function createScrapeApiApp(): express.Express {
  /** Cadastros com foto em base64 — precisa de margem; scrape continua com corpos pequenos. */
  const maxBody = "6mb";

  const app = express();

const corsOrigins = (process.env.CORS_ORIGIN?.split(",") ?? [])
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept", "Authorization"],
    optionsSuccessStatus: 204,
  }),
);
app.use(express.json({ limit: maxBody }));

/** Compra assistida cedo no registo — evita 404 genérico se outro middleware/ordem interferir. */
registerAssistedPurchaseRoutes(app);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "dbx-scrape-api", assistedPurchases: true, growthProgram: true });
});

app.post("/api/client/register", (req, res) => {
  const b = req.body as Record<string, unknown> | null;
  if (!b || typeof b !== "object") {
    res.status(400).json({ error: "Corpo JSON inválido." });
    return;
  }
  const quiz = b.onboardingQuiz;
  if (!quiz || typeof quiz !== "object") {
    res.status(400).json({ error: "Questionário de onboarding em falta." });
    return;
  }
  const q = quiz as Record<string, unknown>;
  const line1 =
    typeof b.addressLine1 === "string"
      ? b.addressLine1
      : typeof b.street === "string"
        ? b.street
        : "";
  const line2 = typeof b.addressLine2 === "string" ? b.addressLine2 : "";
  const city = typeof b.city === "string" ? b.city : "";
  const region =
    typeof b.region === "string" ? b.region : typeof b.stateUs === "string" ? b.stateUs : "";
  const postalCode =
    typeof b.postalCode === "string" ? b.postalCode : typeof b.zipUs === "string" ? b.zipUs : "";
  const country = typeof b.country === "string" ? b.country : "";
  const payload: ClientRegisterPayload = {
    name: typeof b.name === "string" ? b.name : "",
    email: typeof b.email === "string" ? b.email : "",
    phone: typeof b.phone === "string" ? b.phone : "",
    password: typeof b.password === "string" ? b.password : "",
    addressLine1: line1,
    addressLine2: line2,
    city,
    region,
    postalCode,
    country,
    proofOfAddressDataUrl: typeof b.proofOfAddressDataUrl === "string" ? b.proofOfAddressDataUrl : "",
    idDocumentDataUrl: typeof b.idDocumentDataUrl === "string" ? b.idDocumentDataUrl : "",
    onboardingQuiz: {
      productCategories: typeof q.productCategories === "string" ? q.productCategories : "",
      monthlyVolumeBand: typeof q.monthlyVolumeBand === "string" ? q.monthlyVolumeBand : "",
      supplierRegion: q.supplierRegion === "international" ? "international" : "usa",
      businessModel:
        q.businessModel === "dropshipping" || q.businessModel === "online_arbitrage"
          ? q.businessModel
          : "private_label",
    },
  };
  try {
    const c = registerClientFull(payload);
    const accessToken = signUserAccessToken({ suite: c.suite, email: c.email });
    res.json({ profile: toPublicProfile(c), accessToken });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Erro ao registar." });
  }
});

app.post("/api/client/login", (req, res) => {
  const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
  const password = typeof b.password === "string" ? b.password : "";
  const email = typeof b.email === "string" ? b.email.trim() : "";
  const suite = typeof b.suite === "string" ? b.suite.trim() : "";
  const nameOrEmail =
    typeof b.name === "string" ? b.name.trim() : typeof b.nome === "string" ? b.nome.trim() : "";

  if (!password) {
    res.status(400).json({ error: "Indique a senha." });
    return;
  }

  // Modo legado (portal antigo): suite + nome OU e-mail no segundo campo.
  if (suite && nameOrEmail) {
    const legacy = tryClientLoginBySuiteAndNameOrEmail(suite, nameOrEmail, password);
    if (!legacy.ok) {
      const err =
        legacy.reason === "no_password"
          ? "Esta conta ainda não tem senha definida no servidor — use o registo ou peça ao admin para definir uma senha."
          : "Não foi possível entrar. Verifique o número da suite, o nome da conta ou o e-mail usado no registo, e a senha.";
      res.status(401).json({ error: err });
      return;
    }
    res.json({
      profile: toPublicProfile(legacy.client),
      accessToken: signUserAccessToken({ suite: legacy.client.suite, email: legacy.client.email }),
    });
    return;
  }

  // Só dígitos no campo de e-mail → tratar como número da suite.
  const suiteDigits = /^\d{4,8}$/;
  if (email && !email.includes("@") && suiteDigits.test(email)) {
    const bySuite = tryClientLoginBySuitePassword(email, password);
    if (!bySuite.ok) {
      const err =
        bySuite.reason === "password"
          ? "Senha incorrecta."
          : bySuite.reason === "no_password"
            ? "Esta conta ainda não tem senha definida no servidor — use o registo ou peça ao admin para definir uma senha."
            : "Suite não encontrada.";
      res.status(401).json({ error: err });
      return;
    }
    res.json({
      profile: toPublicProfile(bySuite.client),
      accessToken: signUserAccessToken({ suite: bySuite.client.suite, email: bySuite.client.email }),
    });
    return;
  }

  if (!email) {
    res.status(400).json({
      error:
        "Indique o e-mail e a senha. (Se ainda usa o formulário antigo, envie também o número da suite e o nome ou e-mail da conta.)",
    });
    return;
  }

  const result = tryClientLogin(email, password);
  if (!result.ok) {
    const err =
      result.reason === "password"
        ? "Senha incorrecta."
        : result.reason === "no_password"
          ? "Esta conta ainda não tem senha definida no servidor — use o registo ou peça ao admin para definir uma senha."
          : "E-mail não encontrado.";
    res.status(401).json({ error: err });
    return;
  }
  res.json({
    profile: toPublicProfile(result.client),
    accessToken: signUserAccessToken({ suite: result.client.suite, email: result.client.email }),
  });
});

app.get("/api/client/me", requireUser, (req, res) => {
  const suite = userSuite(req);
  const c = findBySuite(suite);
  if (!c) {
    res.status(404).json({ error: "Conta não encontrada." });
    return;
  }
  res.json({ profile: toPublicProfile(c) });
});

/** Pedidos criados no portal — fonte de verdade no servidor (admin e cliente sincronizam aqui). */
app.get("/api/client/orders", requireUser, (req, res) => {
  const suite = userSuite(req);
  res.json({ orders: listClientOrdersBySuite(suite) });
});

app.post("/api/client/orders", requireUser, (req, res) => {
  const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
  const order = b.order;
  if (!order || typeof order !== "object") {
    res.status(400).json({ error: "Envie «order» (JSON do pedido)." });
    return;
  }
  const authSuite = userSuite(req);
  const o = order as Record<string, unknown>;
  const orderSuite = typeof o.suite === "string" ? o.suite.trim() : "";
  if (orderSuite && orderSuite !== authSuite) {
    res.status(403).json({ error: "O pedido não pode ser criado para outra suite." });
    return;
  }
  if (!orderSuite) {
    o.suite = authSuite;
  }
  try {
    const row = prependClientOrder(o);
    res.json({ ok: true, order: row });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Erro ao guardar pedido." });
  }
});

app.patch("/api/client/orders/:id", requireUser, (req, res) => {
  const id = req.params.id;
  const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
  const suite = userSuite(req);
  const patch = b.patch && typeof b.patch === "object" ? (b.patch as Record<string, unknown>) : null;
  if (!patch) {
    res.status(400).json({ error: "Envie «patch»." });
    return;
  }
  const existing = readAllClientOrders().find((o) => o.id === id);
  if (!existing) {
    res.status(404).json({ error: "Pedido não encontrado." });
    return;
  }
  if (typeof existing.suite !== "string" || existing.suite.trim() !== suite) {
    res.status(403).json({ error: "Suite não coincide com o pedido." });
    return;
  }
  const merged = patchClientOrder(id, patch);
  if (!merged) {
    res.status(404).json({ error: "Pedido não encontrado." });
    return;
  }
  res.json({ ok: true, order: merged });
});

app.delete("/api/client/orders/:id", requireUser, (req, res) => {
  const id = req.params.id;
  const suite = userSuite(req);
  const existing = readAllClientOrders().find((o) => o.id === id);
  if (!existing) {
    res.status(404).json({ error: "Pedido não encontrado." });
    return;
  }
  if (typeof existing.suite !== "string" || existing.suite.trim() !== suite) {
    res.status(403).json({ error: "Suite não coincide com o pedido." });
    return;
  }
  if (!deleteClientOrder(id)) {
    res.status(404).json({ error: "Pedido não encontrado." });
    return;
  }
  res.json({ ok: true });
});

app.get("/api/admin/client-orders", requireAdmin, (_req, res) => {
  runAwaitingClientReminderScan();
  res.json({ orders: readAllClientOrders() });
});

app.patch("/api/admin/client-orders/:id", requireAdmin, (req, res) => {
  const id = req.params.id;
  const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
  const patch = b.patch && typeof b.patch === "object" ? (b.patch as Record<string, unknown>) : null;
  if (!patch) {
    res.status(400).json({ error: "Envie «patch»." });
    return;
  }
  const existing = readAllClientOrders().find((o) => o.id === id);
  if (!existing) {
    res.status(404).json({ error: "Pedido não encontrado." });
    return;
  }
  const prevStatus = String(existing.status ?? "");
  const nextStatus = typeof patch.status === "string" ? patch.status : prevStatus;
  if (nextStatus === "aguardando_cliente" && prevStatus !== "aguardando_cliente") {
    const mergedSvc = typeof patch.service === "string" ? patch.service : String(existing.service ?? "");
    if (mergedSvc === "FBA") {
      const dims = patch.fbaMasterBoxDims ?? existing.fbaMasterBoxDims;
      const okDims =
        dims &&
        typeof dims === "object" &&
        [Number((dims as Record<string, unknown>).lengthCm), Number((dims as Record<string, unknown>).widthCm), Number((dims as Record<string, unknown>).heightCm), Number((dims as Record<string, unknown>).weightLb)].every(
          (n) => Number.isFinite(n) && n > 0,
        );
      if (!okDims) {
        res.status(400).json({
          error:
            "Pedidos FBA: guarde as medidas da caixa master (cm e lb) antes de mover o pedido para «Aguardando o cliente».",
        });
        return;
      }
    }
  }
  const merged = patchClientOrder(id, patch);
  if (!merged) {
    res.status(404).json({ error: "Pedido não encontrado." });
    return;
  }
  res.json({ ok: true, order: merged });
});

/** PREP_KIT — admin credita SKUs de saída no inventário do cliente e fecha o pedido. */
app.post("/api/admin/client-orders/:id/prep-kit-deliver", requireAdmin, (req, res) => {
  const id = req.params.id;
  const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
  const outputs = Array.isArray(b.outputs) ? b.outputs : [];
  const r = adminDeliverPrepKitOrder(id, outputs as { id: string; title: string; qty: number }[]);
  if (!r.ok) {
    res.status(400).json({ error: r.error });
    return;
  }
  res.json({ ok: true, order: r.order });
});

/** Demo: ajustar saldo (cartão simulado, taxa de envio, estorno manual). */
app.post("/api/client/wallet/adjust", requireUser, (req, res) => {
  const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
  const suite = userSuite(req);
  const bodySuite = typeof b.suite === "string" ? b.suite.trim() : "";
  if (bodySuite && bodySuite !== suite) {
    res.status(403).json({ error: "Não pode ajustar a carteira de outra suite." });
    return;
  }
  const deltaUsd = Number(b.deltaUsd);
  const reason = typeof b.reason === "string" && b.reason.trim() ? b.reason.trim() : "adjust";
  const reference = typeof b.reference === "string" && b.reference.trim() ? b.reference.trim() : undefined;
  if (!Number.isFinite(deltaUsd)) {
    res.status(400).json({ error: "Envie «deltaUsd» numérico (positivo = crédito, negativo = débito)." });
    return;
  }
  const adj = applyWalletDelta(suite, Math.round(deltaUsd * 100) / 100);
  if (!adj.ok) {
    res.status(400).json({ error: adj.error });
    return;
  }
  appendWalletLedger({
    suite,
    deltaUsd: Math.round(deltaUsd * 100) / 100,
    balanceAfter: adj.balanceUsd,
    reason,
    reference,
  });
  res.json({ ok: true, balanceUsd: adj.balanceUsd });
});

/** Lista movimentos do livro (demo) — filtrado por suite, mais recentes primeiro. */
app.get("/api/client/wallet/ledger", requireUser, (req, res) => {
  const suite = userSuite(req);
  const entries = readWalletLedger()
    .filter((e) => e.suite === suite)
    .sort((a, b) => Date.parse(b.atIso) - Date.parse(a.atIso));
  res.json({ entries });
});

/** Extrato completo por suite (consola admin, demo). */
app.get("/api/admin/wallet/ledger", requireAdmin, (req, res) => {
  const suite = typeof req.query.suite === "string" ? req.query.suite.trim() : "";
  if (!suite) {
    res.status(400).json({ error: "Envie «suite»." });
    return;
  }
  const entries = readWalletLedger()
    .filter((e) => e.suite === suite)
    .sort((a, b) => Date.parse(b.atIso) - Date.parse(a.atIso));
  res.json({ entries });
});

/** Consola admin: crédito/débito na carteira de qualquer suite (demo). */
app.post("/api/admin/wallet/adjust", requireAdmin, (req, res) => {
  const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
  const suite = typeof b.suite === "string" ? b.suite.trim() : "";
  if (!suite) {
    res.status(400).json({ error: "Envie «suite»." });
    return;
  }
  const deltaUsd = Number(b.deltaUsd);
  const reason = typeof b.reason === "string" && b.reason.trim() ? b.reason.trim() : "admin_adjust";
  const reference = typeof b.reference === "string" && b.reference.trim() ? b.reference.trim() : undefined;
  if (!Number.isFinite(deltaUsd)) {
    res.status(400).json({ error: "Envie «deltaUsd» numérico (positivo = crédito, negativo = débito)." });
    return;
  }
  const adj = applyWalletDelta(suite, Math.round(deltaUsd * 100) / 100);
  if (!adj.ok) {
    res.status(400).json({ error: adj.error });
    return;
  }
  appendWalletLedger({
    suite,
    deltaUsd: Math.round(deltaUsd * 100) / 100,
    balanceAfter: adj.balanceUsd,
    reason,
    reference,
  });
  res.json({ ok: true, balanceUsd: adj.balanceUsd });
});

registerVipRoutes(app);
registerSupportRoutes(app);
registerAmazonLeadsRoutes(app);
registerBundleRoutes(app);
registerGrowthProgramRoutes(app);
registerGrowthStrategyAiRoutes(app);
registerAiListingRoutes(app);
registerListingAnalysisRoutes(app);
registerListingComplianceRoutes(app);
registerListingMultiPlatformRoutes(app);
registerProductHunterRoutes(app);

/**
 * Demo: repõe servidor como «empresa nova» — um cliente com saldo, inventário vazio, filas limpas.
 * Não autenticado (uso local); não exponha em produção.
 */
app.post("/api/admin/demo/full-reset", requireAdmin, (req, res) => {
  const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
  const suite = typeof b.suite === "string" ? b.suite.trim() : undefined;
  const name = typeof b.name === "string" ? b.name.trim() : undefined;
  const balanceUsd = typeof b.balanceUsd === "number" && Number.isFinite(b.balanceUsd) ? b.balanceUsd : undefined;
  const demoPassword = typeof b.demoPassword === "string" ? b.demoPassword.trim() : undefined;
  const rawEmpty = b.emptyClients ?? b.empty_clients;
  const emptyClients =
    rawEmpty === true || rawEmpty === 1 || (typeof rawEmpty === "string" && rawEmpty.trim().toLowerCase() === "true");
  const rawSeedVip = b.seedVipDemo ?? b.seed_vip_demo;
  const seedVipDemo =
    rawSeedVip === true || rawSeedVip === 1 || (typeof rawSeedVip === "string" && rawSeedVip.trim().toLowerCase() === "true")
      ? true
      : rawSeedVip === false || rawSeedVip === 0 || (typeof rawSeedVip === "string" && rawSeedVip.trim().toLowerCase() === "false")
        ? false
        : undefined;
  const out = runDemoFullReset({ suite, name, balanceUsd, demoPassword, emptyClients, seedVipDemo });
  res.json({ ok: true, ...out });
});

app.get("/api/admin/clients", requireAdmin, (_req, res) => {
  res.json({
    clients: listClients().map((c) => ({
      suite: c.suite,
      name: c.name,
      email: c.email,
      phone: c.phone,
      addressLine1: c.addressLine1,
      addressLine2: c.addressLine2,
      city: c.city,
      region: c.region,
      postalCode: c.postalCode,
      country: c.country,
      balanceUsd: typeof c.balanceUsd === "number" && Number.isFinite(c.balanceUsd) ? c.balanceUsd : 0,
      active: c.active,
      tier: c.tier,
      verificationStatus: c.verificationStatus,
      hasProofOfAddress: Boolean(c.proofOfAddressDataUrl),
      hasIdDocument: Boolean(c.idDocumentDataUrl),
      supplierRegion: c.onboardingQuiz.supplierRegion,
      businessModel: c.onboardingQuiz.businessModel,
      productCategories: c.onboardingQuiz.productCategories,
      monthlyVolumeBand: c.onboardingQuiz.monthlyVolumeBand,
      premiumActive: c.premiumActive === true,
      amazonLeadsProActive: c.amazonLeadsProActive === true,
      repriceProActive: c.repriceProActive === true,
      aiListingStarterActive: c.aiListingStarterActive === true,
      aiListingProActive: c.aiListingProActive === true,
    })),
  });
});

app.delete("/api/admin/clients/:suite", requireAdmin, (req, res) => {
  const suite = req.params.suite;
  if (!removeClientBySuite(suite)) {
    res.status(404).json({ error: "Suite não encontrada." });
    return;
  }
  res.json({ ok: true });
});

app.patch("/api/admin/clients/:suite", requireAdmin, (req, res) => {
  const suite = req.params.suite;
  const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
  const patch: Parameters<typeof patchClientBySuite>[1] = {};
  if (typeof b.name === "string") patch.name = b.name;
  if (typeof b.email === "string") patch.email = b.email;
  if (typeof b.phone === "string") patch.phone = b.phone;
  if (typeof b.addressLine1 === "string") patch.addressLine1 = b.addressLine1;
  if (typeof b.addressLine2 === "string") patch.addressLine2 = b.addressLine2;
  if (typeof b.city === "string") patch.city = b.city;
  if (typeof b.region === "string") patch.region = b.region;
  if (typeof b.postalCode === "string") patch.postalCode = b.postalCode;
  if (typeof b.country === "string") patch.country = b.country;
  if (typeof b.tier === "string") patch.tier = b.tier;
  if (b.active === true || b.active === false) patch.active = b.active;
  const updated = patchClientBySuite(suite, patch);
  if (!updated) {
    res.status(400).json({ error: "Não foi possível atualizar (dados inválidos ou suite inexistente)." });
    return;
  }
  res.json({ ok: true, suite: updated.suite });
});

app.post("/api/admin/clients/:suite/password", requireAdmin, (req, res) => {
  const suite = req.params.suite;
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const r = setClientPasswordBySuite(suite, password);
  if (!r.ok) {
    res.status(400).json({ error: r.error });
    return;
  }
  res.json({ ok: true, suite: r.client.suite });
});

app.post("/api/admin/clients/:suite/premium", requireAdmin, (req, res) => {
  const suite = req.params.suite;
  const active = req.body?.active;
  if (active !== true && active !== false) {
    res.status(400).json({ error: "Envie «active»: true ou false." });
    return;
  }
  const updated = setClientPremiumActive(suite, active);
  if (!updated) {
    res.status(404).json({ error: "Suite não encontrada." });
    return;
  }
  const bal = typeof updated.balanceUsd === "number" && Number.isFinite(updated.balanceUsd) ? updated.balanceUsd : 0;
  appendWalletLedger({
    suite: updated.suite,
    deltaUsd: 0,
    balanceAfter: bal,
    reason: active ? "premium_subscription_activated" : "premium_subscription_cancelled",
    reference: `premium-${Date.now().toString(36)}`,
  });
  res.json({ ok: true, suite: updated.suite, premiumActive: updated.premiumActive });
});

app.post("/api/admin/clients/:suite/amazon-leads-pro", requireAdmin, (req, res) => {
  const suite = req.params.suite;
  const active = req.body?.active;
  if (active !== true && active !== false) {
    res.status(400).json({ error: "Envie «active»: true ou false." });
    return;
  }
  const updated = setClientAmazonLeadsProActive(suite, active);
  if (!updated) {
    res.status(404).json({ error: "Suite não encontrada." });
    return;
  }
  const bal = typeof updated.balanceUsd === "number" && Number.isFinite(updated.balanceUsd) ? updated.balanceUsd : 0;
  appendWalletLedger({
    suite: updated.suite,
    deltaUsd: 0,
    balanceAfter: bal,
    reason: active ? "amazon_leads_pro_activated" : "amazon_leads_pro_cancelled",
    reference: `leads-pro-${Date.now().toString(36)}`,
  });
  res.json({ ok: true, suite: updated.suite, amazonLeadsProActive: updated.amazonLeadsProActive });
});

app.post("/api/admin/clients/:suite/reprice-pro", requireAdmin, (req, res) => {
  const suite = req.params.suite;
  const active = req.body?.active;
  if (active !== true && active !== false) {
    res.status(400).json({ error: "Envie «active»: true ou false." });
    return;
  }
  const updated = setClientRepriceProActive(suite, active);
  if (!updated) {
    res.status(404).json({ error: "Suite não encontrada." });
    return;
  }
  const bal = typeof updated.balanceUsd === "number" && Number.isFinite(updated.balanceUsd) ? updated.balanceUsd : 0;
  appendWalletLedger({
    suite: updated.suite,
    deltaUsd: 0,
    balanceAfter: bal,
    reason: active ? "dbx_reprice_pro_activated" : "dbx_reprice_pro_cancelled",
    reference: `reprice-pro-${Date.now().toString(36)}`,
  });
  res.json({ ok: true, suite: updated.suite, repriceProActive: updated.repriceProActive });
});

app.post("/api/admin/clients/:suite/ai-listing-starter", requireAdmin, (req, res) => {
  const suite = req.params.suite;
  const active = req.body?.active;
  if (active !== true && active !== false) {
    res.status(400).json({ error: "Envie «active»: true ou false." });
    return;
  }
  const updated = setClientAiListingStarterActive(suite, active);
  if (!updated) {
    res.status(404).json({ error: "Suite não encontrada." });
    return;
  }
  res.json({ ok: true, suite: updated.suite, aiListingStarterActive: updated.aiListingStarterActive });
});

app.post("/api/admin/clients/:suite/ai-listing-pro", requireAdmin, (req, res) => {
  const suite = req.params.suite;
  const active = req.body?.active;
  if (active !== true && active !== false) {
    res.status(400).json({ error: "Envie «active»: true ou false." });
    return;
  }
  const updated = setClientAiListingProActive(suite, active);
  if (!updated) {
    res.status(404).json({ error: "Suite não encontrada." });
    return;
  }
  res.json({ ok: true, suite: updated.suite, aiListingProActive: updated.aiListingProActive });
});

/** Documentos KYC em data URL — só para consola admin (demo, sem autenticação). */
app.get("/api/admin/clients/:suite/kyc-docs", requireAdmin, (req, res) => {
  const suite = req.params.suite;
  const c = findBySuite(suite);
  if (!c) {
    res.status(404).json({ error: "Suite não encontrada." });
    return;
  }
  res.json({
    suite: c.suite,
    name: c.name,
    email: c.email,
    phone: c.phone,
    addressLine1: c.addressLine1,
    addressLine2: c.addressLine2,
    city: c.city,
    region: c.region,
    postalCode: c.postalCode,
    country: c.country,
    verificationStatus: c.verificationStatus,
    proofOfAddressDataUrl: c.proofOfAddressDataUrl || null,
    idDocumentDataUrl: c.idDocumentDataUrl || null,
  });
});

app.post("/api/admin/clients/:suite/approve", requireAdmin, (req, res) => {
  const suite = req.params.suite;
  const updated = approveClientSuite(suite);
  if (!updated) {
    res.status(404).json({ error: "Suite não encontrada." });
    return;
  }
  res.json({ ok: true, suite: updated.suite, verificationStatus: updated.verificationStatus });
});

app.get("/api/client/inventory", requireUser, (req, res) => {
  const full = loadSnapshot({ processStorageReminders: true });
  res.json(filterInventorySnapshotForSuite(full, userSuite(req)));
});

app.post("/api/client/inventory/additions", requireUser, (req, res) => {
  const row = req.body?.row;
  if (!row || typeof row !== "object") {
    res.status(400).json({ error: "Envie o objeto «row»." });
    return;
  }
  if (!isRow(row)) {
    res.status(400).json({ error: "Campos obrigatórios do «row» em falta ou inválidos." });
    return;
  }
  const authSuite = userSuite(req);
  const merged: InventoryJsonRow = {
    ...(row as InventoryJsonRow),
    clientSuite: authSuite,
  };
  const snap = appendRow(merged);
  res.json(filterInventorySnapshotForSuite(snap, authSuite));
});

app.patch("/api/client/inventory/additions/:id", requireUser, (req, res) => {
  const id = req.params.id;
  const authSuite = userSuite(req);
  const before = loadSnapshot();
  if (!additionBelongsToSuite(before, id, authSuite)) {
    res.status(403).json({ error: "Este SKU não pertence à sua suite." });
    return;
  }
  const patch = req.body?.patch;
  if (!patch || typeof patch !== "object") {
    res.status(400).json({ error: "Envie o objeto «patch»." });
    return;
  }
  const allowed: Partial<InventoryJsonRow> = {};
  const keys = [
    "asin",
    "title",
    "qty",
    "kind",
    "storageDays",
    "storageLimitDays",
    "storageFreeStartIso",
    "imageUrl",
    "unitPriceUsd",
    "fbmUnitLabelReady",
    "clientSuite",
    "clientName",
    "supplier",
    "brand",
    "condition",
    "poNumber",
    "arrivalDate",
    "notes",
    "color",
    "size",
    "model",
    "upc",
    "tracking",
    "prepCenterPlan",
    "prepCenterServiceId",
    "productCostUsd",
    "platformFeePct",
    "desiredMarginPct",
    "labelFeeUsd",
    "prepCenterFeeUsd",
    "pricingPreviewQty",
    "profitPerUnitUsd",
    "projectedProfitUsd",
    "suggestedSaleUsd",
  ] as const;
  for (const k of keys) {
    if (k in patch) (allowed as Record<string, unknown>)[k] = (patch as Record<string, unknown>)[k];
  }
  const snap = patchRow(id, allowed);
  if (!snap) {
    res.status(404).json({ error: "SKU não encontrado nos cadastros do servidor." });
    return;
  }
  res.json(filterInventorySnapshotForSuite(snap, authSuite));
});

app.post("/api/client/inventory/deductions", requireUser, (req, res) => {
  const authSuite = userSuite(req);
  const items = req.body?.items;
  if (!Array.isArray(items)) {
    res.status(400).json({ error: "Envie «items»: { id, qty }[]" });
    return;
  }
  const parsed: { id: string; qty: number }[] = [];
  for (const x of items) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    if (typeof o.id === "string" && typeof o.qty === "number") parsed.push({ id: o.id, qty: o.qty });
  }
  const cur = loadSnapshot();
  for (const it of parsed) {
    if (!additionBelongsToSuite(cur, it.id, authSuite)) {
      res.status(403).json({ error: `O SKU ${it.id} não pertence à sua suite.` });
      return;
    }
  }
  const snap = addDeductions(parsed);
  res.json(filterInventorySnapshotForSuite(snap, authSuite));
});

app.post("/api/client/inventory/deductions/remove", requireUser, (req, res) => {
  const authSuite = userSuite(req);
  const items = req.body?.items;
  if (!Array.isArray(items)) {
    res.status(400).json({ error: "Envie «items»: { id, qty }[]" });
    return;
  }
  const parsed: { id: string; qty: number }[] = [];
  for (const x of items) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    if (typeof o.id === "string" && typeof o.qty === "number") parsed.push({ id: o.id, qty: o.qty });
  }
  const cur = loadSnapshot();
  for (const it of parsed) {
    if (!additionBelongsToSuite(cur, it.id, authSuite)) {
      res.status(403).json({ error: `O SKU ${it.id} não pertence à sua suite.` });
      return;
    }
  }
  const snap = removeDeductions(parsed);
  res.json(filterInventorySnapshotForSuite(snap, authSuite));
});

/** Extrai texto de PDF de etiqueta e tenta detetar transportadora + tracking (demo). */
app.post("/api/shipping-label/parse", requireUser, async (req, res) => {
  try {
    const dataUrl = req.body?.dataUrl;
    const fileName = typeof req.body?.fileName === "string" ? req.body.fileName : undefined;
    if (typeof dataUrl !== "string") {
      res.status(400).json({ error: "Envie JSON com «dataUrl» (PDF em base64)." });
      return;
    }
    const result = await parseShippingLabelPdfDataUrl(dataUrl, fileName);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao processar PDF.";
    res.status(500).json({ error: msg });
  }
});

/** Estado do envio (17TRACK com SEVENTEEN_TRACK_TOKEN, ou instruções sem token). */
app.post("/api/shipping-tracking/lookup", requireUser, async (req, res) => {
  try {
    const tracking = typeof req.body?.tracking === "string" ? req.body.tracking.trim() : "";
    const carrierId = typeof req.body?.carrierId === "string" ? req.body.carrierId.trim() : undefined;
    if (!tracking) {
      res.status(400).json({ error: "Envie JSON com «tracking»." });
      return;
    }
    const result = await lookupShippingTrackingOnServer({ tracking, carrierId });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao consultar rastreio.";
    res.status(500).json({ error: msg });
  }
});

app.post("/api/client/inventory/bootstrap", requireUser, (req, res) => {
  const authSuite = userSuite(req);
  const rows = req.body?.additions;
  if (!Array.isArray(rows)) {
    res.status(400).json({ error: "Envie «additions» como array." });
    return;
  }
  const cur = loadSnapshot();
  if (cur.additions.length > 0) {
    res.json(filterInventorySnapshotForSuite(cur, authSuite));
    return;
  }
  const stamped = rows.map((r) => {
    if (!r || typeof r !== "object" || !isRow(r)) return r;
    return { ...(r as InventoryJsonRow), clientSuite: authSuite };
  });
  const snap = bootstrapAdditionsIfEmpty(stamped);
  if (!snap) {
    res.status(400).json({ error: "Nenhuma linha válida em «additions»." });
    return;
  }
  res.json(filterInventorySnapshotForSuite(snap, authSuite));
});

/** Prep: confirma recebimento físico, liberta stock ou marca problema; demo envia «email» para fila. */
app.post("/api/admin/inventory/additions/:id/confirm-receipt", requireAdmin, (req, res) => {
  try {
    const id = req.params.id;
    const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const mode = b.mode === "issue" ? "issue" : "release";
    const qtyReceived = Number(b.qtyReceived);
    const notifyClient = Boolean(b.notifyClient);
    const adminNotes = typeof b.adminNotes === "string" ? b.adminNotes : undefined;
    const damageNotes = typeof b.damageNotes === "string" ? b.damageNotes : undefined;
    const metaIn = b.metadata && typeof b.metadata === "object" ? (b.metadata as Record<string, unknown>) : {};
    const metadata: Partial<Record<"color" | "size" | "model" | "upc" | "tracking" | "brand" | "condition", string>> =
      {};
    for (const k of ["color", "size", "model", "upc", "tracking", "brand", "condition"] as const) {
      const v = metaIn[k];
      if (typeof v === "string") metadata[k] = v;
    }

    const before = loadSnapshot();
    const prev = before.additions.find((r) => r.id === id);
    const snap = confirmInventoryReceipt(id, {
      mode,
      qtyReceived,
      adminNotes,
      damageNotes,
      metadata: Object.keys(metadata).length ? metadata : undefined,
    });
    if (!snap) {
      res.status(404).json({ error: "Linha não encontrada ou não está em «cadastro pendente»." });
      return;
    }

    if (mode === "issue" && notifyClient && prev?.clientSuite) {
      const client = findBySuite(prev.clientSuite);
      const to = client?.email?.trim();
      if (to) {
        const title = prev.title ?? id;
        queueDemoEmail({
          to,
          subject: `[DBX Prep] Problema no recebimento — ${title.slice(0, 80)}`,
          text: [
            `Olá,`,
            ``,
            `Na conferência do recebimento detetámos um problema com o produto abaixo.`,
            ``,
            `Suite: ${prev.clientSuite}`,
            `SKU / ID: ${id}`,
            `ASIN: ${prev.asin}`,
            `Produto: ${title}`,
            `Quantidade declarada pelo cliente: ${prev.qty}`,
            `Quantidade recebida (prep): ${Number.isFinite(qtyReceived) ? Math.floor(qtyReceived) : "—"}`,
            damageNotes?.trim() ? `\nDescrição: ${damageNotes.trim()}` : "",
            adminNotes?.trim() ? `\nNotas internas (também no registo): ${adminNotes.trim()}` : "",
            ``,
            `Entraremos em contacto se precisarmos de mais informação. (Mensagem demo — fila no servidor.)`,
          ].join("\n"),
          meta: { inventoryId: id, suite: prev.clientSuite },
        });
      }
    }

    res.json(snap);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao confirmar recebimento.";
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

/** Registo no servidor: admin aceitou o pedido e iniciou produção (estado no browser: em_producao). */
app.post("/api/admin/orders/accept-production", requireAdmin, (req, res) => {
  const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
  const orderId = typeof b.orderId === "string" ? b.orderId.trim() : "";
  if (!orderId) {
    res.status(400).json({ error: "Envie «orderId»." });
    return;
  }
  appendOrderOpsEvent({
    type: "accept_production",
    orderId,
    suite: typeof b.suite === "string" ? b.suite.trim() || undefined : undefined,
    clientName: typeof b.clientName === "string" ? b.clientName.trim() || undefined : undefined,
    atIso: typeof b.acceptedAtIso === "string" ? b.acceptedAtIso : undefined,
  });
  res.json({ ok: true });
});

/** E-mail demo + registo: pedido marcado como despachado (produção concluída / envio feito). */
app.post("/api/admin/orders/notify-shipped", requireAdmin, (req, res) => {
  const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
  const orderId = typeof b.orderId === "string" ? b.orderId.trim() : "";
  const suite = typeof b.suite === "string" ? b.suite.trim() : "";
  if (!orderId) {
    res.status(400).json({ error: "Envie «orderId»." });
    return;
  }
  const unitsRaw = b.units;
  const units =
    typeof unitsRaw === "number" && Number.isFinite(unitsRaw) ? Math.max(0, Math.floor(unitsRaw)) : undefined;
  const clientName = typeof b.clientName === "string" ? b.clientName.trim() : "";
  const service = typeof b.service === "string" ? b.service.trim() : "";
  const productSummary = typeof b.productSummary === "string" ? b.productSummary.trim() : "";
  const trackingUrl =
    typeof b.trackingUrl === "string" && b.trackingUrl.trim() ? b.trackingUrl.trim() : undefined;
  const shippedAtIso =
    typeof b.shippedAtIso === "string" && b.shippedAtIso.trim() ? b.shippedAtIso.trim() : new Date().toISOString();

  const client = suite ? findBySuite(suite) : undefined;
  const to = client?.email?.trim() || (suite ? `${suite}@legacy.demo` : "noreply@demo.dbx");

  const text = [
    `Olá${clientName ? `, ${clientName}` : ""},`,
    ``,
    `O seu pedido ${orderId} foi despachado pelo prep center.`,
    service ? `Serviço: ${service}.` : "",
    units != null ? `Unidades: ${units}.` : "",
    productSummary ? `\nResumo: ${productSummary.slice(0, 400)}` : "",
    trackingUrl ? `\nAcompanhar envio: ${trackingUrl}` : "",
    ``,
    `Data/hora (ISO): ${shippedAtIso}`,
    ``,
    `(Demo) E-mail enfileirado no servidor; não é enviado por SMTP real.`,
  ]
    .filter(Boolean)
    .join("\n");

  queueDemoEmail({
    to,
    subject: `[DBX Prep] Envio despachado — pedido ${orderId}`,
    text,
    meta: { orderId, suite: suite || undefined, type: "notify_shipped" },
  });
  appendOrderOpsEvent({
    type: "notify_shipped",
    orderId,
    suite: suite || undefined,
    clientName: clientName || undefined,
    units,
    service: service || undefined,
    productSummary: productSummary || undefined,
    trackingUrl,
    atIso: shippedAtIso,
  });
  res.json({ ok: true, to });
});

app.post("/api/scrape", requireUser, async (req, res) => {
  try {
    const url = req.body?.url;
    if (typeof url !== "string" || !url.trim()) {
      res.status(400).json({ error: "Envie o campo «url» com o link do produto." });
      return;
    }
    const data = await scrapeSupplierPage(url);
    res.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao processar o link.";
    const status = msg === "Body too large" ? 413 : 502;
    res.status(status).json({ error: msg });
  }
});

/** Evita HTML «Cannot POST …» em rotas /api desconhecidas (o cliente espera JSON). */
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    const url = `${req.method} ${req.originalUrl}`;
    const staleApiHint = apiNotFoundStaleHint(req.originalUrl);
    res.status(404).json({
      error: `Endpoint não encontrado: ${url}. Reinicie «npm run scrape-server» se acabou de atualizar o código.${staleApiHint}`,
    });
    return;
  }
  next();
});

app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (!req.path.startsWith("/api")) {
    if (!res.headersSent) res.status(500).send("Internal server error");
    return;
  }
  const any = err as { status?: number; statusCode?: number; type?: string };
  if (any?.type === "entity.too.large") {
    if (!res.headersSent) {
      res.status(413).json({
        error:
          "Pedido demasiado grande. Use imagens/PDF mais pequenos (tente ~300 KB por ficheiro na demo).",
      });
    }
    return;
  }
  const status =
    typeof any.status === "number"
      ? any.status
      : typeof any.statusCode === "number"
        ? any.statusCode
        : 500;
  const safe = status >= 400 && status < 600 ? status : 500;
  const msg = err instanceof Error ? err.message : "Erro no servidor.";
  if (!res.headersSent) res.status(safe).json({ error: msg });
});

  return app;
}
