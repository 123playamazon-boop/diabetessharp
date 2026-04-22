import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Copy, Package } from "lucide-react";
import { toast } from "sonner";
import { ImageLightbox } from "../../components/ImageLightbox";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { useI18n } from "../../i18n/context";
import type { AppLocale } from "../../i18n/catalog";
import type { AdminClientCard, InventoryKind, InventoryRow } from "../../types";
import { amazonImageUrlCandidates, looksLikeAmazonAsin } from "../../lib/productImageFallback";
import { decodeHtmlEntities } from "../../lib/decodeHtmlEntities";
import { storageRegistrationDate, storageUrgency, summarizeStorageFree } from "../../lib/storageFreeTier";
import { jsonAdminHeaders } from "../../lib/authHeaders";
import { apiUrl } from "../../lib/apiUrl";
import {
  CLIENT_INVENTORY_ADDITIONS_KEY,
  CLIENT_INVENTORY_DEDUCTIONS_KEY,
  getMergedInventoryView,
  INVENTORY_UPDATED_EVENT,
  loadAddedInventory,
  updateAddedInventoryRow,
} from "../../lib/clientInventoryStorage";
import { cn } from "../../lib/cn";
import { PageHeader } from "../../ui/PageHeader";
import { CustomerReturnsAdminPanel } from "../../components/admin/CustomerReturnsAdminPanel";

