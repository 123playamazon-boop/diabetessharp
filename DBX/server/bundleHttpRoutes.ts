import type { Express } from "express";
import { requireAdmin, requireUser, userSuite } from "./authMiddleware";
import {
  adminCompleteBundleOrder,
  adminPatchBundleOrderMeta,
  adminSetBundleOrderStatus,
  createBundle,
  createBundleOrder,
  createBundleOrdersGrouped,
  getBundleById,
  getOrderById,
  listBundlesBySuite,
  listOrdersAdmin,
  listOrdersBySuite,
  type BundleItem,
  type BundleOrderLineInput,
  type BundleOrderStatus,
} from "./bundleStore";

const STATUSES: BundleOrderStatus[] = [
  "pending",
  "picking",
  "assembling",
  "quality_check",
  "completed",
  "cancelled",
];

export function registerBundleRoutes(app: Express): void {
  const BASE = "/api/client/bundles";
  const ORD = "/api/client/bundle-orders";
  const ADMIN = "/api/admin/bundle-orders";

  app.post(BASE, requireUser, (req, res) => {
    const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const authSuite = userSuite(req);
    const bodySuite = typeof b.suite === "string" ? b.suite.trim() : "";
    if (bodySuite && bodySuite !== authSuite) {
      res.status(403).json({ error: "Não pode criar kits noutra suite." });
      return;
    }
    const suite = authSuite;
    const name = typeof b.name === "string" ? b.name : "";
    const bundleSku = typeof b.bundleSku === "string" ? b.bundleSku : "";
    const items = Array.isArray(b.items) ? (b.items as unknown[]) : [];
    const parsed: BundleItem[] = [];
    for (const raw of items) {
      if (!raw || typeof raw !== "object") continue;
      const o = raw as Record<string, unknown>;
      const productSku =
        typeof o.productSku === "string" ? o.productSku : typeof o.product_sku === "string" ? o.product_sku : "";
      const qtyPerBundle = Number(o.qtyPerBundle ?? o.quantity);
      if (!productSku.trim()) continue;
      parsed.push({ productSku, qtyPerBundle });
    }
    const assemblyFeeUsd = typeof b.assemblyFeeUsd === "number" ? b.assemblyFeeUsd : undefined;
    const setupFeeUsd = typeof b.setupFeeUsd === "number" ? b.setupFeeUsd : undefined;
    const clientDescription = typeof b.clientDescription === "string" ? b.clientDescription : undefined;
    const r = createBundle({ suite, name, bundleSku, items: parsed, clientDescription, assemblyFeeUsd, setupFeeUsd });
    if (!r.ok) {
      res.status(400).json({ error: r.error });
      return;
    }
    res.json({ ok: true, bundle: r.bundle });
  });

  app.get(BASE, requireUser, (req, res) => {
    const suite = userSuite(req);
    res.json({ bundles: listBundlesBySuite(suite) });
  });

  app.get(`${BASE}/:id`, requireUser, (req, res) => {
    const suite = userSuite(req);
    const b = getBundleById(req.params.id, suite);
    if (!b) {
      res.status(404).json({ error: "Kit não encontrado." });
      return;
    }
    res.json({ bundle: b });
  });

  app.post(ORD, requireUser, (req, res) => {
    const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const authSuite = userSuite(req);
    const bodySuite = typeof b.suite === "string" ? b.suite.trim() : "";
    if (bodySuite && bodySuite !== authSuite) {
      res.status(403).json({ error: "Não pode criar pedidos noutra suite." });
      return;
    }
    const suite = authSuite;
    const labelFnsku = typeof b.labelFnsku === "string" ? b.labelFnsku : undefined;
    const pickingNotes = typeof b.pickingNotes === "string" ? b.pickingNotes : undefined;
    const batchSize = typeof b.batchSize === "number" ? b.batchSize : undefined;

    const linesRaw = Array.isArray(b.lines) ? (b.lines as unknown[]) : [];
    if (linesRaw.length > 0) {
      const lines: BundleOrderLineInput[] = [];
      for (const raw of linesRaw) {
        if (!raw || typeof raw !== "object") continue;
        const o = raw as Record<string, unknown>;
        const bundleId = typeof o.bundleId === "string" ? o.bundleId.trim() : "";
        const quantity = Number(o.quantity);
        const lineNotes = typeof o.lineNotes === "string" ? o.lineNotes : undefined;
        lines.push({ bundleId, quantity, lineNotes });
      }
      const r = createBundleOrdersGrouped({ suite, lines, pickingNotes, batchSize, labelFnsku });
      if (!r.ok) {
        res.status(400).json({ error: r.error });
        return;
      }
      res.json({
        ok: true,
        orders: r.orders,
        balanceUsd: r.balanceUsd,
        assemblyGroupId: r.assemblyGroupId,
      });
      return;
    }

    const bundleId = typeof b.bundleId === "string" ? b.bundleId.trim() : "";
    const quantity = Number(b.quantity);
    const lineNotes = typeof b.lineNotes === "string" ? b.lineNotes : undefined;
    const r = createBundleOrder({
      suite,
      bundleId,
      quantity,
      labelFnsku,
      pickingNotes,
      batchSize,
      lineNotes,
    });
    if (!r.ok) {
      res.status(400).json({ error: r.error });
      return;
    }
    res.json({ ok: true, order: r.order, balanceUsd: r.balanceUsd });
  });

  app.get(ORD, requireUser, (req, res) => {
    const suite = userSuite(req);
    res.json({ orders: listOrdersBySuite(suite) });
  });

  app.get(`${ORD}/:id`, requireUser, (req, res) => {
    const suite = userSuite(req);
    const o = getOrderById(req.params.id);
    if (!o || o.suite !== suite) {
      res.status(404).json({ error: "Pedido não encontrado." });
      return;
    }
    res.json({ order: o });
  });

  app.get(ADMIN, requireAdmin, (req, res) => {
    const st = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const valid = STATUSES.includes(st as BundleOrderStatus);
    res.json({ orders: listOrdersAdmin(valid ? st : undefined) });
  });

  app.patch(`${ADMIN}/:id/status`, requireAdmin, (req, res) => {
    const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const status = typeof b.status === "string" ? (b.status.trim() as BundleOrderStatus) : ("" as BundleOrderStatus);
    if (!STATUSES.includes(status)) {
      res.status(400).json({ error: "«status» inválido." });
      return;
    }
    const r = adminSetBundleOrderStatus(req.params.id, status);
    if (!r.ok) {
      res.status(400).json({ error: r.error });
      return;
    }
    res.json({ ok: true, order: r.order });
  });

  app.post(`${ADMIN}/:id/complete`, requireAdmin, (req, res) => {
    const r = adminCompleteBundleOrder(req.params.id);
    if (!r.ok) {
      res.status(400).json({ error: r.error });
      return;
    }
    res.json({ ok: true, order: r.order });
  });

  app.patch(`${ADMIN}/:id/meta`, requireAdmin, (req, res) => {
    const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const r = adminPatchBundleOrderMeta(req.params.id, {
      labelFnsku: typeof b.labelFnsku === "string" ? b.labelFnsku : undefined,
      qcPhotoDataUrl: typeof b.qcPhotoDataUrl === "string" ? b.qcPhotoDataUrl : undefined,
    });
    if (!r.ok) {
      res.status(404).json({ error: r.error });
      return;
    }
    res.json({ ok: true, order: r.order });
  });
}
