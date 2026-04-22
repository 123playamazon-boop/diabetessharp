import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useI18n } from "../i18n/context";
import { cn } from "../lib/cn";

type PaletteItem = { to: string; labelKey: string; groupKey: string };

const ROUTES: PaletteItem[] = [
  { to: "/app/tools", labelKey: "client.palette.tools", groupKey: "client.palette.groupContent" },
  { to: "/app/dashboard", labelKey: "client.palette.dashboard", groupKey: "client.palette.groupMain" },
  { to: "/app/estoque", labelKey: "client.palette.inventory", groupKey: "client.palette.groupMain" },
  { to: "/app/pedidos/criar?tipo=prep_kit", labelKey: "client.palette.prepKit", groupKey: "client.palette.groupMain" },
  { to: "/app/pedidos", labelKey: "client.palette.orders", groupKey: "client.palette.groupMain" },
  { to: "/app/pedidos/criar", labelKey: "client.palette.createShipment", groupKey: "client.palette.groupMain" },
  { to: "/app/financial", labelKey: "client.palette.financial", groupKey: "client.palette.groupAccount" },
  { to: "/app/extrato", labelKey: "client.palette.statement", groupKey: "client.palette.groupAccount" },
  { to: "/app/taxas", labelKey: "client.palette.fees", groupKey: "client.palette.groupAccount" },
  { to: "/app/notificacoes", labelKey: "client.palette.notifications", groupKey: "client.palette.groupAccount" },
  { to: "/app/suporte", labelKey: "client.palette.support", groupKey: "client.palette.groupAccount" },
  { to: "/app/grupo-vip", labelKey: "client.palette.vip", groupKey: "client.palette.groupContent" },
  { to: "/app/growth-program/strategy-ai", labelKey: "client.palette.growthStrategyAi", groupKey: "client.palette.groupContent" },
  { to: "/app/leads-amazon", labelKey: "client.palette.amazonLeads", groupKey: "client.palette.groupContent" },
  { to: "/app/reprice", labelKey: "client.palette.reprice", groupKey: "client.palette.groupContent" },
  { to: "/app/direct-leads-pro", labelKey: "client.palette.directLeadsPro", groupKey: "client.palette.groupContent" },
  { to: "/app/loja", labelKey: "client.palette.store", groupKey: "client.palette.groupContent" },
  { to: "/app/cadastro-produto", labelKey: "client.palette.registerProduct", groupKey: "client.palette.groupContent" },
  { to: "/app/product-hunter", labelKey: "client.palette.productHunter", groupKey: "client.palette.groupContent" },
  { to: "/app/listing-generator", labelKey: "client.palette.listingGenerator", groupKey: "client.palette.groupContent" },
  { to: "/app/improve-listing", labelKey: "client.palette.improveListing", groupKey: "client.palette.groupContent" },
  { to: "/app/listing-analysis", labelKey: "client.palette.listingAnalysis", groupKey: "client.palette.groupContent" },
  { to: "/app/listing-compliance", labelKey: "client.palette.listingCompliance", groupKey: "client.palette.groupContent" },
  { to: "/app/listing-multi-platform", labelKey: "client.palette.listingMultiPlatform", groupKey: "client.palette.groupContent" },
  { to: "/app/guia-envio-fba", labelKey: "client.palette.fbaGuide", groupKey: "client.palette.groupContent" },
  { to: "/dbx-reprice", labelKey: "client.palette.repriceLand", groupKey: "client.palette.groupContent" },
];

export function GlobalSearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return ROUTES;
    return ROUTES.filter((r) => {
      const label = t(r.labelKey).toLowerCase();
      const group = t(r.groupKey).toLowerCase();
      return label.includes(needle) || group.includes(needle) || r.to.toLowerCase().includes(needle);
    });
  }, [q, t]);

  useEffect(() => {
    if (!open) return;
    setQ("");
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center p-4 pt-[12vh] sm:pt-[15vh]" role="dialog" aria-modal="true" aria-labelledby="palette-title">
      <button type="button" className="absolute inset-0 bg-ds-text/45" aria-label={t("common.close")} onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-ds-card border border-ds-border bg-ds-surface shadow-ds">
        <div className="flex items-center gap-2 border-b border-ds-border px-3 py-2">
          <Search className="size-4 shrink-0 text-ds-muted" aria-hidden />
          <input
            ref={inputRef}
            id="palette-title"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("client.palette.placeholder")}
            className="min-w-0 flex-1 border-0 bg-transparent py-2 text-sm text-ds-text outline-none placeholder:text-ds-muted"
            autoComplete="off"
          />
          <kbd className="hidden shrink-0 rounded border border-ds-border bg-ds-bg px-1.5 py-0.5 text-[10px] font-bold text-ds-muted sm:inline">
            Esc
          </kbd>
        </div>
        <ul className="max-h-[min(50vh,360px)] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-ds-muted">{t("client.palette.empty")}</li>
          ) : (
            filtered.map((r) => (
              <li key={r.to}>
                <button
                  type="button"
                  onClick={() => {
                    navigate(r.to);
                    onClose();
                  }}
                  className={cn(
                    "flex w-full flex-col gap-0.5 px-4 py-2.5 text-left text-sm transition hover:bg-ds-bg",
                  )}
                >
                  <span className="font-semibold text-ds-text">{t(r.labelKey)}</span>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-ds-muted">{t(r.groupKey)}</span>
                </button>
              </li>
            ))
          )}
        </ul>
        <p className="border-t border-ds-border px-4 py-2 text-[11px] text-ds-muted">{t("client.palette.footer")}</p>
      </div>
    </div>
  );
}
