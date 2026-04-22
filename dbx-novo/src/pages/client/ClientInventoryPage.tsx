import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, ChevronsUpDown, Download, Package } from "lucide-react";
import { PageHeader } from "../../ui/PageHeader";
import { cn } from "../../lib/cn";
import { decodeHtmlEntities } from "../../lib/decodeHtmlEntities";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { useI18n } from "../../i18n/context";
import type { AppLocale } from "../../i18n/catalog";
import { useClientProfile } from "../../context/ClientProfileContext";
import {
  getMergedInventoryView,
  INVENTORY_UPDATED_EVENT,
  pullInventoryFromServer,
} from "../../lib/clientInventoryStorage";
import { inventoryRowsForSuite } from "../../lib/clientDashboardMetrics";
import { getCustomerReturnMerchandiseFeePerUnitUsd } from "../../lib/customerReturnFee";
import { formatUsd, prepLineLabel } from "../../lib/prepCenterPricing";
import {
  storageRegistrationDate,
  storageUrgency,
  summarizeStorageFree,
} from "../../lib/storageFreeTier";
import type { InventoryKind, InventoryRow } from "../../types";

type TabId = "novos" | "retornos" | "receber" | "problemas";

type SortKey = "product" | "register" | "qty" | "storage" | "regdate";
type SortDir = "asc" | "desc";

const TAB_ROWS: { id: TabId; labelKey: string; kinds: InventoryKind[] }[] = [
  { id: "novos", labelKey: "client.inventory.tabNovos", kinds: ["novo"] },
  { id: "retornos", labelKey: "client.inventory.tabRetornos", kinds: ["retorno"] },
  { id: "receber", labelKey: "client.inventory.tabReceber", kinds: ["transito", "cadastro_pendente"] },
  { id: "problemas", labelKey: "client.inventory.tabProblemas", kinds: ["problema"] },
];

const COL_COUNT = 6;

function ymdForFilename(): string {
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}`;
}

function matchesTab(row: InventoryRow, tabId: TabId): boolean {
  const def = TAB_ROWS.find((x) => x.id === tabId);
  return def ? def.kinds.includes(row.kind) : false;
}

function prepFlowBadgeKey(kind: InventoryKind): string | null {
  if (kind === "cadastro_pendente") return "client.inventory.badgePending";
  if (kind === "transito") return "client.inventory.badgeTransit";
  if (kind === "problema") return "client.inventory.badgeIssue";
  return null;
}

function formatShortDate(d: Date, locale: AppLocale): string {
  const tag = locale === "pt-BR" ? "pt-BR" : locale === "es" ? "es" : "en-US";
  return new Intl.DateTimeFormat(tag, { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

function rowMatchesQuery(row: InventoryRow, q: string): boolean {
  const raw = q.trim().toLowerCase();
  if (!raw) return true;
  const bundle = [decodeHtmlEntities(row.title), row.asin].join(" ").toLowerCase();
  const tokens = raw.split(/\s+/).filter(Boolean);
  return tokens.every((tok) => bundle.includes(tok));
}

function sortInventoryRows(
  rows: InventoryRow[],
  sort: { key: SortKey; dir: SortDir } | null,
  nowMs: number,
): InventoryRow[] {
  if (!sort) return rows;
  const m = sort.dir === "asc" ? 1 : -1;
  const sf = (r: InventoryRow) => summarizeStorageFree(r, nowMs);
  return [...rows].sort((a, b) => {
    let cmp = 0;
    switch (sort.key) {
      case "product":
        cmp = decodeHtmlEntities(a.title).localeCompare(decodeHtmlEntities(b.title), undefined, {
          sensitivity: "base",
        });
        break;
      case "register":
        cmp = a.asin.localeCompare(b.asin, undefined, { numeric: true });
        break;
      case "qty":
        cmp = a.qty - b.qty;
        break;
      case "storage":
        cmp = sf(a).daysLeft - sf(b).daysLeft;
        break;
      case "regdate": {
        const ta = storageRegistrationDate(a)?.getTime() ?? 0;
        const tb = storageRegistrationDate(b)?.getTime() ?? 0;
        cmp = ta - tb;
        break;
      }
      default:
        cmp = 0;
    }
    if (cmp !== 0) return cmp * m;
    return a.id.localeCompare(b.id) * m;
  });
}

function escapeCsvCell(v: string): string {
  return `"${String(v).replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, csv: string) {
  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function conditionLabel(t: (key: string) => string, c: string): string {
  if (c === "new") return t("client.inventory.condNew");
  if (c === "used") return t("client.inventory.condUsed");
  if (c === "damaged") return t("client.inventory.condDamaged");
  return c;
}