function formatRegDate(d: Date, locale: AppLocale): string {
  const tag = locale === "pt-BR" ? "pt-BR" : locale === "es" ? "es" : "en-US";
  return new Intl.DateTimeFormat(tag, { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

function kindLabel(k: InventoryKind, t: (key: string) => string): string {
  const key = `admin.stock.kind.${k}` as const;
  const s = t(key);
  return s === key ? k : s;
}

function AdminRowThumb({ row }: { row: InventoryRow }) {
  type Stage = "primary" | "asinA" | "asinB" | "icon";
  const tryAmazon = looksLikeAmazonAsin(row.asin);
  const [asinA, asinB] = tryAmazon ? amazonImageUrlCandidates(row.asin) : ["", ""];
  const computeStage = (): Stage => {
    if (row.imageUrl?.trim()) return "primary";
    if (tryAmazon) return "asinA";
    return "icon";
  };
  const [stage, setStage] = useState<Stage>(() => computeStage());
  const [zoomOpen, setZoomOpen] = useState(false);
  useEffect(() => {
    setStage(computeStage());
  }, [row.id, row.asin, row.imageUrl]);

  const src =
    stage === "primary" && row.imageUrl?.trim()
      ? row.imageUrl.trim()
      : stage === "asinA" && tryAmazon
        ? asinA
        : stage === "asinB" && tryAmazon
          ? asinB
          : null;

  const onError = () => {
    setStage((s) => {
      if (s === "primary") return tryAmazon ? "asinA" : "icon";
      if (s === "asinA") return tryAmazon ? "asinB" : "icon";
      return "icon";
    });
  };

  if (!src) {
    return (
      <span className="flex size-10 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-400">
        <Package className="size-5" aria-hidden />
      </span>
    );
  }
  return (
    <>
      <button
        type="button"
        className="block rounded-lg ring-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        title="Ampliar"
        onClick={() => setZoomOpen(true)}
      >
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          className="size-10 cursor-zoom-in rounded-lg border border-zinc-200 object-cover hover:opacity-95"
          onError={onError}
        />
      </button>
      {zoomOpen ? <ImageLightbox src={src} onClose={() => setZoomOpen(false)} /> : null}
    </>
  );
}

type StockTab = "atual" | "detalhado" | "alterar" | "retornos";

const STOCK_KIND_ORDER: InventoryKind[] = ["novo", "cadastro_pendente", "transito", "retorno", "problema"];

function StockEditSection({
  rows,
  addedIds,
  clientBySuite,
  t,
  refresh,
}: {
  rows: InventoryRow[];
  addedIds: Set<string>;
  clientBySuite: Record<string, string>;
  t: (key: string, vars?: Record<string, string | number>) => string;
  refresh: () => void;
}) {
  const editable = useMemo(() => rows.filter((r) => addedIds.has(r.id)), [rows, addedIds]);
  const [savingId, setSavingId] = useState<string | null>(null);

  if (editable.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 px-4 py-10 text-center text-sm text-zinc-600">
        {t("admin.stock.editEmpty")}
      </div>
    );
  }

  const onSave = async (row: InventoryRow) => {
    const el = document.getElementById(`stock-edit-qty-${row.id}`) as HTMLInputElement | null;
    const raw = el?.value ?? "";
    const v = raw === "" ? NaN : Number(raw);
    if (!Number.isFinite(v) || v < 0) {
      toast.error(t("admin.stock.editInvalidQty"));
      return;
    }
    setSavingId(row.id);
    const ok = await updateAddedInventoryRow(row.id, { qty: Math.floor(v) });
    setSavingId(null);
    if (ok) {
      toast.success(t("admin.stock.editSaved"), { description: decodeHtmlEntities(row.title).slice(0, 64) });
      refresh();
    } else {
      toast.error(t("admin.stock.editFail"));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-violet-600 px-4 py-3 text-white shadow-sm">
        <span className="font-semibold">{t("admin.stock.editTitle")}</span>
        <span className="text-sm font-bold tabular-nums">{t("admin.stock.barTotal", { n: editable.length })}</span>
      </div>
      <div className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-sm">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-0 table-fixed border-collapse text-left text-[11px] leading-snug text-zinc-800 sm:text-[12px]">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 sm:text-[11px]">
              <tr>
                <th className="w-12 px-2 py-3 sm:w-14 sm:px-3">{t("admin.stock.colPhoto")}</th>
                <th className="w-[4.5rem] px-2 py-3 sm:w-24 sm:px-3">{t("admin.stock.colSuite")}</th>
                <th className="min-w-0 px-2 py-3 sm:px-3">{t("admin.stock.colProduct")}</th>
                <th className="w-[5.5rem] px-2 py-3 sm:px-3">{t("admin.stock.colAsin")}</th>
                <th className="w-12 px-2 py-3 text-center sm:w-14 sm:px-3">{t("admin.stock.colQty")}</th>
                <th className="w-20 px-2 py-3 text-center sm:w-24 sm:px-3">{t("admin.stock.colNewQty")}</th>
                <th className="w-24 px-2 py-3 text-right sm:w-28 sm:px-3">{t("admin.stock.colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {editable.map((row) => {
                const nameCell =
                  row.clientName ?? (row.clientSuite ? clientBySuite[row.clientSuite] : undefined) ?? "—";
                return (
                  <tr key={row.id} className="hover:bg-zinc-50/70">
                    <td className="px-2 py-3 align-middle sm:px-3">
                      <AdminRowThumb row={row} />
                    </td>
                    <td className="min-w-0 px-2 py-3 font-mono text-[10px] font-semibold tabular-nums text-zinc-900 sm:px-3 sm:text-xs">
                      {row.clientSuite ?? "—"}
                    </td>
                    <td className="min-w-0 px-2 py-3 sm:px-3">
                      <p className="line-clamp-2 break-words font-medium" title={decodeHtmlEntities(row.title)}>
                        {decodeHtmlEntities(row.title)}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-[10px] text-zinc-500">{nameCell}</p>
                    </td>
                    <td className="min-w-0 px-2 py-3 sm:px-3">
                      <span
                        className="inline-block max-w-full truncate rounded-full border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold sm:px-2 sm:text-xs"
                        title={row.asin}
                      >
                        {row.asin}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-center font-semibold tabular-nums sm:px-3">{row.qty}</td>
                    <td className="px-2 py-3 text-center sm:px-3">
                      <input
                        id={`stock-edit-qty-${row.id}`}
                        key={`${row.id}-${row.qty}`}
                        type="number"
                        min={0}
                        step={1}
                        defaultValue={row.qty}
                        className="w-full max-w-[4.5rem] rounded-lg border border-zinc-200 px-1 py-1 text-center text-xs font-semibold tabular-nums outline-none ring-teal-200 focus:ring-2"
                      />
                    </td>
                    <td className="px-2 py-3 text-right sm:px-3">
                      <button
                        type="button"
                        disabled={savingId === row.id}
                        onClick={() => void onSave(row)}
                        className="rounded-lg bg-violet-600 px-2 py-1.5 text-[10px] font-bold text-white hover:bg-violet-700 disabled:opacity-60 sm:text-xs"
                      >
                        {savingId === row.id ? "…" : t("admin.stock.editSave")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function AdminStockPage() {
  const { t, locale } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [suiteFilter, setSuiteFilter] = useState("");
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [rows, setRows] = useState<InventoryRow[]>(() => getMergedInventoryView());
  const [clientBySuite, setClientBySuite] = useState<Record<string, string>>({});
  const [premiumBySuite, setPremiumBySuite] = useState<Record<string, boolean>>({});

  const refresh = useCallback(() => {
    setRows(getMergedInventoryView());
  }, []);

  useEffect(() => {
    refresh();
    const on = () => refresh();
    window.addEventListener(INVENTORY_UPDATED_EVENT, on);
    return () => window.removeEventListener(INVENTORY_UPDATED_EVENT, on);
  }, [refresh]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const su = searchParams.get("suite")?.trim();
    if (su) setSuiteFilter(su);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/admin/clients"), { headers: jsonAdminHeaders() });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { clients?: AdminClientCard[] };
        const map: Record<string, string> = {};
        const prem: Record<string, boolean> = {};
        for (const c of data.clients ?? []) {
          map[c.suite] = c.name;
          prem[c.suite] = c.premiumActive === true;
        }
        if (!cancelled) {
          setClientBySuite(map);
          setPremiumBySuite(prem);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Outro separador na mesma origem alterou `localStorage` (o evento custom só dispara no separador que gravou). */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (
        e.key == null ||
        e.key === CLIENT_INVENTORY_ADDITIONS_KEY ||
        e.key === CLIENT_INVENTORY_DEDUCTIONS_KEY
      ) {
        refresh();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onFocus = () => refresh();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const suiteOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      if (r.clientSuite?.trim()) s.add(r.clientSuite.trim());
    }
    return [...s].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [rows]);

  const filtered = useMemo(() => {
    void nowTick;
    const q = query.trim().toLowerCase();
    const sf = suiteFilter.trim();
    return rows.filter((r) => {
      if (sf && (r.clientSuite ?? "").trim() !== sf) return false;
      if (!q) return true;
      const suite = r.clientSuite ?? "";
      const nm = r.clientName ?? (suite ? clientBySuite[suite] : "") ?? "";
      const hay = `${r.asin} ${r.title} ${suite} ${nm}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, clientBySuite, suiteFilter, nowTick]);

  const storageAlerts = useMemo(() => {
    void nowTick;
    const warning: InventoryRow[] = [];
    const expired: InventoryRow[] = [];
    for (const r of filtered) {
      const u = storageUrgency(r, nowTick);
      if (u === "expired") expired.push(r);
      else if (u === "warning" || u === "critical") warning.push(r);
    }
    return { warning, expired };
  }, [filtered, nowTick]);

  const addedIds = useMemo(() => new Set(loadAddedInventory().map((r) => r.id)), [rows]);
  const localCadastroCount = useMemo(() => loadAddedInventory().length, [rows]);

  const vistaRaw = searchParams.get("vista");
  const stockTab: StockTab =
    vistaRaw === "detalhado" || vistaRaw === "alterar" || vistaRaw === "retornos" ? vistaRaw : "atual";

  const setStockTab = (tab: StockTab) => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (tab === "atual") n.delete("vista");
        else n.set("vista", tab);
        return n;
      },
      { replace: true },
    );
  };

  const overviewStats = useMemo(() => {
    const totalLines = rows.length;
    const totalQty = rows.reduce((acc, r) => acc + (Number.isFinite(r.qty) ? r.qty : 0), 0);
    const byKind: Record<InventoryKind, number> = {
      novo: 0,
      retorno: 0,
      transito: 0,
      problema: 0,
      cadastro_pendente: 0,
    };
    for (const r of rows) {
      byKind[r.kind] += 1;
    }
    const suiteMap = new Map<string, { skus: number; qty: number }>();
    for (const r of rows) {
      const su = (r.clientSuite ?? "").trim() || "—";
      const cur = suiteMap.get(su) ?? { skus: 0, qty: 0 };
      cur.skus += 1;
      cur.qty += Number.isFinite(r.qty) ? r.qty : 0;
      suiteMap.set(su, cur);
    }
    const topSuites = [...suiteMap.entries()]
      .sort(
        (a, b) =>
          b[1].qty - a[1].qty ||
          b[1].skus - a[1].skus ||
          a[0].localeCompare(b[0], undefined, { numeric: true }),
      )
      .slice(0, 15);
    return { totalLines, totalQty, byKind, topSuites };
  }, [rows]);

  const copyAsin = async (asin: string) => {
    const t0 = asin.trim();
    if (!t0) return;
    try {
      await navigator.clipboard.writeText(t0);
      toast.success(t("admin.stock.copyAsinOk"));
    } catch {
      toast.error(t("admin.stock.copyFail"));
    }
  };

  const setSuiteInUrl = (suite: string) => {
    const s = suite.trim();
    setSuiteFilter(s);
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (s) n.set("suite", s);
        else n.delete("suite");
        return n;
      },
      { replace: true },
    );
  };

  const disponibilizar = async (row: InventoryRow) => {
    if (!addedIds.has(row.id)) {
      toast.error(t("admin.stock.onlyClient"));
      return;
    }
    if (row.kind !== "cadastro_pendente" && row.kind !== "transito") return;
    const ok = await updateAddedInventoryRow(row.id, { kind: "novo" });
    if (ok) toast.success(t("admin.stock.releaseOk"), { description: row.title });
    else toast.error(t("admin.stock.releaseFail"));
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("admin.stock.eyebrow")}
        title={t("admin.stock.title")}
        subtitle={t("admin.stock.subtitle")}
        actions={<LanguageSwitcher />}
      />

      <div className="flex flex-wrap gap-1 rounded-2xl border border-zinc-200/90 bg-zinc-50/80 p-1 shadow-inner">
        {(
          [
            { id: "atual" as const, labelKey: "admin.stock.tabOverview" },
            { id: "detalhado" as const, labelKey: "admin.stock.tabDetailed" },
            { id: "alterar" as const, labelKey: "admin.stock.tabEdit" },
            { id: "retornos" as const, labelKey: "admin.stock.tabReturns" },
          ] as const
        ).map(({ id, labelKey }) => (
          <button
            key={id}
            type="button"
            onClick={() => setStockTab(id)}
            className={cn(
              "rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
              stockTab === id
                ? "bg-white text-violet-900 shadow-sm ring-2 ring-violet-500/35"
                : "text-zinc-600 hover:bg-white/70 hover:text-zinc-900",
            )}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {stockTab === "atual" ? (
        <>
          <p className="text-sm text-zinc-600">{t("admin.stock.overviewSubtitle")}</p>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-violet-600 px-4 py-3 text-sm text-white shadow-sm">
            <span className="font-semibold">{t("admin.stock.overviewTitle")}</span>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => refresh()}
                className="text-xs font-bold text-white/95 underline decoration-white/50 underline-offset-2 hover:text-white"
              >
                {t("admin.stock.reload")}
              </button>
              <span className="font-bold tabular-nums">{t("admin.stock.barTotal", { n: overviewStats.totalLines })}</span>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {t("admin.stock.overviewTotalLines")}
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-zinc-900">{overviewStats.totalLines}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {t("admin.stock.overviewTotalQty")}
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-zinc-900">{overviewStats.totalQty}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm md:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {t("admin.stock.overviewByKind")}
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {STOCK_KIND_ORDER.map((k) => (
                  <li
                    key={k}
                    className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-800"
                  >
                    <span>{kindLabel(k, t)}</span>
                    <span className="tabular-nums text-violet-700">{overviewStats.byKind[k]}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm md:col-span-2">
              <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {t("admin.stock.overviewTopSuites")}
              </div>
              <div className="max-w-full overflow-x-auto">
                <table className="w-full min-w-0 table-fixed border-collapse text-left text-xs text-zinc-800">
                  <thead className="border-b border-zinc-100 text-[10px] uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="w-28 px-3 py-2">{t("admin.stock.overviewSuiteCol")}</th>
                      <th className="w-24 px-3 py-2 text-right">{t("admin.stock.overviewSkusCol")}</th>
                      <th className="px-3 py-2 text-right">{t("admin.stock.overviewQtyCol")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {overviewStats.topSuites.map(([suite, agg]) => (
                      <tr key={suite} className="hover:bg-zinc-50/70">
                        <td className="px-3 py-2 font-mono text-[11px] font-semibold tabular-nums">{suite}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{agg.skus}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{agg.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {stockTab === "detalhado" ? (
        <>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-zinc-900">{t("admin.stock.detailedTitle")}</p>
            <p className="text-sm text-zinc-600">{t("admin.stock.detailedSubtitle")}</p>
          </div>
      <div className="rounded-2xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 shadow-sm">
        <p className="font-semibold">{t("admin.stock.bannerTitle")}</p>
        <p className="mt-1 text-xs leading-relaxed text-amber-900/95">{t("admin.stock.bannerBody")}</p>
        <p className="mt-1 text-xs font-semibold text-amber-900">
          {t("admin.orders.col.order")}: <strong className="tabular-nums">{localCadastroCount}</strong>
        </p>
        <p className="mt-2">
          <a
            href={`${typeof window !== "undefined" ? window.location.origin : ""}/app/estoque?aba=receber`}
            className="text-xs font-bold text-teal-800 underline decoration-teal-600/60 underline-offset-2 hover:text-teal-950"
          >
            {t("admin.stock.openClient")}
          </a>
          <span className="mx-2 text-amber-800/50">·</span>
          <button
            type="button"
            onClick={() => refresh()}
            className="text-xs font-bold text-teal-800 underline decoration-teal-600/60 underline-offset-2 hover:text-teal-950"
          >
            {t("admin.stock.reload")}
          </button>
        </p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-3xl border border-zinc-200/80 bg-white p-3 shadow-sm">
        <label className="sr-only" htmlFor="admin-stock-suite">
          {t("admin.orders.filterSuite")}
        </label>
        <select
          id="admin-stock-suite"
          value={suiteFilter}
          onChange={(e) => setSuiteFilter(e.target.value)}
          className="min-w-[140px] rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 outline-none ring-teal-200 focus:ring-4"
        >
          <option value="">{t("admin.stock.filterAllSuites")}</option>
          {suiteOptions.map((su) => (
            <option key={su} value={su}>
              {t("admin.orders.col.suite")} {su}
            </option>
          ))}
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-[200px] flex-1 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-teal-200 focus:ring-4"
          placeholder={t("admin.stock.searchPlaceholder")}
        />
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setSuiteFilter("");
          }}
          className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          {t("admin.stock.clear")}
        </button>
      </div>

      {storageAlerts.expired.length > 0 || storageAlerts.warning.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {storageAlerts.expired.length > 0 ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950 shadow-sm">
              <p className="font-bold">{t("admin.stock.alertExpiredTitle")}</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs font-medium leading-relaxed">
                {storageAlerts.expired.slice(0, 8).map((r) => (
                  <li key={r.id}>
                    Suite {r.clientSuite ?? "—"} — {decodeHtmlEntities(r.title).slice(0, 72)}
                    {r.title.length > 72 ? "…" : ""}
                  </li>
                ))}
              </ul>
              {storageAlerts.expired.length > 8 ? (
                <p className="mt-2 text-xs text-rose-900/80">{t("admin.stock.more", { n: storageAlerts.expired.length - 8 })}</p>
              ) : null}
            </div>
          ) : null}
          {storageAlerts.warning.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm">
              <p className="font-bold">{t("admin.stock.alertWarningTitle")}</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs font-medium leading-relaxed">
                {storageAlerts.warning.slice(0, 8).map((r) => {
                  const s = summarizeStorageFree(r, nowTick);
                  return (
                    <li key={r.id}>
                      Suite {r.clientSuite ?? "—"} — {t("storage.daysLeft", { n: s.daysLeft })} —{" "}
                      {decodeHtmlEntities(r.title).slice(0, 56)}
                      {r.title.length > 56 ? "…" : ""}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-sm">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-0 table-fixed border-collapse text-left text-[11px] leading-snug text-zinc-800 sm:text-[12px]">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 sm:text-[11px]">
              <tr>
                <th className="w-12 px-2 py-3 sm:w-14 sm:px-3">{t("admin.stock.colPhoto")}</th>
                <th className="w-[4.5rem] px-2 py-3 sm:w-24 sm:px-3">{t("admin.stock.colSuite")}</th>
                <th className="w-[18%] min-w-0 px-2 py-3 sm:px-3">{t("admin.stock.colClient")}</th>
                <th className="min-w-0 px-2 py-3 sm:px-3">{t("admin.stock.colProduct")}</th>
                <th className="w-[6.5rem] min-w-0 px-2 py-3 sm:w-32">{t("admin.stock.colStorage")}</th>
                <th className="w-[5.5rem] px-2 py-3 sm:w-28 sm:px-3">{t("admin.stock.colState")}</th>
                <th className="w-[5.5rem] px-2 py-3 sm:px-3">{t("admin.stock.colAsin")}</th>
                <th className="w-10 px-2 py-3 text-center sm:w-12 sm:px-3">{t("admin.stock.colQty")}</th>
                <th className="w-28 px-2 py-3 text-right sm:w-32 sm:px-3">{t("admin.stock.colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                    {t("admin.stock.emptyFilter")}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const canDisponibilizar =
                    addedIds.has(row.id) && (row.kind === "cadastro_pendente" || row.kind === "transito");
                  const suiteCell = row.clientSuite ?? "—";
                  const nameCell = row.clientName ?? (row.clientSuite ? clientBySuite[row.clientSuite] : undefined) ?? "—";
                  const st = summarizeStorageFree(row, nowTick);
                  const reg = storageRegistrationDate(row);
                  const urg = storageUrgency(row, nowTick);
                  const stClass =
                    urg === "expired"
                      ? "border-rose-200 bg-rose-50 text-rose-900"
                      : urg === "warning" || urg === "critical"
                        ? "border-amber-200 bg-amber-50 text-amber-950"
                        : "border-zinc-200 bg-white text-zinc-700";
                  return (
                    <tr key={row.id} className="hover:bg-zinc-50/70">
                      <td className="px-2 py-3 align-middle sm:px-3">
                        <AdminRowThumb row={row} />
                      </td>
                      <td className="min-w-0 px-2 py-3 font-mono text-[10px] font-semibold tabular-nums text-zinc-900 sm:px-3 sm:text-xs">
                        {suiteCell}
                      </td>
                      <td className="min-w-0 px-2 py-3 font-medium sm:px-3">
                        <span className="line-clamp-2 break-words" title={nameCell}>
                          {nameCell}
                        </span>
                      </td>
                      <td className="min-w-0 px-2 py-3 sm:px-3">
                        <span className="line-clamp-3 break-words" title={decodeHtmlEntities(row.title)}>
                          {decodeHtmlEntities(row.title)}
                        </span>
                      </td>
                      <td className="min-w-0 px-2 py-3 align-top">
                        <span
                          className={`inline-flex max-w-full flex-col gap-0.5 rounded-md border px-1.5 py-1 text-[10px] font-semibold leading-tight sm:px-2 sm:text-[11px] ${stClass}`}
                        >
                          {reg ? (
                            <span className="tabular-nums">{formatRegDate(reg, locale)}</span>
                          ) : (
                            <span className="font-medium">{t("admin.stock.storageNoDateShort")}</span>
                          )}
                          <span className="font-semibold tabular-nums">
                            {st.expired ? t("storage.expired") : t("storage.daysLeft", { n: st.daysLeft })}
                          </span>
                        </span>
                      </td>
                      <td className="min-w-0 px-2 py-3 align-top sm:px-3">
                        <span
                          className={
                            row.kind === "cadastro_pendente" || row.kind === "transito"
                              ? "inline-flex max-w-full rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 sm:px-2 sm:text-xs"
                              : "inline-flex max-w-full rounded-full border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700 sm:px-2 sm:text-xs"
                          }
                        >
                          {kindLabel(row.kind, t)}
                        </span>
                      </td>
                      <td className="min-w-0 px-2 py-3 sm:px-3">
                        <span
                          className="inline-block max-w-full truncate rounded-full border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold sm:px-2 sm:text-xs"
                          title={row.asin}
                        >
                          {row.asin}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-center font-semibold tabular-nums sm:px-3">{row.qty}</td>
                      <td className="min-w-0 px-2 py-3 sm:px-3">
                        <div className="ml-auto flex w-full max-w-[7.5rem] flex-col gap-1 sm:max-w-[9rem]">
                          {canDisponibilizar ? (
                            <button
                              type="button"
                              onClick={() => disponibilizar(row)}
                              className="w-full rounded-lg bg-teal-600 px-1.5 py-1 text-center text-[9px] font-bold leading-tight text-white hover:bg-teal-700 sm:text-[10px]"
                            >
                              {t("admin.stock.disponibilizar")}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            title={t("admin.stock.actionCopy")}
                            onClick={() => copyAsin(row.asin)}
                            className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-zinc-200 bg-white px-1.5 py-1 text-[9px] font-semibold text-zinc-700 hover:bg-zinc-50 sm:text-[10px]"
                          >
                            <Copy className="size-3 shrink-0 opacity-70" aria-hidden />
                            <span className="truncate">{t("admin.stock.actionCopy")}</span>
                          </button>
                          {row.clientSuite?.trim() ? (
                            <button
                              type="button"
                              title={t("admin.stock.actionFilterSuite")}
                              onClick={() => setSuiteInUrl(row.clientSuite!)}
                              className="w-full truncate rounded-lg border border-zinc-200 bg-white px-1.5 py-1 text-[9px] font-semibold text-zinc-700 hover:bg-zinc-50 sm:text-[10px]"
                            >
                              {t("admin.stock.actionFilterSuite")}
                            </button>
                          ) : null}
                          <Link
                            to="/admin/pedidos"
                            className="block w-full truncate rounded-lg border border-teal-100 bg-teal-50/80 px-1.5 py-1 text-center text-[9px] font-semibold text-teal-900 hover:bg-teal-100 sm:text-[10px]"
                          >
                            {t("admin.stock.actionOrders")}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      ) : null}

      {stockTab === "alterar" ? (
        <>
          <p className="text-sm text-zinc-600">{t("admin.stock.editSubtitle")}</p>
          <StockEditSection
            rows={rows}
            addedIds={addedIds}
            clientBySuite={clientBySuite}
            t={t}
            refresh={refresh}
          />
        </>
      ) : null}

      {stockTab === "retornos" ? (
        <CustomerReturnsAdminPanel rows={rows} premiumBySuite={premiumBySuite} t={t} locale={locale} />
      ) : null}
    </div>
  );
}
