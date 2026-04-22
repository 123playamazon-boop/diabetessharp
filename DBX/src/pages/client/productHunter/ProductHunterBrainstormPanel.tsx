import { useState } from "react";
import { toast } from "sonner";
import { Radar } from "lucide-react";
import { useI18n } from "../../../i18n/context";
import {
  PRODUCT_HUNTER_EXPERIENCE_LEVELS,
  PRODUCT_HUNTER_MARKETPLACES,
  type ProductHunterExperienceLevel,
  type ProductHunterIdea,
  type ProductHunterMarketplaceId,
  type ProductHunterResult,
} from "../../../../shared/productHunter";
import { postProductHunter, saveProductHunterCandidates } from "../../../lib/productHunterApi";
import { cn } from "../../../lib/cn";

const inputClass =
  "mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 text-sm text-ds-text shadow-ds placeholder:text-ds-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ds-primary";

const defaultMarketplace: ProductHunterMarketplaceId = "amazon_us";
const defaultExperience: ProductHunterExperienceLevel = "intermediate";

function levelPillClass(kind: "demand" | "competition", level: string): string {
  const high = kind === "demand" ? "bg-emerald-600/15 text-emerald-800 ring-emerald-600/25" : "bg-rose-600/12 text-rose-900 ring-rose-600/25";
  const med = "bg-amber-500/15 text-amber-900 ring-amber-600/25";
  const low = kind === "demand" ? "bg-zinc-500/10 text-zinc-700 ring-zinc-400/30" : "bg-emerald-600/12 text-emerald-900 ring-emerald-600/20";
  if (level === "high") return high;
  if (level === "low") return low;
  return med;
}

function ScoreBadge({ score }: { score: number }) {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-wide text-ds-muted">Score</span>
      <span className="text-2xl font-black tabular-nums text-ds-primary">{s}</span>
      <span className="text-[10px] text-ds-muted">0–100</span>
    </div>
  );
}

function ProductCard({
  product,
  onSave,
  saving,
}: {
  product: ProductHunterIdea;
  onSave: () => void;
  saving: boolean;
}) {
  const { t } = useI18n();
  return (
    <article className="rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds ring-1 ring-black/[0.02]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <h3 className="text-base font-bold leading-snug text-ds-text">{product.idea}</h3>
          <div className="flex flex-wrap gap-2">
            <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1", levelPillClass("demand", product.demandLevel))}>
              {t("client.productHunter.demand")}: {t(`client.productHunter.level.${product.demandLevel}`)}
            </span>
            <span
              className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1", levelPillClass("competition", product.competitionLevel))}
            >
              {t("client.productHunter.competition")}: {t(`client.productHunter.level.${product.competitionLevel}`)}
            </span>
            <span className="rounded-full bg-ds-bg px-2.5 py-0.5 text-[11px] font-semibold text-ds-text ring-1 ring-ds-border">
              {t("client.productHunter.margin")}: {product.estimatedProfitMargin}
            </span>
          </div>
        </div>
        <ScoreBadge score={product.opportunityScore} />
      </div>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">{t("client.productHunter.bestMarketplace")}</dt>
          <dd className="mt-0.5 font-semibold text-ds-text">{product.bestMarketplace}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">{t("client.productHunter.logistics")}</dt>
          <dd className="mt-0.5 leading-relaxed text-ds-text">{product.logisticsFeasibility}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">{t("client.productHunter.whyTrending")}</dt>
          <dd className="mt-0.5 leading-relaxed text-ds-text">{product.whyTrending}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">{t("client.productHunter.strategy")}</dt>
          <dd className="mt-0.5 leading-relaxed text-ds-text">{product.sellingStrategy}</dd>
        </div>
      </dl>
      <div className="mt-4 border-t border-ds-border pt-4">
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave()}
          className="rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-2 text-xs font-bold uppercase tracking-wide text-ds-text shadow-ds hover:bg-ds-surface disabled:opacity-50"
        >
          {t("client.productHunter.saveCandidate")}
        </button>
      </div>
    </article>
  );
}

type Props = {
  onCandidatesChanged?: () => void;
};

