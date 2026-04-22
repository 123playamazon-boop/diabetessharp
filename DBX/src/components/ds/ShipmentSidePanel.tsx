import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { mockShipmentsLast7Days } from "../../mock/dashboard";

const days = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function ShipmentSidePanel() {
  const data = mockShipmentsLast7Days.map((v, i) => ({ name: days[i] ?? `D${i + 1}`, envios: v }));

  return (
    <aside className="flex flex-col gap-4">
      <section className="rounded-ds-card border border-ds-border bg-ds-surface p-4 shadow-ds">
        <h3 className="text-sm font-semibold text-ds-text">Envios (7 dias)</h3>
        <p className="mt-1 text-xs text-ds-muted">Recharts — decisão rápida, sem poluição visual.</p>
        <div className="mt-3 h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "rgba(108,92,231,0.06)" }}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #E5E7EB",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="envios" fill="#6C5CE7" radius={[6, 6, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-ds-card border border-ds-border bg-ds-surface p-4 shadow-ds">
        <h3 className="text-sm font-semibold text-ds-text">Checklist rápido</h3>
        <ul className="mt-2 space-y-2 text-sm text-ds-muted">
          <li className="flex gap-2">
            <span className="font-semibold text-ds-success">✓</span> Endereço da suite atualizado
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-ds-warning">!</span> Conferir itens com foto no inbound
          </li>
          <li className="flex gap-2">
            <span className="text-ds-muted">○</span> Etiqueta de transportadora anexada
          </li>
        </ul>
      </section>
    </aside>
  );
}
