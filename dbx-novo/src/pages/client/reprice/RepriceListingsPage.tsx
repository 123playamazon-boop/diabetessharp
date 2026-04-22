import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { mockRepriceListings, mockRepriceStrategies, mockRepriceTemplates } from "../../../lib/dbxReprice/mockData";
import type { RepriceListingRow } from "../../../lib/dbxReprice/types";
import { cn } from "../../../lib/cn";

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

function EditListingModal({
  row,
  onClose,
  onSave,
}: {
  row: RepriceListingRow;
  onClose: () => void;
  onSave: (patch: Partial<RepriceListingRow>) => void;
}) {
  const [supplierPrice, setSupplierPrice] = useState(String(row.supplierPrice));
  const [amazonFeePct, setAmazonFeePct] = useState("15");
  const [profitPct, setProfitPct] = useState("25");
  const [yourPrice, setYourPrice] = useState(String(row.amazonPrice));
  const [minP, setMinP] = useState(String(row.minPrice));
  const [maxP, setMaxP] = useState(String(row.maxPrice));
  const [strategyId, setStrategyId] = useState(row.strategyId ?? "");
  const [tpl, setTpl] = useState(mockRepriceTemplates[0]!.id);
  const [repr, setRepr] = useState(true);
  const [oos, setOos] = useState(true);
  const [restock, setRestock] = useState(true);

  useEffect(() => {
    const t = mockRepriceTemplates.find((x) => x.id === tpl);
    if (!t) return;
    setAmazonFeePct(String(t.amazonFeePct));
    setProfitPct(String(t.profitPct));
  }, [tpl]);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div
        className="max-h-[min(92vh,720px)] w-full max-w-lg overflow-y-auto rounded-t-ds-card border border-ds-border bg-ds-surface shadow-2xl sm:rounded-ds-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reprice-edit-title"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-ds-border bg-ds-surface px-4 py-3">
          <div className="min-w-0">
            <h2 id="reprice-edit-title" className="text-sm font-bold uppercase tracking-wide text-ds-muted">
              Editar anúncio
            </h2>
            <p className="mt-1 line-clamp-2 text-sm font-semibold text-ds-text">{row.title}</p>
            <p className="mt-1 font-mono text-xs text-ds-muted">
              {row.asin} · {row.supplierLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-ds-btn p-2 text-ds-muted hover:bg-ds-bg hover:text-ds-text"
            aria-label="Fechar"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div className="flex justify-end">
            <label className="block w-full max-w-[200px] text-xs font-semibold text-ds-muted">
              Modelo
              <select
                className="mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-bg px-2 py-2 text-sm"
                value={tpl}
                onChange={(e) => setTpl(e.target.value)}
              >
                {mockRepriceTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-semibold text-ds-muted">
              Preço fornecedor
              <input
                className="mt-1 w-full rounded-ds-btn border border-ds-border px-2 py-2 text-sm tabular-nums"
                value={supplierPrice}
                onChange={(e) => setSupplierPrice(e.target.value)}
              />
            </label>
            <label className="text-xs font-semibold text-ds-muted">
              Lucro alvo (%)
              <input
                className="mt-1 w-full rounded-ds-btn border border-ds-border px-2 py-2 text-sm tabular-nums"
                value={profitPct}
                onChange={(e) => setProfitPct(e.target.value)}
              />
            </label>
            <label className="text-xs font-semibold text-ds-muted">
              Preço Amazon
              <input
                className="mt-1 w-full rounded-ds-btn border border-ds-border px-2 py-2 text-sm tabular-nums"
                value={yourPrice}
                onChange={(e) => setYourPrice(e.target.value)}
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-ds-muted">
              Taxa Amazon (%)
              <input
                className="mt-1 w-full rounded-ds-btn border border-ds-border px-2 py-2 text-sm tabular-nums"
                value={amazonFeePct}
                onChange={(e) => setAmazonFeePct(e.target.value)}
              />
            </label>
            <label className="text-xs font-semibold text-ds-muted">
              Qtd. em stock
              <input
                className="mt-1 w-full rounded-ds-btn border border-ds-border px-2 py-2 text-sm tabular-nums"
                defaultValue={row.qty}
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-ds-muted">
              Preço mínimo
              <input className="mt-1 w-full rounded-ds-btn border border-ds-border px-2 py-2 text-sm tabular-nums" value={minP} onChange={(e) => setMinP(e.target.value)} />
            </label>
            <label className="text-xs font-semibold text-ds-muted">
              Preço máximo
              <input className="mt-1 w-full rounded-ds-btn border border-ds-border px-2 py-2 text-sm tabular-nums" value={maxP} onChange={(e) => setMaxP(e.target.value)} />
            </label>
          </div>

          <label className="block text-xs font-semibold text-ds-muted">
            Estratégia
            <select
              className="mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-bg px-2 py-2 text-sm"
              value={strategyId}
              onChange={(e) => setStrategyId(e.target.value)}
            >
              <option value="">—</option>
              {mockRepriceStrategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-2 rounded-ds-card border border-ds-border bg-ds-bg px-3 py-3 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} className="size-4 rounded border-ds-border" />
              <span>Reposição automática de quantidade</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={repr} onChange={(e) => setRepr(e.target.checked)} className="size-4 rounded border-ds-border" />
              <span>Repricing ativo na Amazon</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={oos} onChange={(e) => setOos(e.target.checked)} className="size-4 rounded border-ds-border" />
              <span>Se OOS no fornecedor, qty Amazon → 0</span>
            </label>
          </div>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-ds-border bg-ds-surface px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-ds-btn border border-ds-border px-4 py-2 text-sm font-semibold text-ds-text hover:bg-ds-bg">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onSave({
                supplierPrice: Number.parseFloat(supplierPrice) || row.supplierPrice,
                amazonPrice: Number.parseFloat(yourPrice) || row.amazonPrice,
                minPrice: Number.parseFloat(minP) || row.minPrice,
                maxPrice: Number.parseFloat(maxP) || row.maxPrice,
                strategyId: strategyId || null,
                strategyLabel: mockRepriceStrategies.find((s) => s.id === strategyId)?.name ?? "—",
              });
              toast.success("Alterações guardadas (local, demo).");
              onClose();
            }}
            className="rounded-ds-btn bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

