import { mockRepriceStrategies } from "../../../lib/dbxReprice/mockData";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";

function modePt(m: string): string {
  if (m === "match") return "Igualar";
  if (m === "below") return "Abaixo";
  return m;
}

function targetPt(t: string): string {
  if (t === "buy_box") return "Buy Box";
  if (t === "lowest") return "Menor preço";
  return t;
}

function alonePt(a: string): string {
  if (a === "no_change") return "Não repricing";
  if (a === "lowest") return "Competir c/ menor";
  return a;
}

export function RepriceStrategiesPage() {
  const rows = mockRepriceStrategies;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-ds-card border border-ds-border bg-ds-surface shadow-ds">
        <table className="w-full min-w-[960px] border-collapse text-left text-xs">
          <thead className="bg-ds-bg text-ds-muted">
            <tr>
              <th className="px-3 py-2 font-semibold">Nome</th>
              <th className="px-3 py-2 font-semibold">Concorrência</th>
              <th className="px-3 py-2 font-semibold">Alvo</th>
              <th className="px-3 py-2 font-semibold">Sem concorrência</th>
              <th className="px-3 py-2 font-semibold tabular-nums">Rating mín.</th>
              <th className="px-3 py-2 font-semibold tabular-nums">Montante</th>
              <th className="px-3 py-2 font-semibold tabular-nums">Lucro mín. %</th>
              <th className="px-3 py-2 font-semibold tabular-nums">Lucro máx. %</th>
              <th className="px-3 py-2 font-semibold tabular-nums">Anúncios</th>
              <th className="px-3 py-2 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ds-border">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-ds-bg/80">
                <td className="px-3 py-2 font-semibold text-ds-text">{r.name}</td>
                <td className="px-3 py-2">{modePt(r.competitionMode)}</td>
                <td className="px-3 py-2">{targetPt(r.strategyTarget)}</td>
                <td className="px-3 py-2">{alonePt(r.whenNoCompetition)}</td>
                <td className="px-3 py-2 tabular-nums">{r.sellerRatingMin ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">
                  {r.amountUnit === "pct" ? `${r.amountValue}%` : `$${r.amountValue.toFixed(2)}`}
                </td>
                <td className="px-3 py-2 tabular-nums">{r.minProfitPct}%</td>
                <td className="px-3 py-2 tabular-nums">{r.maxProfitPct}%</td>
                <td className="px-3 py-2 tabular-nums font-semibold text-emerald-800">{r.listingsAssigned ?? "—"}</td>
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
        <button type="button" className="rounded-ds-btn bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700" onClick={() => toast.message("Demo: criar estratégia.")}>
          Nova estratégia
        </button>
      </div>
    </div>
  );
}
