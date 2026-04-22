import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Compass,
  Crown,
  GraduationCap,
  LayoutDashboard,
  LineChart,
  MoreHorizontal,
  Package,
  Rocket,
  ScrollText,
  Settings,
  ShoppingBag,
  Sparkles,
  Truck,
  Wallet,
  Wrench,
} from "lucide-react";
import { useClientProfile } from "../../context/ClientProfileContext";
import { useVipUnread } from "../../context/VipUnreadContext";
import { useNavigationGuard } from "../../context/NavigationGuardContext";
import { useI18n } from "../../i18n/context";
import { cn } from "../../lib/cn";
import { countSyncUrgentNotifications } from "../../lib/clientSyncNotifications";
import { INVENTORY_UPDATED_EVENT } from "../../lib/clientInventoryStorage";
import { ORDERS_UPDATED_EVENT } from "../../lib/clientOrdersStorage";

const STORAGE_KEY = "dbx.sidebar.collapsed";

export type NavItemDef = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: number;
};

const primaryNav: NavItemDef[] = [
  { to: "/app/dashboard", label: "Painel", icon: LayoutDashboard, end: true },
  { to: "/app/estoque", label: "Estoque", icon: Package },
  { to: "/app/pedidos", label: "Envios", icon: Truck },
  { to: "/app/financial", label: "Financeiro", icon: Wallet },
  { to: "/app/extrato", label: "Extrato", icon: ScrollText },
];

const secondaryNavBase: Omit<NavItemDef, "badge">[] = [
  { to: "/app/grupo-vip", label: "Grupo VIP", icon: Crown },
  { to: "/app/leads-amazon", label: "Leads Amazon", icon: LineChart },
  { to: "/app/tools", label: "TOOLS", icon: Wrench },
  { to: "/app/product-hunter", label: "PRODUCT HUNTER", icon: Compass },
  { to: "/app/reprice", label: "DBX Reprice", icon: CircleDollarSign },
  { to: "/app/loja", label: "Compra assistida", icon: ShoppingBag },
  { to: "/app/premium", label: "Direct Premium", icon: Sparkles },
  { to: "/app/growth-program", label: "Growth Amazon", icon: Rocket },
  { to: "/app/reports", label: "Relatórios", icon: BarChart3 },
  { to: "/app/training", label: "Treinamentos", icon: GraduationCap },
  { to: "/app/guia-envio-fba", label: "Guia FBA", icon: BookOpen },
];

const settingsNav: NavItemDef[] = [{ to: "/app/settings", label: "Configurações", icon: Settings }];

function NavRow({ item, collapsed }: { item: NavItemDef; collapsed: boolean }) {
  const Icon = item.icon;
  const location = useLocation();
  const navigate = useNavigate();
  const { guard, releaseNavigationGuard } = useNavigationGuard();

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!guard.active) return;
    if (location.pathname === item.to) return;
    e.preventDefault();
    if (window.confirm(guard.message)) {
      releaseNavigationGuard();
      navigate(item.to);
    }
  };

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      aria-label={item.badge ? `${item.label}, ${item.badge} notificações` : item.label}
      className={({ isActive }) =>
        cn(
          "relative flex items-center gap-3 rounded-ds-btn px-2 py-2 text-sm font-semibold outline-none transition",
          collapsed ? "justify-center" : "",
          isActive ? "bg-ds-bg text-ds-primary ring-1 ring-ds-border" : "text-ds-muted hover:bg-ds-bg hover:text-ds-text",
        )
      }
    >
      <span className="relative inline-flex size-9 items-center justify-center rounded-ds-btn bg-ds-surface ring-1 ring-ds-border">
        <Icon className="size-5 shrink-0 text-ds-primary" aria-hidden />
        {item.badge && item.badge > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-ds-error px-1 text-center text-[10px] font-bold leading-[18px] text-white">
            {item.badge > 9 ? "9+" : item.badge}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[11px] font-bold uppercase tracking-wide transition-opacity duration-200",
          collapsed ? "sr-only" : "opacity-100",
        )}
      >
        {item.label}
      </span>
    </NavLink>
  );
}

