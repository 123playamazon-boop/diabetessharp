import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { PageHeader } from "../../ui/PageHeader";
import { useI18n } from "../../i18n/context";
import type { ListingComplianceViolation } from "../../../shared/listingCompliance";
import { postListingCompliance } from "../../lib/listingComplianceApi";
import { listingTextFromExcelArrayBuffer } from "../../lib/complianceExcelImport";
import { LISTING_COMPLIANCE_PRESETS } from "../../lib/listingCompliancePresets";
import { isValidHttpListingUrl } from "../../../shared/listingUrlInput";
import { cn } from "../../lib/cn";

const inputClass =
  "mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 text-sm text-ds-text shadow-ds placeholder:text-ds-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ds-primary";

type InputTab = "url" | "text" | "preset" | "excel";

function severityRowClass(sev: ListingComplianceViolation["severity"]): string {
  if (sev === "high") return "border-l-ds-error bg-red-50/60 ring-red-200/50";
  if (sev === "medium") return "border-l-amber-500 bg-amber-50/50 ring-amber-200/50";
  return "border-l-zinc-300 bg-zinc-50/90 ring-zinc-200/60";
}

export function ClientListingCompliancePage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<InputTab>("url");
  const [listingUrl, setListingUrl] = useState("");
  const [listingText, setListingText] = useState("");
  const [presetId, setPresetId] = useState(LISTING_COMPLIANCE_PRESETS[0]?.id ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [violations, setViolations] = useState<ListingComplianceViolation[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [mode, setMode] = useState<"live" | "demo" | null>(null);
  const [warn, setWarn] = useState<string | null>(null);

  const run = async () => {
    if (tab === "url") {
      const u = listingUrl.trim();
      if (!u) {
        toast.error(t("client.listingCompliance.validationUrlEmpty"));
        return;
      }
      if (!isValidHttpListingUrl(u)) {
        toast.error(t("client.listingCompliance.validationUrlInvalid"));
        return;
      }
      setBusy(true);
      setWarn(null);
      try {
        const r = await postListingCompliance({ listingUrl: u });
        if (!r.ok) {
          toast.error(r.error);
          setViolations(null);
          setSummary(null);
          setMode(null);
          return;
        }
        setViolations(r.compliance.violations);
        setSummary(r.compliance.summary ?? null);
        setMode(r.mode);
        if (r.warn) setWarn(r.warn);
        toast.success(r.mode === "live" ? t("client.listingCompliance.toastLive") : t("client.listingCompliance.toastDemo"));
      } finally {
        setBusy(false);
      }
      return;
    }

    let text = listingText.trim();
    if (tab === "preset") {
      const p = LISTING_COMPLIANCE_PRESETS.find((x) => x.id === presetId);
      text = p?.text.trim() ?? "";
      if (!text) {
        toast.error(t("client.listingCompliance.validationEmpty"));
        return;
      }
    }

    if (!text) {
      toast.error(t("client.listingCompliance.validationEmpty"));
      return;
    }

    setBusy(true);
    setWarn(null);
    try {
      const r = await postListingCompliance({ listingText: text });
      if (!r.ok) {
        toast.error(r.error);
        setViolations(null);
        setSummary(null);
        setMode(null);
        return;
      }
      setViolations(r.compliance.violations);
      setSummary(r.compliance.summary ?? null);
      setMode(r.mode);
      if (r.warn) setWarn(r.warn);
      toast.success(r.mode === "live" ? t("client.listingCompliance.toastLive") : t("client.listingCompliance.toastDemo"));
    } finally {
      setBusy(false);
    }
  };

  const onExcelPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const txt = listingTextFromExcelArrayBuffer(buf);
      if (!txt) {
        toast.error(t("client.listingCompliance.excelEmpty"));
        return;
      }
      setListingText(txt);
      toast.success(t("client.listingCompliance.excelLoaded"));
    } catch {
      toast.error(t("client.listingCompliance.excelFail"));
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
        eyebrow={t("client.listingCompliance.eyebrow")}
        title={t("client.listingCompliance.title")}
        subtitle={t("client.listingCompliance.subtitle")}
        actions={<LanguageSwitcher />}
      />

      <p className="text-sm text-ds-muted">
        <Link to="/app/dashboard" className="font-semibold text-ds-primary underline-offset-2 hover:underline">
          {t("client.listingCompliance.backDashboard")}
        </Link>
        {" · "}
        <Link to="/app/tools" className="font-semibold text-ds-primary underline-offset-2 hover:underline">
          {t("client.listingCompliance.linkTools")}
        </Link>
        {" · "}
        <Link to="/app/improve-listing" className="font-semibold text-ds-primary underline-offset-2 hover:underline">
          {t("client.listingCompliance.linkImprove")}
        </Link>
      </p>

      <div className="rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("client.listingCompliance.inputModeLabel")}>
          {tabBtn("url", t("client.listingCompliance.tabUrl"))}
          {tabBtn("text", t("client.listingCompliance.tabText"))}
          {tabBtn("preset", t("client.listingCompliance.tabPreset"))}
          {tabBtn("excel", t("client.listingCompliance.tabExcel"))}
        </div>

        <div className="mt-4 space-y-4">
          {tab === "url" ? (
            <label className="block text-xs font-bold uppercase tracking-wide text-ds-muted">
              {t("client.listingCompliance.urlLabel")}
              <input
                className={inputClass}
                value={listingUrl}
                onChange={(e) => setListingUrl(e.target.value)}
                placeholder={t("client.listingCompliance.urlPh")}
                inputMode="url"
                autoComplete="url"
                maxLength={2048}
              />
            </label>
          ) : null}

          {tab === "text" ? (
            <label className="block text-xs font-bold uppercase tracking-wide text-ds-muted">
              {t("client.listingCompliance.textLabel")}
              <textarea
                className={`${inputClass} min-h-[220px] resize-y font-mono text-xs`}
                value={listingText}
                onChange={(e) => setListingText(e.target.value)}
                placeholder={t("client.listingCompliance.textPh")}
                maxLength={48000}
              />
            </label>
          ) : null}

          {tab === "excel" ? (
            <div className="space-y-3">
              <div className="rounded-ds-btn border border-ds-border bg-ds-bg/80 p-4">
                <p className="text-sm text-ds-muted">{t("client.listingCompliance.excelHint")}</p>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="sr-only" onChange={(e) => void onExcelPick(e)} />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mt-3 inline-flex items-center gap-2 rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 text-sm font-bold text-ds-text shadow-ds hover:bg-ds-bg"
                >
                  <Upload className="size-4" aria-hidden />
                  {t("client.listingCompliance.excelPick")}
                </button>
              </div>
              <label className="block text-xs font-bold uppercase tracking-wide text-ds-muted">
                {t("client.listingCompliance.excelPreviewLabel")}
                <textarea
                  className={`${inputClass} min-h-[200px] resize-y font-mono text-xs`}
                  value={listingText}
                  onChange={(e) => setListingText(e.target.value)}
                  placeholder={t("client.listingCompliance.excelPreviewPh")}
                  maxLength={48000}
                />
              </label>
            </div>
          ) : null}

          {tab === "preset" ? (
            <label className="block text-xs font-bold uppercase tracking-wide text-ds-muted">
              {t("client.listingCompliance.presetLabel")}
              <select className={inputClass} value={presetId} onChange={(e) => setPresetId(e.target.value)}>
                {LISTING_COMPLIANCE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {t(p.labelKey)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <p className="mt-2 text-xs text-ds-muted">{t("client.listingCompliance.focusNote")}</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run()}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-ds-btn bg-ds-primary px-4 py-3 text-sm font-bold text-white shadow-ds hover:opacity-95 disabled:opacity-50 sm:w-auto"
        >
          <ShieldAlert className="size-4" aria-hidden />
          {busy ? t("common.loading") : t("client.listingCompliance.submit")}
        </button>
      </div>

      {mode === "demo" && !warn ? (
        <div className="rounded-ds-card border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm text-amber-950">{t("client.listingCompliance.demoBanner")}</div>
      ) : null}
      {mode === "live" ? (
        <div className="rounded-ds-card border border-emerald-200/90 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">{t("client.listingCompliance.liveBanner")}</div>
      ) : null}
      {warn ? (
        <div className="rounded-ds-card border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {t("client.listingCompliance.warnFallback")} <span className="font-mono text-xs opacity-90">{warn}</span>
        </div>
      ) : null}

      {summary ? <p className="text-sm leading-relaxed text-ds-text">{summary}</p> : null}

      {violations && violations.length > 0 ? (
        <section className="space-y-3" aria-labelledby="compliance-results">
          <h2 id="compliance-results" className="text-lg font-bold tracking-tight text-ds-text">
            {t("client.listingCompliance.resultsTitle")}
          </h2>
          <ul className="space-y-3">
            {violations.map((v, i) => (
              <li
                key={`${i}-${v.phrase.slice(0, 32)}`}
                className={cn("rounded-ds-btn border border-l-4 border-ds-border p-4 text-sm shadow-ds ring-1", severityRowClass(v.severity))}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono text-xs font-bold uppercase tracking-wide text-ds-muted">{t("client.listingCompliance.colPhrase")}</span>
                  <span className="text-[11px] font-bold uppercase text-ds-muted">({v.severity})</span>
                </div>
                <p className="mt-1 font-semibold text-ds-text">{v.phrase}</p>
                <p className="mt-2 text-xs font-bold uppercase tracking-wide text-ds-muted">{t("client.listingCompliance.colRisk")}</p>
                <p className="mt-0.5 leading-relaxed text-ds-text">{v.risk}</p>
                <p className="mt-2 text-xs font-bold uppercase tracking-wide text-ds-muted">{t("client.listingCompliance.colReplace")}</p>
                <p className="mt-0.5 leading-relaxed text-ds-text">{v.replacement}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : violations && violations.length === 0 ? (
        <p className="rounded-ds-card border border-emerald-200/80 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-950">{t("client.listingCompliance.noneFound")}</p>
      ) : null}
    </div>
  );
}
