import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "../../ui/PageHeader";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { useClientProfile } from "../../context/ClientProfileContext";
import { useVipUnread } from "../../context/VipUnreadContext";
import { useI18n } from "../../i18n/context";
import {
  buildSyncNotificationItems,
  dismissNotification,
  getDismissedNotificationIds,
  supportTicketNotificationDismissId,
} from "../../lib/clientSyncNotifications";
import { INVENTORY_UPDATED_EVENT } from "../../lib/clientInventoryStorage";
import { ORDERS_UPDATED_EVENT } from "../../lib/clientOrdersStorage";
import { buildSupportTicketThread, fetchClientSupportTickets, type SupportTicketDto } from "../../lib/supportApi";

export function ClientNotificationsPage() {
  const { t } = useI18n();
  const { profile } = useClientProfile();
  const { unreadCount } = useVipUnread();
  const suite = profile.suite?.trim() ?? "";
  const [tick, setTick] = useState(0);
  const [supportTickets, setSupportTickets] = useState<SupportTicketDto[]>([]);
  const [supportLoading, setSupportLoading] = useState(false);

  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener("dbx:notifications-updated", bump);
    window.addEventListener(INVENTORY_UPDATED_EVENT, bump);
    window.addEventListener(ORDERS_UPDATED_EVENT, bump);
    window.addEventListener("dbx:vip-announcements", bump);
    return () => {
      window.removeEventListener("dbx:notifications-updated", bump);
      window.removeEventListener(INVENTORY_UPDATED_EVENT, bump);
      window.removeEventListener(ORDERS_UPDATED_EVENT, bump);
      window.removeEventListener("dbx:vip-announcements", bump);
    };
  }, []);

  useEffect(() => {
    if (!suite) {
      setSupportTickets([]);
      return;
    }
    let cancelled = false;
    setSupportLoading(true);
    void (async () => {
      const r = await fetchClientSupportTickets(suite);
      if (cancelled) return;
      setSupportLoading(false);
      if (r.ok) setSupportTickets(r.tickets);
      else setSupportTickets([]);
    })();
    return () => {
      cancelled = true;
    };
  }, [suite, tick]);

  const dismissed = useMemo(() => getDismissedNotificationIds(), [tick]);

  const activeSupportInAlerts = useMemo(() => {
    return supportTickets.filter(
      (tk) =>
        (tk.status === "open" || tk.status === "in_progress") &&
        !dismissed.has(supportTicketNotificationDismissId(tk.id)),
    );
  }, [supportTickets, dismissed]);

  const items = useMemo(() => buildSyncNotificationItems(profile, suite), [profile, suite, tick]);

  const onDismiss = (id: string) => {
    dismissNotification(id);
    setTick((n) => n + 1);
    toast.success(t("client.notifications.dismissed"));
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        eyebrow={t("client.notifications.eyebrow")}
        title={t("client.notifications.title")}
        subtitle={t("client.notifications.subtitle")}
        actions={<LanguageSwitcher />}
      />

      {unreadCount > 0 ? (
        <div className="rounded-ds-card border border-ds-warning/35 bg-ds-soft-amber/90 p-4 shadow-ds">
          <p className="text-sm font-bold text-ds-text">{t("client.notifications.vipBlockTitle", { n: unreadCount })}</p>
          <p className="mt-1 text-xs leading-relaxed text-ds-muted">{t("client.notifications.vipBlockBody")}</p>
          <Link
            to="/app/grupo-vip"
            className="mt-3 inline-flex rounded-ds-btn bg-ds-primary px-4 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-ds hover:opacity-95"
          >
            {t("client.notifications.vipCta")}
          </Link>
        </div>
      ) : null}

      {items.length === 0 && activeSupportInAlerts.length === 0 && unreadCount === 0 && !supportLoading ? (
        <div className="rounded-ds-card border border-dashed border-ds-border bg-ds-surface px-6 py-12 text-center text-sm text-ds-muted shadow-ds">
          {t("client.notifications.empty")}
        </div>
      ) : null}

      {supportLoading && suite ? (
        <p className="text-sm text-ds-muted">{t("client.support.historyLoading")}</p>
      ) : null}

      {activeSupportInAlerts.length > 0 ? (
        <ul className="space-y-3">
          {activeSupportInAlerts.map((tk) => (
            <li
              key={tk.id}
              className="rounded-ds-card border border-ds-primary/25 bg-ds-surface p-4 shadow-ds ring-1 ring-ds-primary/15"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-ds-primary">{t("client.support.eyebrow")}</p>
                  <p className="mt-1 text-sm font-bold text-ds-text">{tk.subject}</p>
                  <p className="mt-1 font-mono text-[11px] text-ds-muted">
                    {tk.id} · {t(`admin.support.status.${tk.status}`)}
                  </p>
                  <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-ds-muted">{t("admin.support.threadTitle")}</p>
                  <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-ds-border bg-ds-bg/50 p-2">
                    {buildSupportTicketThread(tk).map((m, idx) => (
                      <li
                        key={`${tk.id}-${m.atIso}-${idx}`}
                        className={`rounded-md border px-2 py-1.5 text-xs ${
                          m.author === "staff"
                            ? "ml-2 border-teal-200/90 bg-teal-50/90 text-ds-text"
                            : "mr-2 border-ds-border bg-ds-surface text-ds-text"
                        }`}
                      >
                        <p className="text-[10px] font-bold uppercase text-ds-muted">
                          {m.author === "staff" ? t("client.support.fromTeam") : t("client.support.fromYou")} ·{" "}
                          {new Date(m.atIso).toLocaleString()}
                        </p>
                        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap font-sans text-[13px] leading-snug">{m.text}</pre>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  <Link
                    to="/app/suporte"
                    className="inline-flex justify-center rounded-ds-btn bg-ds-primary px-3 py-2 text-xs font-bold text-white shadow-ds hover:opacity-95"
                  >
                    {t("client.notifications.supportCta")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => onDismiss(supportTicketNotificationDismissId(tk.id))}
                    className="rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-2 text-xs font-semibold text-ds-text hover:bg-white"
                  >
                    {t("client.notifications.dismiss")}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((n) => (
            <li
              key={n.id}
              className="rounded-ds-card border border-ds-border bg-ds-surface p-4 shadow-ds"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ds-text">{t(n.titleKey)}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ds-muted">
                    {t(n.bodyKey, n.bodyParams as Record<string, string | number> | undefined)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  <Link
                    to={n.href}
                    className="inline-flex justify-center rounded-ds-btn bg-ds-primary px-3 py-2 text-xs font-bold text-white shadow-ds hover:opacity-95"
                  >
                    {t("client.notifications.open")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => onDismiss(n.id)}
                    className="rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-2 text-xs font-semibold text-ds-text hover:bg-white"
                  >
                    {t("client.notifications.dismiss")}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
