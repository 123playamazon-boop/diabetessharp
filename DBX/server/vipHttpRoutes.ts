import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Express, RequestHandler } from "express";
import { requireAdmin, requireUser, userSuite } from "./authMiddleware";
import { applyWalletDelta, findBySuite } from "./clientRegistryStore";
import { scrapeSupplierPage } from "./scrapeSupplier";
import { appendWalletLedger } from "./walletLedger";
import {
  deleteVipAnnouncement,
  getVipAnnouncement,
  listVipAnnouncementsAdmin,
  listVipAnnouncementsForClient,
  parseVipAnnouncementFromRequestBody,
  upsertVipAnnouncement,
} from "./vipAnnouncementsStore";
import { resetVipDemoContent } from "./vipDemoSeed";
import {
  appendVipStoreOrder,
  applyVipStoreStockDecrement,
  applyVipStoreStockRestore,
  getVipStoreProductById,
  listVipStoreProductsAdmin,
  listVipStoreProductsPublic,
  readVipStore,
  setVipStoreFeePct,
  updateVipStoreOrder,
  upsertVipStoreProduct,
  type VipStoreOrder,
  type VipStoreOrderStatus,
  type VipStoreProduct,
} from "./vipStoreStore";

/** Margem mínima sobre o custo fornecedor: preço cliente ≥ custo × (1 + este valor). */
const VIP_STORE_COST_MARKUP_MIN = 0.15;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function minClientPriceForCost(referenceCostUsd: number): number {
  return round2(referenceCostUsd * (1 + VIP_STORE_COST_MARKUP_MIN));
}

function validateStoreMargin(unitPriceUsd: number, referenceCostUsd: number | undefined): string | null {
  if (referenceCostUsd === undefined || !Number.isFinite(referenceCostUsd) || referenceCostUsd <= 0) return null;
  const min = minClientPriceForCost(referenceCostUsd);
  if (unitPriceUsd + 1e-9 < min) {
    return `O preço ao cliente deve ser ≥ ${min} USD (custo fornecedor × 1,15 — margem mínima 15% para a plataforma).`;
  }
  return null;
}

