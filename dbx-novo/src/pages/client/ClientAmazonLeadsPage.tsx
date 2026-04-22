import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Copy,
  Download,
  ExternalLink,
  LineChart,
  Link2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useClientProfile } from "../../context/ClientProfileContext";
import {
  getAmazonLeadsDaily,
  type AmazonLeadTableRow,
  type AmazonLeadsDailyEditionDto,
  type LeadRowStatus,
} from "../../lib/amazonLeadsApi";
import { formatUsd } from "../../lib/prepCenterPricing";
import { AMAZON_LEADS_PRO_MONTHLY_USD } from "../../lib/amazonLeadsProProduct";
import { cn } from "../../lib/cn";

type StatusFilter = "lista" | "todos" | "aprovado" | "reprovado";

type SortKey =
  | "productUsd"
  | "usdAmazon"
  | "netProfit"
  | "roi"
  | "ems"
  | "bsrCurrent"
  | "bsrAvg90"
  | "fba";

function rowLeadStatus(r: AmazonLeadTableRow): LeadRowStatus {
  return r.leadStatus ?? "lista";
}

function parseMoney(v: string | undefined): number | null {
  if (v == null || !String(v).trim()) return null;
  const n = Number.parseFloat(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function formatBsrDisplay(raw: string): string {
  if (!raw?.trim()) return "—";
  const n = Number.parseInt(raw.replace(/\D/g, ""), 10);
  if (!Number.isFinite(n) || n <= 0) return raw;
  return new Intl.NumberFormat("pt-BR").format(n);
}

function displayUsdCell(raw: string | undefined): string {
  if (raw == null || !String(raw).trim()) return "—";
  const s = String(raw).trim();
  if (s.startsWith("$")) return s;
  const n = parseMoney(s);
  if (n == null) return s;
  return `$${n.toFixed(2)}`;
}

function formatRoiDisplay(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  return `${Math.round(pct)} %`;
}

type SortState = { key: SortKey; dir: "asc" | "desc" } | null;

function sortValue(row: AmazonLeadTableRow, key: SortKey): number {
  switch (key) {
    case "productUsd":
      return parseMoney(row.productUsd) ?? -Infinity;
    case "usdAmazon":
      return parseMoney(row.usdAmazon) ?? -Infinity;
    case "netProfit":
      return parseMoney(row.netProfitUsd) ?? -Infinity;
    case "roi":
      return row.roiPct ?? -Infinity;
    case "ems":
      return row.emsMonthly ?? -Infinity;
    case "bsrCurrent":
      return Number.parseInt(row.bsrCurrent.replace(/\D/g, ""), 10) || -Infinity;
    case "bsrAvg90":
      return Number.parseInt(row.bsrAvg90.replace(/\D/g, ""), 10) || -Infinity;
    case "fba":
      return row.fbaOfferCount ?? -Infinity;
    default:
      return 0;
  }
}

function SortTh({
  label,
  sortKey,
  active,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  active: SortState;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const cur = active?.key === sortKey ? active.dir : null;
  return (
    <th className={cn("whitespace-nowrap px-2 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-600", className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 rounded px-0.5 text-left hover:text-violet-700"
      >
        {label}
        {cur === "desc" ? (
          <ArrowDown className="size-3.5 shrink-0 text-violet-600" aria-hidden />
        ) : cur === "asc" ? (
          <ArrowUp className="size-3.5 shrink-0 text-violet-600" aria-hidden />
        ) : (
          <ArrowUpDown className="size-3.5 shrink-0 text-slate-400" aria-hidden />
        )}
      </button>
    </th>
  );
}

export function ClientAmazonLeadsPage() {
  const { profile } = useClientProfile();
  const subscribed = profile.amazonLeadsProActive === true;
  const [loading, setLoading] = useState(false);
  const [edition, setEdition] = useState<AmazonLeadsDailyEditionDto | null>(null);
  const [recentDates, setRecentDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [disclaimer, setDisclaimer] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("lista");
  const [sort, setSort] = useState<SortState>({ key: "roi", dir: "desc" });

  const load = useCallback(async () => {
    setLoading(true);
    const r = await getAmazonLeadsDaily(profile.suite, selectedDate || undefined);
    setLoading(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setEdition(r.data.edition);
    setRecentDates(r.data.recentEditionDates ?? []);
    setDisclaimer(typeof r.data.disclaimer === "string" ? r.data.disclaimer : null);
  }, [profile.suite, selectedDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSort = (key: SortKey) => {
    setSort((prev) => {
      if (prev?.key !== key) return { key, dir: "desc" };
      if (prev.dir === "desc") return { key, dir: "asc" };
      return { key, dir: "desc" };
    });
  };

  const filteredRows = useMemo(() => {
    if (!edition?.rows) return [];
    return edition.rows.filter((r) => {
      const st = rowLeadStatus(r);
      if (statusFilter === "todos") return true;
      return st === statusFilter;
    });
  }, [edition?.rows, statusFilter]);

  const displayRows = useMemo(() => {
    if (!sort) return filteredRows;
    const { key, dir } = sort;
    const mul = dir === "desc" ? -1 : 1;
    return [...filteredRows].sort((a, b) => {
      const va = sortValue(a, key);
      const vb = sortValue(b, key);
      if (va === vb) return 0;
      return va < vb ? -1 * mul : 1 * mul;
    });
  }, [filteredRows, sort]);

  const onDownloadCsv = () => {
    if (!edition?.csv) return;
    const blob = new Blob([edition.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `direct-leads-pro-${edition.editionDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV descarregado.");
  };

  const copyAsin = (asin: string) => {
    void navigator.clipboard.writeText(asin).then(
      () => toast.success("ASIN copiado."),
      () => toast.error("Não foi possível copiar."),
    );
  };

  const priceLabel = formatUsd(AMAZON_LEADS_PRO_MONTHLY_USD);
  const dateMin = recentDates.length ? recentDates[recentDates.length - 1] : undefined;
  const dateMax = new Date().toISOString().slice(0, 10);
  const dateInputValue = selectedDate || edition?.editionDate || "";

  if (!subscribed) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 pb-10">
        <div>
          <Link
            to="/app/dashboard"
            className="inline-flex items-center gap-1 text-sm font-semibold text-ds-muted transition hover:text-ds-primary"
          >
            Voltar ao painel
          </Link>
          <div className="mt-3 flex flex-wrap items-start gap-3">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-ds-card bg-ds-soft-violet ring-1 ring-ds-primary/20">
              <LineChart className="size-6 text-ds-primary" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-tight text-ds-text">Leads Amazon (EUA)</h1>
              <p className="mt-1 text-sm text-ds-muted">
                A lista curada diária faz parte do add-on <strong className="text-ds-text">Direct Leads Pro</strong> (
                {priceLabel}/mês). A equipa publica até 50 ASINs validados por dia útil; com a assinatura activa, esta
                página mostra a edição no layout Direct Box USA.
              </p>
            </div>
          </div>
        </div>

        <section className="rounded-ds-card border border-ds-border bg-ds-surface p-6 shadow-ds">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ds-muted">Ainda sem assinatura</h2>
          <p className="mt-2 text-sm leading-relaxed text-ds-text">
            Veja o produto, o ritmo de entregas e peça a activação na sua suite.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/app/direct-leads-pro"
              className="rounded-ds-btn bg-ds-primary px-4 py-2.5 text-sm font-bold text-white shadow-ds"
            >
              Ver página do produto
            </Link>
            <Link
              to="/app/suporte"
              className="rounded-ds-btn border border-ds-border bg-ds-bg px-4 py-2.5 text-sm font-semibold text-ds-text shadow-ds"
            >
              Pedir activação
            </Link>
            <Link
              to="/direct-leads-pro"
              className="rounded-ds-btn border border-ds-border px-4 py-2.5 text-sm font-semibold text-ds-muted shadow-ds"
            >
              Landpage pública
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-0 pb-10">
      <header className="sticky top-0 z-20 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 bg-gradient-to-b from-slate-100 to-slate-50 px-3 py-3 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className="grid size-10 shrink-0 place-items-center rounded-lg bg-violet-600 text-lg font-light text-white shadow-md shadow-violet-900/20"
            aria-hidden
          >
            ◆
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-black uppercase leading-tight tracking-tight text-violet-950 sm:text-lg">
              Direct Box <span className="text-violet-600">USA</span>
            </div>
            <div className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-500">Lista de leads</div>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 sm:gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-600">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="min-w-[140px] rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-800 shadow-sm"
            >
              <option value="lista">Status Lista</option>
              <option value="todos">Todos</option>
              <option value="aprovado">Aprovados</option>
              <option value="reprovado">Reprovados</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-600">Listas anteriores</span>
            <div className="flex items-end gap-1">
              <input
                type="date"
                min={dateMin}
                max={dateMax}
                value={dateInputValue}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-[160px] rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-800 shadow-sm"
              />
              <button
                type="button"
                title="Carregar a edição mais recente"
                onClick={() => setSelectedDate("")}
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[10px] font-bold uppercase text-violet-700 hover:bg-violet-50"
              >
                Hoje
              </button>
            </div>
          </label>

          <div className="flex flex-wrap items-center gap-2 pb-0.5">
            <span className="text-sm font-semibold tabular-nums text-slate-800">
              Total de Produtos: <span className="text-violet-700">{displayRows.length}</span>
            </span>
            {edition && edition.rows.length > 0 ? (
              <button
                type="button"
                onClick={onDownloadCsv}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <Download className="size-3.5" aria-hidden />
                CSV
              </button>
            ) : null}
            <button
              type="button"
              disabled={loading}
              onClick={() => void load()}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {loading ? "…" : "Atualizar"}
            </button>
          </div>

          <Link
            to="/app/dashboard"
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-violet-900/25 transition hover:bg-violet-700"
          >
            Voltar
          </Link>
        </div>
      </header>

      {loading ? (
        <p className="flex items-center gap-2 px-4 py-3 text-sm text-slate-600">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          A carregar lista…
        </p>
      ) : null}

      {edition ? (
        <p className="border-b border-slate-100 bg-white px-4 py-1.5 text-[11px] text-slate-500">
          Edição <span className="font-mono font-semibold text-slate-700">{edition.editionDate}</span> · publicada{" "}
          {new Date(edition.publishedAtIso).toLocaleString("pt-BR")}
          {edition.pipelineNote ? (
            <>
              {" "}
              · <span className="italic">{edition.pipelineNote}</span>
            </>
          ) : null}
          {" · "}
          <Link to="/app/direct-leads-pro" className="font-semibold text-violet-600 underline-offset-2 hover:underline">
            Sobre Direct Leads Pro
          </Link>
        </p>
      ) : null}

      {!loading && edition == null ? (
        <p className="px-4 py-6 text-sm text-amber-800">
          Ainda não há edição publicada. Quando a equipa publicar no admin, a grelha aparece aqui.
        </p>
      ) : null}

      {disclaimer ? (
        <p className="border-b border-slate-100 bg-amber-50/50 px-4 py-2 text-[11px] leading-relaxed text-slate-600">{disclaimer}</p>
      ) : null}

      {edition && displayRows.length > 0 ? (
        <div className="overflow-x-auto border-y border-slate-200 bg-white shadow-inner">
          <table className="w-full min-w-[1400px] border-collapse text-left text-[12px] text-slate-800">
            <thead className="sticky top-0 z-10 bg-slate-200/90 text-slate-700 backdrop-blur-sm">
              <tr className="border-b border-slate-300">
                <th className="px-2 py-2.5 text-[11px] font-bold uppercase tracking-wide">Foto</th>
                <th className="px-2 py-2.5 text-[11px] font-bold uppercase tracking-wide">ASIN</th>
                <th className="px-2 py-2.5 text-[11px] font-bold uppercase tracking-wide">Amazon</th>
                <th className="px-2 py-2.5 text-[11px] font-bold uppercase tracking-wide">Loja</th>
                <th className="px-2 py-2.5 text-[11px] font-bold uppercase tracking-wide">Link loja</th>
                <th className="min-w-[140px] px-2 py-2.5 text-[11px] font-bold uppercase tracking-wide">Categoria</th>
                <SortTh label="$ Produto" sortKey="productUsd" active={sort} onSort={onSort} />
                <SortTh label="$ Amazon" sortKey="usdAmazon" active={sort} onSort={onSort} />
                <SortTh label="Net Profit" sortKey="netProfit" active={sort} onSort={onSort} />
                <SortTh label="ROI %" sortKey="roi" active={sort} onSort={onSort} />
                <SortTh label="EMS" sortKey="ems" active={sort} onSort={onSort} />
                <SortTh label="Current BSR" sortKey="bsrCurrent" active={sort} onSort={onSort} />
                <SortTh label="90 Days BSR" sortKey="bsrAvg90" active={sort} onSort={onSort} />
                <SortTh label="FBA" sortKey="fba" active={sort} onSort={onSort} />
                <th className="min-w-[160px] px-2 py-2.5 text-[11px] font-bold uppercase tracking-wide">Notas</th>
                <th className="px-2 py-2.5 text-[11px] font-bold uppercase tracking-wide">Frete $</th>
                <th className="px-2 py-2.5 text-[11px] font-bold uppercase tracking-wide">Cash back</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((r, idx) => (
                <tr
                  key={`${r.asin}-${idx}`}
                  className={cn("border-b border-slate-100", idx % 2 === 1 ? "bg-slate-50/80" : "bg-white")}
                >
                  <td className="px-2 py-2 align-middle">
                    {r.imageUrl ? (
                      <img
                        src={r.imageUrl}
                        alt=""
                        title={r.title || undefined}
                        className="size-11 rounded border border-slate-200 object-cover"
                      />
                    ) : (
                      <span className="inline-flex size-11 items-center justify-center rounded border border-slate-200 bg-slate-100 text-slate-400">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 align-middle">
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-[11px] font-semibold text-slate-900">{r.asin}</span>
                      <button
                        type="button"
                        onClick={() => copyAsin(r.asin)}
                        className="rounded p-0.5 text-violet-600 hover:bg-violet-50"
                        aria-label={`Copiar ${r.asin}`}
                      >
                        <Copy className="size-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-2 align-middle">
                    <a
                      href={r.amazonUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex rounded-full bg-amber-100 p-1.5 text-amber-700 ring-1 ring-amber-200/80 hover:bg-amber-200"
                      aria-label="Abrir na Amazon"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                  </td>
                  <td className="max-w-[160px] px-2 py-2 align-middle">
                    {r.storeUrl ? (
                      <span className="line-clamp-2 break-all text-[11px] text-slate-600" title={r.storeUrl}>
                        {r.storeUrl}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2 align-middle">
                    {r.storeProductUrl ? (
                      <a
                        href={r.storeProductUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex rounded-full bg-sky-100 p-1.5 text-sky-700 ring-1 ring-sky-200 hover:bg-sky-200"
                        aria-label="Abrir produto na loja"
                      >
                        <Link2 className="size-4" />
                      </a>
                    ) : r.storeUrl ? (
                      <a
                        href={r.storeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex rounded-full bg-sky-100 p-1.5 text-sky-700 ring-1 ring-sky-200 hover:bg-sky-200"
                        aria-label="Abrir loja"
                      >
                        <Link2 className="size-4" />
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="max-w-[180px] px-2 py-2 align-middle">
                    <span className="line-clamp-2 text-[11px] leading-snug text-slate-700" title={r.categoryLabel}>
                      {r.categoryLabel || "—"}
                    </span>
                  </td>
                  <td className="px-2 py-2 align-middle tabular-nums text-slate-800">{displayUsdCell(r.productUsd)}</td>
                  <td className="px-2 py-2 align-middle tabular-nums font-medium text-slate-900">{displayUsdCell(r.usdAmazon)}</td>
                  <td
                    className={cn(
                      "px-2 py-2 align-middle tabular-nums text-sm font-bold",
                      (parseMoney(r.netProfitUsd) ?? 0) < 0 ? "text-red-700" : "text-emerald-700",
                    )}
                  >
                    {r.netProfitUsd?.trim()
                      ? r.netProfitUsd.startsWith("$")
                        ? r.netProfitUsd
                        : displayUsdCell(r.netProfitUsd)
                      : "—"}
                  </td>
                  <td className="px-2 py-2 align-middle text-sm font-bold text-violet-700 tabular-nums">
                    {formatRoiDisplay(r.roiPct)}
                  </td>
                  <td className="px-2 py-2 align-middle tabular-nums text-slate-800">{r.emsMonthly ?? "—"}</td>
                  <td className="px-2 py-2 align-middle tabular-nums text-slate-800">{formatBsrDisplay(r.bsrCurrent)}</td>
                  <td className="px-2 py-2 align-middle tabular-nums text-slate-800">{formatBsrDisplay(r.bsrAvg90)}</td>
                  <td className="px-2 py-2 align-middle text-center tabular-nums font-medium text-slate-800">
                    {r.fbaOfferCount != null ? r.fbaOfferCount : "—"}
                  </td>
                  <td className="max-w-[200px] px-2 py-2 align-middle text-[11px] leading-snug text-slate-600">
                    {r.notas?.trim() ? (
                      <span className="line-clamp-3" title={r.notas}>
                        {r.notas}
                      </span>
                    ) : (
                      <span className="line-clamp-2 text-slate-400" title={r.title || undefined}>
                        {r.title || "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 align-middle tabular-nums text-slate-700">{displayUsdCell(r.shippingUsd)}</td>
                  <td className="px-2 py-2 align-middle text-[11px] text-slate-600">{r.cashBack?.trim() || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : edition && edition.rows.length > 0 && displayRows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-600">Nenhum produto com o filtro de status seleccionado.</p>
      ) : null}
    </div>
  );
}
