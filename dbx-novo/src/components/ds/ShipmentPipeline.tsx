import { Fragment } from "react";
import { Link } from "react-router-dom";
import { mockPipeline } from "../../mock/dashboard";
import type { ClientPipelineStage } from "../../lib/clientDashboardMetrics";
import { cn } from "../../lib/cn";

const toneRing: Record<string, string> = {
  zinc: "bg-ds-surface text-ds-text ring-ds-border",
  violet: "bg-ds-surface text-ds-primary ring-violet-200",
  blue: "bg-ds-surface text-sky-700 ring-sky-200",
  amber: "bg-ds-surface text-amber-900 ring-amber-200",
  emerald: "bg-ds-surface text-ds-success ring-emerald-200",
};

export type ShipmentPipelineProps = {
  stages?: ClientPipelineStage[];
};

export function ShipmentPipeline({ stages }: ShipmentPipelineProps) {
  const pipeline: ClientPipelineStage[] = stages ?? mockPipeline;
  return (
    <section className="rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds" aria-label="Pipeline de pedidos">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-ds-text">Pipeline de pedidos</h2>
          <p className="mt-1 text-sm text-ds-muted">Etapas conectadas — teclado: use Tab entre os nós.</p>
        </div>
        <Link
          to="/app/pedidos"
          className="text-sm font-semibold text-ds-primary hover:underline focus-visible:rounded-ds-btn focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
        >
          Abrir envios
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto pb-1">
        <div className="flex min-w-[640px] items-center px-1">
          {pipeline.map((stage, idx) => (
            <Fragment key={stage.id}>
              <div className="flex w-[112px] shrink-0 flex-col items-center">
                <Link
                  to="/app/pedidos"
                  className={cn(
                    "flex size-11 items-center justify-center rounded-full text-sm font-bold ring-2 transition hover:brightness-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary",
                    toneRing[stage.tone] ?? toneRing.zinc,
                  )}
                  aria-label={`${stage.label}: ${stage.count} pedidos`}
                >
                  {stage.count}
                </Link>
                <span className="mt-2 text-center text-[11px] font-semibold leading-tight text-ds-muted">{stage.label}</span>
              </div>
              {idx < pipeline.length - 1 ? (
                <div className="mx-1 h-px min-w-[8px] flex-1 bg-ds-border" aria-hidden />
              ) : null}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