export function CollapsibleSidebar() {
  const { t } = useI18n();
  const { profile, logout } = useClientProfile();
  const { unreadCount } = useVipUnread();
  const { guard, releaseNavigationGuard } = useNavigationGuard();
  const [collapsed, setCollapsed] = useState(false);
  const [notifyTick, setNotifyTick] = useState(0);

  useEffect(() => {
    const bump = () => setNotifyTick((n) => n + 1);
    window.addEventListener("dbx:notifications-updated", bump);
    window.addEventListener(INVENTORY_UPDATED_EVENT, bump);
    window.addEventListener(ORDERS_UPDATED_EVENT, bump);
    window.addEventListener("dbx:vip-announcements", bump);
    return () => {
      window.removeEventListener("dbx:notifications-updated", bump);
      window.removeEventListener(INVENTORY_UPDATED_EVENT, bump);
      window.removeEventListener(ORDERS_UPDATED_EVENT, bump);
      window.removeEventListener("dbx:vip-announcements", bump);
    };
  }, []);

  const primaryWithAlerts = useMemo((): NavItemDef[] => {
    void notifyTick;
    const n = unreadCount + countSyncUrgentNotifications(profile, profile.suite);
    return [
      primaryNav[0]!,
      { to: "/app/notificacoes", label: t("client.nav.notifications"), icon: Bell, badge: n },
      ...primaryNav.slice(1),
    ];
  }, [profile, unreadCount, notifyTick, t]);

  const secondaryNav = useMemo((): NavItemDef[] => {
    return secondaryNavBase.map((item) => {
      const withBadge = item.to === "/app/grupo-vip" ? { ...item, badge: unreadCount } : { ...item };
      if (item.to === "/app/leads-amazon") return { ...withBadge, label: t("client.nav.amazonLeads") };
      if (item.to === "/app/reprice") return { ...withBadge, label: t("client.nav.reprice") };
      if (item.to === "/app/growth-program") return { ...withBadge, label: t("growth.nav.client") };
      if (item.to === "/app/tools") return { ...withBadge, label: t("client.nav.tools") };
      return withBadge;
    });
  }, [unreadCount, t]);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <aside
      className={cn(
        "sticky top-0 z-30 hidden h-screen min-h-0 shrink-0 flex-col border-r border-ds-border bg-ds-surface shadow-ds transition-[width] duration-200 ease-out lg:flex",
        collapsed ? "w-16" : "w-60",
      )}
      aria-label="Navegação principal"
    >
      <div
        className={cn(
          "flex gap-2 px-2 py-3",
          collapsed ? "flex-col items-center" : "flex-row items-center justify-between",
        )}
      >
        <div className={cn("flex min-w-0 items-center gap-2", collapsed && "flex-col")}>
          <div className="grid size-9 shrink-0 place-items-center rounded-ds-btn bg-ds-primary text-sm font-black text-white" aria-hidden>
            D
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-ds-text">DBX NOVO</div>
              <div className="truncate text-xs font-medium text-ds-muted">Prep center</div>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={toggle}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-ds-btn border border-ds-border bg-ds-bg text-ds-text shadow-ds focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
          aria-expanded={!collapsed}
          aria-controls="sidebar-primary-nav"
          aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
        >
          {collapsed ? <ChevronRight className="size-5" aria-hidden /> : <ChevronLeft className="size-5" aria-hidden />}
        </button>
      </div>

      <div
        className="mx-2 rounded-ds-card border border-ds-border bg-ds-bg px-3 py-2.5"
        title={`Suite ${profile.suite} · US$ ${profile.balanceUsd.toFixed(2)}`}
      >
        {!collapsed ? <div className="text-[10px] font-bold uppercase tracking-wide text-ds-muted">Suite</div> : null}
        <div className={cn("font-bold tabular-nums text-ds-text", collapsed ? "text-center text-xs leading-tight" : "text-base")}>
          {profile.suite}
        </div>
        {!collapsed ? <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-ds-muted">Saldo</div> : null}
        <div
          className={cn(
            "font-semibold tabular-nums text-ds-text",
            collapsed ? "text-center text-[10px] leading-tight" : "text-sm",
          )}
        >
          US$ {profile.balanceUsd.toFixed(2)}
        </div>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
        <nav id="sidebar-primary-nav" className="flex shrink-0 flex-col gap-1 px-2" aria-label="Seções principais">
          {primaryWithAlerts.map((item) => (
            <NavRow key={item.to} item={item} collapsed={collapsed} />
          ))}
        </nav>

        <div className="mx-3 my-2 h-px shrink-0 bg-ds-border" />

        <nav className="flex shrink-0 flex-col gap-1 px-2 pb-1" aria-label="Suporte e conteúdo">
          {secondaryNav.map((item) => (
            <NavRow key={item.to} item={item} collapsed={collapsed} />
          ))}
        </nav>

        <div className="mx-3 my-2 h-px shrink-0 bg-ds-border" />

        <nav className="flex shrink-0 flex-col gap-1 px-2 pb-3" aria-label="Configurações">
          {settingsNav.map((item) => (
            <NavRow key={item.to} item={item} collapsed={collapsed} />
          ))}
          <button
            type="button"
            onClick={() => {
              if (guard.active && !window.confirm(guard.message)) return;
              releaseNavigationGuard();
              logout();
            }}
            className={cn(
              "mt-1 rounded-ds-btn px-2 py-2 text-left text-sm font-semibold text-ds-muted transition hover:bg-ds-bg hover:text-ds-text",
              collapsed && "text-center text-xs",
            )}
          >
            {collapsed ? "Sair" : "Sair da conta"}
          </button>
        </nav>
      </div>
    </aside>
  );
}

