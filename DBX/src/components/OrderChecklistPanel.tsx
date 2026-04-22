import { CheckCircle2, Circle } from "lucide-react";
import type { ClientOrder } from "../types";
import { buildOrderClientChecklist } from "../lib/orderClientChecklist";
import { useI18n } from "../i18n/context";
import { cn } from "../lib/cn";

export function OrderChecklistPanel({ order, isUserOrder }: { order: ClientOrder; isUserOrder: boolean }) {
  const { t } = useI18n();
  const items = buildOrderClientChecklist(order, isUserOrder);
  if (items.length === 0) return null;
  return (
    <div className="rounded-ds-btn border border-ds-border bg-ds-bg/80 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-ds-primary">{t("client.orders.checklist.title")}</p>
      <ul className="mt-2 space-y-2">
        {items.map((it) => (
          <li key={it.id} className="flex gap-2 text-xs">
            {it.done ? (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <Circle className="size-4 shrink-0 text-ds-muted" aria-hidden />
            )}
            <div className="min-w-0">
              <span className={cn("font-semibold", it.done && "text-ds-muted line-through")}>
                {t(`client.orders.checklist.${it.labelKey}`)}
              </span>
              {it.hintKey ? (
                <p className="mt-0.5 text-[11px] leading-relaxed text-ds-muted">{t(`client.orders.checklist.${it.hintKey}`)}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
