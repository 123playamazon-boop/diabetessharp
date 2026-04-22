import { useCallback, useEffect, useState } from "react";
import { Crown, Paperclip, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { useVipUnread } from "../../context/VipUnreadContext";
import { useClientProfile } from "../../context/ClientProfileContext";
import { useI18n } from "../../i18n/context";
import { fetchClientVipAnnouncements, type VipAnnouncementDto } from "../../lib/vipAnnouncementsApi";
import { markVipAnnouncementsRead } from "../../lib/vipReadIds";
import { PageHeader } from "../../ui/PageHeader";
import type { AppLocale } from "../../i18n/catalog";

function formatPub(iso: string, locale: AppLocale): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  const tag = locale === "pt-BR" ? "pt-BR" : locale === "es" ? "es" : "en-US";
  return new Intl.DateTimeFormat(tag, { dateStyle: "medium", timeStyle: "short" }).format(new Date(ms));
}

function channelLabel(t: (k: string) => string, ch: string): string {
  const k = `client.vip.channel.${ch}` as const;
  const x = t(k);
  return x === k ? ch : x;
}

export function ClientVipGroupPage() {
  const { t, locale } = useI18n();
  const { profile } = useClientProfile();
  const { refresh: refreshUnread } = useVipUnread();
  const [list, setList] = useState<VipAnnouncementDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchClientVipAnnouncements(profile.suite);
    setLoading(false);
    if (!r.ok) {
      toast.error(r.error);
      setList([]);
      return;
    }
    setList(r.announcements);
  }, [profile.suite]);

  useEffect(() => {
    void load();
  }, [load]);

  const onToggle = (id: string) => {
    setOpenId((cur) => (cur === id ? null : id));
    markVipAnnouncementsRead([id]);
    void refreshUnread();
  };

  const markAllRead = () => {
    if (list.length === 0) return;
    markVipAnnouncementsRead(list.map((a) => a.id));
    void refreshUnread();
    toast.success(t("client.vip.markAllOk"));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        eyebrow={t("client.vip.eyebrow")}
        title={t("client.vip.title")}
        subtitle={t("client.vip.subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LanguageSwitcher />
            <button
              type="button"
              disabled={loading || list.length === 0}
              onClick={() => markAllRead()}
              className="rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 text-xs font-bold uppercase tracking-wide text-ds-text shadow-ds hover:bg-ds-bg disabled:opacity-50"
            >
              {t("client.vip.markAllRead")}
            </button>
          </div>
        }
      />

      <div className="rounded-ds-card border border-violet-300/60 bg-gradient-to-br from-violet-950/90 via-ds-surface to-ds-surface p-4 shadow-ds ring-1 ring-violet-500/20">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-ds-btn bg-violet-600 text-white shadow-lg shadow-violet-600/30">
            <Crown className="size-6" aria-hidden />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-violet-200">{t("client.vip.badgeLine")}</p>
            <p className="mt-1 text-sm leading-relaxed text-ds-text">{t("client.vip.badgeBody")}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-ds-muted">{t("client.vip.loading")}</p>
      ) : list.length === 0 ? (
        <p className="rounded-ds-card border border-ds-border bg-ds-surface px-4 py-10 text-center text-sm text-ds-muted">{t("client.vip.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {list.map((a) => {
            const open = openId === a.id;
            const premiumOnly = a.audience === "premium_only";
            return (
              <li key={a.id} className="overflow-hidden rounded-ds-card border border-ds-border bg-ds-surface shadow-ds">
                <button
                  type="button"
                  onClick={() => onToggle(a.id)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-ds-bg/80"
                >
                  {a.pinned ? <Crown className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden /> : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-ds-bg px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-ds-muted">
                        {channelLabel(t, a.channel)}
                      </span>
                      {premiumOnly ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-violet-800">
                          <Sparkles className="size-3" aria-hidden />
                          {t("client.vip.premiumOnly")}
                        </span>
                      ) : null}
                      <span className="text-[11px] text-ds-muted">{formatPub(a.publishedAtIso, locale)}</span>
                    </div>
                    <p className="mt-1 flex items-center gap-2 font-bold text-ds-text">
                      {a.attachment ? <Paperclip className="size-4 shrink-0 text-violet-600" aria-hidden /> : null}
                      {a.title}
                    </p>
                  </div>
                </button>
                {open ? (
                  <div className="border-t border-ds-border bg-ds-bg/50 px-4 py-3 space-y-3">
                    {a.body.trim() ? (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ds-text">{a.body}</p>
                    ) : null}
                    {a.attachment?.url ? (
                      <div className="rounded-ds-btn border border-ds-border bg-ds-surface p-2">
                        {a.attachment.kind === "image" ? (
                          <a href={a.attachment.url} target="_blank" rel="noopener noreferrer" className="block">
                            <img src={a.attachment.url} alt="" className="mx-auto max-h-[min(420px,55vh)] w-auto max-w-full rounded object-contain" />
                          </a>
                        ) : null}
                        {a.attachment.kind === "video" ? (
                          <video src={a.attachment.url} controls className="w-full max-h-[min(420px,55vh)] rounded bg-black" />
                        ) : null}
                        {a.attachment.kind === "pdf" ? (
                          <div className="space-y-2">
                            <a
                              href={a.attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex rounded-ds-btn bg-ds-primary px-3 py-2 text-xs font-bold text-white hover:opacity-95"
                            >
                              {t("client.vip.openPdf")}
                            </a>
                            <iframe title={a.title} src={a.attachment.url} className="h-[min(400px,50vh)] w-full rounded border border-ds-border" />
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
