import { useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { PageHeader } from "../../ui/PageHeader";
import { useI18n } from "../../i18n/context";
import { LISTING_PLATFORM_IDS, type ListingPlatformId } from "../../../shared/listingGenerator";
import { isValidHttpListingUrl } from "../../../shared/listingUrlInput";
import type { ListingAnalysisResult, ListingAnalysisWeakSeverity } from "../../../shared/listingAnalysis";
import { postListingAnalysis } from "../../lib/listingAnalysisApi";
import { cn } from "../../lib/cn";

const inputClass =
  "mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 text-sm text-ds-text shadow-ds placeholder:text-ds-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ds-primary";

const defaultPlatform: ListingPlatformId = "amazon_us";

type InputTab = "url" | "paste";

function severityBorder(sev: ListingAnalysisWeakSeverity): string {
  if (sev === "high") return "border-l-ds-error bg-red-50/50 ring-red-200/60";
  if (sev === "medium") return "border-l-amber-500 bg-amber-50/40 ring-amber-200/60";
  return "border-l-zinc-300 bg-zinc-50/80 ring-zinc-200/70";
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(10, Math.round(value)));
  return (
    <div className="rounded-ds-btn border border-ds-border bg-ds-bg/80 p-4 shadow-ds">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-ds-muted">{label}</span>
        <span className="text-lg font-black tabular-nums text-ds-text">{v}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-ds-border/80">
        <div className="h-full rounded-full bg-ds-primary transition-[width] duration-500" style={{ width: `${v * 10}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-ds-muted">0–10</p>
    </div>
  );
}

export function ClientListingAnalysisPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<InputTab>("url");
  const [listingUrl, setListingUrl] = useState("");
  const [platform, setPlatform] = useState<ListingPlatformId>(defaultPlatform);
  const [title, setTitle] = useState("");
  const [bullets, setBullets] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState<ListingAnalysisResult | null>(null);
  const [mode, setMode] = useState<"live" | "demo" | null>(null);
  const [warn, setWarn] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setWarn(null);
    try {
      if (tab === "url") {
        const u = listingUrl.trim();
        if (!isValidHttpListingUrl(u)) {
          toast.error(t("client.listingAnalysis.validationUrl"));
          setBusy(false);
          return;
        }
        const r = await postListingAnalysis({ platform, listingUrl: u });
        if (!r.ok) {
          toast.error(r.error);
          setAnalysis(null);
          setMode(null);
          return;
        }
        setAnalysis(r.analysis);
        setMode(r.mode);
        if (r.warn) setWarn(r.warn);
        toast.success(r.mode === "live" ? t("client.listingAnalysis.toastLive") : t("client.listingAnalysis.toastDemo"));
        return;
      }

      if (!title.trim() && !bullets.trim() && !description.trim()) {
        toast.error(t("client.listingAnalysis.validationEmpty"));
        setBusy(false);
        return;
      }
      const r = await postListingAnalysis({ platform, title, bullets, description });
      if (!r.ok) {
        toast.error(r.error);
        setAnalysis(null);
        setMode(null);
        return;
      }
      setAnalysis(r.analysis);
      setMode(r.mode);
      if (r.warn) setWarn(r.warn);
      toast.success(r.mode === "live" ? t("client.listingAnalysis.toastLive") : t("client.listingAnalysis.toastDemo"));
    } finally {
      setBusy(false);
    }
  };

  const tabBtn = (id: InputTab, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      className={cn(
        "rounded-ds-btn px-3 py-2 text-xs font-bold uppercase tracking-wide transition",
        tab === id ? "bg-ds-primary text-white shadow-ds" : "bg-ds-bg text-ds-muted ring-1 ring-ds-border hover:text-ds-text",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow={t("client.listingAnalysis.eyebrow")}
        title={t("client.listingAnalysis.title")}
        subtitle={t("client.listingAnalysis.subtitle")}
        actions={<LanguageSwitcher />}
      />

      <p className="text-sm text-ds-muted">
        <Link to="/app/dashboard" className="font-semibold text-ds-primary underline-offset-2 hover:underline">
          {t("client.listingAnalysis.backDashboard")}
        </Link>
        {" · "}
        <Link to="/app/tools" className="font-semibold text-ds-primary underline-offset-2 hover:underline">
          {t("client.listingAnalysis.linkTools")}
        </Link>
        {" · "}
        <Link to="/app/listing-generator" className="font-semibold text-ds-primary underline-offset-2 hover:underline">
          {t("client.listingAnalysis.linkGenerator")}
        </Link>
      </p>

      <div className="rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds">
        <div className="flex flex-wrap gap-2" role="tablist">
          {tabBtn("url", t("client.listingAnalysis.tabUrl"))}
          {tabBtn("paste", t("client.listingAnalysis.tabPaste"))}
        </div>

        <div className="mt-4 grid gap-4">
          <label className="block text-xs font-bold uppercase tracking-wide text-ds-muted">
            {t("client.listingAnalysis.platformLabel")}
            <select className={inputClass} value={platform} onChange={(e) => setPlatform(e.target.value as ListingPlatformId)}>
              {LISTING_PLATFORM_IDS.map((id) => (
                <option key={id} value={id}>
                  {t(`client.listingGenerator.platform.${id}`)}
                </option>
              ))}
            </select>
          </label>

          {tab === "url" ? (
            <label className="block text-xs font-bold uppercase tracking-wide text-ds-muted">
              {t("client.listingAnalysis.listingUrlLabel")}
              <input
                className={inputClass}
                value={listingUrl}
                onChange={(e) => setListingUrl(e.target.value)}
                placeholder={t("client.listingGenerator.improveUrlPh")}
                inputMode="url"
                autoComplete="url"
                maxLength={2048}
              />
            </label>
          ) : (
            <>
              <label className="block text-xs font-bold uppercase tracking-wide text-ds-muted">
                {t("client.listingAnalysis.titleLabel")}
                <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("client.listingAnalysis.titlePh")} maxLength={2000} />
              </label>

              <label className="block text-xs font-bold uppercase tracking-wide text-ds-muted">
                {t("client.listingAnalysis.bulletsLabel")}
                <textarea
                  className={`${inputClass} min-h-[140px] resize-y font-mono text-xs`}
                  value={bullets}
                  onChange={(e) => setBullets(e.target.value)}
                  placeholder={t("client.listingAnalysis.bulletsPh")}
                  maxLength={12000}
                />
              </label>

              <label className="block text-xs font-bold uppercase tracking-wide text-ds-muted">
                {t("client.listingAnalysis.descriptionLabel")}
                <textarea className={`${inputClass} min-h-[160px] resize-y`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("client.listingAnalysis.descriptionPh")} maxLength={24000} />
              </label>
            </>
          )}
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void run()}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-ds-btn bg-ds-primary px-4 py-3 text-sm font-bold text-white shadow-ds hover:opacity-95 disabled:opacity-50 sm:w-auto"
        >
          <ClipboardCheck className="size-4" aria-hidden />
          {busy ? t("common.loading") : t("client.listingAnalysis.submit")}
        </button>
      </div>

      {mode === "demo" && !warn ? (
        <div className="rounded-ds-card border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm text-amber-950">{t("client.listingAnalysis.demoBanner")}</div>
      ) : null}
      {mode === "live" ? (
        <div className="rounded-ds-card border border-emerald-200/90 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">{t("client.listingAnalysis.liveBanner")}</div>
      ) : null}
      {warn ? (
        <div className="rounded-ds-card border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {t("client.listingAnalysis.warnFallback")} <span className="font-mono text-xs opacity-90">{warn}</span>
        </div>
      ) : null}

      {analysis ? (
        <section className="space-y-6" aria-labelledby="analysis-out-heading">
          <h2 id="analysis-out-heading" className="flex items-center gap-2 text-lg font-bold tracking-tight text-ds-text">
            <Sparkles className="size-5 text-ds-primary" aria-hidden />
            {t("client.listingAnalysis.outputTitle")}
          </h2>

          <div className="grid gap-3 sm:grid-cols-3">
            <ScoreRow label={t("client.listingAnalysis.scoreSeo")} value={analysis.seoScore} />
            <ScoreRow label={t("client.listingAnalysis.scoreConversion")} value={analysis.conversionScore} />
            <ScoreRow label={t("client.listingAnalysis.scoreCompliance")} value={analysis.complianceScore} />
          </div>

          {analysis.weakAreas.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-ds-muted">{t("client.listingAnalysis.weakTitle")}</h3>
              <ul className="space-y-2">
                {analysis.weakAreas.map((w, idx) => (
                  <li
                    key={`${idx}-${w.label}`}
                    className={cn("rounded-ds-btn border border-l-4 border-ds-border p-3 text-sm shadow-ds ring-1", severityBorder(w.severity))}
                  >
                    <span className="font-bold text-ds-text">{w.label}</span>
                    <span className="ml-2 text-[11px] font-bold uppercase tracking-wide text-ds-muted">({w.severity})</span>
                    <p className="mt-1 leading-relaxed text-ds-text">{w.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-ds-muted">{t("client.listingAnalysis.suggestionsTitle")}</h3>
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ds-text">
              {analysis.suggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}
    </div>
  );
}