export function RepriceListingsPage() {
  const [rows, setRows] = useState(() => mockRepriceListings);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [edit, setEdit] = useState<RepriceListingRow | null>(null);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return rows;
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(n) ||
        r.sku.toLowerCase().includes(n) ||
        r.asin.toLowerCase().includes(n) ||
        r.supplierLabel.toLowerCase().includes(n),
    );
  }, [rows, q]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.id)));
  };

  return (
    <div className="space-y-4">
      {edit ? (
        <EditListingModal
          row={edit}
          onClose={() => setEdit(null)}
          onSave={(patch) => {
            setRows((prev) => prev.map((r) => (r.id === edit.id ? { ...r, ...patch } : r)));
          }}
        />
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-ds-card border border-ds-border bg-ds-surface p-4 shadow-ds">
        <label className="min-w-[160px] flex-1 text-xs font-semibold text-ds-muted">
          Pesquisa
          <input
            className="mt-1 w-full rounded-ds-btn border border-ds-border px-3 py-2 text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Título, SKU, ASIN…"
          />
        </label>
        <label className="text-xs font-semibold text-ds-muted">
          Fornecedor
          <select className="mt-1 w-full min-w-[120px] rounded-ds-btn border border-ds-border bg-ds-bg px-2 py-2 text-sm">
            <option>Todos</option>
            <option>Walmart</option>
            <option>{"Sam's Club"}</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-ds-muted">
          Por página
          <select className="mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-bg px-2 py-2 text-sm">
            <option>50</option>
            <option>100</option>
            <option>500</option>
          </select>
        </label>
        <button type="button" className="rounded-ds-btn bg-ds-primary px-4 py-2 text-sm font-bold text-white shadow-sm">
          Filtrar
        </button>
      </div>

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-ds-card border border-ds-border bg-ds-bg px-4 py-2 text-sm">
          <span className="font-semibold text-ds-text">{selected.size} selecionados</span>
          <button type="button" className="rounded-ds-btn bg-red-600 px-3 py-1.5 text-xs font-bold text-white" onClick={() => toast.message("Demo: sem eliminação.")}>
            Eliminar
          </button>
          <button type="button" className="rounded-ds-btn bg-ds-primary px-3 py-1.5 text-xs font-bold text-white" onClick={() => toast.message("Demo: sem export.")}>
            Exportar CSV
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-ds-card border border-ds-border bg-ds-surface shadow-ds">
        <table className="w-full min-w-[1100px] border-collapse text-left text-xs">
          <thead className="bg-ds-bg text-ds-muted">
            <tr>
              <th className="w-10 px-2 py-2">
                <input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleAll} aria-label="Selecionar todos" />
              </th>
              <th className="px-2 py-2 font-semibold">Produto</th>
              <th className="px-2 py-2 font-semibold">Fornecedor</th>
              <th className="px-2 py-2 font-semibold tabular-nums">Custo</th>
              <th className="px-2 py-2 font-semibold tabular-nums">Frete forn.</th>
              <th className="px-2 py-2 font-semibold tabular-nums">Bundle</th>
              <th className="px-2 py-2 font-semibold tabular-nums">Qty</th>
              <th className="px-2 py-2 font-semibold tabular-nums">Preço Amazon</th>
              <th className="px-2 py-2 font-semibold tabular-nums">Mínimo</th>
              <th className="px-2 py-2 font-semibold tabular-nums">Máximo</th>
              <th className="px-2 py-2 font-semibold tabular-nums">Lucro</th>
              <th className="px-2 py-2 font-semibold">Estratégia</th>
              <th className="px-2 py-2 font-semibold tabular-nums">Pedidos</th>
              <th className="px-2 py-2 font-semibold"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ds-border">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-ds-bg/80">
                <td className="px-2 py-2">
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Selecionar ${r.sku}`} />
                </td>
                <td className="max-w-[220px] px-2 py-2">
                  <div className="font-semibold leading-snug text-ds-text">{r.title}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-ds-muted">
                    {r.sku} ·{" "}
                    <a className="text-ds-primary hover:underline" href={`https://www.amazon.com/dp/${r.asin}`} target="_blank" rel="noreferrer">
                      {r.asin}
                    </a>
                  </div>
                </td>
                <td className="px-2 py-2 text-ds-muted">{r.supplierLabel}</td>
                <td className="px-2 py-2 tabular-nums">{money(r.supplierPrice)}</td>
                <td className="px-2 py-2 tabular-nums">{money(r.supplierShipping)}</td>
                <td className="px-2 py-2 tabular-nums">{r.bundleQty}</td>
                <td className="px-2 py-2 tabular-nums">{r.qty}</td>
                <td className={cn("px-2 py-2 tabular-nums font-semibold", "bg-emerald-50 text-emerald-900")}>{money(r.amazonPrice)}</td>
                <td className="px-2 py-2 tabular-nums text-ds-text">{money(r.minPrice)}</td>
                <td className="px-2 py-2 tabular-nums text-ds-text">{money(r.maxPrice)}</td>
                <td className="px-2 py-2 tabular-nums font-semibold text-emerald-800">{money(r.profit)}</td>
                <td className="px-2 py-2">
                  <span className="rounded-ds-btn bg-ds-bg px-2 py-1 text-[11px] font-medium ring-1 ring-ds-border">{r.strategyLabel}</span>
                </td>
                <td className="px-2 py-2 tabular-nums">{r.orderCount}</td>
                <td className="px-2 py-2">
                  <button type="button" className="text-[11px] font-bold uppercase tracking-wide text-ds-primary hover:underline" onClick={() => setEdit(r)}>
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
