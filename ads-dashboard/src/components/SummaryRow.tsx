import type { SummarySnapshot } from "../types";
import { formatMoney } from "../statusRules";

export function SummaryRow({ s, timeLabel }: { s: SummarySnapshot; timeLabel: string }) {
  return (
    <section className="section">
      <h2 className="section__title">Resumo hoje — {timeLabel}</h2>
      <div className="kpi-grid">
        <article className="kpi">
          <span className="kpi__label">Vendas</span>
          <strong className="kpi__value">{s.vendas}</strong>
          {s.vendasAtMorning != null ? (
            <span className="kpi__hint">às 7h: {s.vendasAtMorning}</span>
          ) : null}
        </article>
        <article className="kpi">
          <span className="kpi__label">Revenue</span>
          <strong className="kpi__value">{formatMoney(s.revenue)}</strong>
          <span className="kpi__hint">
            {s.vendas} × {formatMoney(s.avgOrderValue)}
          </span>
        </article>
        <article className="kpi">
          <span className="kpi__label">Gasto</span>
          <strong className="kpi__value">{formatMoney(s.gasto)}</strong>
          {s.gastoAtMorning != null ? (
            <span className="kpi__hint">às 7h: {formatMoney(s.gastoAtMorning)}</span>
          ) : null}
        </article>
        <article className="kpi">
          <span className="kpi__label">Profit</span>
          <strong className="kpi__value kpi__value--profit">{formatMoney(s.profit)}</strong>
          <span className="kpi__hint">preliminar</span>
        </article>
        <article className="kpi">
          <span className="kpi__label">ROAS</span>
          <strong className="kpi__value">{s.roas.toFixed(2)}x</strong>
          <span className="kpi__hint">meta: {s.metaRoas}x+</span>
        </article>
        <article className="kpi">
          <span className="kpi__label">CPA médio</span>
          <strong className="kpi__value">{formatMoney(s.cpa)}</strong>
          <span className="kpi__hint">meta: &lt;{formatMoney(s.metaCpa)}</span>
        </article>
      </div>
    </section>
  );
}
