import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { pullInventoryFromServer } from "../lib/clientInventoryStorage";
import { pullAdminClientOrdersFromServer } from "../lib/clientOrdersStorage";
import {
  DEV_DEFAULT_ADMIN_API_TOKEN,
  isAdminApiTokenConfigured,
  saveAdminApiToken,
} from "../lib/authHeaders";
import type { LucideIcon } from "lucide-react";
import { Box, Crown, FileSpreadsheet, Flame, Gauge, Headphones, Inbox, Layers, LineChart, Percent, Rocket, Send, ShoppingBag, Sparkles, Users } from "lucide-react";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useI18n } from "../i18n/context";
import { cn } from "../lib/cn";

type NavItem = { to: string; labelKey: string; icon: LucideIcon; end?: boolean };

const linkDefs: NavItem[] = [
  { to: "/admin", labelKey: "admin.nav.home", icon: Gauge, end: true },
  { to: "/admin/estoque", labelKey: "admin.nav.inventory", icon: Box },
  { to: "/admin/clientes", labelKey: "admin.nav.clients", icon: Users },
  { to: "/admin/assinaturas-premium", labelKey: "admin.nav.premium", icon: Sparkles },
  { to: "/admin/leads-amazon", labelKey: "admin.nav.amazonLeads", icon: LineChart },
  { to: "/admin/assinaturas-leads-pro", labelKey: "admin.nav.amazonLeadsPro", icon: Flame },
  { to: "/admin/assinaturas-reprice-pro", labelKey: "admin.nav.repricePro", icon: Percent },
  { to: "/admin/assinaturas-listagens-ia", labelKey: "admin.nav.aiListingPlans", icon: FileSpreadsheet },
  { to: "/admin/growth-program", labelKey: "admin.nav.growthProgram", icon: Rocket },
  { to: "/admin/recebimentos", labelKey: "admin.nav.receipts", icon: Inbox },
  { to: "/admin/pedidos", labelKey: "admin.nav.orders", icon: Send },
  { to: "/admin/kitagem", labelKey: "admin.nav.bundles", icon: Layers },
  { to: "/admin/grupo-vip", labelKey: "admin.nav.vipGroup", icon: Crown },
  { to: "/admin/loja", labelKey: "admin.nav.vipStore", icon: ShoppingBag },
  { to: "/admin/suporte", labelKey: "admin.nav.supportTickets", icon: Headphones },
];

export function AdminLayout() {
  const { t } = useI18n();
  const [adminTokenOk, setAdminTokenOk] = useState(() => isAdminApiTokenConfigured());
  const links = useMemo(
    () =>
      linkDefs.map((l) => ({
        ...l,
        label: t(l.labelKey),
      })),
    [t],
  );

  useLayoutEffect(() => {
    if (!import.meta.env.DEV) return;
    if (isAdminApiTokenConfigured()) return;
    saveAdminApiToken(DEV_DEFAULT_ADMIN_API_TOKEN);
    setAdminTokenOk(true);
  }, []);

  useEffect(() => {
    void pullInventoryFromServer();
    void pullAdminClientOrdersFromServer();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50">
      <a
        href="#conteudo-admin"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-zinc-900 focus:px-3 focus:py-2 focus:text-xs focus:font-bold focus:uppercase focus:tracking-wide focus:text-white"
      >
        {t("admin.skipContent")}
      </a>

      <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-600 text-sm font-black text-white shadow-lg shadow-teal-600/20">
              A
            </div>
            <div>
              <div className="text-sm font-black uppercase tracking-wide text-zinc-900">DBX NOVO</div>
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {t("admin.brandSubtitle")}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <LanguageSwitcher />
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-zinc-600">
              {t("admin.demo")}
            </span>
          </div>
        </div>
        <div className="border-t border-zinc-200/80 bg-white/70">
          <nav className="mx-auto flex max-w-7xl flex-wrap gap-1 px-4 py-2 sm:px-6" aria-label={t("admin.nav.menuAria")}>
            {links.map((l) => {
              const Icon = l.icon;
              return (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    cn(
                      "inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold uppercase tracking-wide transition",
                      isActive ? "bg-teal-50 text-teal-800 ring-1 ring-teal-200/70" : "text-zinc-600 hover:bg-zinc-100",
                    )
                  }
                >
                  <Icon className="size-4" />
                  {l.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </header>

      {!adminTokenOk && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:px-6">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold">{t("admin.tokenMissing.title")}</p>
              <p className="mt-1 max-w-3xl text-amber-900/90">{t("admin.tokenMissing.body")}</p>
            </div>
            {import.meta.env.DEV && (
              <button
                type="button"
                className="shrink-0 rounded-xl bg-amber-800 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white shadow hover:bg-amber-900"
                onClick={() => {
                  saveAdminApiToken(DEV_DEFAULT_ADMIN_API_TOKEN);
                  setAdminTokenOk(true);
                  window.location.reload();
                }}
              >
                {t("admin.tokenMissing.applyDev")}
              </button>
            )}
          </div>
        </div>
      )}

      <main id="conteudo-admin" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