export function registerVipRoutes(app: Express): void {
  app.get("/api/client/vip-announcements", requireUser, (req, res) => {
    const suite = userSuite(req);
    const c = findBySuite(suite);
    if (!c) {
      res.status(404).json({ error: "Conta não encontrada." });
      return;
    }
    const list = listVipAnnouncementsForClient(suite, c.premiumActive === true);
    res.json({ announcements: list });
  });

  app.get("/api/admin/vip-announcements", requireAdmin, (_req, res) => {
    res.json({ announcements: listVipAnnouncementsAdmin() });
  });

  app.post("/api/admin/vip-announcements", requireAdmin, (req, res) => {
    const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const id = `vip-${Date.now().toString(36)}`;
    const row = parseVipAnnouncementFromRequestBody(b, id);
    if (!row) {
      res.status(400).json({ error: "Envie «title» e texto ou anexo (imagem / vídeo / PDF)." });
      return;
    }
    upsertVipAnnouncement(row);
    res.json({ ok: true, announcement: row });
  });

  app.patch("/api/admin/vip-announcements/:id", requireAdmin, (req, res) => {
    const id = req.params.id;
    const prev = getVipAnnouncement(id);
    if (!prev) {
      res.status(404).json({ error: "Não encontrado." });
      return;
    }
    const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const merged: Record<string, unknown> = {
      ...prev,
      ...b,
      id,
      title: typeof b.title === "string" ? b.title.trim() : prev.title,
      body: typeof b.body === "string" ? b.body.trim() : prev.body,
    };
    if ("attachment" in b) {
      if (b.attachment === null) delete merged.attachment;
      else merged.attachment = b.attachment;
    }
    const row = parseVipAnnouncementFromRequestBody(merged, id);
    if (!row) {
      res.status(400).json({ error: "Dados inválidos (título e texto ou anexo obrigatórios)." });
      return;
    }
    upsertVipAnnouncement(row);
    res.json({ ok: true, announcement: row });
  });

  app.delete("/api/admin/vip-announcements/:id", requireAdmin, (req, res) => {
    if (!deleteVipAnnouncement(req.params.id)) {
      res.status(404).json({ error: "Não encontrado." });
      return;
    }
    res.json({ ok: true });
  });

  const sendPublicVipCatalog: RequestHandler = (_req, res) => {
    const snap = readVipStore();
    res.json({ feePct: snap.platformFeePct, products: listVipStoreProductsPublic() });
  };
  app.get("/api/client/vip-store/catalog", sendPublicVipCatalog);
  /** Alias usado por scripts / integrações mais antigas. */
  app.get("/api/client/vip/catalog", sendPublicVipCatalog);

  app.get("/api/client/vip-store/orders", requireUser, (req, res) => {
    const suite = userSuite(req);
    const orders = readVipStore()
      .orders.filter((o) => o.suite === suite)
      .sort((a, b) => Date.parse(b.createdAtIso) - Date.parse(a.createdAtIso));
    res.json({ orders });
  });

  app.post("/api/client/vip-store/checkout", requireUser, (req, res) => {
    const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const authSuite = userSuite(req);
    const bodySuite = typeof b.suite === "string" ? b.suite.trim() : "";
    if (bodySuite && bodySuite !== authSuite) {
      res.status(403).json({ error: "Não pode comprar noutra suite." });
      return;
    }
    const suite = authSuite;
    const linesRaw = b.lines;
    if (!suite) {
      res.status(400).json({ error: "Envie «suite»." });
      return;
    }
    const c = findBySuite(suite);
    if (!c) {
      res.status(404).json({ error: "Conta não encontrada." });
      return;
    }
    if (!Array.isArray(linesRaw) || linesRaw.length === 0) {
      res.status(400).json({ error: "Envie «lines»: [{ productId, qty }, …]." });
      return;
    }
    const lines: { productId: string; qty: number }[] = [];
    for (const x of linesRaw) {
      if (!x || typeof x !== "object") continue;
      const o = x as Record<string, unknown>;
      const productId = typeof o.productId === "string" ? o.productId.trim() : "";
      const qty = Number(o.qty);
      if (!productId || !Number.isFinite(qty) || qty < 1 || !Number.isInteger(qty)) {
        res.status(400).json({ error: "Cada linha precisa de «productId» e «qty» inteiro ≥ 1." });
        return;
      }
      lines.push({ productId, qty });
    }
    if (lines.length === 0) {
      res.status(400).json({ error: "Nenhuma linha válida." });
      return;
    }

    const snap = readVipStore();
    const feePct = snap.platformFeePct;
    const orderLines: VipStoreOrder["items"] = [];
    let subtotal = 0;
    for (const ln of lines) {
      const p = getVipStoreProductById(ln.productId);
      if (!p || !p.active) {
        res.status(400).json({ error: `Produto inválido ou inactivo: ${ln.productId}` });
        return;
      }
      if (p.stockQty < ln.qty) {
        res.status(400).json({ error: `Stock insuficiente: ${p.title}` });
        return;
      }
      const lineTotal = Math.round(ln.qty * p.unitPriceUsd * 100) / 100;
      subtotal = Math.round((subtotal + lineTotal) * 100) / 100;
      orderLines.push({
        productId: p.id,
        title: p.title,
        qty: ln.qty,
        unitPriceUsd: p.unitPriceUsd,
        lineTotalUsd: lineTotal,
      });
    }
    const platformFeeUsd = Math.round(subtotal * feePct * 100) / 100;
    const totalUsd = Math.round((subtotal + platformFeeUsd) * 100) / 100;

    const adj = applyWalletDelta(suite, -totalUsd);
    if (!adj.ok) {
      res.status(400).json({ error: adj.error });
      return;
    }
    applyVipStoreStockDecrement(lines);
    const orderId = `LOJA-${Date.now().toString(36).toUpperCase()}`;
    const now = new Date().toISOString();
    const order: VipStoreOrder = {
      id: orderId,
      suite,
      clientName: c.name,
      items: orderLines,
      subtotalUsd: subtotal,
      platformFeeUsd,
      totalUsd,
      status: "pago_aguardando_compra",
      createdAtIso: now,
      updatedAtIso: now,
    };
    appendVipStoreOrder(order);
    appendWalletLedger({
      suite,
      deltaUsd: -totalUsd,
      balanceAfter: adj.balanceUsd,
      reason: "vip_store_purchase",
      reference: orderId,
    });
    res.json({ ok: true, order, balanceUsd: adj.balanceUsd });
  });

  app.get("/api/admin/vip-store", requireAdmin, (_req, res) => {
    const s = readVipStore();
    res.json({
      platformFeePct: s.platformFeePct,
      products: listVipStoreProductsAdmin(),
      orders: s.orders.sort((a, b) => Date.parse(b.createdAtIso) - Date.parse(a.createdAtIso)),
    });
  });

  app.post("/api/admin/vip-store/preview-import", requireAdmin, async (req, res) => {
    const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const url = typeof b.url === "string" ? b.url.trim() : "";
    if (!url) {
      res.status(400).json({ error: "Envie «url» do produto no fornecedor." });
      return;
    }
    try {
      const scraped = await scrapeSupplierPage(url);
      const supplier = scraped.priceUsd != null ? round2(scraped.priceUsd) : null;
      const unitSuggested = supplier != null ? round2(supplier * (1 + VIP_STORE_COST_MARKUP_MIN)) : null;
      res.json({
        ok: true,
        scraped: {
          title: scraped.title,
          description: scraped.description,
          imageUrl: scraped.imageUrl,
          brand: scraped.brand,
          supplier: scraped.supplier,
          sourceUrl: scraped.sourceUrl,
          priceUsd: scraped.priceUsd,
        },
        referenceCostUsd: supplier,
        unitPriceUsdSuggested: unitSuggested,
        minMarkupPct: VIP_STORE_COST_MARKUP_MIN,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao importar o link.";
      res.status(400).json({ error: msg });
    }
  });

  app.patch("/api/admin/vip-store/settings", requireAdmin, (req, res) => {
    const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const pct = Number(b.platformFeePct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 0.5) {
      res.status(400).json({ error: "«platformFeePct» entre 0 e 0,5." });
      return;
    }
    setVipStoreFeePct(pct);
    res.json({ ok: true, platformFeePct: readVipStore().platformFeePct });
  });

  app.post("/api/admin/vip-store/products", requireAdmin, (req, res) => {
    const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const title = typeof b.title === "string" ? b.title.trim() : "";
    if (!title) {
      res.status(400).json({ error: "Envie «title»." });
      return;
    }
    const unitPriceUsd = Number(b.unitPriceUsd);
    const stockQty = Number(b.stockQty);
    if (!Number.isFinite(unitPriceUsd) || unitPriceUsd <= 0) {
      res.status(400).json({ error: "«unitPriceUsd» inválido." });
      return;
    }
    if (!Number.isFinite(stockQty) || stockQty < 0 || !Number.isInteger(stockQty)) {
      res.status(400).json({ error: "«stockQty» inteiro ≥ 0." });
      return;
    }
    const refUsd =
      typeof b.referenceCostUsd === "number" && Number.isFinite(b.referenceCostUsd)
        ? Math.round(b.referenceCostUsd * 100) / 100
        : undefined;
    const marginErr = validateStoreMargin(Math.round(unitPriceUsd * 100) / 100, refUsd);
    if (marginErr) {
      res.status(400).json({ error: marginErr });
      return;
    }
    const obs =
      typeof b.observationsDetail === "string" && b.observationsDetail.trim() ? b.observationsDetail.trim() : undefined;
    const designerNotes =
      typeof b.designerNotes === "string" && b.designerNotes.trim() ? b.designerNotes.trim() : undefined;
    const supplierUrl =
      typeof b.supplierUrl === "string" && b.supplierUrl.trim().startsWith("http") ? b.supplierUrl.trim() : undefined;
    const p: VipStoreProduct = {
      id: typeof b.id === "string" && b.id.trim() ? b.id.trim() : `prod-${Date.now().toString(36)}`,
      title,
      shortDescription: typeof b.shortDescription === "string" ? b.shortDescription.trim() : "",
      unitPriceUsd: Math.round(unitPriceUsd * 100) / 100,
      referenceCostUsd: refUsd,
      stockQty,
      imageUrl: typeof b.imageUrl === "string" ? b.imageUrl.trim() || undefined : undefined,
      supplierUrl,
      observationsDetail: obs,
      designerNotes,
      active: b.active !== false,
      category: typeof b.category === "string" && b.category.trim() ? b.category.trim() : "Geral",
      createdAtIso: new Date().toISOString(),
    };
    upsertVipStoreProduct(p);
    res.json({ ok: true, product: p });
  });

  app.patch("/api/admin/vip-store/products/:id", requireAdmin, (req, res) => {
    const cur = getVipStoreProductById(req.params.id);
    if (!cur) {
      res.status(404).json({ error: "Produto não encontrado." });
      return;
    }
    const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const title = typeof b.title === "string" ? b.title.trim() : cur.title;
    const unitPriceUsd = Number(b.unitPriceUsd);
    const stockQty = Number(b.stockQty);
    const nextRef =
      typeof b.referenceCostUsd === "number" && Number.isFinite(b.referenceCostUsd)
        ? Math.round(b.referenceCostUsd * 100) / 100
        : cur.referenceCostUsd;
    const nextUnit = Number.isFinite(unitPriceUsd) && unitPriceUsd > 0 ? Math.round(unitPriceUsd * 100) / 100 : cur.unitPriceUsd;
    const marginErr = validateStoreMargin(nextUnit, nextRef);
    if (marginErr) {
      res.status(400).json({ error: marginErr });
      return;
    }
    const next: VipStoreProduct = {
      ...cur,
      title: title || cur.title,
      shortDescription: typeof b.shortDescription === "string" ? b.shortDescription.trim() : cur.shortDescription,
      unitPriceUsd: nextUnit,
      referenceCostUsd: nextRef,
      stockQty: Number.isFinite(stockQty) && stockQty >= 0 && Number.isInteger(stockQty) ? stockQty : cur.stockQty,
      imageUrl: typeof b.imageUrl === "string" ? b.imageUrl.trim() || undefined : cur.imageUrl,
      supplierUrl:
        typeof b.supplierUrl === "string"
          ? b.supplierUrl.trim() === ""
            ? undefined
            : b.supplierUrl.trim().startsWith("http")
              ? b.supplierUrl.trim()
              : cur.supplierUrl
          : cur.supplierUrl,
      observationsDetail:
        typeof b.observationsDetail === "string"
          ? b.observationsDetail.trim() || undefined
          : cur.observationsDetail,
      designerNotes:
        typeof b.designerNotes === "string"
          ? b.designerNotes.trim() || undefined
          : cur.designerNotes,
      active: typeof b.active === "boolean" ? b.active : cur.active,
      category: typeof b.category === "string" && b.category.trim() ? b.category.trim() : cur.category,
    };
    upsertVipStoreProduct(next);
    res.json({ ok: true, product: next });
  });

  app.patch("/api/admin/vip-store/orders/:id", requireAdmin, (req, res) => {
    const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const status = typeof b.status === "string" ? (b.status as VipStoreOrderStatus) : undefined;
    const allowed: VipStoreOrderStatus[] = [
      "pago_aguardando_compra",
      "em_compra",
      "enviado_prep",
      "entregue",
      "cancelado",
    ];
    if (status && !allowed.includes(status)) {
      res.status(400).json({ error: "Estado inválido." });
      return;
    }
    const noteAdmin = typeof b.noteAdmin === "string" ? b.noteAdmin.trim() : undefined;
    const updated = updateVipStoreOrder(req.params.id, {
      ...(status ? { status } : {}),
      ...(noteAdmin !== undefined ? { noteAdmin } : {}),
    });
    if (!updated) {
      res.status(404).json({ error: "Pedido não encontrado." });
      return;
    }
    res.json({ ok: true, order: updated });
  });

  app.post("/api/admin/vip-store/orders/:id/refund", requireAdmin, (req, res) => {
    const s = readVipStore();
    const ord = s.orders.find((o) => o.id === req.params.id);
    if (!ord) {
      res.status(404).json({ error: "Pedido não encontrado." });
      return;
    }
    if (ord.status === "cancelado") {
      res.status(400).json({ error: "Pedido já cancelado." });
      return;
    }
    const refund = applyWalletDelta(ord.suite, ord.totalUsd);
    if (!refund.ok) {
      res.status(400).json({ error: refund.error });
      return;
    }
    applyVipStoreStockRestore(ord.items.map((i) => ({ productId: i.productId, qty: i.qty })));
    appendWalletLedger({
      suite: ord.suite,
      deltaUsd: ord.totalUsd,
      balanceAfter: refund.balanceUsd,
      reason: "vip_store_refund",
      reference: ord.id,
    });
    const updated = updateVipStoreOrder(ord.id, { status: "cancelado", noteAdmin: "Estornado ao saldo (admin)." });
    res.json({ ok: true, order: updated, balanceUsd: refund.balanceUsd });
  });

  const __vipDir = path.dirname(fileURLToPath(import.meta.url));
  const vipAnnPath = path.join(__vipDir, "data", "vip-announcements.json");
  if (!fs.existsSync(vipAnnPath)) {
    resetVipDemoContent();
  }
}
