import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { PageHeader } from "../../ui/PageHeader";
import { useI18n } from "../../i18n/context";
import { LISTING_ADAPTER_PLATFORM_IDS, type AdaptedListingFields } from "../../../shared/listingMultiPlatform";
import { postListingMultiPlatform } from "../../lib/listingMultiPlatformApi";
import { cn } from "../../lib/cn";

const inputClass =
  "mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 text-sm text-ds-text shadow-ds placeholder:text-ds-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ds-primary";

function formatListingBlock(v: AdaptedListingFields): string {
  const lines: string[] = [];
  if (v.hook) lines.push(v.hook, "");
  lines.push(v.title, "");
  if (v.subheadline) lines.push(v.subheadline, "");
  lines.push(...v.bulletPoints.map((b) => `• ${b}`), "", v.description);
  if (v.callToAction) lines.push("", `CTA: ${v.callToAction}`);
  lines.push("", `Keywords: ${v.keywords}`);
  return lines.join("\n");
}

function CopyRow({ label, text, activeKey, rowKey, onCopy }: { label: string; text: string; activeKey: string | null; rowKey: string; onCopy: (k: string, t: string) => void }) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-ds-border py-2 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-wide text-ds-muted">{label}</p>
        <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-sm text-ds-text">{text}</pre>
      </div>
      <button
        type="button"
        onClick={() => void onCopy(rowKey, text)}
        className="inline-flex shrink-0 items-center gap-1 rounded-ds-btn border border-ds-border bg-ds-surface px-2 py-1.5 text-xs font-bold uppercase tracking-wide shadow-ds hover:bg-ds-bg"
        aria-label={label}
      >
        {activeKey === rowKey ? <Check className="size-3.5 text-ds-success" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      </button>
    </div>
  );
}

