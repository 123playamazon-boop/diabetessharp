import { useEffect } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { BarChart3, Layers, ListOrdered, Lock, Package, Percent } from "lucide-react";
import { useClientProfile } from "../../../context/ClientProfileContext";
import { pullClientProfileFromServer } from "../../../lib/clientProfileStorage";
import { DBX_REPRICE_MONTHLY_USD } from "../../../lib/dbxRepriceProduct";
import { formatUsd } from "../../../lib/prepCenterPricing";
import { PageHeader } from "../../../ui/PageHeader";
import { cn } from "../../../lib/cn";

const subNav: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: "/app/reprice/painel", label: "Painel", icon: BarChart3, end: true },
  { to: "/app/reprice/anuncios", label: "Anúncios", icon: Package },
  { to: "/app/reprice/encomendas-amazon", label: "Pedidos Amazon", icon: ListOrdered },
  { to: "/app/reprice/estrategias", label: "Estratégias", icon: Percent },
  { to: "/app/reprice/modelos", label: "Modelos", icon: Layers },
];

export function RepriceModuleLayout() {
  const { profile } = useClientProfile();
  const subscribed = profile.repriceProActive === true;
  const price = formatUsd(DBX_REPRICE_MONTHLY_USD);

  useEffect(() => {
    void pullClientProfileFromServer();
  }, []);

  if (!subscribed) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Add-on"
          title="DBX Reprice"
          subtitle={`Repricing e margem para dropshipping / OA na Amazon — ${price}/mês após aprovação da equipe.`}
        />

        <div className="rounded-ds-card border border-violet-200/90 bg-gradient-to-br from-violet-50 to-ds-surface p-6 shadow-ds sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="inline-flex size-12 shrink-0 items-center justify-center rounded-ds-btn bg-violet-100 text-violet-900 ring-1 ring-violet-200">
              <Lock className="size-6" aria-hidden />
            </div>
            <div className="min-w-0 space-y-3">
              <h2 className="text-lg font-bold text-ds-text">Assinatura não ativa nesta suite</h2>
              <p className="text-sm leading-relaxed text-ds-muted">
                O módulo <strong className="text-ds-text">DBX Reprice</strong> só aparece depois que a equipe DBX
                confirmar o pagamento e <strong className="text-ds-text">ativar a assinatura</strong> no painel admin
                (como nos outros add-ons). Peça a ativação pelo suporte ou aguarde a confirmação do plano.
              </p>
              <p className="text-sm leading-relaxed text-ds-muted">
                Depois de ativado, atualize a página (F5) ou entre de novo no portal para sincronizar o perfil.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  to="/dbx-reprice"
                  className="inline-flex items-center justify-center rounded-ds-btn bg-ds-primary px-4 py-2.5 text-sm font-bold text-white shadow-ds"
                >
                  Ver oferta e preços
                </Link>
                <Link
                  to="/app/suporte"
                  className="inline-flex items-center justify-center rounded-ds-btn border border-ds-border bg-ds-surface px-4 py-2.5 text-sm font-semibold text-ds-text shadow-ds"
                >
                  Pedir ativação
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vendas online"
        title="DBX Reprice"
        subtitle="Painel, anúncios, pedidos e estratégias — dados de demonstração até conectar a conta Amazon (SP-API) por suite."
      />

      <div
        className="rounded-ds-card border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-ds"
        role="status"
      >
        <strong className="font-bold">Beta técnico.</strong> Os números são fictícios para validar UX. Integração SP-API
        e fornecedores em roadmap.
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <nav
          className="flex shrink-0 gap-1 overflow-x-auto rounded-ds-card border border-ds-border bg-ds-surface p-2 shadow-ds lg:w-56 lg:flex-col lg:gap-1"
          aria-label="DBX Reprice"
        >
          {subNav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-ds-btn px-3 py-2.5 text-sm font-semibold transition",
                  isActive ? "bg-ds-primary text-white shadow-sm" : "text-ds-muted hover:bg-ds-bg hover:text-ds-text",
                )
              }
            >
              <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
              <span className="whitespace-nowrap">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
