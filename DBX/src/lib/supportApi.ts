import { apiUrl } from "./apiUrl";
import { jsonAdminHeaders, jsonUserHeaders } from "./authHeaders";

export type SupportTicketMessageDto = {
  atIso: string;
  author: "client" | "staff";
  text: string;
};

/** Primeira mensagem = corpo inicial do cliente; a seguir mensagens persistidas (ex.: equipa). */
export function buildSupportTicketThread(tk: SupportTicketDto): SupportTicketMessageDto[] {
  const initial: SupportTicketMessageDto = { atIso: tk.createdAtIso, author: "client", text: tk.body };
  const rest = [...tk.messages].sort((a, b) => Date.parse(a.atIso) - Date.parse(b.atIso));
  return [initial, ...rest];
}

export type SupportTicketDto = {
  id: string;
  suite: string;
  clientName: string;
  subject: string;
  body: string;
  status: "open" | "in_progress" | "closed";
  createdAtIso: string;
  updatedAtIso: string;
  messages: SupportTicketMessageDto[];
};

export async function postSupportTicket(input: {
  suite: string;
  subject: string;
  body: string;
}): Promise<{ ok: true; ticket: SupportTicketDto } | { ok: false; error: string }> {
  try {
    const res = await fetch(apiUrl("/api/client/support-ticket"), {
      method: "POST",
      headers: jsonUserHeaders(),
      body: JSON.stringify(input),
    });
    const j = (await res.json()) as { ok?: boolean; ticket?: unknown; error?: string };
    if (!res.ok) return { ok: false, error: typeof j.error === "string" ? j.error : "Pedido falhou." };
    const ticket = coerceTicketDto(j.ticket);
    if (!ticket) return { ok: false, error: "Resposta inválida." };
    return { ok: true, ticket };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

export async function fetchAdminSupportTickets(): Promise<
  { ok: true; tickets: SupportTicketDto[] } | { ok: false; error: string }
> {
  try {
    const res = await fetch(apiUrl("/api/admin/support-tickets"), { headers: jsonAdminHeaders() });
    const j = (await res.json()) as { tickets?: unknown; error?: string };
    if (!res.ok) return { ok: false, error: typeof j.error === "string" ? j.error : "Pedido falhou." };
    if (!Array.isArray(j.tickets)) return { ok: false, error: "Resposta inválida." };
    const tickets = j.tickets.map(coerceTicketDto).filter((x): x is SupportTicketDto => Boolean(x));
    return { ok: true, tickets };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

export async function patchAdminSupportTicket(
  id: string,
  status: SupportTicketDto["status"],
): Promise<{ ok: true; ticket: SupportTicketDto } | { ok: false; error: string }> {
  try {
    const res = await fetch(apiUrl(`/api/admin/support-tickets/${encodeURIComponent(id)}`), {
      method: "PATCH",
      headers: jsonAdminHeaders(),
      body: JSON.stringify({ status }),
    });
    const j = (await res.json()) as { ok?: boolean; ticket?: unknown; error?: string };
    if (!res.ok) return { ok: false, error: typeof j.error === "string" ? j.error : "Pedido falhou." };
    const ticket = coerceTicketDto(j.ticket);
    if (!ticket) return { ok: false, error: "Resposta inválida." };
    return { ok: true, ticket };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

function coerceTicketDto(raw: unknown): SupportTicketDto | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const messages = Array.isArray(o.messages) ? o.messages : [];
  const outMsgs: SupportTicketMessageDto[] = [];
  for (const m of messages) {
    if (!m || typeof m !== "object") continue;
    const r = m as Record<string, unknown>;
    const text = typeof r.text === "string" ? r.text.trim() : "";
    if (!text) continue;
    outMsgs.push({
      atIso: typeof r.atIso === "string" ? r.atIso : "",
      author: r.author === "staff" ? "staff" : "client",
      text,
    });
  }
  if (
    typeof o.id !== "string" ||
    typeof o.suite !== "string" ||
    typeof o.subject !== "string" ||
    typeof o.body !== "string" ||
    typeof o.createdAtIso !== "string" ||
    typeof o.status !== "string"
  ) {
    return null;
  }
  return {
    id: o.id,
    suite: o.suite,
    clientName: typeof o.clientName === "string" ? o.clientName : "",
    subject: o.subject,
    body: o.body,
    status: o.status === "in_progress" || o.status === "closed" ? o.status : "open",
    createdAtIso: o.createdAtIso,
    updatedAtIso: typeof o.updatedAtIso === "string" ? o.updatedAtIso : o.createdAtIso,
    messages: outMsgs,
  };
}

export async function postAdminSupportTicketReply(
  id: string,
  text: string,
): Promise<{ ok: true; ticket: SupportTicketDto } | { ok: false; error: string }> {
  try {
    const res = await fetch(apiUrl(`/api/admin/support-tickets/${encodeURIComponent(id)}/reply`), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ text }),
    });
    const j = (await res.json()) as { ok?: boolean; ticket?: unknown; error?: string };
    if (!res.ok) return { ok: false, error: typeof j.error === "string" ? j.error : "Pedido falhou." };
    const ticket = coerceTicketDto(j.ticket);
    if (!ticket) return { ok: false, error: "Resposta inválida." };
    return { ok: true, ticket };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

export async function fetchClientSupportTickets(
  suite: string,
): Promise<{ ok: true; tickets: SupportTicketDto[] } | { ok: false; error: string }> {
  try {
    const res = await fetch(apiUrl(`/api/client/support-tickets?suite=${encodeURIComponent(suite)}`), {
      headers: jsonUserHeaders(),
    });
    const j = (await res.json()) as { tickets?: unknown; error?: string };
    if (!res.ok) return { ok: false, error: typeof j.error === "string" ? j.error : "Pedido falhou." };
    if (!Array.isArray(j.tickets)) return { ok: false, error: "Resposta inválida." };
    const tickets = j.tickets.map(coerceTicketDto).filter((x): x is SupportTicketDto => Boolean(x));
    return { ok: true, tickets };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}
