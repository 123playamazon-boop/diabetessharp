import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useI18n } from "../../i18n/context";
import {
  fetchAdminSupportTickets,
  patchAdminSupportTicket,
  postAdminSupportTicketReply,
  type SupportTicketDto,
  type SupportTicketMessageDto,
} from "../../lib/supportApi";

function threadEntries(tk: SupportTicketDto): SupportTicketMessageDto[] {
  const initial: SupportTicketMessageDto = {
    atIso: tk.createdAtIso,
    author: "client",
    text: tk.body,
  };
  const rest = [...tk.messages].sort((a, b) => Date.parse(a.atIso) - Date.parse(b.atIso));
  return [initial, ...rest];
}

export function AdminSupportPage() {
  const { t } = useI18n();
  const [tickets, setTickets] = useState<SupportTicketDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [replyBusy, setReplyBusy] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchAdminSupportTickets();
    setLoading(false);
    if (!r.ok) {
      toast.error(r.error);
      setTickets([]);
      return;
    }
    setTickets(r.tickets);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (id: string, status: SupportTicketDto["status"]) => {
    const r = await patchAdminSupportTicket(id, status);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(t("admin.support.statusOk"));
    setTickets((prev) => prev.map((x) => (x.id === id ? r.ticket : x)));
  };

  const sendReply = async (id: string) => {
    const text = (replyDraft[id] ?? "").trim();
    if (!text) {
      toast.error(t("admin.support.replyValidation"));
      return;
    }
    setReplyBusy((b) => ({ ...b, [id]: true }));
    const r = await postAdminSupportTicketReply(id, text);
    setReplyBusy((b) => ({ ...b, [id]: false }));
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(t("admin.support.replyOk"));
    setReplyDraft((d) => ({ ...d, [id]: "" }));
    setTickets((prev) => prev.map((x) => (x.id === id ? r.ticket : x)));
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-black uppercase tracking-wide text-teal-700">{t("admin.support.eyebrow")}</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-zinc-900">{t("admin.support.title")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">{t("admin.support.subtitle")}</p>
      </header>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          {t("admin.support.refresh")}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">{t("admin.support.loading")}</p>
      ) : tickets.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-12 text-center text-sm text-zinc-500">
          {t("admin.support.empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {tickets.map((tk) => {
            const thread = threadEntries(tk);
            const closed = tk.status === "closed";
            return (
              <li key={tk.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs font-bold text-zinc-500">{tk.id}</p>
                    <p className="mt-1 text-sm font-bold text-zinc-900">{tk.subject}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {tk.clientName} · {tk.suite} · {new Date(tk.createdAtIso).toLocaleString()}
                    </p>
                  </div>
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-[10px] font-bold uppercase text-zinc-600">
                    {t(`admin.support.status.${tk.status}`)}
                  </span>
                </div>

                <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-zinc-500">{t("admin.support.threadTitle")}</p>
                <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-zinc-100 bg-zinc-50/80 p-2">
                  {thread.map((m, idx) => (
                    <li
                      key={`${m.atIso}-${idx}`}
                      className={`rounded-lg border px-2.5 py-2 text-xs ${
                        m.author === "staff"
                          ? "ml-4 border-teal-200 bg-teal-50 text-teal-950"
                          : "mr-4 border-zinc-200 bg-white text-zinc-800"
                      }`}
                    >
                      <p className="text-[10px] font-bold uppercase text-zinc-500">
                        {m.author === "staff" ? t("admin.support.bubbleStaff") : t("admin.support.bubbleClient")} ·{" "}
                        {new Date(m.atIso).toLocaleString()}
                      </p>
                      <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap font-sans text-[13px] leading-snug">{m.text}</pre>
                    </li>
                  ))}
                </ul>

                {!closed ? (
                  <div className="mt-3 space-y-2">
                    <label className="block text-[11px] font-semibold text-zinc-700">
                      {t("admin.support.replyLabel")}
                      <textarea
                        value={replyDraft[tk.id] ?? ""}
                        onChange={(e) => setReplyDraft((d) => ({ ...d, [tk.id]: e.target.value }))}
                        rows={3}
                        placeholder={t("admin.support.replyPlaceholder")}
                        className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900"
                        maxLength={8000}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={replyBusy[tk.id]}
                      onClick={() => void sendReply(tk.id)}
                      className="w-full rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50"
                    >
                      {t("admin.support.replySend")}
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-zinc-500">{t("admin.support.closedNoReply")}</p>
                )}

                <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
                  {closed ? (
                    <button
                      type="button"
                      onClick={() => void setStatus(tk.id, "open")}
                      className="rounded-full border border-zinc-200 px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-700 hover:bg-zinc-50"
                    >
                      {t("admin.support.actionOpen")}
                    </button>
                  ) : null}
                  {!closed && tk.status !== "in_progress" ? (
                    <button
                      type="button"
                      onClick={() => void setStatus(tk.id, "in_progress")}
                      className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-bold uppercase text-amber-900 hover:bg-amber-100"
                    >
                      {t("admin.support.actionProgress")}
                    </button>
                  ) : null}
                  {!closed ? (
                    <button
                      type="button"
                      onClick={() => void setStatus(tk.id, "closed")}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold uppercase text-emerald-900 hover:bg-emerald-100"
                    >
                      {t("admin.support.actionClose")}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