function SortTh({
  labelKey,
  sortKey,
  current,
  onSort,
  t,
}: {
  labelKey: string;
  sortKey: SortKey;
  current: { key: SortKey; dir: SortDir } | null;
  onSort: (k: SortKey) => void;
  t: (key: string) => string;
}) {
  const active = current?.key === sortKey;
  const dir = active ? current?.dir : null;
  return (
    <th className="px-4 py-3">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-ds-muted hover:text-ds-text"
        aria-sort={!active ? "none" : dir === "asc" ? "ascending" : "descending"}
      >
        {t(labelKey)}
        {!active ? (
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" aria-hidden />
        ) : dir === "asc" ? (
          <ArrowUp className="size-3.5 shrink-0 text-ds-primary" aria-hidden />
        ) : (
          <ArrowDown className="size-3.5 shrink-0 text-ds-primary" aria-hidden />
        )}
      </button>
    </th>
  );
}

export function ClientInventoryPage() {
  const { profile } = useClientProfile();
  const { t, locale } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTabId = searchParams.get("aba");
  const resolvedFromUrl = TAB_ROWS.find((x) => x.id === urlTabId)?.id;

  const [tab, setTab] = useState<TabId>(resolvedFromUrl ?? "novos");
  const [refreshKey, setRefreshKey] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [detailRow, setDetailRow] = useState<InventoryRow | null>(null);
  const [listReady, setListReady] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);

  useEffect(() => {
    const aba = searchParams.get("aba");
    if (aba && TAB_ROWS.some((x) => x.id === aba)) setTab(aba as TabId);
  }, [searchParams]);

  useEffect(() => {
    const onUpdate = () => setRefreshKey((k) => k + 1);
    window.addEventListener(INVENTORY_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(INVENTORY_UPDATED_EVENT, onUpdate);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setListReady(false);
    void pullInventoryFromServer().finally(() => {
      if (!cancelled) {
        setRefreshKey((k) => k + 1);
        setListReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onFocus = () => {
      void pullInventoryFromServer().finally(() => setRefreshKey((k) => k + 1));
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    if (!detailRow) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetailRow(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailRow]);

  const rows = useMemo(() => {
    void refreshKey;
    return inventoryRowsForSuite(getMergedInventoryView(), profile.suite);
  }, [refreshKey, profile.suite]);

  const byTab = useMemo(() => {
    void nowTick;
    return rows.filter((r) => matchesTab(r, tab));
  }, [rows, tab, nowTick]);

  const searched = useMemo(() => byTab.filter((r) => rowMatchesQuery(r, query)), [byTab, query]);

  const displayRows = useMemo(
    () => sortInventoryRows(searched, sort, nowTick),
    [searched, sort, nowTick],
  );

  const returnFeeLabels = useMemo(
    () => ({
      free: formatUsd(getCustomerReturnMerchandiseFeePerUnitUsd("basic")),
      prem: formatUsd(getCustomerReturnMerchandiseFeePerUnitUsd("premium")),
    }),
    [],
  );

  const selectTab = (id: TabId) => {
    setTab(id);
    setSearchParams(id === "novos" ? {} : { aba: id });
  };

  const onSort = useCallback((key: SortKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }, []);

  const exportCsv = useCallback(() => {
    const headers = [
      t("client.inventory.colProduct"),
      t("client.inventory.colRegister"),
      t("client.inventory.colStockQty"),
      t("client.inventory.colRegDate"),
      t("client.inventory.colStorage"),
      t("client.inventory.detailKind"),
    ];
    const lines = [headers.map(escapeCsvCell).join(",")];
    for (const row of displayRows) {
      const reg = storageRegistrationDate(row);
      const st = summarizeStorageFree(row, nowTick);
      const kindKey = `admin.stock.kind.${row.kind}` as const;
      const kindText = t(kindKey);
      const kindCell = kindText === kindKey ? row.kind : kindText;
      lines.push(
        [
          decodeHtmlEntities(row.title),
          row.asin,
          String(row.qty),
          reg ? formatShortDate(reg, locale) : "—",
          `${t("storage.dayProgress", { used: st.daysUsed, limit: st.limitDays })}; ${st.expired ? t("storage.freeEnded") : t("storage.daysLeftLong", { n: st.daysLeft })}`,
          kindCell,
        ]
          .map(escapeCsvCell)
          .join(","),
      );
    }
    const tabSlug = TAB_ROWS.find((x) => x.id === tab)?.id ?? "stock";
    downloadCsv(`prep-inventory-${tabSlug}-${ymdForFilename()}.csv`, lines.join("\n"));
  }, [displayRows, locale, nowTick, t, tab]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title={t("client.inventory.title")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LanguageSwitcher />
            <Link
              to="/app/cadastro-produto"
              className="inline-flex items-center justify-center gap-2 rounded-ds-btn bg-ds-primary px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow-ds transition hover:opacity-95"
            >
              {t("client.inventory.register")}
            </Link>
          </div>
        }
      />

      <div className="rounded-ds-card border border-ds-primary/25 bg-ds-bg/90 p-4 shadow-ds">
        <div className="flex flex-wrap items-start gap-3">
          <Package className="mt-0.5 size-5 shrink-0 text-ds-primary" aria-hidden />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-xs font-black uppercase tracking-wide text-ds-primary">
              {t("client.inventory.returnsInfoTitle")}
            </p>
            <p className="text-sm leading-relaxed text-ds-text">
              {t("client.inventory.returnsInfoBody", returnFeeLabels)}
            </p>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold uppercase tracking-wide">
              <Link
                to="/app/financial"
                className="text-ds-primary underline underline-offset-2 transition hover:opacity-90"
              >
                {t("client.inventory.returnsInfoLinkFinancial")}
              </Link>
              <Link
                to="/app/premium"
                className="text-ds-primary underline underline-offset-2 transition hover:opacity-90"
              >
                {t("client.inventory.returnsInfoLinkPremium")}
              </Link>
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-ds-card border border-ds-border bg-ds-surface p-3 shadow-ds sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1 rounded-ds-btn bg-ds-bg p-1" role="tablist" aria-label={t("client.inventory.title")}>
          {TAB_ROWS.map((tb) => (
            <button
              key={tb.id}
              type="button"
              role="tab"
              aria-selected={tab === tb.id}
              onClick={() => selectTab(tb.id)}
              className={cn(
                "rounded-ds-btn px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary",
                tab === tb.id ? "bg-ds-surface text-ds-text shadow-ds ring-1 ring-ds-border" : "text-ds-muted hover:text-ds-text",
              )}
            >
              {t(tb.labelKey)}
            </button>
          ))}
        </div>
        <div className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">
          {displayRows.length === 1
            ? t("client.inventory.itemsOne", { n: displayRows.length })
            : t("client.inventory.itemsMany", { n: displayRows.length })}{" "}
          — {t(TAB_ROWS.find((x) => x.id === tab)?.labelKey ?? "client.inventory.tabNovos")}
        </div>
      </div>

      {tab === "receber" ? (
        <div className="rounded-ds-card border border-ds-border bg-ds-bg/90 p-3 text-sm leading-relaxed text-ds-text shadow-ds">
          {t("client.inventory.receberTabFlowHint")}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 rounded-ds-card border border-ds-border bg-ds-surface p-3 shadow-ds sm:flex-row sm:flex-wrap sm:items-center">
        <label className="sr-only" htmlFor="inv-client-search">
          {t("client.inventory.searchAria")}
        </label>
        <input
          id="inv-client-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("client.inventory.searchPlaceholder")}
          className="min-w-[200px] flex-1 rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-2 text-sm text-ds-text shadow-ds placeholder:text-ds-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ds-primary"
        />
        <div className="flex flex-wrap items-center gap-2">
          {sort ? (
            <button
              type="button"
              onClick={() => setSort(null)}
              className="rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-ds-text hover:bg-ds-surface"
            >
              {t("client.inventory.sortClear")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={exportCsv}
            disabled={displayRows.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-ds-text shadow-ds transition hover:bg-ds-bg disabled:opacity-50"
          >
            <Download className="size-3.5 shrink-0" aria-hidden />
            {t("client.inventory.exportCsv")}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-ds-card border border-ds-border bg-ds-surface shadow-ds">
        <div className="overflow-x-auto">
          <table
            className="min-w-[880px] w-full text-sm"
            aria-busy={!listReady}
            aria-label={!listReady ? t("client.inventory.skeletonAria") : undefined}
          >
            <thead className="bg-ds-bg text-left text-[10px] font-bold uppercase tracking-wide text-ds-muted">
              <tr>
                <SortTh labelKey="client.inventory.sortProduct" sortKey="product" current={sort} onSort={onSort} t={t} />
                <SortTh labelKey="client.inventory.sortRegister" sortKey="register" current={sort} onSort={onSort} t={t} />
                <SortTh labelKey="client.inventory.sortQty" sortKey="qty" current={sort} onSort={onSort} t={t} />
                <SortTh labelKey="client.inventory.sortRegDate" sortKey="regdate" current={sort} onSort={onSort} t={t} />
                <SortTh labelKey="client.inventory.sortStorage" sortKey="storage" current={sort} onSort={onSort} t={t} />
                <th className="px-4 py-3 text-right"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ds-border">
              {!listReady ? (
                <InventorySkeletonRows />
              ) : byTab.length === 0 ? (
                <tr>
                  <td colSpan={COL_COUNT} className="px-4 py-10 text-center text-sm text-ds-muted">
                    {t("client.inventory.emptyTab")}
                  </td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr>
                  <td colSpan={COL_COUNT} className="px-4 py-10 text-center text-sm text-ds-muted">
                    {t("client.inventory.emptySearch")}
                  </td>
                </tr>
              ) : (
                displayRows.map((row) => {
                  const st = summarizeStorageFree(row, nowTick);
                  const urg = storageUrgency(row, nowTick);
                  const stClass =
                    urg === "expired"
                      ? "border-ds-error/30 bg-red-50 text-ds-error"
                      : urg === "warning" || urg === "critical"
                        ? "border-ds-warning/40 bg-ds-soft-amber text-ds-soft-amber-icon"
                        : "border-ds-border bg-ds-bg text-ds-muted";
                  const badgeKey = prepFlowBadgeKey(row.kind);
                  const reg = storageRegistrationDate(row);
                  return (
                    <tr key={row.id} className="hover:bg-ds-bg/80">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-ds-btn bg-ds-bg ring-1 ring-ds-border">
                            {row.imageUrl ? (
                              <img src={row.imageUrl} alt="" className="size-full object-cover" />
                            ) : (
                              <Package className="size-5 text-ds-muted" aria-hidden />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-ds-text">{decodeHtmlEntities(row.title)}</p>
                            {badgeKey ? (
                              <p className="mt-1 text-[10px] font-bold uppercase leading-snug tracking-wide text-ds-muted">
                              {t(badgeKey)}
                            </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full border border-ds-border bg-ds-bg px-2 py-1 text-xs font-semibold text-ds-text">
                          {row.asin}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-ds-text">{row.qty}</td>
                      <td className="px-4 py-3 text-xs font-semibold tabular-nums text-ds-text">
                        {reg ? formatShortDate(reg, locale) : "—"}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex max-w-[240px] flex-col gap-1.5">
                          <span
                            className={cn(
                              "inline-flex flex-col gap-0.5 rounded-lg border px-2 py-1.5 text-[10px] font-bold uppercase leading-snug tracking-wide",
                              stClass,
                            )}
                          >
                            <span>{t("storage.dayProgress", { used: st.daysUsed, limit: st.limitDays })}</span>
                            <span className="text-[9px] font-bold uppercase leading-tight tracking-wide opacity-95">
                              {st.expired ? t("storage.freeEnded") : t("storage.daysLeftLong", { n: st.daysLeft })}
                              {st.mode === "estimated"
                                ? ` (${t("storage.modeEstimated")})`
                                : ` (${t("storage.modeCalendar")})`}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setDetailRow(row)}
                          className="rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-ds-text shadow-ds transition hover:bg-ds-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
                        >
                          {t("client.inventory.details")}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailRow ? (
        <DetailModal row={detailRow} t={t} locale={locale} onClose={() => setDetailRow(null)} />
      ) : null}
    </div>
  );
}

function InventorySkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i}>
          <td className="px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="size-10 shrink-0 animate-pulse rounded-ds-btn bg-ds-bg ring-1 ring-ds-border" />
              <div className="h-4 min-w-[120px] flex-1 animate-pulse rounded bg-ds-bg" />
            </div>
          </td>
          <td className="px-4 py-3">
            <div className="h-6 w-20 animate-pulse rounded-full bg-ds-bg" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-8 animate-pulse rounded bg-ds-bg" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-16 animate-pulse rounded bg-ds-bg" />
          </td>
          <td className="px-4 py-3">
            <div className="h-14 w-full max-w-[200px] animate-pulse rounded-lg bg-ds-bg" />
          </td>
          <td className="px-4 py-3 text-right">
            <div className="ml-auto h-9 w-20 animate-pulse rounded-ds-btn bg-ds-bg" />
          </td>
        </tr>
      ))}
    </>
  );
}

function DetailModal({
  row,
  t,
  locale,
  onClose,
}: {
  row: InventoryRow;
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: AppLocale;
  onClose: () => void;
}) {
  const st = summarizeStorageFree(row, Date.now());
  const kindKey = `admin.stock.kind.${row.kind}` as const;
  const kindText = t(kindKey);
  const reg = storageRegistrationDate(row);
  const prepPlanLabel =
    row.prepCenterPlan === "premium"
      ? t("client.inventory.prepPlanPremium")
      : t("client.inventory.prepPlanBasic");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inv-detail-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds">
        <div className="flex items-start justify-between gap-3">
          <h2 id="inv-detail-title" className="text-lg font-black uppercase tracking-wide text-ds-text">
            {t("client.inventory.detailTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-ds-btn px-2 py-1 text-sm font-semibold text-ds-muted hover:bg-ds-bg"
          >
            {t("client.inventory.detailClose")}
          </button>
        </div>
        <div className="mt-4 space-y-3 text-sm text-ds-text">
          {row.imageUrl ? (
            <img src={row.imageUrl} alt="" className="mx-auto max-h-40 rounded-ds-btn object-contain ring-1 ring-ds-border" />
          ) : null}
          <p>
            <span className="font-semibold text-ds-muted">{t("client.inventory.detailProduct")}:</span>{" "}
            {decodeHtmlEntities(row.title)}
          </p>
          <p>
            <span className="font-semibold text-ds-muted">{t("client.inventory.detailRegister")}:</span> {row.asin}
          </p>
          <p>
            <span className="font-semibold text-ds-muted">{t("client.inventory.detailQty")}:</span> {row.qty}
          </p>
          <p>
            <span className="font-semibold text-ds-muted">{t("client.inventory.detailKind")}:</span>{" "}
            {kindText === kindKey ? row.kind : kindText}
          </p>
          <p>
            <span className="font-semibold text-ds-muted">{t("client.inventory.detailRegistrationDate")}:</span>{" "}
            {reg ? formatShortDate(reg, locale) : "—"}
          </p>
          <p>
            <span className="font-semibold text-ds-muted">{t("client.inventory.detailStorage")}:</span>{" "}
            {t("storage.dayProgress", { used: st.daysUsed, limit: st.limitDays })} —{" "}
            {st.expired ? t("storage.freeEnded") : t("storage.daysLeftLong", { n: st.daysLeft })}
            {st.mode === "estimated" ? ` (${t("storage.modeEstimated")})` : ` (${t("storage.modeCalendar")})`}
          </p>
          {row.clientSuite ? (
            <p>
              <span className="font-semibold text-ds-muted">{t("client.inventory.detailSuite")}:</span> {row.clientSuite}
              {row.clientName ? ` · ${row.clientName}` : null}
            </p>
          ) : null}
          {row.supplier ? (
            <p>
              <span className="font-semibold text-ds-muted">{t("client.inventory.detailSupplier")}:</span> {row.supplier}
            </p>
          ) : null}
          {row.brand ? (
            <p>
              <span className="font-semibold text-ds-muted">{t("client.inventory.detailBrand")}:</span>{" "}
              {decodeHtmlEntities(row.brand)}
            </p>
          ) : null}
          {row.condition ? (
            <p>
              <span className="font-semibold text-ds-muted">{t("client.inventory.detailCondition")}:</span>{" "}
              {conditionLabel(t, row.condition)}
            </p>
          ) : null}
          {row.poNumber ? (
            <p>
              <span className="font-semibold text-ds-muted">{t("client.inventory.detailPo")}:</span> {row.poNumber}
            </p>
          ) : null}
          {row.arrivalDate ? (
            <p>
              <span className="font-semibold text-ds-muted">{t("client.inventory.detailArrival")}:</span> {row.arrivalDate}
            </p>
          ) : null}
          {row.suggestedSaleUsd != null ? (
            <div className="rounded-ds-btn border border-ds-soft-violet-border bg-ds-soft-violet/35 p-3 text-xs leading-relaxed">
              <p className="font-semibold text-ds-text">{t("client.inventory.detailPricingTitle")}</p>
              <p className="mt-1">
                <span className="font-semibold text-ds-muted">{t("client.inventory.detailSuggestedUnit")}:</span>{" "}
                <span className="text-base font-bold tabular-nums text-ds-primary">{formatUsd(row.suggestedSaleUsd)}</span>
              </p>
              {row.productCostUsd != null ? (
                <p className="mt-1">
                  <span className="font-semibold text-ds-muted">{t("client.inventory.detailProductCost")}:</span>{" "}
                  {formatUsd(row.productCostUsd)}
                  {row.prepCenterFeeUsd != null ? (
                    <>
                      {" "}
                      · {t("client.inventory.detailPrepShort")} {formatUsd(row.prepCenterFeeUsd)}
                    </>
                  ) : null}
                  {row.labelFeeUsd != null ? (
                    <>
                      {" "}
                      · {t("client.inventory.detailLabelShort")} {formatUsd(row.labelFeeUsd)}
                    </>
                  ) : null}
                </p>
              ) : null}
              {row.platformFeePct != null || row.desiredMarginPct != null ? (
                <p className="mt-1 text-ds-muted">
                  {row.platformFeePct != null ? <>{t("client.inventory.detailPlatformFee", { n: row.platformFeePct })} · </> : null}
                  {row.desiredMarginPct != null ? <>{t("client.inventory.detailMarginLine", { n: row.desiredMarginPct })}</> : null}
                </p>
              ) : null}
              {row.profitPerUnitUsd != null ? (
                <p className="mt-1">
                  <span className="font-semibold text-ds-muted">{t("client.inventory.detailProfitUnit")}:</span>{" "}
                  {formatUsd(row.profitPerUnitUsd)}
                </p>
              ) : null}
              {row.pricingPreviewQty != null && row.projectedProfitUsd != null ? (
                <p className="mt-1">
                  <span className="font-semibold text-ds-muted">
                    {t("client.inventory.detailProfitTotal", { n: row.pricingPreviewQty })}:
                  </span>{" "}
                  {formatUsd(row.projectedProfitUsd)}
                </p>
              ) : null}
              {row.prepCenterServiceId ? (
                <p className="mt-1 text-ds-muted">
                  {t("client.inventory.detailPrepLine", {
                    plan: prepPlanLabel,
                    service: prepLineLabel(row.prepCenterServiceId) ?? row.prepCenterServiceId,
                  })}
                </p>
              ) : null}
            </div>
          ) : null}
          {row.notes ? (
            <div>
              <p className="font-semibold text-ds-muted">{t("client.inventory.detailNotes")}</p>
              <p className="mt-1 whitespace-pre-wrap rounded-ds-btn bg-ds-bg p-3 text-xs leading-relaxed text-ds-text">
                {row.notes}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
