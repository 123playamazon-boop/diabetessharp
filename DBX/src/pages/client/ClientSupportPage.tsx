import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "../../ui/PageHeader";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { useClientProfile } from "../../context/ClientProfileContext";
import { useI18n } from "../../i18n/context";
import { buildSupportTicketThread, fetchClientSupportTickets, postSupportTicket, type SupportTicketDto } from "../../lib/supportApi";

const inputClass =
  "mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 text-sm text-ds-text shadow-ds placeholder:text-ds-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ds-primary";

export function ClientSupportPage() {
  const { t } = useI18n();
  const { profile } = useClientProfile();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<SupportTicketDto[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    const r = await fetchClientSupportTickets(profile.suite);
    setHistoryLoading(false);
    if (!r.ok) {
      setHistory([]);
      return;
    }
    setHistory(r.tickets);
    window.dispatchEvent(new Event("dbx:notifications-updated"));
  }, [profile.suite]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const submit = async () => {
    const s = subject.trim();
    const b = body.trim();
    if (!s || !b) {
      toast.error(t("client.support.validation"));
      return;
    }
    setBusy(true);
    try {
      const r = await postSupportTicket({ suite: profile.suite, subject: s, body: b });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(t("client.support.success", { id: r.ticket.id }));
      setSubject("");
      setBody("");
      void loadHistory();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        eyebrow={t("client.support.eyebrow")}
        title={t("client.support.title")}
        subtitle={t("client.support.subtitle")}
        actions={<LanguageSwitcher />}
      />

      <div className="rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds">
        <p className="text-xs text-ds-muted">
          {t("client.support.suiteLine", { suite: profile.suite })}
        </p>
        <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-ds-muted">
          {t("client.support.subject")}
          <input className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
        </label>
        <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-ds-muted">
          {t("client.support.body")}
          <textarea className={`${inputClass} min-h-[140px] resize-y`} value={body} onChange={(e) => setBody(e.target.value)} maxLength={8000} />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="mt-4 w-full rounded-ds-btn bg-ds-primary px-4 py-3 text-sm font-bold text-white shadow-ds hover:opacity-95 disabled:opacity-50"
        >
          {t("client.support.submit")}
        </button>
      </div>

      <div className="rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds">
        <p className="text-xs font-bold uppercase tracking-wide text-ds-muted">{t("client.support.historyTitle")}</p>
        {historyLoading ? (
          <p className="mt-3 text-sm text-ds-muted">{t("client.support.historyLoading")}</p>
        ) : history.length === 0 ? (
          <p className="mt-3 text-sm text-ds-muted">{t("client.support.historyEmpty")}</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {history.map((tk) => (
              <li key={tk.id} className="rounded-ds-btn border border-ds-border bg-ds-bg/40 p-3">
                <p className="font-mono text-[11px] font-bold text-ds-muted">{tk.id}</p>
                <p className="mt-1 text-sm font-bold text-ds-text">{tk.subject}</p>
                <p className="mt-1 text-[11px] text-ds-muted">
                  {t(`admin.support.status.${tk.status}`)} · {new Date(tk.createdAtIso).toLocaleString()}
                </p>
                <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-lg border border-ds-border bg-ds-surface p-2">
                  {buildSupportTicketThread(tk).map((m, idx) => (
                    <li
                      key={`${tk.id}-${m.atIso}-${idx}`}
                      className={`rounded-md border px-2 py-1.5 text-xs ${
                        m.author === "staff"
                          ? "ml-3 border-teal-200/80 bg-teal-50/80 text-ds-text"
                          : "mr-3 border-ds-border bg-ds-bg/30 text-ds-text"
                      }`}
                    >
                      <p className="text-[10px] font-bold uppercase text-ds-muted">
                        {m.author === "staff" ? t("client.support.fromTeam") : t("client.support.fromYou")} ·{" "}
                        {new Date(m.atIso).toLocaleString()}
                      </p>
                      <pre className="mt-1 whitespace-pre-wrap font-sans text-[13px] leading-snug">{m.text}</pre>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-center text-xs text-ds-muted">
        <Link to="/app/notificacoes" className="font-semibold text-ds-primary underline-offset-2 hover:underline">
          {t("client.support.linkNotifications")}
        </Link>
      </p>
    </div>
  );
}