export function ClientListingMultiPlatformPage() {
  const { t } = useI18n();
  const [listingText, setListingText] = useState("");
  const [busy, setBusy] = useState(false);
  const [versions, setVersions] = useState<Record<(typeof LISTING_ADAPTER_PLATFORM_IDS)[number], AdaptedListingFields> | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [mode, setMode] = useState<"live" | "demo" | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const onCopy = useCallback(
    async (key: string, text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(key);
        window.setTimeout(() => setCopied(null), 2000);
        toast.success(t("client.listingGenerator.copied"));
      } catch {
        toast.error(t("client.listingGenerator.copyFail"));
      }
    },
    [t],
  );

  const run = async () => {
    if (!listingText.trim()) {
      toast.error(t("client.listingMultiPlatform.validationEmpty"));
      return;
    }
    setBusy(true);
    setWarn(null);
    try {
      const r = await postListingMultiPlatform(listingText);
      if (!r.ok) {
        toast.error(r.error);
        setVersions(null);
        setSummary(null);
        setMode(null);
        return;
      }
      setVersions(r.adapter.versions);
      setSummary(r.adapter.summary ?? null);
      setMode(r.mode);
      if (r.warn) setWarn(r.warn);
      toast.success(r.mode === "live" ? t("client.listingMultiPlatform.toastLive") : t("client.listingMultiPlatform.toastDemo"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24">
      <PageHeader
        eyebrow={t("client.listingMultiPlatform.eyebrow")}
        title={t("client.listingMultiPlatform.title")}
        subtitle={t("client.listingMultiPlatform.subtitle")}
        actions={<LanguageSwitcher />}
      />

      <p className="text-sm text-ds-muted">
        <Link to="/app/dashboard" className="font-semibold text-ds-primary underline-offset-2 hover:underline">
          {t("client.listingMultiPlatform.backDashboard")}
        </Link>
        {" · "}
        <Link to="/app/tools" className="font-semibold text-ds-primary underline-offset-2 hover:underline">
          {t("client.listingMultiPlatform.linkTools")}
        </Link>
        {" · "}
        <Link to="/app/listing-compliance" className="font-semibold text-ds-primary underline-offset-2 hover:underline">
          {t("client.listingMultiPlatform.linkCompliance")}
        </Link>
        {" · "}
        <Link to="/app/improve-listing" className="font-semibold text-ds-primary underline-offset-2 hover:underline">
          {t("client.listingMultiPlatform.linkImprove")}
        </Link>
      </p>

      <div className="rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds">
        <label className="block text-xs font-bold uppercase tracking-wide text-ds-muted">
          {t("client.listingMultiPlatform.textLabel")}
          <textarea
            className={`${inputClass} min-h-[200px] resize-y font-mono text-xs`}
            value={listingText}
            onChange={(e) => setListingText(e.target.value)}
            placeholder={t("client.listingMultiPlatform.textPh")}
          />
        </label>
        <p className="mt-2 text-xs text-ds-muted">{t("client.listingMultiPlatform.focusNote")}</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run()}
          className="mt-4 inline-flex items-center justify-center rounded-ds-btn bg-ds-primary px-4 py-2.5 text-sm font-bold text-white shadow-ds hover:opacity-95 disabled:opacity-50"
        >
          {busy ? t("common.loading") : t("client.listingMultiPlatform.submit")}
        </button>
      </div>

      {mode === "demo" ? (
        <div className="rounded-ds-card border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm text-amber-950">{t("client.listingMultiPlatform.demoBanner")}</div>
      ) : null}
      {mode === "live" ? (
        <div className="rounded-ds-card border border-emerald-200/90 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">{t("client.listingMultiPlatform.liveBanner")}</div>
      ) : null}
      {warn ? (
        <div className="rounded-ds-card border border-ds-border bg-ds-bg px-4 py-3 text-sm text-ds-text">
          {t("client.listingMultiPlatform.warnFallback")} <span className="font-mono text-xs opacity-90">{warn}</span>
        </div>
      ) : null}

      {summary ? <p className="text-sm text-ds-muted">{summary}</p> : null}

      {versions ? (
        <div className="space-y-6">
          {LISTING_ADAPTER_PLATFORM_IDS.map((platformId) => {
            const v = versions[platformId];
            const platformLabel = t(`client.listingGenerator.platform.${platformId}`);
            const allKey = `all:${platformId}`;
            return (
              <section
                key={platformId}
                className={cn("rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds", "ring-1 ring-ds-border/60")}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-ds-text">{platformLabel}</h2>
                  <button
                    type="button"
                    onClick={() => void onCopy(allKey, formatListingBlock(v))}
                    className="inline-flex items-center gap-1.5 rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-1.5 text-xs font-bold uppercase tracking-wide shadow-ds hover:bg-ds-surface"
                  >
                    {copied === allKey ? <Check className="size-3.5 text-ds-success" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
                    {t("client.listingMultiPlatform.copyAll")}
                  </button>
                </div>

                <div className="mt-3 divide-y divide-ds-border rounded-ds-btn border border-ds-border bg-ds-bg/50 px-3">
                  {v.hook ? <CopyRow label={t("client.listingGenerator.tiktokHookLabel")} text={v.hook} activeKey={copied} rowKey={`${platformId}:hook`} onCopy={onCopy} /> : null}
                  <CopyRow label={t("client.listingGenerator.sectionTitle")} text={v.title} activeKey={copied} rowKey={`${platformId}:title`} onCopy={onCopy} />
                  {v.subheadline ? (
                    <CopyRow label={t("client.listingGenerator.shopifySubheadlineLabel")} text={v.subheadline} activeKey={copied} rowKey={`${platformId}:sub`} onCopy={onCopy} />
                  ) : null}
                  {v.callToAction ? (
                    <CopyRow label={t("client.listingGenerator.shopifyCtaLabel")} text={v.callToAction} activeKey={copied} rowKey={`${platformId}:cta`} onCopy={onCopy} />
                  ) : null}
                  <div className="py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-ds-muted">{t("client.listingMultiPlatform.bulletsLabel")}</p>
                      <button
                        type="button"
                        onClick={() => void onCopy(`${platformId}:bullets`, v.bulletPoints.map((b) => `• ${b}`).join("\n"))}
                        className="inline-flex shrink-0 items-center gap-1 rounded-ds-btn border border-ds-border bg-ds-surface px-2 py-1 text-xs font-bold uppercase tracking-wide shadow-ds hover:bg-ds-bg"
                      >
                        {copied === `${platformId}:bullets` ? <Check className="size-3.5 text-ds-success" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
                      </button>
                    </div>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ds-text">
                      {v.bulletPoints.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </div>
                  <CopyRow
                    label={t("client.listingGenerator.sectionDescription")}
                    text={v.description}
                    activeKey={copied}
                    rowKey={`${platformId}:desc`}
                    onCopy={onCopy}
                  />
                  <CopyRow
                    label={
                      platformId === "amazon_us"
                        ? t("client.listingGenerator.sectionKeywordsAmazon")
                        : t("client.listingGenerator.sectionKeywords")
                    }
                    text={v.keywords}
                    activeKey={copied}
                    rowKey={`${platformId}:kw`}
                    onCopy={onCopy}
                  />
                </div>
              </section>
            );
          })}
        </div>
      ) : null}

      <p className="text-xs text-ds-muted">{t("client.listingMultiPlatform.disclaimer")}</p>
    </div>
  );
}
