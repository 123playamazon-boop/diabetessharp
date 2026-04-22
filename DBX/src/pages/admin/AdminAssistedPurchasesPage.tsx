import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { useI18n } from "../../i18n/context";
import {
  fetchAdminAssistedPurchases,
  patchAdminAssistedChecklist,
  patchAdminAssistedReview,
  patchAdminAssistedUpdatePrice,
  postAdminAssistedNotifyClient,
  postAdminAssistedPurchaseOps,
  postAdminAssistedRefreshLink,
  type AssistedPurchaseAdminChecklistDto,
  type AssistedPurchaseClientAlertType,
  type AssistedPurchaseDto,
  type AssistedPurchaseStatus,
} from "../../lib/assistedPurchaseApi";
import { isScrapedUnitAboveRegisteredDto, previewAssistedPurchaseTotals } from "../../lib/assistedPurchasePricing";
import { formatUsd } from "../../lib/prepCenterPricing";
import { PageHeader } from "../../ui/PageHeader";

const NOTIFY_TYPES: AssistedPurchaseClientAlertType[] = [
  "price_higher_than_declared",
  "product_out_of_stock",
  "characteristics_mismatch",
  "shipping_timeframe_mismatch",
];

function formatNeedByYmd(ymd: string | undefined, locale: string): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "—";
  const d = new Date(`${ymd}T12:00:00`);
  const loc = locale === "pt-BR" ? "pt-PT" : locale === "es" ? "es-ES" : "en-US";
  return d.toLocaleDateString(loc, { day: "numeric", month: "short", year: "numeric" });
}

const STATUSES: AssistedPurchaseStatus[] = [
  "pending_review",
  "waiting_customer_approval",
  "approved",
  "purchasing",
  "purchased",
  "in_transit",
  "received",
  "cancelled",
];

