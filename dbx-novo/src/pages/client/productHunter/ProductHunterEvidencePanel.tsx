import { useState } from "react";
import { toast } from "sonner";
import { useI18n } from "../../../i18n/context";
import {
  PRODUCT_HUNTER_EXPERIENCE_LEVELS,
  type ProductHunterExperienceLevel,
  type ProductHunterIdea,
  type ProductHunterResult,
} from "../../../../shared/productHunter";
import { patchProductHunterCandidate, postProductHunterEvidenceFeed, saveProductHunterCandidates } from "../../../lib/productHunterApi";
import { cn } from "../../../lib/cn";

const inputClass =
  "mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 text-sm text-ds-text shadow-ds placeholder:text-ds-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ds-primary";

type Props = { onCandidatesChanged?: () => void };

export function ProductHunterEvidencePanel({ onCandidatesChanged }: Props) {
  const { t, locale } = useI18n();
  const [budget, setBudget] = useState("");
  const [experience, setExperience] = useState<ProductHunterExperienceLevel>("intermediate");
  const [editionDate, setEditionDate] = useState("");
  const [priceMinUsd, setPriceMinUsd] = useState(15);
  const [priceMaxUsd, setPriceMaxUsd] = useState(80);
  const [minMonthlySold, setMinMonthlySold] = useState(150);
  const [maxNewOffersTotal, setMaxNewOffersTotal] = useState(25);
  const [busy, setBusy] = useState(false);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [hunter, setHunter] = useState<ProductHunterResult | null>(null);
  const [meta, setMeta] = useState<{ editionDate: string | null; rowCount: number; asins: string[] } | null>(null);
  const [feedMode, setFeedMode] = useState<"evidence" | "evidence_demo" | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const b = budget.trim();
      if (!b) {
        toast.error(t("client.productHunter.validationBudget"));
        return;
      }
      const edition = editionDate.trim();
      const r = await postProductHunterEvidenceFeed({
        budget: b,
        marketplace: "amazon_us",
        experienceLevel: experience,
        locale,
        ...(edition && /^\d{4}-\d{2}-\d{2}$/.test(edition) ? { editionDate: edition } : {}),
        filters: {
          priceMinUsd,
          priceMaxUsd,
          minMonthlySold,
          maxNewOffersTotal,
        },
      });
      if (!r.ok) {
        toast.error(r.error);
        setHunter(null);
        setMeta(null);
        setFeedMode(null);
        return;
      }
      setHunter(r.hunter);
      setMeta(r.meta);
      setFeedMode(r.mode);
      setFromCache(r.fromCache);
      toast.success(r.mode === "evidence" ? t("client.productHunter.evidence.toastOk") : t("client.productHunter.evidence.toastDemo"));
    } finally {
      setBusy(false);
    }
  };

  const saveAt = async (idx: number) => {
    if (!hunter?.products[idx] || !meta) return;
    setSavingIdx(idx);
    try {
      const idea: ProductHunterIdea = hunter.products[idx];
      const r = await saveProductHunterCandidates({ ideas: [idea], source: "evidence_feed" });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const saved = r.saved[0];
      if (!saved) {
        toast.error(t("common.errorUpdate"));
        return;
      }
      const seed = meta.asins[idx]?.trim().toUpperCase();
      const ed = meta.editionDate?.trim();
      if (seed && /^B[A-Z0-9]{9}$/.test(seed)) {
        const hunterContext: { seedAsin: string; editionDate?: string } = { seedAsin: seed };
        if (ed && /^\d{4}-\d{2}-\d{2}$/.test(ed)) hunterContext.editionDate = ed;
        const pr = await patchProductHunterCandidate(saved.id, { hunterContext });
        if (!pr.ok) toast.error(pr.error);
      }
      toast.success(t("client.productHunter.savedCandidateToast"));
      onCandidatesChanged?.();
    } finally {
      setSavingIdx(null);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-ds-muted">{t("client.productHunter.evidence.amazonOnly")}</p>

      <section className="rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds">
        <h3 className="text-sm font-bold text-ds-text">{t("client.productHunter.evidence.filtersTitle")}</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-ds-muted" htmlFor="ph-ev-budget">
              {t("client.productHunter.budgetLabel")}
            </label>
            <textarea
              id="ph-ev-budget"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              rows={2}
              className={cn(inputClass, "min-h-[72px] resize-y")}
              placeholder={t("client.productHunter.budgetPh")}
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-ds-muted" htmlFor="ph-ev-exp">
              {t("client.productHunter.experienceLabel")}
            </label>
            <select id="ph-ev-exp" value={experience} onChange={(e) => setExperience(e.target.value as ProductHunterExperienceLevel)} className={inputClass}>
              {PRODUCT_HUNTER_EXPERIENCE_LEVELS.map((id) => (
                <option key={id} value={id}>
                  {t(`client.productHunter.experience.${id}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wide text-ds-muted" htmlFor="ph-ev-ed">
              {t("client.productHunter.evidence.editionDate")}
            </label>
            <input
              id="ph-ev-ed"
              type="text"
              value={editionDate}
              onChange={(e) => setEditionDate(e.target.value)}
              placeholder="YYYY-MM-DD"
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-ds-muted" htmlFor="ph-pmin">
              {t("client.productHunter.evidence.priceMin")}
            </label>
            <input
              id="ph-pmin"
              type="number"
              value={priceMinUsd}
              onChange={(e) => setPriceMinUsd(Number(e.target.value))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-ds-muted" htmlFor="ph-pmax">
              {t("client.productHunter.evidence.priceMax")}
            </label>
            <input
              id="ph-pmax"
              type="number"
              value={priceMaxUsd}
              onChange={(e) => setPriceMaxUsd(Number(e.target.value))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-ds-muted" htmlFor="ph-sold">
              {t("client.productHunter.evidence.minSold")}
            </label>
            <input
              id="ph-sold"
              type="number"
              value={minMonthlySold}
              onChange={(e) => setMinMonthlySold(Number(e.target.value))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-ds-muted" htmlFor="ph-offers">
              {t("client.productHunter.evidence.maxOffers")}
            </label>
            <input
              id="ph-offers"
              type="number"
              value={maxNewOffersTotal}
              onChange={(e) => setMaxNewOffersTotal(Number(e.target.value))}
              className={inputClass}
            />
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run()}
          className="mt-4 inline-flex w-full items-center justify-center rounded-ds-btn bg-ds-primary px-4 py-3 text-sm font-bold text-white shadow-ds disabled:opacity-60 sm:w-auto"
        >
          {busy ? t("common.loading") : t("client.productHunter.evidence.run")}
        </button>
      </section>

      {feedMode && meta ? (
        <p className="text-xs text-ds-muted">
          {t("client.productHunter.evidence.metaLine", {
            edition: meta.editionDate ?? "—",
            rows: meta.rowCount,
            cache: fromCache ? t("client.productHunter.evidence.cacheYes") : t("client.productHunter.evidence.cacheNo"),
          })}
        </p>
      ) : null}

      {hunter && hunter.products.length > 0 ? (
        <div className="space-y-4">
          {hunter.summary ? (
            <div className="rounded-ds-card border border-ds-border bg-ds-bg/60 p-4 text-sm text-ds-text">
              <p className="whitespace-pre-wrap">{hunter.summary}</p>
            </div>
          ) : null}
          <ul className="space-y-4">
            {hunter.products.map((p, idx) => (
              <li key={`${p.idea}-${idx}`} className="rounded-ds-card border border-ds-border bg-ds-surface p-4 shadow-ds">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-ds-muted">ASIN</p>
                    <p className="font-mono text-sm font-semibold text-ds-text">{meta?.asins[idx] ?? "—"}</p>
                    <h3 className="mt-2 text-base font-bold text-ds-text">{p.idea}</h3>
                  </div>
                  <span className="text-2xl font-black tabular-nums text-ds-primary">{Math.round(p.opportunityScore)}</span>
                </div>
                <button
                  type="button"
                  disabled={savingIdx === idx}
                  onClick={() => void saveAt(idx)}
                  className="mt-3 rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-2 text-xs font-bold uppercase tracking-wide text-ds-text disabled:opacity-50"
                >
                  {t("client.productHunter.saveCandidate")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : hunter && hunter.summary ? (
        <p className="rounded-ds-card border border-ds-border bg-amber-50/80 p-4 text-sm text-amber-950">{hunter.summary}</p>
      ) : null}
    </div>
  );
}
