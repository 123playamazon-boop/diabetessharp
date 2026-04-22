import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { useClientProfile } from "../../context/ClientProfileContext";
import { useI18n } from "../../i18n/context";
import {
  fetchClientAssistedPurchases,
  postClientAssistedPurchase,
  postClientAssistedPurchaseApprove,
  postClientAssistedPurchaseCancel,
  type AssistedPurchaseDto,
  type AssistedPurchaseStatus,
} from "../../lib/assistedPurchaseApi";
import { saveClientProfile } from "../../lib/clientProfileStorage";
import {
  isScrapedUnitAboveRegisteredDto,
  previewAssistedPurchaseTotals,
} from "../../lib/assistedPurchasePricing";
import { formatUsd } from "../../lib/prepCenterPricing";
import { PageHeader } from "../../ui/PageHeader";

function formatNeedByDate(ymd: string | undefined, locale: string): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "—";
  const d = new Date(`${ymd}T12:00:00`);
  const loc = locale === "pt-BR" ? "pt-PT" : locale === "es" ? "es-ES" : "en-US";
  return d.toLocaleDateString(loc, { day: "numeric", month: "short", year: "numeric" });
}

function localeTag(locale: string): string {
  if (locale === "pt-BR") return "pt-PT";
  if (locale === "es") return "es-ES";
  return "en-US";
}

function formatIsoDateTime(iso: string | undefined, locale: string): string {
  if (!iso || !iso.trim()) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(localeTag(locale), { dateStyle: "medium", timeStyle: "short" });
}

function statusBadgeClass(s: AssistedPurchaseStatus): string {
  switch (s) {
    case "pending_review":
      return "bg-amber-100 text-amber-950 ring-amber-200";
    case "waiting_customer_approval":
      return "bg-violet-100 text-violet-950 ring-violet-200";
    case "approved":
      return "bg-emerald-100 text-emerald-950 ring-emerald-200";
    case "purchasing":
    case "purchased":
    case "in_transit":
      return "bg-sky-100 text-sky-950 ring-sky-200";
    case "received":
      return "bg-zinc-200 text-zinc-900 ring-zinc-300";
    case "cancelled":
      return "bg-rose-100 text-rose-950 ring-rose-200";
    default:
      return "bg-zinc-100 text-zinc-800 ring-zinc-200";
  }
}

