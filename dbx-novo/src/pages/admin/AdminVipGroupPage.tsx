import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Paperclip } from "lucide-react";
import { toast } from "sonner";
import {
  deleteAdminVipAnnouncement,
  fetchAdminVipAnnouncements,
  patchAdminVipAnnouncement,
  postAdminVipAnnouncement,
  type VipAnnouncementDto,
} from "../../lib/vipAnnouncementsApi";
import { PageHeader } from "../../ui/PageHeader";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { useI18n } from "../../i18n/context";

const CHANNELS = ["amazon", "mercado_livre", "ebay", "walmart", "geral"] as const;
const AUDIENCES = ["all", "premium_only"] as const;

const MAX_VIP_ATTACHMENT_BYTES = Math.floor(2.5 * 1024 * 1024);

function readFileAsAttachment(file: File): Promise<{ kind: "image" | "video" | "pdf"; url: string } | null> {
  if (file.size > MAX_VIP_ATTACHMENT_BYTES) return Promise.resolve(null);
  const mime = file.type;
  let kind: "image" | "video" | "pdf";
  if (mime.startsWith("image/")) kind = "image";
  else if (mime.startsWith("video/")) kind = "video";
  else if (mime === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) kind = "pdf";
  else return Promise.resolve(null);
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => {
      const u = r.result;
      if (typeof u !== "string" || u.length > MAX_VIP_ATTACHMENT_BYTES) resolve(null);
      else resolve({ kind, url: u });
    };
    r.onerror = () => resolve(null);
    r.readAsDataURL(file);
  });
}

export function AdminVipGroupPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<VipAnnouncementDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const [pendingAttachment, setPendingAttachment] = useState<{ kind: "image" | "video" | "pdf"; url: string } | null>(null);
  const [attachLabel, setAttachLabel] = useState("");
  const [form, setForm] = useState({
    title: "",
    body: "",
    channel: "amazon" as (typeof CHANNELS)[number],
    audience: "all" as (typeof AUDIENCES)[number],
    pinned: false,
    active: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchAdminVipAnnouncements();
    setLoading(false);
    if (!r.ok) {
      toast.error(r.error);
      setRows([]);
      return;
    }
    setRows(r.announcements);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!form.title.trim() || (!form.body.trim() && !pendingAttachment)) {
      toast.error(t("admin.vip.formRequired"));
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        body: form.body.trim(),
        channel: form.channel,
        audience: form.audience,
        pinned: form.pinned,
        active: form.active,
      };
      if (pendingAttachment) payload.attachment = pendingAttachment;
      const r = await postAdminVipAnnouncement(payload);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(t("admin.vip.saved"));
      setForm({ title: "", body: "", channel: "amazon", audience: "all", pinned: false, active: true });
      setPendingAttachment(null);
      setAttachLabel("");
      if (attachInputRef.current) attachInputRef.current.value = "";
      await load();
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (a: VipAnnouncementDto) => {
    const r = await patchAdminVipAnnouncement(a.id, { ...a, active: !a.active });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    await load();
  };

  const remove = async (id: string) => {
    if (!window.confirm(t("admin.vip.deleteConfirm"))) return;
    const r = await deleteAdminVipAnnouncement(id);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(t("admin.vip.deleted"));
    await load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("admin.vip.eyebrow")}
        title={t("admin.vip.title")}
        subtitle={t("admin.vip.subtitle")}
        actions={
          <div className="flex gap-2">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50"
            >
              {t("admin.vip.refresh")}
            </button>
          </div>
        }
      />

      <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-zinc-900">{t("admin.vip.newPost")}</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <label className="block text-xs font-semibold text-zinc-600">
            {t("admin.vip.fieldTitle")}
            <input
              className="mt-1 w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </label>
          <label className="block text-xs font-semibold text-zinc-600">
            {t("admin.vip.fieldChannel")}
            <select
              className="mt-1 w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm"
              value={form.channel}
              onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value as (typeof CHANNELS)[number] }))}
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {t(`client.vip.channel.${c}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-zinc-600">
            {t("admin.vip.fieldAudience")}
            <select
              className="mt-1 w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm"
              value={form.audience}
              onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value as (typeof AUDIENCES)[number] }))}
            >
              {AUDIENCES.map((c) => (
                <option key={c} value={c}>
                  {t(`admin.vip.audience.${c}`)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-4 pt-6">
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700">
              <input type="checkbox" checked={form.pinned} onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))} />
              {t("admin.vip.fieldPinned")}
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
              {t("admin.vip.fieldActive")}
            </label>
          </div>
          <label className="block text-xs font-semibold text-zinc-600 lg:col-span-2">
            {t("admin.vip.fieldBody")}
            <textarea
              className="mt-1 min-h-[120px] w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            />
          </label>
          <div className="lg:col-span-2">
            <p className="text-xs font-semibold text-zinc-600">{t("admin.vip.attachmentLabel")}</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">{t("admin.vip.attachmentHint")}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                ref={attachInputRef}
                type="file"
                accept="image/*,video/*,.pdf,application/pdf"
                className="hidden"
                onChange={async (e: ChangeEvent<HTMLInputElement>) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const att = await readFileAsAttachment(f);
                  if (!att) {
                    toast.error(t("admin.vip.attachmentTooBig"));
                    return;
                  }
                  setPendingAttachment(att);
                  setAttachLabel(f.name);
                }}
              />
              <button
                type="button"
                onClick={() => attachInputRef.current?.click()}
                className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-100"
              >
                {t("admin.vip.attachmentLabel")}
              </button>
              {attachLabel ? (
                <span className="text-xs text-zinc-600">
                  {attachLabel}{" "}
                  <button
                    type="button"
                    className="font-semibold text-violet-700 hover:underline"
                    onClick={() => {
                      setPendingAttachment(null);
                      setAttachLabel("");
                      if (attachInputRef.current) attachInputRef.current.value = "";
                    }}
                  >
                    {t("admin.vip.attachmentClear")}
                  </button>
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void create()}
          className="mt-4 rounded-2xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {t("admin.vip.publish")}
        </button>
      </div>

      <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-zinc-900">{t("admin.vip.listTitle")}</h2>
        {loading ? (
          <p className="mt-4 text-sm text-zinc-600">{t("admin.vip.loading")}</p>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">{t("admin.vip.empty")}</p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-100">
            {rows.map((a) => (
              <li key={a.id} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-zinc-900">
                      {a.attachment ? <Paperclip className="size-4 shrink-0 text-violet-600" aria-hidden /> : null}
                      {a.title}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {a.id} · {t(`client.vip.channel.${a.channel}`)} · {t(`admin.vip.audience.${a.audience}`)}
                      {a.pinned ? ` · ${t("admin.vip.pinned")}` : ""}
                    </p>
                    <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-zinc-700">{a.body}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void toggleActive(a)}
                      className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-50"
                    >
                      {a.active ? t("admin.vip.deactivate") : t("admin.vip.activate")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(a.id)}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-900 hover:bg-rose-100"
                    >
                      {t("admin.vip.delete")}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
