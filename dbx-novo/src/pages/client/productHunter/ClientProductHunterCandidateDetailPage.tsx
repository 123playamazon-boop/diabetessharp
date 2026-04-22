import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { LanguageSwitcher } from "../../../components/LanguageSwitcher";
import { PageHeader } from "../../../ui/PageHeader";
import { useI18n } from "../../../i18n/context";
import {
  getProductHunterBrief,
  listProductHunterCandidates,
  patchProductHunterCandidate,
  postProductHunterBrief,
} from "../../../lib/productHunterApi";
import type { ProductHunterBrief, ProductHunterCandidate, ProductHunterCandidateContext, ProductHunterCandidateStatus } from "../../../../shared/productHunter";
import { PRODUCT_HUNTER_CANDIDATE_STATUSES } from "../../../../shared/productHunter";
import { useBriefGenerationProgress } from "../../../hooks/useBriefGenerationProgress";
import { cn } from "../../../lib/cn";

const inputClass =
  "mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 text-sm text-ds-text shadow-ds placeholder:text-ds-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ds-primary";

type LoadState = "loading" | "missing" | "ready";

export function ClientProductHunterCandidateDetailPage() {
  const { t, locale } = useI18n();
  const { id: idParam } = useParams();
  const id = idParam?.trim() ?? "";
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [candidate, setCandidate] = useState<ProductHunterCandidate | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const notesDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [seedAsin, setSeedAsin] = useState("");
  const [categoryLabel, setCategoryLabel] = useState("");
  const [asinHowToOpen, setAsinHowToOpen] = useState(false);
  const [brief, setBrief] = useState<ProductHunterBrief | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [forceRegen, setForceRegen] = useState(false);
  const { phase, barPct } = useBriefGenerationProgress(genBusy);

  const load = useCallback(async () => {
    if (!id) {
      setLoadState("missing");
      setCandidate(null);
      return;
    }
    setLoadState("loading");
    const r = await listProductHunterCandidates();
    if (!r.ok) {
      setLoadErr(r.error);
      setCandidate(null);
      setLoadState("missing");
      return;
    }
    setLoadErr(null);
    const c = r.candidates.find((x) => x.id === id) ?? null;
    if (!c) {
      setCandidate(null);
      setLoadState("missing");
      return;
    }
    setCandidate(c);
    setNotes(c.notes ?? "");
    // Pre-filled from candidate hunterContext (Evidence Feed origin when save patched ASIN).
    setSeedAsin(c.hunterContext?.seedAsin ?? "");
    setCategoryLabel(c.hunterContext?.categoryLabel ?? "");
    if (c.brief) {
      setBrief(c.brief);
    } else {
      const br = await getProductHunterBrief(id);
      setBrief(br.ok ? br.brief : null);
    }
    setLoadState("ready");
  }, [id]);

  /** Clear brief inputs when switching candidate so we never show the previous route's ASIN/category. */
  useEffect(() => {
    setSeedAsin("");
    setCategoryLabel("");
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const briefMessage = useMemo(() => {
    const keys = [
      "client.productHunter.brief.progress0",
      "client.productHunter.brief.progress1",
      "client.productHunter.brief.progress2",
      "client.productHunter.brief.progress3",
      "client.productHunter.brief.progress4",
    ] as const;
    return t(keys[phase]);
  }, [phase, t]);

  const patchStatus = async (status: ProductHunterCandidateStatus) => {
    if (!id) return;
    const r = await patchProductHunterCandidate(id, { status });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setCandidate(r.candidate);
    toast.success(t("client.productHunter.toastStatusSaved"), { duration: 2200 });
  };

  const flushNotes = async (value: string) => {
    if (!id) return;
    const r = await patchProductHunterCandidate(id, { notes: value });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setCandidate(r.candidate);
    toast.success(t("client.productHunter.toastNotesSaved"), { duration: 2200 });
  };

  const onNotesChange = (value: string) => {
    setNotes(value);
    if (notesDebounce.current) clearTimeout(notesDebounce.current);
    notesDebounce.current = setTimeout(() => {
      notesDebounce.current = null;
      void flushNotes(value);
    }, 650);
  };

  const saveContext = async () => {
    if (!id || !candidate) return;
    const seed = (seedAsin.trim().toUpperCase() || candidate.hunterContext?.seedAsin || "").trim().toUpperCase();
    const catRaw = categoryLabel.trim() || candidate.hunterContext?.categoryLabel || "";
    const cat = catRaw.slice(0, 200);
    const ed = candidate.hunterContext?.editionDate;
    const hunterContext: ProductHunterCandidateContext = {};
    if (seed && /^B[A-Z0-9]{9}$/.test(seed)) hunterContext.seedAsin = seed;
    if (ed && /^\d{4}-\d{2}-\d{2}$/.test(ed)) hunterContext.editionDate = ed;
    if (cat) hunterContext.categoryLabel = cat;
    if (!hunterContext.seedAsin && !hunterContext.editionDate && !hunterContext.categoryLabel) {
      toast.error(t("client.productHunter.detail.contextEmpty"));
      return;
    }
    const r = await patchProductHunterCandidate(id, { hunterContext });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setCandidate(r.candidate);
    setSeedAsin(r.candidate.hunterContext?.seedAsin ?? "");
    setCategoryLabel(r.candidate.hunterContext?.categoryLabel ?? "");
    toast.success(t("client.productHunter.toastContextSaved"), { duration: 2200 });
  };

  const runBrief = async () => {
    if (!id || !candidate) return;
    setGenBusy(true);
    try {
      const body: { seedAsin?: string; force?: boolean; categoryLabel?: string } = { force: forceRegen };
      const seed = (seedAsin.trim() || candidate.hunterContext?.seedAsin || "").toUpperCase();
      if (seed) body.seedAsin = seed;
      const cat = (categoryLabel.trim() || candidate.hunterContext?.categoryLabel || "").trim();
      if (cat) body.categoryLabel = cat;
      const r = await postProductHunterBrief(id, { ...body, locale });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setBrief(r.brief);
      setForceRegen(false);
      await load();
      toast.success(t("client.productHunter.detail.briefReady"), { duration: 2400 });
    } finally {
      setGenBusy(false);
    }
  };

  if (loadState === "loading") {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center text-sm text-ds-muted">
        {t("common.loading")}
      </div>
    );
  }

  if (loadState === "missing" || !candidate) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-8">
        <PageHeader eyebrow={t("client.productHunter.eyebrow")} title={t("client.productHunter.detail.notFound")} />
        <Link to="/app/product-hunter" className="text-sm font-semibold text-ds-primary underline-offset-2 hover:underline">
          {t("client.productHunter.detail.back")}
        </Link>
        {loadErr ? <p className="text-sm text-rose-700">{loadErr}</p> : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow={t("client.productHunter.eyebrow")}
        title={candidate.idea.idea}
        subtitle={t("client.productHunter.detail.subtitle")}
        actions={<LanguageSwitcher />}
      />

      <p className="text-sm">
        <Link to="/app/product-hunter" className="font-semibold text-ds-primary underline-offset-2 hover:underline">
          {t("client.productHunter.detail.back")}
        </Link>
      </p>

      <section className="rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds">
        <label className="text-xs font-bold uppercase tracking-wide text-ds-muted" htmlFor="ph-status">
          {t("client.productHunter.detail.statusLabel")}
        </label>
        <select
          id="ph-status"
          value={candidate.status}
          onChange={(e) => void patchStatus(e.target.value as ProductHunterCandidateStatus)}
          className={cn(inputClass, "mt-1")}
        >
          {PRODUCT_HUNTER_CANDIDATE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`client.productHunter.status.${s}`)}
            </option>
          ))}
        </select>
      </section>

      <section className="rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds">
        <label className="text-xs font-bold uppercase tracking-wide text-ds-muted" htmlFor="ph-notes">
          {t("client.productHunter.detail.notesLabel")}
        </label>
        <textarea
          id="ph-notes"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          onBlur={() => void flushNotes(notes)}
          rows={5}
          placeholder={t("client.productHunter.detail.notesPh")}
          className={cn(inputClass, "min-h-[120px] resize-y")}
        />
      </section>

      <section className="space-y-4 rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds">
        <h2 className="text-base font-bold text-ds-text">{t("client.productHunter.detail.briefTitle")}</h2>
        <p className="text-xs leading-relaxed text-ds-muted">{t("client.productHunter.detail.briefHint")}</p>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-ds-muted" htmlFor="ph-seed">
            {t("client.productHunter.brief.asinLabel")}
          </label>
          <p className="mt-1 text-xs leading-relaxed text-ds-muted">{t("client.productHunter.brief.asinHelper")}</p>
          <input
            id="ph-seed"
            value={seedAsin}
            onChange={(e) => setSeedAsin(e.target.value)}
            placeholder={t("client.productHunter.brief.asinPlaceholder")}
            className={inputClass}
          />
          <details className="mt-2" onToggle={(e) => setAsinHowToOpen((e.currentTarget as HTMLDetailsElement).open)}>
            <summary className="cursor-pointer list-none select-none text-sm font-semibold text-ds-primary underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden">
              {asinHowToOpen ? t("client.productHunter.brief.asinHowTo.titleExpanded") : t("client.productHunter.brief.asinHowTo.titleCollapsed")}
            </summary>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ds-muted">
              <li>{t("client.productHunter.brief.asinHowTo.step1")}</li>
              <li>{t("client.productHunter.brief.asinHowTo.step2")}</li>
              <li>{t("client.productHunter.brief.asinHowTo.step3")}</li>
            </ol>
          </details>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-ds-muted" htmlFor="ph-cat">
            {t("client.productHunter.detail.categoryHint")}
          </label>
          <input id="ph-cat" value={categoryLabel} onChange={(e) => setCategoryLabel(e.target.value)} className={inputClass} />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <button
              type="button"
              onClick={() => void saveContext()}
              className="w-fit rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-2 text-xs font-bold uppercase tracking-wide text-ds-text"
            >
              {t("client.productHunter.detail.saveContext")}
            </button>
            <p className="max-w-md text-xs leading-relaxed text-ds-muted">{t("client.productHunter.brief.saveContextHelp")}</p>
          </div>
          <label className="flex items-center gap-2 text-xs text-ds-muted">
            <input type="checkbox" checked={forceRegen} onChange={(e) => setForceRegen(e.target.checked)} />
            {t("client.productHunter.detail.briefRegenerate")}
          </label>
        </div>
        <button
          type="button"
          disabled={genBusy}
          onClick={() => void runBrief()}
          className="inline-flex w-full items-center justify-center rounded-ds-btn bg-ds-primary px-4 py-3 text-sm font-bold text-white shadow-ds disabled:opacity-60 sm:w-auto"
        >
          {genBusy ? t("common.loading") : brief ? t("client.productHunter.detail.briefRegenerateAction") : t("client.productHunter.detail.briefGenerate")}
        </button>

        {genBusy ? (
          <div className="space-y-2 rounded-ds-btn border border-ds-border bg-ds-bg/80 p-4">
            <p className="text-sm font-medium text-ds-text">{briefMessage}</p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-ds-border">
              <div
                className="h-full rounded-full bg-ds-primary transition-[width] duration-300 ease-out"
                style={{ width: `${barPct}%` }}
              />
            </div>
          </div>
        ) : null}
      </section>

      {brief ? (
        <article className="space-y-4 rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds text-sm">
          <header className="border-b border-ds-border pb-3">
            <p className="text-xs font-bold uppercase text-ds-muted">{t("client.productHunter.detail.briefMeta")}</p>
            <p className="text-ds-text">
              {brief.generatedAtIso} · {brief.source} · {brief.quality}
            </p>
            {brief.warnings.length ? (
              <ul className="mt-2 list-disc pl-5 text-amber-900">
                {brief.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            ) : null}
          </header>
          <section>
            <h3 className="text-xs font-bold uppercase text-ds-muted">{t("client.productHunter.detail.briefCompetitors")}</h3>
            <p className="mt-1 font-mono text-xs">{brief.competitorAsins.join(", ") || "—"}</p>
            <p className="text-xs text-ds-muted">
              {t("client.productHunter.detail.briefSample")}: {brief.reviewSampleSize}
            </p>
          </section>
          <section>
            <h3 className="text-xs font-bold uppercase text-ds-muted">{t("client.productHunter.detail.briefPain")}</h3>
            <ul className="mt-2 space-y-2">
              {brief.painPoints.map((p, i) => (
                <li key={i} className="rounded-ds-btn border border-ds-border bg-ds-bg/50 p-3">
                  <span className="font-semibold text-ds-text">{p.point}</span>
                  <span className="ml-2 text-xs text-ds-muted">
                    ({p.severity} · {p.mentionCount})
                  </span>
                  {p.quoteSample ? <p className="mt-1 text-xs italic text-ds-muted">&ldquo;{p.quoteSample}&rdquo;</p> : null}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="text-xs font-bold uppercase text-ds-muted">{t("client.productHunter.detail.briefImprove")}</h3>
            <ul className="mt-2 list-disc pl-5">
              {brief.productV2Improvements.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="text-xs font-bold uppercase text-ds-muted">{t("client.productHunter.detail.briefAngles")}</h3>
            <ul className="mt-2 space-y-2">
              {brief.marketingAngles.map((m, i) => (
                <li key={i}>
                  <strong>{m.angle}</strong>
                  <p className="text-ds-muted">{m.exploits}</p>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="text-xs font-bold uppercase text-ds-muted">{t("client.productHunter.detail.briefDiff")}</h3>
            <p className="mt-1 leading-relaxed">{brief.differentiationSummary}</p>
          </section>
        </article>
      ) : null}
    </div>
  );
}