export function AdminAssistedPurchasesPage() {
  const { t, locale } = useI18n();
  const [filter, setFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [allRows, setAllRows] = useState<AssistedPurchaseDto[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [productTitle, setProductTitle] = useState("");
  const [finalUnit, setFinalUnit] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeOrderId, setStoreOrderId] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [checklist, setChecklist] = useState<AssistedPurchaseAdminChecklistDto>({
    valueMatchesSupplierScreen: false,
    characteristicsMatchLink: false,
    shippingMatchesSupplier: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchAdminAssistedPurchases();
    setLoading(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setAllRows(r.purchases);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const f = filter.trim();
    if (!f) return allRows;
    return allRows.filter((p) => p.status === f);
  }, [allRows, filter]);

  const statusCounts = useMemo(() => {
    const c: Partial<Record<AssistedPurchaseStatus, number>> = {};
    for (const p of allRows) {
      c[p.status] = (c[p.status] ?? 0) + 1;
    }
    return c;
  }, [allRows]);

  const active = useMemo(() => allRows.find((x) => x.id === sel) ?? null, [allRows, sel]);

  const finalPreview = useMemo(() => {
    if (!active) return null;
    const u = Number(finalUnit.replace(",", ".").trim());
    if (!Number.isFinite(u) || u <= 0) return null;
    return previewAssistedPurchaseTotals(u, active.quantity);
  }, [active, finalUnit]);

  useEffect(() => {
    if (!active) {
      setAdminNotes("");
      setProductTitle("");
      setFinalUnit("");
      setStoreName("");
      setStoreOrderId("");
      setTrackingNumber("");
      setChecklist({
        valueMatchesSupplierScreen: false,
        characteristicsMatchLink: false,
        shippingMatchesSupplier: false,
      });
      return;
    }
    setAdminNotes(active.adminNotes ?? "");
    setProductTitle(active.productTitle);
    setFinalUnit(active.finalUnitPriceUsd != null ? String(active.finalUnitPriceUsd) : String(active.estimatedUnitPriceUsd));
    setStoreName(active.storeName ?? "");
    setStoreOrderId(active.storeOrderId ?? "");
    setTrackingNumber(active.trackingNumber ?? "");
    setChecklist({
      valueMatchesSupplierScreen: active.adminChecklist?.valueMatchesSupplierScreen ?? false,
      characteristicsMatchLink: active.adminChecklist?.characteristicsMatchLink ?? false,
      shippingMatchesSupplier: active.adminChecklist?.shippingMatchesSupplier ?? false,
    });
  }, [active]);

  const persistChecklist = async (next: AssistedPurchaseAdminChecklistDto) => {
    if (!active) return;
    setBusy(true);
    try {
      const r = await patchAdminAssistedChecklist(active.id, next);
      if (!r.ok) {
        toast.error(r.error);
        await load();
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  const toggleChecklist = async (key: keyof AssistedPurchaseAdminChecklistDto) => {
    const next = { ...checklist, [key]: !checklist[key] };
    setChecklist(next);
    await persistChecklist(next);
  };

  const notifyClient = async (type: AssistedPurchaseClientAlertType) => {
    if (!active) return;
    if (!window.confirm(t("admin.assistedPurchase.notifyConfirm"))) return;
    setBusy(true);
    try {
      const r = await postAdminAssistedNotifyClient(active.id, { type });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(t("admin.assistedPurchase.notifySent"));
      await load();
      setSel(active.id);
    } finally {
      setBusy(false);
    }
  };

  const saveReview = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const r = await patchAdminAssistedReview(active.id, { adminNotes: adminNotes.trim(), productTitle: productTitle.trim() });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(t("admin.assistedPurchase.reviewSaved"));
      await load();
    } finally {
      setBusy(false);
    }
  };

  const applyPrice = async (acceptEstimate: boolean) => {
    if (!active) return;
    setBusy(true);
    try {
      const body = acceptEstimate
        ? { acceptEstimate: true as const }
        : { finalUnitPriceUsd: Number(finalUnit.replace(",", ".")) };
      if (!acceptEstimate && (!Number.isFinite(body.finalUnitPriceUsd as number) || (body.finalUnitPriceUsd as number) <= 0)) {
        toast.error(t("admin.assistedPurchase.priceInvalid"));
        setBusy(false);
        return;
      }
      const r = await patchAdminAssistedUpdatePrice(active.id, body);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      if (r.needsClientApproval) toast.message(t("admin.assistedPurchase.needsClient"));
      else toast.success(t("admin.assistedPurchase.priceApplied"));
      await load();
    } finally {
      setBusy(false);
    }
  };

  const refreshLink = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const r = await postAdminAssistedRefreshLink(active.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(t("admin.assistedPurchase.refreshLinkOk"));
      if (r.scrapedPriceAboveRegistered && r.purchase) {
        toast.message(
          t("admin.assistedPurchase.priceWarnBanner", {
            scraped: formatUsd(r.purchase.linkScrapeUnitPriceUsd ?? 0),
            registered: formatUsd(r.purchase.registeredUnitPriceUsd ?? r.purchase.estimatedUnitPriceUsd),
          }),
          { duration: 9000 },
        );
      }
      await load();
      setSel(active.id);
    } finally {
      setBusy(false);
    }
  };

  const ops = async (action: string) => {
    if (!active) return;
    setBusy(true);
    try {
      const r = await postAdminAssistedPurchaseOps(active.id, {
        action,
        storeName: storeName.trim() || undefined,
        storeOrderId: storeOrderId.trim() || undefined,
        trackingNumber: trackingNumber.trim() || undefined,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(t("admin.assistedPurchase.opsOk"));
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("admin.assistedPurchase.eyebrow")}
        title={t("admin.assistedPurchase.title")}
        subtitle={t("admin.assistedPurchase.subtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50"
            >
              {t("admin.assistedPurchase.refresh")}
            </button>
          </div>
        }
      />

      {(statusCounts.pending_review ?? 0) > 0 ? (
        <div
          className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 shadow-sm"
          role="status"
        >
          {t("admin.assistedPurchase.newOrdersBanner", { n: statusCounts.pending_review ?? 0 })}
        </div>
      ) : null}

      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{t("admin.assistedPurchase.dashboardTitle")}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter("")}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${!filter.trim() ? "bg-teal-700 text-white" : "border border-zinc-200 bg-zinc-50 text-zinc-800 hover:bg-zinc-100"}`}
          >
            {t("admin.assistedPurchase.dashAll")} ({allRows.length})
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                filter === s ? "bg-teal-700 text-white" : "border border-zinc-200 bg-zinc-50 text-zinc-800 hover:bg-zinc-100"
              }`}
            >
              {t(`admin.assistedPurchase.dashLabel.${s}`)} ({statusCounts[s] ?? 0})
            </button>
          ))}
        </div>
        <label className="block text-xs font-semibold text-zinc-600">
          {t("admin.assistedPurchase.filterStatus")}
          <select
            className="mt-1 block w-full max-w-md rounded-xl border border-zinc-200 px-3 py-2 text-sm sm:w-auto"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">{t("admin.assistedPurchase.filterAll")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`client.assistedPurchase.status.${s}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {loading ? (
            <p className="p-4 text-sm text-zinc-600">…</p>
          ) : (
            <table className="w-full min-w-[960px] border-collapse text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2">{t("admin.assistedPurchase.colSuite")}</th>
                  <th className="px-3 py-2">{t("admin.assistedPurchase.colId")}</th>
                  <th className="w-14 px-1 py-2">
                    <span className="sr-only">{t("admin.assistedPurchase.colPhoto")}</span>
                  </th>
                  <th className="px-3 py-2">{t("admin.assistedPurchase.colTitle")}</th>
                  <th className="px-3 py-2">{t("admin.assistedPurchase.colStatus")}</th>
                  <th className="px-3 py-2">{t("admin.assistedPurchase.colTotal")}</th>
                  <th className="px-3 py-2">{t("admin.assistedPurchase.colProfit")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((p) => (
                  <tr
                    key={p.id}
                    className={`cursor-pointer hover:bg-zinc-50 ${sel === p.id ? "bg-teal-50/60" : ""}`}
                    onClick={() => setSel(p.id)}
                  >
                    <td className="px-3 py-2 font-semibold">{p.suite}</td>
                    <td className="px-3 py-2 font-mono text-xs">{p.id}</td>
                    <td className="px-1 py-2">
                      {p.productImageUrl ? (
                        <img
                          src={p.productImageUrl}
                          alt=""
                          className="size-10 rounded-md border border-zinc-200 object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="size-10 rounded-md border border-zinc-100 bg-zinc-50" aria-hidden />
                      )}
                    </td>
                    <td className="max-w-[200px] px-3 py-2">
                      <p className="line-clamp-2">{p.productTitle}</p>
                    </td>
                    <td className="px-3 py-2 text-xs">{t(`client.assistedPurchase.status.${p.status}`)}</td>
                    <td className="px-3 py-2 tabular-nums text-xs">
                      {formatUsd(p.finalTotalUsd ?? p.estimatedTotalUsd)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-xs text-teal-900">
                      {formatUsd(p.finalServiceFeeUsd ?? p.estimatedServiceFeeUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          {!active ? (
            <p className="text-sm text-zinc-600">{t("admin.assistedPurchase.pickRow")}</p>
          ) : (
            <>
              <p className="text-xs font-bold uppercase text-zinc-500">{active.id}</p>
              {active.productImageUrl ? (
                <img
                  src={active.productImageUrl}
                  alt=""
                  className="mt-2 max-h-40 w-full rounded-xl border border-zinc-200 object-contain"
                  loading="lazy"
                />
              ) : null}
              <a
                href={active.productUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 break-all text-xs font-semibold text-teal-700 hover:underline"
              >
                {t("admin.assistedPurchase.supplierLink")}
                <ExternalLink className="size-3.5 shrink-0" aria-hidden />
              </a>
              <button
                type="button"
                disabled={busy}
                onClick={() => void refreshLink()}
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2 text-xs font-bold text-zinc-800 hover:bg-zinc-100 disabled:opacity-50"
              >
                {t("admin.assistedPurchase.refreshLink")}
              </button>
              {isScrapedUnitAboveRegisteredDto(active) ? (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-[11px] font-semibold text-amber-950">
                  {t("admin.assistedPurchase.priceWarnBanner", {
                    scraped: formatUsd(active.linkScrapeUnitPriceUsd ?? 0),
                    registered: formatUsd(active.registeredUnitPriceUsd ?? active.estimatedUnitPriceUsd),
                  })}
                </p>
              ) : null}
              <p className="text-xs text-zinc-600">
                {t("admin.assistedPurchase.summaryLine", {
                  qty: active.quantity,
                  est: formatUsd(active.estimatedTotalUsd),
                  fee: String(Math.round(active.serviceFeeRate * 100)),
                })}
              </p>
              <div className="mt-2 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-700">
                <p className="font-bold uppercase tracking-wide text-zinc-500">{t("admin.assistedPurchase.breakdownBlock")}</p>
                {typeof active.floridaTaxUsd === "number" ? (
                  <ul className="mt-2 space-y-1 tabular-nums">
                    <li className="flex justify-between gap-2">
                      <span className="text-zinc-500">{t("client.assistedPurchase.breakdownSubtotal")}</span>
                      <span>{formatUsd(active.estimatedProductSubtotalUsd)}</span>
                    </li>
                    <li className="flex justify-between gap-2">
                      <span className="text-zinc-500">{t("client.assistedPurchase.breakdownPlatform")}</span>
                      <span>{formatUsd(active.estimatedServiceFeeUsd)}</span>
                    </li>
                    <li className="flex justify-between gap-2">
                      <span className="text-zinc-500">{t("client.assistedPurchase.breakdownFlorida")}</span>
                      <span>{formatUsd(active.floridaTaxUsd)}</span>
                    </li>
                    <li className="flex justify-between gap-2 border-t border-zinc-200 pt-1 font-semibold">
                      <span>{t("client.assistedPurchase.breakdownTotal")}</span>
                      <span>{formatUsd(active.estimatedTotalUsd)}</span>
                    </li>
                  </ul>
                ) : (
                  <p className="mt-1 text-zinc-500">{t("client.assistedPurchase.legacyPricingNote")}</p>
                )}
                <p className="mt-2 border-t border-zinc-200 pt-2 text-[11px] leading-snug text-zinc-600">
                  {t("admin.assistedPurchase.walletDebitHint")}
                </p>
                {typeof active.finalTotalUsd === "number" ? (
                  <p className="mt-2 border-t border-zinc-200 pt-2 text-xs font-semibold text-zinc-900">
                    {t("client.assistedPurchase.colFinal")}: {formatUsd(active.finalTotalUsd)}
                    {typeof active.finalFloridaTaxUsd === "number" ? (
                      <span className="mt-1 block font-normal text-zinc-600">
                        ({t("client.assistedPurchase.breakdownFlorida")}: {formatUsd(active.finalFloridaTaxUsd)})
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </div>
              <div className="mt-3 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[11px] text-zinc-800">
                <p className="font-bold uppercase tracking-wide text-zinc-500">{t("admin.assistedPurchase.clientPricingBlock")}</p>
                <p className="mt-1">
                  <span className="text-zinc-500">{t("admin.assistedPurchase.clientRegisteredUnit")}</span>{" "}
                  <span className="font-semibold tabular-nums">{formatUsd(active.registeredUnitPriceUsd ?? active.estimatedUnitPriceUsd)}</span>
                </p>
                <p className="mt-0.5">
                  <span className="text-zinc-500">{t("admin.assistedPurchase.linkScrapeUnit")}</span>{" "}
                  <span className="font-semibold tabular-nums">
                    {typeof active.linkScrapeUnitPriceUsd === "number" ? formatUsd(active.linkScrapeUnitPriceUsd) : "—"}
                  </span>
                </p>
                <p className="mt-2 font-bold uppercase tracking-wide text-zinc-500">{t("admin.assistedPurchase.clientNotesTitle")}</p>
                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-zinc-100 bg-zinc-50 p-2 text-[11px] leading-snug text-zinc-800">
                  {active.notes}
                </pre>
                <p className="mt-2 text-[11px] text-zinc-600">
                  <span className="font-semibold text-zinc-700">{t("admin.assistedPurchase.clientNeedBy")}:</span>{" "}
                  {formatNeedByYmd(active.requiredDeliveryByDate, locale)}
                </p>
              </div>
              <div className="mt-3 rounded-xl border border-teal-100 bg-teal-50/60 px-3 py-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-teal-900">{t("admin.assistedPurchase.checklistTitle")}</p>
                <p className="mt-1 text-[10px] text-teal-950/90">{t("admin.assistedPurchase.checklistHint")}</p>
                <ul className="mt-2 space-y-2 text-[11px] text-zinc-900">
                  <li className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0 rounded border-zinc-300"
                      checked={checklist.valueMatchesSupplierScreen}
                      disabled={busy}
                      onChange={() => void toggleChecklist("valueMatchesSupplierScreen")}
                    />
                    <span>{t("admin.assistedPurchase.checkValue")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0 rounded border-zinc-300"
                      checked={checklist.characteristicsMatchLink}
                      disabled={busy}
                      onChange={() => void toggleChecklist("characteristicsMatchLink")}
                    />
                    <span>{t("admin.assistedPurchase.checkChars")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0 rounded border-zinc-300"
                      checked={checklist.shippingMatchesSupplier}
                      disabled={busy}
                      onChange={() => void toggleChecklist("shippingMatchesSupplier")}
                    />
                    <span>{t("admin.assistedPurchase.checkShipping")}</span>
                  </li>
                </ul>
              </div>
              <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-amber-950">{t("admin.assistedPurchase.notifyTitle")}</p>
                <p className="mt-1 text-[10px] text-amber-950/90">{t("admin.assistedPurchase.notifyHint")}</p>
                <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {NOTIFY_TYPES.map((nt) => (
                    <button
                      key={nt}
                      type="button"
                      disabled={busy}
                      onClick={() => void notifyClient(nt)}
                      className="rounded-lg border border-amber-200 bg-white px-2 py-2 text-left text-[10px] font-bold uppercase leading-tight text-amber-950 hover:bg-amber-100 disabled:opacity-50"
                    >
                      {t(`admin.assistedPurchase.notify.${nt}`)}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block text-xs font-semibold text-zinc-700">
                {t("admin.assistedPurchase.fieldTitle")}
                <input className="mt-1 w-full rounded-xl border border-zinc-200 px-2 py-1.5 text-sm" value={productTitle} onChange={(e) => setProductTitle(e.target.value)} />
              </label>
              <label className="block text-xs font-semibold text-zinc-700">
                {t("admin.assistedPurchase.fieldAdminNotes")}
                <textarea className="mt-1 min-h-[72px] w-full rounded-xl border border-zinc-200 px-2 py-1.5 text-sm" value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
              </label>
              <button type="button" disabled={busy} onClick={() => void saveReview()} className="w-full rounded-xl bg-zinc-900 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50">
                {t("admin.assistedPurchase.saveReview")}
              </button>

              <hr className="border-zinc-200" />
              <p className="text-xs font-bold uppercase text-zinc-500">{t("admin.assistedPurchase.pricingBlock")}</p>
              <label className="block text-xs font-semibold text-zinc-700">
                {t("admin.assistedPurchase.fieldFinalUnit")}
                <input className="mt-1 w-full rounded-xl border border-zinc-200 px-2 py-1.5 text-sm tabular-nums" value={finalUnit} onChange={(e) => setFinalUnit(e.target.value)} inputMode="decimal" />
              </label>
              {finalPreview ? (
                <div className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-800">
                  <p className="font-bold text-zinc-600">{t("admin.assistedPurchase.finalPreviewTitle")}</p>
                  <ul className="mt-1 space-y-0.5 tabular-nums">
                    <li className="flex justify-between gap-2">
                      <span className="text-zinc-500">{t("client.assistedPurchase.breakdownSubtotal")}</span>
                      <span>{formatUsd(finalPreview.subtotalUsd)}</span>
                    </li>
                    <li className="flex justify-between gap-2">
                      <span className="text-zinc-500">{t("client.assistedPurchase.breakdownPlatform")}</span>
                      <span>{formatUsd(finalPreview.platformFeeUsd)}</span>
                    </li>
                    <li className="flex justify-between gap-2">
                      <span className="text-zinc-500">{t("client.assistedPurchase.breakdownFlorida")}</span>
                      <span>{formatUsd(finalPreview.floridaTaxUsd)}</span>
                    </li>
                    <li className="flex justify-between gap-2 border-t border-zinc-200 pt-1 font-semibold">
                      <span>{t("client.assistedPurchase.breakdownTotal")}</span>
                      <span>{formatUsd(finalPreview.totalUsd)}</span>
                    </li>
                  </ul>
                </div>
              ) : null}
              <div className="flex flex-col gap-2">
                <button type="button" disabled={busy} onClick={() => void applyPrice(false)} className="rounded-xl bg-teal-600 py-2 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50">
                  {t("admin.assistedPurchase.applyFinalUnit")}
                </button>
                <button type="button" disabled={busy} onClick={() => void applyPrice(true)} className="rounded-xl border border-teal-300 bg-teal-50 py-2 text-xs font-bold text-teal-900 hover:bg-teal-100 disabled:opacity-50">
                  {t("admin.assistedPurchase.acceptEstimate")}
                </button>
              </div>

              <hr className="border-zinc-200" />
              <p className="text-xs font-bold uppercase text-zinc-500">{t("admin.assistedPurchase.opsBlock")}</p>
              <label className="block text-xs font-semibold text-zinc-700">
                {t("admin.assistedPurchase.fieldStore")}
                <input className="mt-1 w-full rounded-xl border border-zinc-200 px-2 py-1.5 text-sm" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
              </label>
              <label className="block text-xs font-semibold text-zinc-700">
                {t("admin.assistedPurchase.fieldOrderId")}
                <input className="mt-1 w-full rounded-xl border border-zinc-200 px-2 py-1.5 text-sm" value={storeOrderId} onChange={(e) => setStoreOrderId(e.target.value)} />
              </label>
              <label className="block text-xs font-semibold text-zinc-700">
                {t("admin.assistedPurchase.fieldTracking")}
                <input className="mt-1 w-full rounded-xl border border-zinc-200 px-2 py-1.5 text-sm" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["purchasing", "purchased", "in_transit", "received"] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    disabled={busy}
                    onClick={() => void ops(a)}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 py-2 text-[10px] font-bold uppercase text-zinc-800 hover:bg-zinc-100 disabled:opacity-40"
                  >
                    {t(`admin.assistedPurchase.ops.${a}`)}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm(t("admin.assistedPurchase.cancelRefundConfirm"))) return;
                  void ops("cancel_refund");
                }}
                className="w-full rounded-xl border border-rose-200 bg-rose-50 py-2 text-xs font-bold text-rose-900 hover:bg-rose-100 disabled:opacity-50"
              >
                {t("admin.assistedPurchase.cancelRefund")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
