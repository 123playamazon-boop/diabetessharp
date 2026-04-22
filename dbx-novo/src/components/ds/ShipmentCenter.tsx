import { useCallback, useId, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronRight, Package } from "lucide-react";
import { mockReadyShipments } from "../../mock/dashboard";
import { cn } from "../../lib/cn";

const steps = [
  { id: 0, title: "Dados do envio", desc: "Canal e referência" },
  { id: 1, title: "Itens", desc: "O que entra no pacote" },
  { id: 2, title: "Confirmar", desc: "Revisão final" },
] as const;

export function ShipmentCenter() {
  const [step, setStep] = useState(0);
  const stepperId = useId();

  const goNext = useCallback(() => {
    setStep((s) => Math.min(2, s + 1));
  }, []);

  const goPrev = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  return (
    <section
      className="flex h-full min-h-[420px] flex-col rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds"
      aria-labelledby="shipment-center-title"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="shipment-center-title" className="text-lg font-semibold text-ds-text">
            Central de envios
          </h2>
          <p className="text-sm text-ds-muted">Prontos para despacho + fluxo em 3 passos.</p>
        </div>
      </div>

      <div className="mt-5 grid flex-1 gap-5 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Prontos para envio</h3>
          <ul className="mt-2 space-y-2">
            {mockReadyShipments.length === 0 ? (
              <li className="rounded-ds-btn border border-dashed border-ds-border bg-ds-bg px-3 py-4 text-center text-sm text-ds-muted">
                Nenhum envio pronto — cria o primeiro em «Criar envio».
              </li>
            ) : (
              mockReadyShipments.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="inline-flex size-8 items-center justify-center rounded-ds-btn bg-ds-surface text-ds-primary ring-1 ring-ds-border">
                      <Package className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ds-text">{s.id}</div>
                      <div className="truncate text-xs text-ds-muted">
                        {s.channel} · {s.eta}
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-ds-text">{s.units} u</span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="lg:col-span-3">
          <div className="rounded-ds-btn border border-ds-border bg-ds-bg p-3">
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Passos para criar envio">
              {steps.map((s, idx) => {
                const active = step === idx;
                const done = step > idx;
                return (
                  <div key={s.id} className="flex min-w-0 flex-1 items-center gap-2">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={active}
                      aria-controls={`${stepperId}-panel-${idx}`}
                      id={`${stepperId}-tab-${idx}`}
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-2 rounded-ds-btn px-2 py-2 text-left text-sm font-semibold transition",
                        active && "bg-ds-surface text-ds-text ring-1 ring-ds-border shadow-ds",
                        done && !active && "text-ds-success",
                        !active && !done && "text-ds-muted hover:bg-ds-surface",
                      )}
                      onClick={() => setStep(idx)}
                    >
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-2",
                          done ? "bg-ds-success text-white ring-emerald-200" : active ? "bg-ds-primary text-white ring-violet-200" : "bg-ds-surface text-ds-muted ring-ds-border",
                        )}
                        aria-hidden
                      >
                        {done ? <Check className="size-4" strokeWidth={3} /> : idx + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate">{s.title}</span>
                        <span className="block truncate text-xs font-medium text-ds-muted">{s.desc}</span>
                      </span>
                    </button>
                    {idx < steps.length - 1 ? (
                      <ChevronRight className="size-4 shrink-0 text-ds-muted" aria-hidden />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className="mt-4 rounded-ds-card border border-ds-border bg-ds-surface p-4"
            role="tabpanel"
            id={`${stepperId}-panel-${step}`}
            aria-labelledby={`${stepperId}-tab-${step}`}
          >
            {step === 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold text-ds-muted">
                  Canal
                  <select className="mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-2 text-ds-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary">
                    <option>Amazon FBM</option>
                    <option>Amazon FBA</option>
                    <option>TikTok Shop</option>
                  </select>
                </label>
                <label className="text-sm font-semibold text-ds-muted">
                  Ref. do pedido
                  <input
                    className="mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-2 text-ds-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
                    placeholder="Ex.: 114-9922333-2211"
                  />
                </label>
              </div>
            ) : null}
            {step === 1 ? (
              <ul className="space-y-2 text-sm">
                {["SKU A · 12 u", "SKU B · 8 u", "Etiqueta FNSKU"].map((row) => (
                  <li key={row} className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="size-4 rounded border-ds-border text-ds-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary" aria-label={row} />
                    <span className="text-ds-text">{row}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {step === 2 ? (
              <p className="text-sm leading-relaxed text-ds-muted">
                Confirme os dados acima. Ao criar, o prep center recebe a ordem na fila de produção (demo).
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={goPrev}
                disabled={step === 0}
                className="rounded-ds-btn border border-ds-border bg-ds-surface px-4 py-2 text-sm font-semibold text-ds-text shadow-ds disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
              >
                Voltar
              </button>
              {step < 2 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="rounded-ds-btn border border-ds-border bg-ds-primary px-4 py-2 text-sm font-semibold text-white shadow-ds focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
                >
                  Continuar
                </button>
              ) : (
                <Link
                  to="/app/pedidos/criar"
                  className="inline-flex items-center justify-center rounded-ds-btn bg-cta-gradient px-5 py-2.5 text-sm font-bold text-white shadow-ds focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
                >
                  Criar envio
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
