import { mockRepriceOrders } from "../../../lib/dbxReprice/mockData";
import type { RepriceOrderStatus } from "../../../lib/dbxReprice/types";
import { cn } from "../../../lib/cn";

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

function statusLabel(s: RepriceOrderStatus): string {
  const map: Record<RepriceOrderStatus, string> = {
    pending: "Pendente",
    shipped: "Enviado",
    canceled: "Cancelado",
    ordered: "Pedido",
    fulfillment_error: "Erro envio",
    out_of_stock: "Sem stock",
    refunded: "Reembolsado",
    return_requested: "Devolução",
  };
  return map[s];
}

function statusClass(s: RepriceOrderStatus): string {
  if (s === "shipped") return "bg-emerald-100 text-emerald-900 ring-emerald-200";
  if (s === "pending") return "bg-amber-100 text-amber-950 ring-amber-200";
  if (s === "canceled") return "bg-red-100 text-red-900 ring-red-200";
  return "bg-ds-bg text-ds-muted ring-ds-border";
}

export function RepriceOrdersPage() {
  const rows = mockRepriceOrders;
  const pending = rows.filter((r) => r.status === "pending").length;
  const shipped = rows.filter((r) => r.status === "shipped").length;
  const canceled = rows.filter((r) => r.status === "canceled").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-ds-card border border-ds-border bg-ds-surface p-4 shadow-ds">
        <label className="min-w-[140px] flex-1 text-xs font-semibold text-ds-muted">
          Pesquisa
          <input className="mt-1 w-full rounded-ds-btn border border-ds-border px-3 py-2 text-sm" placeholder="SKU, ASIN, order ID…" />
        </label>
        <label className="text-xs font-semibold text-ds-muted">
          Estado
          <select className="mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-bg px-2 py-2 text-sm">
            <option>Todos</option>
          </select>
        </label>
        <button type="button" className="rounded-ds-btn bg-ds-primary px-4 py-2 text-sm font-bold text-white">
          Filtrar
        </button>
      </div>

      <p className="text-xs text-ds-muted">
        {rows.length} pedidos · Pendente {pending} · Enviado {shipped} · Cancelado {canceled} (demo)
      </p>

      <div className="overflow-x-auto rounded-ds-card border border-ds-border bg-ds-surface shadow-ds">
        <table className="w-full min-w-[1200px] border-collapse text-left text-xs">
          <thead className="bg-ds-bg text-ds-muted">
            <tr>
              <th className="px-2 py-2 font-semibold">Data</th>
              <th className="px-2 py-2 font-semibold">Produto</th>
              <th className="px-2 py-2 font-semibold tabular-nums">Amazon</th>
              <th className="px-2 py-2 font-semibold tabular-nums">Taxa Amz.</th>
              <th className="px-2 py-2 font-semibold tabular-nums">Qty</th>
              <th className="px-2 py-2 font-semibold">Fornecedor</th>
              <th className="px-2 py-2 font-semibold tabular-nums">Custo forn.</th>
              <th className="px-2 py-2 font-semibold tabular-nums">Lucro</th>
              <th className="px-2 py-2 font-semibold tabular-nums">Margem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ds-border">
            {rows.map((r) => (
              <tr key={r.id} className="align-top hover:bg-ds-bg/80">
                <td className="px-2 py-2 whitespace-nowrap">
                  <div className="font-mono text-[11px] text-ds-text">{r.purchaseAtIso.slice(0, 10)}</div>
                  <span className={cn("mt-1 inline-flex rounded-ds-btn px-2 py-0.5 text-[10px] font-bold uppercase ring-1", statusClass(r.status))}>
                    {statusLabel(r.status)}
                  </span>
                </td>
                <td className="max-w-[240px] px-2 py-2">
                  <div className="font-semibold leading-snug text-ds-text">{r.title}</div>
                  <div className="mt-1 font-mono text-[10px] text-ds-muted">
                    {r.sku} ·{" "}
                    <a className="text-ds-primary hover:underline" href={`https://www.amazon.com/dp/${r.asin}`} target="_blank" rel="noreferrer">
                      {r.asin}
                    </a>
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-ds-primary">{r.amazonOrderId}</div>
                </td>
                <td className="px-2 py-2 tabular-nums">{money(r.amazonPrice)}</td>
                <td className="px-2 py-2 tabular-nums">{money(r.amazonFee)}</td>
                <td className="px-2 py-2 tabular-nums">{r.qtySold}</td>
                <td className="px-2 py-2 text-ds-muted">{r.supplierLabel}</td>
                <td className="px-2 py-2 tabular-nums">{money(r.supplierPrice + r.supplierTax + r.supplierShipping - r.supplierDiscount)}</td>
                <td className="px-2 py-2 tabular-nums font-semibold text-emerald-800">{money(r.profit)}</td>
                <td className="px-2 py-2 tabular-nums">{r.profitMarginPct.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
