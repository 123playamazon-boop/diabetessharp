import { useId, useMemo, useState } from "react";
import { Info } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { mockRepriceDashboardSeries, mockRepriceDashboardSummary } from "../../../lib/dbxReprice/mockData";
import { cn } from "../../../lib/cn";

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

export function RepriceDashboardPage() {
  const chartGradId = useId().replace(/:/g, "");
  const [metric, setMetric] = useState<"revenue" | "sales" | "buyBox" | "profit">("revenue");
  const summary = mockRepriceDashboardSummary;
  const series = mockRepriceDashboardSeries;

  const chartData = useMemo(() => {
    return series.map((d) => ({
      label: d.day.slice(5),
      revenue: d.revenue,
      sales: d.sales,
      buyBox: d.buyBoxPct,
      profit: d.profit,
    }));
  }, [series]);

  const dataKey =
    metric === "revenue" ? "revenue" : metric === "sales" ? "sales" : metric === "buyBox" ? "buyBox" : "profit";

  const kpis = [
    { id: "revenue" as const, title: "Receita", value: money(summary.revenueUsd) },
    { id: "sales" as const, title: "Vendas", value: String(summary.salesCount) },
    { id: "buyBox" as const, title: "Buy Box", value: `${summary.buyBoxPct.toFixed(2)}%`, hint: true },
    { id: "profit" as const, title: "Lucro", value: money(summary.profitUsd), hint: true },
  ];

  const last = series[series.length - 1]!;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setMetric(k.id)}
            className={cn(
              "rounded-ds-card border bg-ds-surface p-4 text-left shadow-ds transition hover:shadow-md",
              metric === k.id ? "border-ds-primary ring-2 ring-ds-primary/25" : "border-ds-border",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-ds-muted">{k.title}</span>
              {k.hint ? (
                <span className="text-ds-muted" title="Estimativa demo">
                  <Info className="size-3.5" aria-hidden />
                </span>
              ) : null}
            </div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-ds-text">{k.value}</div>
          </button>
        ))}
      </div>

      <p className="text-xs text-ds-muted">
        Período: {series[0]!.day} — {series[series.length - 1]!.day} (30 dias, demo)
      </p>

      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        <div className="rounded-ds-card border border-ds-border bg-ds-surface p-4 shadow-ds">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ds-muted">
            {metric === "revenue" && "Receita diária"}
            {metric === "sales" && "Unidades vendidas por dia"}
            {metric === "buyBox" && "% Buy Box (média do dia)"}
            {metric === "profit" && "Lucro diário"}
          </h2>
          <div className="mt-4 h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={chartGradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6c5ce7" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#6c5ce7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#71717a" />
                <YAxis tick={{ fontSize: 10 }} stroke="#71717a" width={44} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e4e4e7",
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey={dataKey} stroke="#6c5ce7" fill={`url(#${chartGradId})`} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-xs">
              <thead className="bg-ds-bg text-ds-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">Data</th>
                  <th className="px-3 py-2 font-semibold tabular-nums">Receita</th>
                  <th className="px-3 py-2 font-semibold tabular-nums">Vendas</th>
                  <th className="px-3 py-2 font-semibold tabular-nums">Buy Box</th>
                  <th className="px-3 py-2 font-semibold tabular-nums">Margem</th>
                  <th className="px-3 py-2 font-semibold tabular-nums">Lucro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ds-border">
                {[last].map((d) => (
                  <tr key={d.day} className="bg-ds-surface">
                    <td className="px-3 py-2 font-mono text-ds-text">{d.day}</td>
                    <td className="px-3 py-2 tabular-nums">{money(d.revenue)}</td>
                    <td className="px-3 py-2 tabular-nums">{d.sales}</td>
                    <td className="px-3 py-2 tabular-nums">{d.buyBoxPct.toFixed(2)}%</td>
                    <td className="px-3 py-2 tabular-nums">{d.profitMarginPct.toFixed(2)}%</td>
                    <td className="px-3 py-2 tabular-nums text-emerald-800">{money(d.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-ds-muted">Tabela resumida (demo); na versão completa listaríamos todos os dias.</p>
          </div>
        </div>

        <aside className="space-y-3">
          {[
            ["Anúncios ativos", summary.activeListings],
            ["Sem stock", summary.outOfStockListings],
            ["No Buy Box", `${summary.inBuyBox} (${((summary.inBuyBox / summary.activeListings) * 100).toFixed(2)}%)`],
            ["Concorrência abaixo do mínimo", summary.competitionBelowMin],
          ].map(([label, val]) => (
            <div key={String(label)} className="rounded-ds-card border border-ds-border bg-ds-surface p-4 shadow-ds">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-ds-muted">{label}</span>
                <button type="button" className="text-[11px] font-semibold text-ds-primary hover:underline">
                  Ver anúncios
                </button>
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums text-ds-text">{val}</div>
            </div>
          ))}

          <div className="rounded-ds-card border border-ds-border bg-ds-surface p-4 shadow-ds">
            <div className="text-xs font-bold uppercase tracking-wide text-ds-muted">Mix por fornecedor</div>
            <ul className="mt-3 space-y-2 text-sm">
              {summary.supplierMix.map((s) => (
                <li key={s.supplier} className="flex justify-between gap-2 tabular-nums">
                  <span className="text-ds-text">{s.label}</span>
                  <span className="font-semibold text-ds-muted">{s.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
