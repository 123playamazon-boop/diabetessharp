import { useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, LineChart } from "lucide-react";
import { toast } from "sonner";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { PageHeader } from "../../ui/PageHeader";
import { useI18n } from "../../i18n/context";
import { type GrowthStrategyAiMode, type GrowthStrategyAiResult } from "../../../shared/growthStrategyAi";
import { postGrowthStrategyAi } from "../../lib/growthProgramApi";
import { cn } from "../../lib/cn";

const inputClass =
  "mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 text-sm text-ds-text shadow-ds placeholder:text-ds-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ds-primary";

export function ClientGrowthStrategyAiPage() {
  const { t } = useI18n();
  const [aiMode, setAiMode] = useState<GrowthStrategyAiMode>("growth_strategy");
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GrowthStrategyAiResult | null>(null);
  const [apiMode, setApiMode] = useState<"live" | "demo" | null>(null);
  const [warn, setWarn] = useState<string | null>(null);

  const run = async () => {
    const q = question.trim();
    if (!q) {
      toast.error(t("growth.strategyAi.validationQuestion"));
      return;
    }
    setBusy(true);
    setWarn(null);
    try {
      const ctx = context.trim();
      const r = await postGrowthStrategyAi({
        mode: aiMode,
        question: q,
        context: ctx || undefined,
      });
      if (!r.ok) {
        toast.error(r.error);
        setResult(null);
        setApiMode(null);
        return;
      }
      setResult(r.result);
      setApiMode(r.mode);
      if (r.warn) setWarn(r.warn);
      toast.success(r.mode === "live" ? t("growth.strategyAi.toastLive") : t("growth.strategyAi.toastDemo"));
    } finally {
      setBusy(false);
    }
  };

  const modeBtn = (mode: GrowthStrategyAiMode, icon: typeof LineChart) => {
    const Icon = icon;
    const active = aiMode === mode;
    return (
      <button
        key={mode}
        type="button"
        onClick={() => setAiMode(mode)}
        className={cn(
          "flex flex-1 flex-col gap-1 rounded-ds-btn border px-4 py-3 text-left text-sm transition sm:flex-row sm:items-center sm:gap-3",
          active ? "border-ds-primary bg-ds-primary/8 ring-1 ring-ds-primary/25" : "border-ds-border bg-ds-bg hover:border-ds-primary/30",
        )}
      >
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-ds-btn bg-ds-surface ring-1 ring-ds-border">
          <Icon className="size-4 text-ds-primary" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block font-bold text-ds-text">
            {mode === "growth_strategy" ? t("growth.strategyAi.modeGrowth") : t("growth.strategyAi.modeSales")}
          </span>
          <span className="mt-0.5 block text-xs leading-snug text-ds-muted">
            {mode === "growth_strategy" ? t("growth.strategyAi.modeGrowthHint") : t("growth.strategyAi.modeSalesHint")}
          </span>
        </span>
      </button>
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <PageHeader
        eyebrow={t("growth.strategyAi.eyebrow")}
        title={t("growth.strategyAi.title")}
        subtitle={t("growth.strategyAi.subtitle")}
        actions={<LanguageSwitcher />}
      />

      <p className="text-sm text-ds-muted">
        <Link to="/app/growth-program" className="font-semibold text-ds-primary underline-offset-2 hover:underline">
          {t("growth.strategyAi.backLanding")}
        </Link>
        {" · "}
        <Link to="/app/growth-program/dashboard" className="font-semibold text-ds-primary underline-offset-2 hover:underline">
          {t("growth.strategyAi.backDashboard")}
        </Link>
      </p>

      <p className="rounded-ds-btn border border-ds-border bg-ds-bg px-4 py-3 text-xs font-semibold leading-relaxed text-ds-text ring-1 ring-black/[0.03]">
        {t("growth.strategyAi.notChatbot")}
      </p>

      <section className="space-y-4 rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-ds-muted">{t("growth.strategyAi.modeLabel")}</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            {modeBtn("growth_strategy", LineChart)}
            {modeBtn("sales_consultant", Briefcase)}
          </div>
        </div>

        <div>
          <label htmlFor="gsai-q" className="text-xs font-black uppercase tracking-wide text-ds-muted">
            {t("growth.strategyAi.questionLabel")}
          </label>
          <textarea
            id="gsai-q"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={5}
            placeholder={t("growth.strategyAi.questionPh")}
            className={cn(inputClass, "min-h-[120px] resize-y")}
          />
        </div>
        <div>
          <label htmlFor="gsai-ctx" className="text-xs font-black uppercase tracking-wide text-ds-muted">
            {t("growth.strategyAi.contextLabel")}
          </label>
          <textarea
            id="gsai-ctx"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={2}
            placeholder={t("growth.strategyAi.contextPh")}
            className={cn(inputClass, "min-h-[72px] resize-y")}
          />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run()}
          className="w-full rounded-ds-btn bg-ds-primary px-4 py-3 text-sm font-black uppercase tracking-wide text-white shadow-ds transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {busy ? t("common.loading") : t("growth.strategyAi.submit")}
        </button>
      </section>

      {apiMode ? (
        <div
          className={cn(
            "rounded-ds-btn border px-4 py-3 text-sm leading-relaxed",
            apiMode === "demo" ? "border-amber-300/80 bg-amber-50/85 text-amber-950" : "border-emerald-300/80 bg-emerald-50/85 text-emerald-950",
          )}
        >
          {apiMode === "demo" ? t("growth.strategyAi.demoBanner") : t("growth.strategyAi.liveBanner")}
        </div>
      ) : null}

      {warn ? (
        <p className="rounded-ds-btn border border-ds-border bg-ds-bg px-4 py-3 text-sm text-ds-text">
          <span className="font-semibold">{t("growth.strategyAi.warnFallback")}</span> {warn}
        </p>
      ) : null}

      {result ? (
        <div className="space-y-5">
          <section className="rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds">
            <h2 className="text-[11px] font-black uppercase tracking-wide text-ds-muted">{t("growth.strategyAi.sectionDiagnosis")}</h2>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-ds-text">{result.diagnosis}</p>
          </section>
          <section className="rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds">
            <h2 className="text-[11px] font-black uppercase tracking-wide text-ds-muted">{t("growth.strategyAi.sectionMarket")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ds-text">{result.marketReality}</p>
          </section>
          <section className="rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds">
            <h2 className="text-[11px] font-black uppercase tracking-wide text-ds-muted">{t("growth.strategyAi.sectionActions")}</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ds-text">
              {result.actionSteps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </section>
          {result.scalingStrategy?.trim() ? (
            <section className="rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds">
              <h2 className="text-[11px] font-black uppercase tracking-wide text-ds-muted">{t("growth.strategyAi.sectionScaling")}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ds-text">{result.scalingStrategy}</p>
            </section>
          ) : (
            <p className="text-xs text-ds-muted">{t("growth.strategyAi.scalingEmpty")}</p>
          )}
          <section className="rounded-ds-card border border-ds-border bg-ds-bg/60 p-5 shadow-ds ring-1 ring-ds-border/60">
            <h2 className="text-[11px] font-black uppercase tracking-wide text-ds-muted">{t("growth.strategyAi.sectionMemo")}</h2>
            <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ds-text">{result.executiveMemo}</div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
