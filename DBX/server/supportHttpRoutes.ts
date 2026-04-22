import type { Express } from "express";
import { requireAdmin, requireUser, userSuite } from "./authMiddleware";
import { findBySuite } from "./clientRegistryStore";
import {
  appendSupportTicket,
  appendSupportTicketStaffReply,
  listSupportTickets,
  listSupportTicketsBySuite,
  updateSupportTicketStatus,
} from "./supportTicketsStore";

export function registerSupportRoutes(app: Express): void {
  app.post("/api/client/support-ticket", requireUser, (req, res) => {
    const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const authSuite = userSuite(req);
    const bodySuite = typeof b.suite === "string" ? b.suite.trim() : "";
    if (bodySuite && bodySuite !== authSuite) {
      res.status(403).json({ error: "Não pode abrir ticket noutra suite." });
      return;
    }
    const suite = authSuite;
    const subject = typeof b.subject === "string" ? b.subject.trim() : "";
    const body = typeof b.body === "string" ? b.body.trim() : "";
    if (!suite || !subject || !body) {
      res.status(400).json({ error: "Envie «suite», «subject» e «body»." });
      return;
    }
    const c = findBySuite(suite);
    if (!c) {
      res.status(404).json({ error: "Suite não encontrada." });
      return;
    }
    const id = `TKT-${Date.now().toString(36).toUpperCase()}`;
    const now = new Date().toISOString();
    const ticket = appendSupportTicket({
      id,
      suite,
      clientName: c.name,
      subject,
      body,
      status: "open",
      createdAtIso: now,
    });
    res.json({ ok: true, ticket });
  });

  app.get("/api/admin/support-tickets", requireAdmin, (_req, res) => {
    res.json({ tickets: listSupportTickets() });
  });

  app.get("/api/client/support-tickets", (req, res) => {
    const suite = typeof req.query.suite === "string" ? req.query.suite.trim() : "";
    if (!suite) {
      res.status(400).json({ error: "Envie «suite»." });
      return;
    }
    if (!findBySuite(suite)) {
      res.status(404).json({ error: "Suite não encontrada." });
      return;
    }
    res.json({ tickets: listSupportTicketsBySuite(suite) });
  });

  app.post("/api/admin/support-tickets/:id/reply", requireAdmin, (req, res) => {
    const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const text = typeof b.text === "string" ? b.text : "";
    if (!text.trim()) {
      res.status(400).json({ error: "Envie «text» com a resposta." });
      return;
    }
    const updated = appendSupportTicketStaffReply(req.params.id, text);
    if (!updated) {
      res.status(404).json({ error: "Ticket não encontrado ou já encerrado." });
      return;
    }
    res.json({ ok: true, ticket: updated });
  });

  app.patch("/api/admin/support-tickets/:id", requireAdmin, (req, res) => {
    const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const status = b.status;
    if (status !== "open" && status !== "in_progress" && status !== "closed") {
      res.status(400).json({ error: "«status»: open | in_progress | closed" });
      return;
    }
    const updated = updateSupportTicketStatus(req.params.id, status);
    if (!updated) {
      res.status(404).json({ error: "Ticket não encontrado." });
      return;
    }
    res.json({ ok: true, ticket: updated });
  });
}