export function ClientAssistedPurchasePage() {
  const { t, locale } = useI18n();
  const { profile } = useClientProfile();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [purchases, setPurchases] = useState<AssistedPurchaseDto[]>([]);
  const [url, setUrl] = useState("");
  const [productTitle, setProductTitle] = useState("");
  const [qty, setQty] = useState("1");
  const [noteColor, setNoteColor] = useState("");
  const [noteSize, setNoteSize] = useState("");
  const [noteObs, setNoteObs] = useState("");
  const [unitOverride, setUnitOverride] = useState("");
  const [needByDate, setNeedByDate] = useState("");
  const [detail, setDetail] = useState<AssistedPurchaseDto | null>(null);

  const minNeedByYmd = useMemo(() => {
    const n = new Date();
    const y = n.getFullYear();
    const m = String(n.getMonth() + 1).padStart(2, "0");
    const d = String(n.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  const buildVariantNotes = () => {
    const sizeLine = noteSize.trim() ? noteSize.trim() : "—";
    return `Cor: ${noteColor.trim()}\nTamanho: ${sizeLine}\nObservações: ${noteObs.trim()}`;
  };

  const pricePreview = useMemo(() => {
    const quantity = Number(qty.replace(",", "."));
    const unit = unitOverride.trim() ? Number(unitOverride.replace(",", ".")) : NaN;
    if (!Number.isInteger(quantity) || quantity < 1) return null;
    if (!Number.isFinite(unit) || unit <= 0) return null;
    return previewAssistedPurchaseTotals(unit, quantity);
  }, [qty, unitOverride]);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchClientAssistedPurchases(profile.suite);
    setLoading(false);
    if (!r.ok) {
      toast.error(r.error);
      setPurchases([]);
      return;
    }
    setPurchases(r.purchases);
  }, [profile.suite]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetail(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail]);

  const selected = useMemo(
    () => purchases.find((p) => p.status === "waiting_customer_approval"),
    [purchases],
  );

  const submit = async () => {
    const quantity = Number(qty.replace(",", "."));
    const unit = Number(unitOverride.trim().replace(",", "."));
    if (!url.trim()) {
      toast.error(t("client.assistedPurchase.urlRequired"));
      return;
    }
    if (productTitle.trim().length < 4) {
      toast.error(t("client.assistedPurchase.titleTooShort"));
      return;
    }
    if (!noteColor.trim()) {
      toast.error(t("client.assistedPurchase.colorRequired"));
      return;
    }
    if (noteObs.trim().length < 8) {
      toast.error(t("client.assistedPurchase.obsTooShort"));
      return;
    }
    if (!Number.isFinite(unit) || unit <= 0) {
      toast.error(t("client.assistedPurchase.unitRequired"));
      return;
    }
    if (!needByDate.trim()) {
      toast.error(t("client.assistedPurchase.needByDateRequired"));
      return;
    }
    const notes = buildVariantNotes();
    if (notes.length < 10) {
      toast.error(t("client.assistedPurchase.notesTooShort"));
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      toast.error(t("client.assistedPurchase.qtyInvalid"));
      return;
    }
    setBusy(true);
    try {
      const r = await postClientAssistedPurchase({
        suite: profile.suite,
        productUrl: url.trim(),
        productTitle: productTitle.trim(),
        quantity,
        notes,
        unitPriceUsd: unit,
        requiredDeliveryByDate: needByDate.trim(),
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(t("client.assistedPurchase.createdOk"));
      if (r.scrapedPriceAboveRegistered) {
        toast.message(t("client.assistedPurchase.priceWarnToast"), { duration: 8000 });
      }
      setUrl("");
      setProductTitle("");
      setQty("1");
      setNoteColor("");
      setNoteSize("");
      setNoteObs("");
      setUnitOverride("");
      setNeedByDate("");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const approve = async (id: string) => {
    setBusy(true);
    try {
      const r = await postClientAssistedPurchaseApprove(profile.suite, id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      saveClientProfile({ ...profile, balanceUsd: r.balanceUsd });
      toast.success(t("client.assistedPurchase.approvedOk"));
      await load();
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: string) => {
    if (!window.confirm(t("client.assistedPurchase.cancelConfirm"))) return;
    setBusy(true);
    try {
      const r = await postClientAssistedPurchaseCancel(profile.suite, id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(t("client.assistedPurchase.cancelledOk"));
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow={t("client.assistedPurchase.eyebrow")}
        title={t("client.assistedPurchase.title")}
        subtitle={t("client.assistedPurchase.subtitle")}
        actions={<LanguageSwitcher />}
      />

      <section className="rounded-ds-card border border-ds-border bg-ds-surface p-4 shadow-ds">
        <h2 className="text-xs font-black uppercase tracking-wide text-ds-muted">{t("client.assistedPurchase.formTitle")}</h2>
        <p className="mt-2 text-sm text-ds-muted">{t("client.assistedPurchase.feeBlurb")}</p>
        <p className="mt-2 rounded-lg border border-ds-border bg-ds-bg px-3 py-2 text-xs text-ds-muted">
          {t("client.assistedPurchase.floridaTaxDisclaimer")}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-ds-text sm:col-span-2">
            {t("client.assistedPurchase.fieldUrl")}
            <input
              className="mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-2 text-sm"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </label>
          <label className="block text-xs font-semibold text-ds-text sm:col-span-2">
            {t("client.assistedPurchase.fieldTitle")}
            <input
              className="mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-2 text-sm"
              value={productTitle}
              onChange={(e) => setProductTitle(e.target.value)}
            />
          </label>
          <label className="block text-xs font-semibold text-ds-text">
            {t("client.assistedPurchase.fieldQty")}
            <input
              className="mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-2 text-sm tabular-nums"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              inputMode="numeric"
            />
          </label>
          <label className="block text-xs font-semibold text-ds-text">
            {t("client.assistedPurchase.fieldUnitOverride")}
            <input
              className="mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-2 text-sm tabular-nums"
              value={unitOverride}
              onChange={(e) => setUnitOverride(e.target.value)}
              inputMode="decimal"
              placeholder={t("client.assistedPurchase.unitPlaceholder")}
            />
            <p className="mt-1 text-[11px] text-ds-muted">{t("client.assistedPurchase.unitHelp")}</p>
          </label>
          <label className="block text-xs font-semibold text-ds-text sm:col-span-2">
            {t("client.assistedPurchase.fieldNeedByDate")}
            <input
              type="date"
              className="mt-1 w-full max-w-xs rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-2 text-sm tabular-nums"
              value={needByDate}
              min={minNeedByYmd}
              onChange={(e) => setNeedByDate(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-ds-muted">{t("client.assistedPurchase.needByDateHelp")}</p>
          </label>
          <div className="sm:col-span-2">
            <p className="text-xs font-semibold text-ds-text">{t("client.assistedPurchase.variantSectionTitle")}</p>
            <p className="mt-0.5 text-[11px] text-ds-muted">{t("client.assistedPurchase.variantSectionHint")}</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-ds-text">
                {t("client.assistedPurchase.fieldColor")}
                <input
                  className="mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-2 text-sm"
                  value={noteColor}
                  onChange={(e) => setNoteColor(e.target.value)}
                  placeholder={t("client.assistedPurchase.colorPlaceholder")}
                />
              </label>
              <label className="block text-xs font-semibold text-ds-text">
                {t("client.assistedPurchase.fieldSizeOptional")}
                <input
                  className="mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-2 text-sm"
                  value={noteSize}
                  onChange={(e) => setNoteSize(e.target.value)}
                  placeholder={t("client.assistedPurchase.sizePlaceholder")}
                />
              </label>
              <label className="block text-xs font-semibold text-ds-text sm:col-span-2">
                {t("client.assistedPurchase.fieldObs")}
                <textarea
                  className="mt-1 min-h-[64px] w-full rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-2 text-sm"
                  value={noteObs}
                  onChange={(e) => setNoteObs(e.target.value)}
                  placeholder={t("client.assistedPurchase.obsPlaceholder")}
                />
              </label>
            </div>
          </div>
        </div>
        {pricePreview ? (
          <div className="mt-4 rounded-lg border border-ds-border bg-ds-bg px-3 py-2 text-xs text-ds-text">
            <p className="font-bold text-ds-muted">{t("client.assistedPurchase.previewTitle")}</p>
            <ul className="mt-2 space-y-1 tabular-nums">
              <li className="flex justify-between gap-2">
                <span>{t("client.assistedPurchase.breakdownSubtotal")}</span>
                <span>{formatUsd(pricePreview.subtotalUsd)}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span>{t("client.assistedPurchase.breakdownPlatform")}</span>
                <span>{formatUsd(pricePreview.platformFeeUsd)}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span>{t("client.assistedPurchase.breakdownFlorida")}</span>
                <span>{formatUsd(pricePreview.floridaTaxUsd)}</span>
              </li>
              <li className="flex justify-between gap-2 border-t border-ds-border pt-1 font-semibold">
                <span>{t("client.assistedPurchase.breakdownTotal")}</span>
                <span>{formatUsd(pricePreview.totalUsd)}</span>
              </li>
            </ul>
          </div>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="mt-4 rounded-ds-btn bg-ds-primary px-4 py-2 text-xs font-black uppercase tracking-wide text-white shadow-ds hover:opacity-95 disabled:opacity-40"
        >
          {t("client.assistedPurchase.submit")}
        </button>
      </section>

      {selected ? (
        <div className="rounded-ds-card border border-violet-300 bg-violet-50/80 p-4 shadow-ds">
          <p className="text-sm font-bold text-violet-950">{t("client.assistedPurchase.approvalBanner")}</p>
          <p className="mt-1 text-xs text-violet-900">
            {t("client.assistedPurchase.approvalDetail", {
              total: formatUsd(selected.finalTotalUsd ?? 0),
              est: formatUsd(selected.estimatedTotalUsd),
            })}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void approve(selected.id)}
            className="mt-3 rounded-ds-btn bg-violet-700 px-4 py-2 text-xs font-black uppercase tracking-wide text-white hover:bg-violet-800 disabled:opacity-40"
          >
            {t("client.assistedPurchase.approveCta")}
          </button>
        </div>
      ) : null}

      <section className="rounded-ds-card border border-ds-border bg-ds-surface shadow-ds">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ds-border px-4 py-3">
          <h2 className="text-xs font-black uppercase tracking-wide text-ds-muted">{t("client.assistedPurchase.listTitle")}</h2>
          <button
            type="button"
            onClick={() => void load()}
            className="text-xs font-bold uppercase tracking-wide text-ds-primary hover:underline"
          >
            {t("client.assistedPurchase.refresh")}
          </button>
        </div>
        {loading ? (
          <p className="p-4 text-sm text-ds-muted">{t("client.assistedPurchase.loading")}</p>
        ) : purchases.length === 0 ? (
          <p className="p-6 text-center text-sm text-ds-muted">{t("client.assistedPurchase.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="border-b border-ds-border bg-ds-bg text-[10px] font-black uppercase tracking-wide text-ds-muted">
                <tr>
                  <th className="px-3 py-2">{t("client.assistedPurchase.colId")}</th>
                  <th className="px-3 py-2">{t("client.assistedPurchase.colProduct")}</th>
                  <th className="px-3 py-2">{t("client.assistedPurchase.colStatus")}</th>
                  <th className="px-3 py-2">{t("client.assistedPurchase.colNeedBy")}</th>
                  <th className="px-3 py-2">{t("client.assistedPurchase.colEstimate")}</th>
                  <th className="px-3 py-2">{t("client.assistedPurchase.colFinal")}</th>
                  <th className="px-3 py-2">{t("client.assistedPurchase.colActions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ds-border">
                {purchases.map((p) => (
                  <tr key={p.id} className="text-ds-text">
                    <td className="px-3 py-2 font-mono text-xs">{p.id}</td>
                    <td className="max-w-[260px] px-3 py-2">
                      <div className="flex gap-2">
                        {p.productImageUrl ? (
                          <img
                            src={p.productImageUrl}
                            alt=""
                            className="size-12 shrink-0 rounded-md border border-ds-border object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="size-12 shrink-0 rounded-md border border-ds-border bg-ds-bg" aria-hidden />
                        )}
                        <div className="min-w-0">
                          <p className="line-clamp-2 font-medium">{p.productTitle}</p>
                          <a
                            href={p.productUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 break-all text-[11px] text-ds-primary hover:underline"
                          >
                            {t("client.assistedPurchase.openLink")}
                            <ExternalLink className="size-3 shrink-0" aria-hidden />
                          </a>
                          {isScrapedUnitAboveRegisteredDto(p) ? (
                            <p className="mt-1 text-[10px] font-semibold text-amber-800">
                              {t("client.assistedPurchase.priceWarnScrapedHigher", {
                                scraped: formatUsd(p.linkScrapeUnitPriceUsd ?? 0),
                                registered: formatUsd(p.registeredUnitPriceUsd ?? p.estimatedUnitPriceUsd),
                              })}
                            </p>
                          ) : null}
                          {p.clientNotifications && p.clientNotifications.length > 0 ? (
                            <div className="mt-2 rounded-md border border-rose-200 bg-rose-50/90 px-2 py-1.5 text-[10px] text-rose-950">
                              <p className="font-bold uppercase tracking-wide text-rose-900">{t("client.assistedPurchase.opsAlerts")}</p>
                              <ul className="mt-1 list-inside list-disc space-y-0.5">
                                {p.clientNotifications.slice(0, 5).map((n, i) => (
                                  <li key={`${n.atIso}-${i}`}>{t(`client.assistedPurchase.alert.${n.type}`)}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${statusBadgeClass(p.status)}`}>
                        {t(`client.assistedPurchase.status.${p.status}`)}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top text-xs tabular-nums text-ds-muted">
                      {formatNeedByDate(p.requiredDeliveryByDate, locale)}
                    </td>
                    <td className="px-3 py-2 align-top text-xs tabular-nums">
                      <p className="font-semibold">{formatUsd(p.estimatedTotalUsd)}</p>
                      {typeof p.floridaTaxUsd === "number" ? (
                        <ul className="mt-1 space-y-0.5 text-[10px] text-ds-muted">
                          <li className="flex justify-between gap-2">
                            <span className="shrink-0">{t("client.assistedPurchase.breakdownSubtotal")}</span>
                            <span>{formatUsd(p.estimatedProductSubtotalUsd)}</span>
                          </li>
                          <li className="flex justify-between gap-2">
                            <span className="shrink-0">{t("client.assistedPurchase.breakdownPlatform")}</span>
                            <span>{formatUsd(p.estimatedServiceFeeUsd)}</span>
                          </li>
                          <li className="flex justify-between gap-2">
                            <span className="shrink-0">{t("client.assistedPurchase.breakdownFlorida")}</span>
                            <span>{formatUsd(p.floridaTaxUsd)}</span>
                          </li>
                        </ul>
                      ) : (
                        <p className="mt-1 text-[10px] text-ds-muted">{t("client.assistedPurchase.legacyPricingNote")}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-xs tabular-nums">
                      {typeof p.finalTotalUsd === "number" ? (
                        <>
                          <p className="font-semibold">{formatUsd(p.finalTotalUsd)}</p>
                          {typeof p.finalProductSubtotalUsd === "number" ? (
                            <>
                              <p className="mt-1 text-[10px] text-ds-muted">{t("client.assistedPurchase.finalBreakdownNote")}</p>
                              <ul className="mt-0.5 space-y-0.5 text-[10px] text-ds-muted">
                                <li className="flex justify-between gap-2">
                                  <span className="shrink-0">{t("client.assistedPurchase.breakdownSubtotal")}</span>
                                  <span>{formatUsd(p.finalProductSubtotalUsd)}</span>
                                </li>
                                {typeof p.finalServiceFeeUsd === "number" ? (
                                  <li className="flex justify-between gap-2">
                                    <span className="shrink-0">{t("client.assistedPurchase.breakdownPlatform")}</span>
                                    <span>{formatUsd(p.finalServiceFeeUsd)}</span>
                                  </li>
                                ) : null}
                                {typeof p.finalFloridaTaxUsd === "number" ? (
                                  <li className="flex justify-between gap-2">
                                    <span className="shrink-0">{t("client.assistedPurchase.breakdownFlorida")}</span>
                                    <span>{formatUsd(p.finalFloridaTaxUsd)}</span>
                                  </li>
                                ) : (
                                  <li className="pt-0.5 text-[10px] italic text-ds-muted">{t("client.assistedPurchase.legacyPricingNote")}</li>
                                )}
                              </ul>
                            </>
                          ) : (
                            <p className="mt-1 text-[10px] text-ds-muted">{t("client.assistedPurchase.legacyPricingNote")}</p>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex max-w-[140px] flex-col gap-1">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setDetail(p)}
                          className="rounded-lg border border-ds-primary/40 bg-ds-bg px-2 py-1 text-left text-[10px] font-bold uppercase text-ds-primary hover:bg-ds-surface disabled:opacity-40"
                        >
                          {t("client.assistedPurchase.openDetails")}
                        </button>
                        {p.status === "waiting_customer_approval" ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void approve(p.id)}
                            className="rounded-lg bg-violet-600 px-2 py-1 text-[10px] font-bold uppercase text-white hover:bg-violet-700 disabled:opacity-40"
                          >
                            {t("client.assistedPurchase.approveShort")}
                          </button>
                        ) : null}
                        {p.status === "pending_review" || p.status === "waiting_customer_approval" ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void cancel(p.id)}
                            className="rounded-lg border border-ds-border px-2 py-1 text-[10px] font-bold uppercase text-ds-muted hover:bg-ds-bg disabled:opacity-40"
                          >
                            {t("client.assistedPurchase.cancelShort")}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {detail ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal
          aria-labelledby="ap-detail-title"
          onClick={() => setDetail(null)}
        >
          <div
            className="max-h-[min(92vh,720px)] w-full max-w-lg overflow-y-auto rounded-t-ds-card border border-ds-border bg-ds-surface shadow-ds sm:rounded-ds-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-[1] flex items-start justify-between gap-3 border-b border-ds-border bg-ds-surface px-4 py-3">
              <div className="min-w-0">
                <h2 id="ap-detail-title" className="text-sm font-black uppercase tracking-wide text-ds-muted">
                  {t("client.assistedPurchase.detailModalTitle")}
                </h2>
                <p className="mt-0.5 font-mono text-xs text-ds-text">{detail.id}</p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-lg border border-ds-border px-3 py-1.5 text-xs font-bold text-ds-text hover:bg-ds-bg"
                onClick={() => setDetail(null)}
              >
                {t("client.assistedPurchase.detailClose")}
              </button>
            </div>

            <div className="space-y-5 p-4 text-sm text-ds-text">
              <div className="flex gap-3">
                {detail.productImageUrl ? (
                  <img
                    src={detail.productImageUrl}
                    alt=""
                    className="size-20 shrink-0 rounded-lg border border-ds-border object-cover"
                  />
                ) : (
                  <div className="size-20 shrink-0 rounded-lg border border-ds-border bg-ds-bg" aria-hidden />
                )}
                <div className="min-w-0">
                  <p className="font-semibold leading-snug">{detail.productTitle}</p>
                  <a
                    href={detail.productUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-ds-primary hover:underline"
                  >
                    {t("client.assistedPurchase.openLink")}
                    <ExternalLink className="size-3 shrink-0" aria-hidden />
                  </a>
                </div>
              </div>

              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ring-1 ${statusBadgeClass(detail.status)}`}>
                {t(`client.assistedPurchase.status.${detail.status}`)}
              </span>

              <div>
                <p className="text-[10px] font-black uppercase tracking-wide text-ds-muted">{t("client.assistedPurchase.detailSectionCore")}</p>
                <dl className="mt-2 divide-y divide-ds-border rounded-lg border border-ds-border bg-ds-bg px-3">
                  <div className="flex justify-between gap-3 py-2 text-xs">
                    <dt className="text-ds-muted">{t("client.assistedPurchase.detailSuite")}</dt>
                    <dd className="font-semibold tabular-nums">{detail.suite}</dd>
                  </div>
                  <div className="flex justify-between gap-3 py-2 text-xs">
                    <dt className="text-ds-muted">{t("client.assistedPurchase.detailQty")}</dt>
                    <dd className="font-semibold tabular-nums">{detail.quantity}</dd>
                  </div>
                  <div className="flex justify-between gap-3 py-2 text-xs">
                    <dt className="text-ds-muted">{t("client.assistedPurchase.detailUnitDeclared")}</dt>
                    <dd className="font-semibold tabular-nums">{formatUsd(detail.registeredUnitPriceUsd ?? detail.estimatedUnitPriceUsd)}</dd>
                  </div>
                  {typeof detail.finalUnitPriceUsd === "number" ? (
                    <div className="flex justify-between gap-3 py-2 text-xs">
                      <dt className="text-ds-muted">{t("client.assistedPurchase.detailUnitFinal")}</dt>
                      <dd className="font-semibold tabular-nums">{formatUsd(detail.finalUnitPriceUsd)}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-3 py-2 text-xs">
                    <dt className="text-ds-muted">{t("client.assistedPurchase.detailNeedBy")}</dt>
                    <dd className="font-semibold">{formatNeedByDate(detail.requiredDeliveryByDate, locale)}</dd>
                  </div>
                  <div className="flex justify-between gap-3 py-2 text-xs">
                    <dt className="text-ds-muted">{t("client.assistedPurchase.detailCreated")}</dt>
                    <dd className="text-right text-[11px] font-medium">{formatIsoDateTime(detail.createdAtIso, locale)}</dd>
                  </div>
                  <div className="flex justify-between gap-3 py-2 text-xs">
                    <dt className="text-ds-muted">{t("client.assistedPurchase.detailUpdated")}</dt>
                    <dd className="text-right text-[11px] font-medium">{formatIsoDateTime(detail.updatedAtIso, locale)}</dd>
                  </div>
                </dl>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-wide text-ds-muted">{t("client.assistedPurchase.detailNotes")}</p>
                <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-ds-border bg-ds-bg p-3 text-xs leading-relaxed text-ds-text">{detail.notes}</pre>
              </div>

              {isScrapedUnitAboveRegisteredDto(detail) ? (
                <p className="text-xs font-semibold text-amber-900">
                  {t("client.assistedPurchase.priceWarnScrapedHigher", {
                    scraped: formatUsd(detail.linkScrapeUnitPriceUsd ?? 0),
                    registered: formatUsd(detail.registeredUnitPriceUsd ?? detail.estimatedUnitPriceUsd),
                  })}
                </p>
              ) : null}

              <div>
                <p className="text-[10px] font-black uppercase tracking-wide text-ds-muted">{t("client.assistedPurchase.detailEstimated")}</p>
                <ul className="mt-2 space-y-1 rounded-lg border border-ds-border bg-ds-bg px-3 py-2 text-xs tabular-nums">
                  <li className="flex justify-between gap-2">
                    <span className="text-ds-muted">{t("client.assistedPurchase.breakdownSubtotal")}</span>
                    <span>{formatUsd(detail.estimatedProductSubtotalUsd)}</span>
                  </li>
                  <li className="flex justify-between gap-2">
                    <span className="text-ds-muted">{t("client.assistedPurchase.breakdownPlatform")}</span>
                    <span>{formatUsd(detail.estimatedServiceFeeUsd)}</span>
                  </li>
                  {typeof detail.floridaTaxUsd === "number" ? (
                    <li className="flex justify-between gap-2">
                      <span className="text-ds-muted">{t("client.assistedPurchase.breakdownFlorida")}</span>
                      <span>{formatUsd(detail.floridaTaxUsd)}</span>
                    </li>
                  ) : (
                    <li className="text-[10px] italic text-ds-muted">{t("client.assistedPurchase.legacyPricingNote")}</li>
                  )}
                  <li className="flex justify-between gap-2 border-t border-ds-border pt-1 font-semibold">
                    <span>{t("client.assistedPurchase.breakdownTotal")}</span>
                    <span>{formatUsd(detail.estimatedTotalUsd)}</span>
                  </li>
                </ul>
              </div>

              {typeof detail.finalTotalUsd === "number" ? (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wide text-ds-muted">{t("client.assistedPurchase.detailFinal")}</p>
                  <ul className="mt-2 space-y-1 rounded-lg border border-ds-border bg-ds-bg px-3 py-2 text-xs tabular-nums">
                    {typeof detail.finalProductSubtotalUsd === "number" ? (
                      <>
                        <li className="flex justify-between gap-2">
                          <span className="text-ds-muted">{t("client.assistedPurchase.breakdownSubtotal")}</span>
                          <span>{formatUsd(detail.finalProductSubtotalUsd)}</span>
                        </li>
                        {typeof detail.finalServiceFeeUsd === "number" ? (
                          <li className="flex justify-between gap-2">
                            <span className="text-ds-muted">{t("client.assistedPurchase.breakdownPlatform")}</span>
                            <span>{formatUsd(detail.finalServiceFeeUsd)}</span>
                          </li>
                        ) : null}
                        {typeof detail.finalFloridaTaxUsd === "number" ? (
                          <li className="flex justify-between gap-2">
                            <span className="text-ds-muted">{t("client.assistedPurchase.breakdownFlorida")}</span>
                            <span>{formatUsd(detail.finalFloridaTaxUsd)}</span>
                          </li>
                        ) : (
                          <li className="text-[10px] italic text-ds-muted">{t("client.assistedPurchase.legacyPricingNote")}</li>
                        )}
                      </>
                    ) : (
                      <li className="text-[10px] italic text-ds-muted">{t("client.assistedPurchase.legacyPricingNote")}</li>
                    )}
                    <li className="flex justify-between gap-2 border-t border-ds-border pt-1 font-semibold">
                      <span>{t("client.assistedPurchase.colFinal")}</span>
                      <span>{formatUsd(detail.finalTotalUsd)}</span>
                    </li>
                  </ul>
                </div>
              ) : null}

              {detail.adminNotes?.trim() ? (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wide text-ds-muted">{t("client.assistedPurchase.detailAdminNotes")}</p>
                  <p className="mt-2 rounded-lg border border-ds-border bg-ds-bg p-3 text-xs leading-relaxed">{detail.adminNotes}</p>
                </div>
              ) : null}

              {detail.storeName?.trim() || detail.storeOrderId?.trim() || detail.trackingNumber?.trim() ? (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wide text-ds-muted">
                    {t("client.assistedPurchase.detailSectionLogistics")}
                  </p>
                  <dl className="mt-2 divide-y divide-ds-border rounded-lg border border-ds-border bg-ds-bg px-3 text-xs">
                    {detail.storeName?.trim() ? (
                      <div className="flex justify-between gap-3 py-2">
                        <dt className="text-ds-muted">{t("client.assistedPurchase.detailStore")}</dt>
                        <dd className="max-w-[60%] text-right font-medium">{detail.storeName}</dd>
                      </div>
                    ) : null}
                    {detail.storeOrderId?.trim() ? (
                      <div className="flex justify-between gap-3 py-2">
                        <dt className="text-ds-muted">{t("client.assistedPurchase.detailStoreOrder")}</dt>
                        <dd className="font-mono text-[11px] font-medium">{detail.storeOrderId}</dd>
                      </div>
                    ) : null}
                    {detail.trackingNumber?.trim() ? (
                      <div className="flex justify-between gap-3 py-2">
                        <dt className="text-ds-muted">{t("client.assistedPurchase.detailTracking")}</dt>
                        <dd className="break-all font-mono text-[11px] font-medium">{detail.trackingNumber}</dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              ) : null}

              {typeof detail.debitedUsd === "number" ? (
                <div className="rounded-lg border border-ds-border bg-ds-bg px-3 py-2 text-xs">
                  <p className="font-semibold">
                    {t("client.assistedPurchase.detailDebited")}: {formatUsd(detail.debitedUsd)}
                  </p>
                  {detail.debitedAtIso ? (
                    <p className="mt-1 text-ds-muted">
                      {t("client.assistedPurchase.detailDebitedAt")}: {formatIsoDateTime(detail.debitedAtIso, locale)}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {detail.clientNotifications && detail.clientNotifications.length > 0 ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50/90 px-3 py-2 text-xs text-rose-950">
                  <p className="font-bold uppercase tracking-wide text-rose-900">{t("client.assistedPurchase.opsAlerts")}</p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5">
                    {detail.clientNotifications.map((n, i) => (
                      <li key={`${n.atIso}-${i}`}>{t(`client.assistedPurchase.alert.${n.type}`)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {detail.auditLog && detail.auditLog.length > 0 ? (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wide text-ds-muted">{t("client.assistedPurchase.detailAudit")}</p>
                  <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-lg border border-ds-border bg-ds-bg p-3 text-[11px] text-ds-muted">
                    {detail.auditLog.map((a, i) => (
                      <li key={`${a.atIso}-${i}`} className="border-b border-ds-border/60 pb-2 last:border-0 last:pb-0">
                        <span className="font-mono text-[10px] text-ds-text">{formatIsoDateTime(a.atIso, locale)}</span>
                        <span className="mx-1 text-ds-muted">·</span>
                        <span className="font-semibold text-ds-text">{a.actor}</span>
                        <span className="mx-1">—</span>
                        <span>{a.action}</span>
                        {a.detail ? <p className="mt-0.5 text-[10px]">{a.detail}</p> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
