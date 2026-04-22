import type { DaySnapshot } from "../types";
import { formatMoney } from "../statusRules";

export function ComparisonSection({ days }: { days: DaySnapshot[] }) {
  return (
    <section className="section">
      <h2 className="section__title">Comparativo — mesmo horário aproximado</h2>
      <div className="compare-grid">
        {days.map((d) => (
          <article key={d.label + d.dateLabel} className={`compare-card${d.partial ? " compare-card--partial" : ""}`}>
            <h3 className="compare-card__head">
              {d.label} <span className="compare-card__date">{d.dateLabel}</span>
              {d.partial ? <span className="compare-card__tag">parcial</span> : null}
            </h3>
            <ul className="compare-card__list">
              <li>
                <span>Vendas</span> <strong>{d.vendas}</strong>
              </li>
              <li>
                <span>Gasto</span> <strong>{formatMoney(d.gasto)}</strong>
              </li>
              <li>
                <span>Profit</span>{" "}
                <strong className={d.profit >= 0 ? "text-pos" : "text-neg"}>{formatMoney(d.profit)}</strong>
              </li>
              <li>
                <span>ROAS</span> <strong>{d.roas.toFixed(2)}x</strong>
              </li>
              <li>
                <span>CPA</span> <strong>{formatMoney(d.cpa)}</strong>
              </li>
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