function MobileDockItem({ item }: { item: NavItemDef }) {
  const Icon = item.icon;
  const location = useLocation();
  const navigate = useNavigate();
  const { guard, releaseNavigationGuard } = useNavigationGuard();

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!guard.active) return;
    if (location.pathname === item.to) return;
    e.preventDefault();
    if (window.confirm(guard.message)) {
      releaseNavigationGuard();
      navigate(item.to);
    }
  };

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      aria-label={item.badge ? `${item.label}, ${item.badge} notificações` : item.label}
      className={({ isActive }) =>
        cn(
          "relative flex min-w-[72px] flex-1 flex-col items-center gap-1 rounded-ds-btn px-2 py-2 text-[11px] font-semibold",
          isActive ? "text-ds-primary" : "text-ds-muted",
        )
      }
    >
      <span className="relative inline-flex size-8 items-center justify-center rounded-ds-btn bg-ds-bg ring-1 ring-ds-border">
        <Icon className="size-4" aria-hidden />
        {item.badge && item.badge > 0 ? (
          <span className="absolute -right-1 -top-1 size-4 rounded-full bg-ds-error text-[9px] font-bold leading-4 text-white">
            {item.badge > 9 ? "+" : item.badge}
          </span>
        ) : null}
      </span>
      <span className="truncate font-bold uppercase tracking-wide">{item.label}</span>
    </NavLink>
  );
}

export function MobileDock() {
  const { t } = useI18n();
  const { profile } = useClientProfile();
  const { unreadCount } = useVipUnread();
  const [notifyTick, setNotifyTick] = useState(0);

  useEffect(() => {
    const bump = () => setNotifyTick((n) => n + 1);
    window.addEventListener("dbx:notifications-updated", bump);
    window.addEventListener(INVENTORY_UPDATED_EVENT, bump);
    window.addEventListener(ORDERS_UPDATED_EVENT, bump);
    window.addEventListener("dbx:vip-announcements", bump);
    return () => {
      window.removeEventListener("dbx:notifications-updated", bump);
      window.removeEventListener(INVENTORY_UPDATED_EVENT, bump);
      window.removeEventListener(ORDERS_UPDATED_EVENT, bump);
      window.removeEventListener("dbx:vip-announcements", bump);
    };
  }, []);

  const primaryWithAlerts = useMemo((): NavItemDef[] => {
    void notifyTick;
    const n = unreadCount + countSyncUrgentNotifications(profile, profile.suite);
    return [
      primaryNav[0]!,
      { to: "/app/notificacoes", label: t("client.nav.notifications"), icon: Bell, badge: n },
      ...primaryNav.slice(1),
    ];
  }, [profile, unreadCount, notifyTick, t]);

  const dockItems = useMemo(
    (): NavItemDef[] => [
      ...primaryWithAlerts,
      { to: "/app/grupo-vip", label: "Grupo VIP", icon: Crown, badge: unreadCount },
      { to: "/app/leads-amazon", label: t("client.nav.amazonLeads"), icon: LineChart },
      { to: "/app/tools", label: t("client.nav.tools"), icon: Wrench },
      { to: "/app/reprice", label: t("client.nav.reprice"), icon: CircleDollarSign },
      { to: "/app/loja", label: "Compra assistida", icon: ShoppingBag },
      { to: "/app/reports", label: "Mais", icon: MoreHorizontal },
    ],
    [primaryWithAlerts, unreadCount, t],
  );

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-ds-border bg-ds-surface/95 px-2 py-2 backdrop-blur-md lg:hidden"
      aria-label="Navegação móvel"
    >
      <div className="mx-auto flex max-w-xl items-stretch justify-between gap-1 overflow-x-auto pb-1">
        {dockItems.map((item) => (
          <MobileDockItem key={item.to + item.label} item={item} />
        ))}
      </div>
    </nav>
  );
}
