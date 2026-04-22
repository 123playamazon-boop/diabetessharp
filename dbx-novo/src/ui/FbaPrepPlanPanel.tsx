import type { ClientOrder } from "../types";
import { cn } from "../lib/cn";
import { fbaPlanConsistencyMessage, fbaPlanPerBox, hasFbaBoxPlan } from "../lib/fbaOrderPlan";

type Variant = "admin" | "client";

export function FbaPrepPlanPanel({ order, variant }: { order: ClientOrder; variant: Variant }) {
  if (!hasFbaBoxPlan(order)) return null;
  const boxes = fbaPlanPerBox(order.fbaBoxGroups, order.fbaBoxSplits, order.fbaItemsSnapshot);
  const warn = fbaPlanConsistencyMessage(order);
  const isAdmin = variant === "admin";

  return (
    <div
      className={cn(
        "rounded-2xl border p-3 text-left",
        isAdmin ? "border-teal-200 bg-white/90 shadow-sm" : "border-ds-border bg-ds-bg/80",
      )}
    >
      <p
        className={cn(
          "text-[11px] font-bold uppercase tracking-wide",
          isAdmin ? "text-teal-900" : "text-ds-muted",
        )}
      >
        {isAdmin ? "Separar no armazém (FBA)" : "O que pediste ao prep (por grupo Amazon)"}
      </p>
      <p className={cn("mt-1 text-xs leading-relaxed", isAdmin ? "text-zinc-700" : "text-ds-muted")}>
        Cada bloco é um <strong className={isAdmin ? "text-zinc-900" : "text-ds-text"}>grupo</strong> (Inbound / envio
        Amazon) — embalar só as unidades indicadas; não misturar com outro grupo deste pedido.
      </p>
      {warn ? (
        <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-900">
          {warn}
        </p>
      ) : null}
      <div className={cn("mt-3 grid gap-3", boxes.length > 1 ? "sm:grid-cols-2" : "")}>
        {boxes.map((b) => (
          <div
            key={b.id}
            className={cn(
              "rounded-xl border p-3",
              isAdmin ? "border-teal-100 bg-teal-50/40" : "border-ds-border bg-ds-surface",
            )}
          >
            <p className={cn("text-xs font-bold", isAdmin ? "text-teal-950" : "text-ds-text")}>
              Grupo {b.index}
              {b.label ? (
                <>
                  {" "}
                  — <span className="font-semibold">{b.label}</span>
                </>
              ) : null}
            </p>
            {b.lines.length === 0 ? (
              <p className="mt-2 text-[11px] font-medium text-amber-800">Sem unidades neste grupo neste pedido.</p>
            ) : (
              <ul className="mt-2 space-y-1.5 text-xs">
                {b.lines.map((line) => (
                  <li
                    key={`${b.id}-${line.asin}`}
                    className={cn(
                      "rounded-lg border px-2 py-2",
                      isAdmin ? "border-white/80 bg-white/90" : "border-ds-border bg-ds-surface",
                    )}
                  >
                    <span className={cn("block min-w-0 font-medium", isAdmin ? "text-zinc-900" : "text-ds-text")}>
                      <span className={cn("tabular-nums font-bold", isAdmin ? "text-teal-800" : "text-ds-primary")}>
                        {line.qty}×
                      </span>{" "}
                      <span className={cn("font-mono text-[11px]", isAdmin ? "text-teal-700" : "text-ds-primary")}>
                        {line.asin}
                      </span>
                      <span
                        className={cn(
                          "mt-1 block text-left text-[11px] font-normal leading-snug break-words whitespace-normal",
                          isAdmin ? "text-zinc-600" : "text-ds-muted",
                        )}
                      >
                        {line.title}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function FbaPrepPlanMissingNote({ order }: { order: ClientOrder }) {
  if (order.service !== "FBA" || hasFbaBoxPlan(order)) return null;
  return (
    <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] font-medium text-amber-900">
      Pedido FBA sem plano de grupos guardado (criado antes desta funcionalidade).
    </p>
  );
}
