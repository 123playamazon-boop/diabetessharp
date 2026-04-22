import { mockRepriceTemplates } from "../../../lib/dbxReprice/mockData";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";

export function RepriceTemplatesPage() {
  const rows = mockRepriceTemplates;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-ds-card border border-ds-border bg-ds-surface shadow-ds">
        <table className="w-full min-w-[900px] border-collapse text-left text-xs">
          <thead className="bg-ds-bg text-ds-muted">
            <tr>
              <th className="px-3 py-2 font-semibold">Nome</th>
              <th className="px-3 py-2 font-semibold tabular-nums">Lucro %</th>
              <th className="px-3 py-2 font-semibold tabular-nums">Taxa Amz. %</th>
              <th className="px-3 py-2 font-semibold tabular-nums">Frete forn.</th>
              <th className="px-3 py-2 font-semibold tabular-nums">Imposto forn. %</th>
              <th className="px-3 py-2 font-semibold tabular-nums">Desconto %</th>
              <th className="px-3 py-2 font-semibold tabular-nums">Bundle</th>
              <th className="px-3 py-2 font-semibold tabular-nums">Handling (d)</th>
              <th className="px-3 py-2 font-semibold tabular-nums">Qty</th>
              <th className="px-3 py-2 font-semibold">Reposição</th>
              <th className="px-3 py-2 font-semibold">Reprice</th>
              <th className="px-3 py-2 font-semibold">OOS→0</th>
              <th className="px-3 py-2 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ds-border">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-ds-bg/80">
                <td className="px-3 py-2 font-semibold text-ds-text">{r.name}</td>
                <td className="px-3 py-2 tabular-nums">{r.profitPct.toFixed(2)}%</td>
                <td className="px-3 py-2 tabular-nums">{r.amazonFeePct.toFixed(2)}%</td>
                <td className="px-3 py-2 tabular-nums">${r.supplierShippingUsd.toFixed(2)}</td>
                <td className="px-3 py-2 tabular-nums">{r.supplierTaxPct.toFixed(2)}%</td>
                <td className="px-3 py-2 tabular-nums">{r.supplierDiscountPct.toFixed(2)}%</td>
                <td className="px-3 py-2 tabular-nums">{r.bundleQty}</td>
                <td className="px-3 py-2 tabular-nums">{r.handlingDays}</td>
                <td className="px-3 py-2 tabular-nums">{r.defaultQty}</td>
                <td className="px-3 py-2">{r.restockQty ? "Sim" : "Não"}</td>
                <td className="px-3 py-2">{r.repriceOnAmazon ? "Sim" : "Não"}</td>
                <td className="px-3 py-2">{r.oosZeroQty ? "Sim" : "Não"}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button type="button" className="rounded-ds-btn p-1.5 text-amber-700 hover:bg-amber-50" aria-label="Editar" onClick={() => toast.message("Demo: editor em roadmap.")}>
                      <Pencil className="size-4" />
                    </button>
                    <button type="button" className="rounded-ds-btn p-1.5 text-red-700 hover:bg-red-50" aria-label="Eliminar" onClick={() => toast.message("Demo: sem eliminar.")}>
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <button type="button" className="rounded-ds-btn bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700" onClick={() => toast.message("Demo: novo modelo.")}>
          Novo modelo
        </button>
      </div>
    </div>
  );
}