export function ProductHunterBrainstormPanel({ onCandidatesChanged }: Props) {
  const { t, locale } = useI18n();
  const [budget, setBudget] = useState("");
  const [marketplace, setMarketplace] = useState<ProductHunterMarketplaceId>(defaultMarketplace);
  const [experience, setExperience] = useState<ProductHunterExperienceLevel>(defaultExperience);
  const [busy, setBusy] = useState(false);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [hunter, setHunter] = useState<ProductHunterResult | null>(null);
  const [mode, setMode] = useState<"live" | "demo" | null>(null);
  const [warn, setWarn] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setWarn(null);
    try {
      const b = budget.trim();
      if (!b) {
        toast.error(t("client.productHunter.validationBudget"));
        return;
      }
      const r = await postProductHunter({ budget: b, marketplace, experienceLevel: experience, locale });
      if (!r.ok) {
        toast.error(r.error);
        setHunter(null);
        setMode(null);
        return;
      }
      setHunter(r.hunter);
      setMode(r.mode);
      if (r.warn) setWarn(r.warn);
      toast.success(r.mode === "live" ? t("client.productHunter.toastLive") : t("client.productHunter.toastDemo"));
    } finally {
      setBusy(false);
    }
  };

  const saveIdea = async (idx: number) => {
    if (!hunter?.products[idx]) return;
    setSavingIdx(idx);
    try {
      const r = await saveProductHunterCandidates({ ideas: [hunter.products[idx]], source: "hunter_run" });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(t("client.productHunter.savedCandidateToast"));
      onCandidatesChanged?.();
    } finally {
      setSavingIdx(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds">
        <div className="space-y-4">
          <div>
            <label htmlFor="ph-budget" className="text-xs font-bold uppercase tracking-wide text-ds-muted">
              {t("client.productHunter.budgetLabel")}
            </label>
            <textarea
              id="ph-budget"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              rows={3}
              placeholder={t("client.productHunter.budgetPh")}
              className={cn(inputClass, "min-h-[88px] resize-y")}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ph-mp" className="text-xs font-bold uppercase tracking-wide text-ds-muted">
                {t("client.productHunter.marketplaceLabel")}
              </label>
              <select id="ph-mp" value={marketplace} onChange={(e) => setMarketplace(e.target.value as ProductHunterMarketplaceId)} className={inputClass}>
                {PRODUCT_HUNTER_MARKETPLACES.map((id) => (
                  <option key={id} value={id}>
                    {t(`client.productHunter.marketplace.${id}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ph-exp" className="text-xs font-bold uppercase tracking-wide text-ds-muted">
                {t("client.productHunter.experienceLabel")}
              </label>
              <select id="ph-exp" value={experience} onChange={(e) => setExperience(e.target.value as ProductHunterExperienceLevel)} className={inputClass}>
                {PRODUCT_HUNTER_EXPERIENCE_LEVELS.map((id) => (
                  <option key={id} value={id}>
                    {t(`client.productHunter.experience.${id}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-ds-muted">{t("client.productHunter.focusNote")}</p>
          <button
            type="button"
            onClick={() => void run()}
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-ds-btn bg-ds-primary px-4 py-3 text-sm font-bold text-white shadow-ds transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            <Radar className="size-4 shrink-0" aria-hidden />
            {busy ? t("common.loading") : t("client.productHunter.submit")}
          </button>
        </div>
      </section>

      {mode && (
        <div
          className={cn(
            "rounded-ds-btn border px-4 py-3 text-sm leading-relaxed",
            mode === "demo" ? "border-amber-300/80 bg-amber-50/80 text-amber-950" : "border-emerald-300/80 bg-emerald-50/80 text-emerald-950",
          )}
        >
          {mode === "demo" ? t("client.productHunter.demoBanner") : t("client.productHunter.liveBanner")}
        </div>
      )}

      {warn ? (
        <p className="rounded-ds-btn border border-ds-border bg-ds-bg px-4 py-3 text-sm text-ds-text">
          <span className="font-semibold">{t("client.productHunter.warnFallback")}</span> {warn}
        </p>
      ) : null}

      {hunter ? (
        <div className="space-y-4">
          {hunter.summary ? (
            <div className="rounded-ds-card border border-ds-border bg-ds-bg/60 p-4 text-sm leading-relaxed text-ds-text">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">{t("client.productHunter.summaryTitle")}</p>
              <p className="mt-2 whitespace-pre-wrap">{hunter.summary}</p>
            </div>
          ) : null}
          <h2 className="text-lg font-bold text-ds-text">{t("client.productHunter.resultsTitle")}</h2>
          <ul className="space-y-4">
            {hunter.products.map((p, idx) => (
              <li key={idx}>
                <ProductCard product={p} saving={savingIdx === idx} onSave={() => void saveIdea(idx)} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
