import type { DerivedAccount } from "../statusRules";
import { formatMoney, pctConvIc } from "../statusRules";
import { StatusBadge } from "./StatusBadge";

export function AccountsTable({ rows, timeLabel }: { rows: DerivedAccount[]; timeLabel: string }) {
  return (
    <section className="section">
      <h2 className="section__title">Por conta — {timeLabel}</h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Conta</th>
              <th>Nicho</th>
              <th className="num">Gasto</th>
              <th className="num">Conv</th>
              <th className="num">IC</th>
              <th className="num">Conv/IC</th>
              <th className="num">CPA</th>
              <th className="num">Revenue</th>
              <th className="num">Profit</th>
              <th className="num">ROAS</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="cell-strong">{r.conta}</td>
                <td>{r.nicho}</td>
                <td className="num">{formatMoney(r.gasto)}</td>
                <td className="num">{r.conv}</td>
                <td className="num">{r.ic}</td>
                <td className="num">{pctConvIc(r.convIc)}</td>
                <td className="num">{r.cpa != null ? formatMoney(r.cpa) : "—"}</td>
                <td className="num">{formatMoney(r.revenue)}</td>
                <td className={`num ${r.profit >= 0 ? "text-pos" : "text-neg"}`}>{formatMoney(r.profit)}</td>
                <td className="num">{r.roas.toFixed(2)}x</td>
                <td>
                  <StatusBadge label={r.statusLabel} tone={r.statusTone} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
