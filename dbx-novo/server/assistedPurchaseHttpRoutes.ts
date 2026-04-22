import type { Express } from "express";
import { requireAdmin, requireUser, userSuite } from "./authMiddleware";
import { ASSISTED_PURCHASE_ADMIN_API_BASE, ASSISTED_PURCHASE_CLIENT_API_BASE } from "../shared/assistedPurchaseRoutes";
import { applyWalletDelta, findBySuite } from "./clientRegistryStore";
import { assertSafePublicUrl, scrapeSupplierPage } from "./scrapeSupplier";
import { appendWalletLedger } from "./walletLedger";
import {
  appendAssistedPurchaseDraft,
  ASSISTED_PURCHASE_SERVICE_FEE_RATE,
  computeAssistedPurchaseTotals,
  getAssistedPurchaseById,
  isAssistedPurchaseClientAlertType,
  isScrapedUnitAboveRegistered,
  listAssistedPurchasesAdmin,
  listAssistedPurchasesBySuite,
  saveAssistedPurchase,
  type AssistedPurchase,
} from "./assistedPurchaseStore";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseLocalYmd(ymd: string): Date {
  const parts = ymd.trim().split("-").map((p) => Number.parseInt(p, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return new Date(NaN);
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return new Date(NaN);
  return dt;
}

function isRequiredDeliveryByDateOnOrAfterToday(ymd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd.trim())) return false;
  const target = parseLocalYmd(ymd);
  if (Number.isNaN(target.getTime())) return false;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return target.getTime() >= today.getTime();
}

function pushAudit(ap: AssistedPurchase, actor: "client" | "admin", action: string, detail?: string): void {
  const log = ap.auditLog ?? [];
  log.push({ atIso: new Date().toISOString(), actor, action, detail });
  ap.auditLog = log;
}

function debitApproved(ap: AssistedPurchase, amountUsd: number): { ok: true; balanceUsd: number } | { ok: false; error: string } {
  const adj = applyWalletDelta(ap.suite, -amountUsd);
  if (!adj.ok) return adj;
  appendWalletLedger({
    suite: ap.suite,
    deltaUsd: -amountUsd,
    balanceAfter: adj.balanceUsd,
    reason: "assisted_purchase",
    reference: ap.id,
  });
  ap.debitedUsd = round2(amountUsd);
  ap.debitedAtIso = new Date().toISOString();
  return adj;
}

function refundIfDebited(ap: AssistedPurchase): void {
  const d = ap.debitedUsd;
  if (typeof d === "number" && d > 0) {
    const adj = applyWalletDelta(ap.suite, d);
    if (!adj.ok) return;
    appendWalletLedger({
      suite: ap.suite,
      deltaUsd: d,
      balanceAfter: adj.balanceUsd,
      reason: "assisted_purchase_refund",
      reference: ap.id,
    });
  }
  ap.debitedUsd = undefined;
  ap.debitedAtIso = undefined;
}

function totalsClose(a: number, b: number, eps = 0.015): boolean {
  return Math.abs(a - b) <= eps;
}

