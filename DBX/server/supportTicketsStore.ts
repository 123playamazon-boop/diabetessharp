import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findBySuite } from "./clientRegistryStore";
import { queueDemoEmail } from "./emailOutbox";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data", "support-tickets.json");

export type SupportTicketMessage = {
  atIso: string;
  author: "client" | "staff";
  text: string;
};

export type SupportTicket = {
  id: string;
  suite: string;
  clientName?: string;
  subject: string;
  body: string;
  status: "open" | "in_progress" | "closed";
  createdAtIso: string;
  updatedAtIso: string;
  messages: SupportTicketMessage[];
};

type FileShape = { tickets: SupportTicket[] };

function normalizeTicket(row: SupportTicket): SupportTicket {
  const msgs = Array.isArray(row.messages) ? row.messages.filter((m) => m && typeof m === "object") : [];
  return {
    ...row,
    messages: msgs
      .filter((m) => typeof (m as SupportTicketMessage).text === "string" && (m as SupportTicketMessage).text.trim())
      .map((m) => ({
        atIso: typeof (m as SupportTicketMessage).atIso === "string" ? (m as SupportTicketMessage).atIso : row.createdAtIso,
        author: (m as SupportTicketMessage).author === "staff" ? "staff" : "client",
        text: String((m as SupportTicketMessage).text).trim(),
      })),
  };
}

function readAll(): FileShape {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const j = JSON.parse(raw) as unknown;
    if (j && typeof j === "object" && Array.isArray((j as FileShape).tickets)) {
      const tickets = ((j as FileShape).tickets as SupportTicket[]).map((t) =>
        normalizeTicket({ ...t, messages: Array.isArray(t.messages) ? t.messages : [] }),
      );
      return { tickets };
    }
  } catch {
    /* empty */
  }
  return { tickets: [] };
}

function writeAll(data: FileShape): void {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

export function listSupportTickets(): SupportTicket[] {
  return readAll().tickets.sort((a, b) => Date.parse(b.createdAtIso) - Date.parse(a.createdAtIso));
}

export function listSupportTicketsBySuite(suite: string): SupportTicket[] {
  const s = suite.trim();
  if (!s) return [];
  return readAll()
    .tickets.filter((t) => t.suite.trim() === s)
    .sort((a, b) => Date.parse(b.updatedAtIso) - Date.parse(a.updatedAtIso));
}

export function appendSupportTicket(
  t: Omit<SupportTicket, "updatedAtIso" | "messages"> & { updatedAtIso?: string; messages?: SupportTicketMessage[] },
): SupportTicket {
  const data = readAll();
  const base = { ...t, messages: t.messages ?? [] } as SupportTicket;
  const full: SupportTicket = {
    ...normalizeTicket(base),
    updatedAtIso: t.updatedAtIso ?? t.createdAtIso,
  };
  data.tickets.unshift(full);
  writeAll(data);
  queueDemoEmail({
    to: "ops@demo.dbx",
    subject: `[DBX demo] Ticket ${full.id} — suite ${full.suite}`,
    text: `${full.subject}\n\n${full.body}`,
    meta: { ticketId: full.id, suite: full.suite },
  });
  return full;
}

export function clearSupportTickets(): void {
  writeAll({ tickets: [] });
}

export function updateSupportTicketStatus(
  id: string,
  status: SupportTicket["status"],
): SupportTicket | null {
  const data = readAll();
  const i = data.tickets.findIndex((x) => x.id === id);
  if (i < 0) return null;
  const cur = data.tickets[i]!;
  const next: SupportTicket = {
    ...cur,
    status,
    updatedAtIso: new Date().toISOString(),
  };
  data.tickets[i] = next;
  writeAll(data);
  return next;
}

export function appendSupportTicketStaffReply(id: string, text: string): SupportTicket | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const data = readAll();
  const i = data.tickets.findIndex((x) => x.id === id);
  if (i < 0) return null;
  const cur = normalizeTicket(data.tickets[i]!);
  if (cur.status === "closed") return null;
  const msgs: SupportTicketMessage[] = [...cur.messages, { atIso: new Date().toISOString(), author: "staff", text: trimmed }];
  const next: SupportTicket = {
    ...cur,
    messages: msgs,
    status: "in_progress",
    updatedAtIso: new Date().toISOString(),
  };
  data.tickets[i] = next;
  writeAll(data);
  const c = findBySuite(cur.suite);
  const to = c?.email?.trim();
  if (to) {
    queueDemoEmail({
      to,
      subject: `[DBX demo] Resposta ao ticket ${cur.id}`,
      text: `Assunto: ${cur.subject}\n\n${trimmed}\n\n— Equipa (demo; ver email-outbox.json no servidor)`,
      meta: { ticketId: cur.id, suite: cur.suite, type: "support_staff_reply" },
    });
  }
  return next;
}
