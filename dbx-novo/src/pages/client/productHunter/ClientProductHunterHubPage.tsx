import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LanguageSwitcher } from "../../../components/LanguageSwitcher";
import { PageHeader } from "../../../ui/PageHeader";
import { useI18n } from "../../../i18n/context";
import { listProductHunterCandidates } from "../../../lib/productHunterApi";
import type { ProductHunterCandidate } from "../../../../shared/productHunter";
import { cn } from "../../../lib/cn";
import { ProductHunterBrainstormPanel } from "./ProductHunterBrainstormPanel";
import { ProductHunterEvidencePanel } from "./ProductHunterEvidencePanel";

type Tab = "brainstorm" | "evidence" | "candidates";

export function ClientProductHunterHubPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("brainstorm");
  const [listTick, setListTick] = useState(0);
  const [candidates, setCandidates] = useState<ProductHunterCandidate[] | null>(null);
  const [listErr, setListErr] = useState<string | null>(null);

  const bumpList = useCallback(() => setListTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await listProductHunterCandidates();
      if (cancelled) return;
      if (!r.ok) {
        setListErr(r.error);
        setCandidates([]);
        return;
      }
      setListErr(null);
      setCandidates(r.candidates);
    })();
    return () => {
      cancelled = true;
    };
  }, [listTick]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "brainstorm", label: t("client.productHunter.hub.tabBrainstorm") },
    { id: "evidence", label: t("client.productHunter.hub.tabEvidence") },
    { id: "candidates", label: t("client.productHunter.hub.tabCandidates") },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow={t("client.productHunter.eyebrow")}
        title={t("client.productHunter.title")}
        subtitle={t("client.productHunter.hub.subtitle")}
        actions={<LanguageSwitcher />}
      />

      <p className="text-sm text-ds-muted">
        <Link to="/app/dashboard" className="font-semibold text-ds-primary underline-offset-2 hover:underline">
          {t("client.productHunter.backDashboard")}
        </Link>
        {" · "}
        <Link to="/app/tools" className="font-semibold text-ds-primary underline-offset-2 hover:underline">
          {t("client.productHunter.linkTools")}
        </Link>
      </p>

      <div className="flex flex-wrap gap-2 border-b border-ds-border pb-1">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "rounded-t-ds-btn px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition",
              tab === id ? "bg-ds-bg text-ds-primary ring-1 ring-ds-border" : "text-ds-muted hover:text-ds-text",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "brainstorm" ? <ProductHunterBrainstormPanel onCandidatesChanged={bumpList} /> : null}
      {tab === "evidence" ? <ProductHunterEvidencePanel onCandidatesChanged={bumpList} /> : null}

      {tab === "candidates" ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-ds-text">{t("client.productHunter.candidates.title")}</h2>
            <button
              type="button"
              onClick={() => bumpList()}
              className="rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-ds-text shadow-ds"
            >
              {t("client.productHunter.candidates.refresh")}
            </button>
          </div>
          {listErr ? <p className="text-sm text-rose-700">{listErr}</p> : null}
          {!candidates?.length ? (
            <p className="text-sm text-ds-muted">{t("client.productHunter.hub.emptyCandidates")}</p>
          ) : (
            <ul className="space-y-2">
              {candidates.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/app/product-hunter/candidatos/${encodeURIComponent(c.id)}`}
                    className="flex items-center justify-between gap-3 rounded-ds-card border border-ds-border bg-ds-surface p-4 shadow-ds transition hover:bg-ds-bg"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ds-text">{c.idea.idea}</p>
                      <p className="text-xs text-ds-muted">
                        {t(`client.productHunter.status.${c.status}`)} · {Math.round(c.idea.opportunityScore)} pts
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-bold uppercase text-ds-primary">{t("client.productHunter.candidates.open")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