export function registerAssistedPurchaseRoutes(app: Express): void {
  const C = ASSISTED_PURCHASE_CLIENT_API_BASE;
  const A = ASSISTED_PURCHASE_ADMIN_API_BASE;

  /** Cliente: criar pedido (link + quantidade + notas). */
  app.post(C, requireUser, async (req, res) => {
    const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const authSuite = userSuite(req);
    const bodySuite = typeof b.suite === "string" ? b.suite.trim() : "";
    if (bodySuite && bodySuite !== authSuite) {
      res.status(403).json({ error: "Não pode criar pedidos noutra suite." });
      return;
    }
    const suite = authSuite;
    const productUrl = typeof b.productUrl === "string" ? b.productUrl.trim() : "";
    const notes = typeof b.notes === "string" ? b.notes.trim() : "";
    const productTitle = typeof b.productTitle === "string" ? b.productTitle.trim() : "";
    const qty = Number(b.quantity);
    const manualUnit = Number(b.unitPriceUsd);
    const MIN_TITLE = 4;
    const MIN_NOTES = 10;
    const pendingTitle = /título pendente|title pending|título pendiente|pendiente/i;

    if (!suite || !productUrl) {
      res.status(400).json({ error: "Envie «suite» e «productUrl»." });
      return;
    }
    if (productTitle.length < MIN_TITLE) {
      res.status(400).json({ error: `Envie «productTitle» com pelo menos ${MIN_TITLE} caracteres (nome exato do produto).` });
      return;
    }
    if (pendingTitle.test(productTitle)) {
      res.status(400).json({ error: "Indique o nome real do produto no título (não use texto de «título pendente»)." });
      return;
    }
    if (notes.length < MIN_NOTES) {
      res.status(400).json({ error: `«notes» muito curtas — preencha cor, tamanho (opcional) e observações.` });
      return;
    }
    if (!Number.isFinite(qty) || qty < 1 || !Number.isInteger(qty)) {
      res.status(400).json({ error: "«quantity» deve ser inteiro ≥ 1." });
      return;
    }
    if (!Number.isFinite(manualUnit) || manualUnit <= 0) {
      res.status(400).json({
        error:
          "«unitPriceUsd» é obrigatório: indique o preço unitário em USD que vê no fornecedor (a operação compara com o valor lido do link).",
      });
      return;
    }
    const requiredDeliveryByDate =
      typeof b.requiredDeliveryByDate === "string" ? b.requiredDeliveryByDate.trim() : "";
    if (!isRequiredDeliveryByDateOnOrAfterToday(requiredDeliveryByDate)) {
      res.status(400).json({
        error:
          "Envie «requiredDeliveryByDate» em formato AAAA-MM-DD (data em que precisa do artigo no prep), hoje ou no futuro.",
      });
      return;
    }
    const c = findBySuite(suite);
    if (!c) {
      res.status(404).json({ error: "Conta não encontrada." });
      return;
    }
    try {
      assertSafePublicUrl(productUrl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "URL inválida.";
      res.status(400).json({ error: msg });
      return;
    }

    let scraped: Awaited<ReturnType<typeof scrapeSupplierPage>> | null = null;
    try {
      scraped = await scrapeSupplierPage(productUrl);
    } catch {
      scraped = null;
    }

    const unit = round2(manualUnit);
    const scrapePrice =
      scraped && Number.isFinite(scraped.priceUsd ?? NaN) && (scraped.priceUsd as number) > 0 ? (scraped.priceUsd as number) : undefined;

    const imageUrl = scraped?.imageUrl?.trim() ? scraped.imageUrl.trim() : undefined;
    const nowIso = new Date().toISOString();
    const ap = appendAssistedPurchaseDraft({
      suite,
      clientName: c.name,
      productUrl,
      productTitle,
      quantity: qty,
      notes,
      unitPriceUsd: unit,
      requiredDeliveryByDate,
      productImageUrl: imageUrl,
      linkScrapeUnitPriceUsd: scrapePrice != null ? round2(scrapePrice) : undefined,
      linkScrapeAtIso: scrapePrice != null ? nowIso : undefined,
    });
    const warn = isScrapedUnitAboveRegistered(ap);
    res.json({ ok: true, purchase: ap, scrapedPriceAboveRegistered: warn });
  });

  app.get(C, requireUser, (req, res) => {
    const suite = userSuite(req);
    if (!findBySuite(suite)) {
      res.status(404).json({ error: "Conta não encontrada." });
      return;
    }
    res.json({ purchases: listAssistedPurchasesBySuite(suite) });
  });

  /** Cliente aprova total final após ajuste de preço pela operação. */
  app.post(`${C}/:id/approve`, requireUser, (req, res) => {
    const suite = userSuite(req);
    const ap = getAssistedPurchaseById(req.params.id);
    if (!ap || ap.suite !== suite) {
      res.status(404).json({ error: "Pedido não encontrado." });
      return;
    }
    if (ap.status !== "waiting_customer_approval") {
      res.status(400).json({ error: "Este pedido não aguarda a sua aprovação de preço." });
      return;
    }
    const total = ap.finalTotalUsd;
    if (typeof total !== "number" || !Number.isFinite(total) || total <= 0) {
      res.status(400).json({ error: "Total final inválido. Contacte a operação." });
      return;
    }
    const deb = debitApproved(ap, total);
    if (!deb.ok) {
      res.status(400).json({ error: deb.error });
      return;
    }
    ap.status = "approved";
    ap.customerApprovedAtIso = new Date().toISOString();
    pushAudit(ap, "client", "approve_final_price", `total=${total}`);
    saveAssistedPurchase(ap);
    res.json({ ok: true, purchase: ap, balanceUsd: deb.balanceUsd });
  });

  app.post(`${C}/:id/cancel`, requireUser, (req, res) => {
    const suite = userSuite(req);
    const ap = getAssistedPurchaseById(req.params.id);
    if (!ap || ap.suite !== suite) {
      res.status(404).json({ error: "Pedido não encontrado." });
      return;
    }
    if (ap.status !== "pending_review" && ap.status !== "waiting_customer_approval") {
      res.status(400).json({ error: "Só é possível cancelar pedidos ainda não debitados." });
      return;
    }
    ap.status = "cancelled";
    pushAudit(ap, "client", "cancel");
    saveAssistedPurchase(ap);
    res.json({ ok: true, purchase: ap });
  });

  app.get(`${C}/:id`, requireUser, (req, res) => {
    const suite = userSuite(req);
    const ap = getAssistedPurchaseById(req.params.id);
    if (!ap || ap.suite !== suite) {
      res.status(404).json({ error: "Pedido não encontrado." });
      return;
    }
    res.json({ purchase: ap });
  });

  app.get(A, requireAdmin, (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status.trim() : undefined;
    res.json({ purchases: listAssistedPurchasesAdmin(status) });
  });

  /** Re-ler link do fornecedor (imagem + preço detectado na página). */
  app.post(`${A}/:id/refresh-link`, requireAdmin, async (req, res) => {
    const ap = getAssistedPurchaseById(req.params.id);
    if (!ap) {
      res.status(404).json({ error: "Pedido não encontrado." });
      return;
    }
    try {
      assertSafePublicUrl(ap.productUrl);
      const scraped = await scrapeSupplierPage(ap.productUrl);
      if (scraped.imageUrl?.trim()) ap.productImageUrl = scraped.imageUrl.trim();
      if (Number.isFinite(scraped.priceUsd ?? NaN) && (scraped.priceUsd as number) > 0) {
        ap.linkScrapeUnitPriceUsd = round2(scraped.priceUsd as number);
        ap.linkScrapeAtIso = new Date().toISOString();
      }
      pushAudit(ap, "admin", "refresh_link_scrape");
      saveAssistedPurchase(ap);
      res.json({ ok: true, purchase: ap, scrapedPriceAboveRegistered: isScrapedUnitAboveRegistered(ap) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao atualizar o link.";
      res.status(400).json({ error: msg });
    }
  });

  /** Checklist operacional (equipa). */
  app.patch(`${A}/:id/checklist`, requireAdmin, (req, res) => {
    const ap = getAssistedPurchaseById(req.params.id);
    if (!ap) {
      res.status(404).json({ error: "Pedido não encontrado." });
      return;
    }
    const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const cur = ap.adminChecklist ?? {
      valueMatchesSupplierScreen: false,
      characteristicsMatchLink: false,
      shippingMatchesSupplier: false,
    };
    ap.adminChecklist = {
      valueMatchesSupplierScreen:
        typeof b.valueMatchesSupplierScreen === "boolean" ? b.valueMatchesSupplierScreen : cur.valueMatchesSupplierScreen,
      characteristicsMatchLink:
        typeof b.characteristicsMatchLink === "boolean" ? b.characteristicsMatchLink : cur.characteristicsMatchLink,
      shippingMatchesSupplier:
        typeof b.shippingMatchesSupplier === "boolean" ? b.shippingMatchesSupplier : cur.shippingMatchesSupplier,
    };
    pushAudit(ap, "admin", "checklist_update");
    saveAssistedPurchase(ap);
    res.json({ ok: true, purchase: ap });
  });

  /** Regista aviso ao cliente (portal). */
  app.post(`${A}/:id/notify-client`, requireAdmin, (req, res) => {
    const ap = getAssistedPurchaseById(req.params.id);
    if (!ap) {
      res.status(404).json({ error: "Pedido não encontrado." });
      return;
    }
    if (ap.status === "cancelled" || ap.status === "received") {
      res.status(400).json({ error: "Este pedido não aceita novos avisos ao cliente." });
      return;
    }
    const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const rawType = typeof b.type === "string" ? b.type.trim() : "";
    if (!isAssistedPurchaseClientAlertType(rawType)) {
      res.status(400).json({ error: "«type» de aviso inválido." });
      return;
    }
    const entry = { type: rawType, atIso: new Date().toISOString() };
    ap.clientNotifications = [entry, ...(ap.clientNotifications ?? [])].slice(0, 40);
    pushAudit(ap, "admin", "notify_client", rawType);
    saveAssistedPurchase(ap);
    res.json({ ok: true, purchase: ap });
  });

  /** Notas internas / título exibido (sem alterar preço). */
  app.patch(`${A}/:id/review`, requireAdmin, (req, res) => {
    const ap = getAssistedPurchaseById(req.params.id);
    if (!ap) {
      res.status(404).json({ error: "Pedido não encontrado." });
      return;
    }
    const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    if (typeof b.adminNotes === "string") ap.adminNotes = b.adminNotes.trim() || undefined;
    if (typeof b.productTitle === "string" && b.productTitle.trim()) ap.productTitle = b.productTitle.trim();
    pushAudit(ap, "admin", "review_notes");
    saveAssistedPurchase(ap);
    res.json({ ok: true, purchase: ap });
  });

  /**
   * Define preço unitário final. Se o total divergir do estimado, o cliente deve aprovar antes do débito.
   * Se for igual (± tolerância), debita já e passa a «approved».
   */
  app.patch(`${A}/:id/update-price`, (req, res) => {
    const ap = getAssistedPurchaseById(req.params.id);
    if (!ap) {
      res.status(404).json({ error: "Pedido não encontrado." });
      return;
    }
    if (ap.status !== "pending_review" && ap.status !== "waiting_customer_approval") {
      res.status(400).json({ error: "Preço só pode ser definido enquanto o pedido está em análise ou aguarda cliente." });
      return;
    }
    const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const acceptEstimate = b.acceptEstimate === true;
    const finalUnit = acceptEstimate ? ap.estimatedUnitPriceUsd : Number(b.finalUnitPriceUsd);
    if (!Number.isFinite(finalUnit) || finalUnit <= 0) {
      res.status(400).json({ error: "Envie «finalUnitPriceUsd» > 0 ou «acceptEstimate»: true." });
      return;
    }
    const t = computeAssistedPurchaseTotals(finalUnit, ap.quantity, ASSISTED_PURCHASE_SERVICE_FEE_RATE);
    ap.finalUnitPriceUsd = round2(finalUnit);
    ap.finalProductSubtotalUsd = t.estimatedProductSubtotalUsd;
    ap.finalServiceFeeUsd = t.estimatedServiceFeeUsd;
    ap.finalFloridaTaxUsd = t.floridaTaxUsd;
    ap.finalTotalUsd = t.estimatedTotalUsd;

    if (totalsClose(ap.finalTotalUsd, ap.estimatedTotalUsd)) {
      const deb = debitApproved(ap, ap.finalTotalUsd);
      if (!deb.ok) {
        res.status(400).json({ error: deb.error });
        return;
      }
      ap.status = "approved";
      pushAudit(ap, "admin", "update_price_auto_approved", `total=${ap.finalTotalUsd}`);
      saveAssistedPurchase(ap);
      res.json({ ok: true, purchase: ap, balanceUsd: deb.balanceUsd, debited: true });
      return;
    }
    ap.status = "waiting_customer_approval";
    pushAudit(ap, "admin", "update_price_needs_client", `final=${ap.finalTotalUsd} est=${ap.estimatedTotalUsd}`);
    saveAssistedPurchase(ap);
    res.json({ ok: true, purchase: ap, debited: false, needsClientApproval: true });
  });

  /**
   * Operação de compra / logística: purchasing → purchased → in_transit → received,
   * ou cancel_refund (estorna saldo se já debitado).
   */
  app.post(`${A}/:id/purchase`, requireAdmin, (req, res) => {
    const ap = getAssistedPurchaseById(req.params.id);
    if (!ap) {
      res.status(404).json({ error: "Pedido não encontrado." });
      return;
    }
    const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const action = typeof b.action === "string" ? b.action.trim() : "";

    if (action === "cancel_refund") {
      if (ap.status === "cancelled" || ap.status === "received") {
        res.status(400).json({ error: "Estado não permite cancelamento." });
        return;
      }
      refundIfDebited(ap);
      ap.status = "cancelled";
      pushAudit(ap, "admin", "cancel_refund");
      saveAssistedPurchase(ap);
      res.json({ ok: true, purchase: ap });
      return;
    }

    if (typeof b.storeName === "string" && b.storeName.trim()) ap.storeName = b.storeName.trim();
    if (typeof b.storeOrderId === "string" && b.storeOrderId.trim()) ap.storeOrderId = b.storeOrderId.trim();
    if (typeof b.trackingNumber === "string" && b.trackingNumber.trim()) ap.trackingNumber = b.trackingNumber.trim();

    const next: Record<string, AssistedPurchase["status"]> = {
      purchasing: "purchasing",
      purchased: "purchased",
      in_transit: "in_transit",
      received: "received",
    };
    const target = next[action];
    if (!target) {
      res.status(400).json({ error: "«action» inválida (purchasing | purchased | in_transit | received | cancel_refund)." });
      return;
    }

    const order: AssistedPurchase["status"][] = ["approved", "purchasing", "purchased", "in_transit", "received"];
    const curIdx = order.indexOf(ap.status);
    const tgtIdx = order.indexOf(target);
    if (curIdx < 0 || tgtIdx < 0 || tgtIdx !== curIdx + 1) {
      res.status(400).json({ error: `Transição inválida: ${ap.status} → ${target}.` });
      return;
    }
    ap.status = target;
    pushAudit(ap, "admin", `ops_${action}`);
    saveAssistedPurchase(ap);
    res.json({ ok: true, purchase: ap });
  });
}
