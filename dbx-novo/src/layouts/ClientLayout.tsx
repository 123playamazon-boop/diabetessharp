import { useEffect, useMemo, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { Bell, Search } from "lucide-react";
import { CollapsibleSidebar, MobileDock } from "../components/ds/CollapsibleSidebar";
import { GlobalSearchPalette } from "../components/GlobalSearchPalette";
import { NavigationGuardProvider } from "../context/NavigationGuardContext";
import { VipUnreadProvider } from "../context/VipUnreadContext";
import { useClientProfile } from "../context/ClientProfileContext";
import { useVipUnread } from "../context/VipUnreadContext";
import {
  CLIENT_INVENTORY_ADDITIONS_KEY,
  CLIENT_INVENTORY_DEDUCTIONS_KEY,
  pullInventoryFromServer,
  INVENTORY_UPDATED_EVENT,
} from "../lib/clientInventoryStorage";
import {
  clearClientProfile,
  pullClientProfileFromServer,
} from "../lib/clientProfileStorage";
import { pullClientOrdersFromServer } from "../lib/clientOrdersStorage";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useI18n } from "../i18n/context";
import { countSyncUrgentNotifications } from "../lib/clientSyncNotifications";
import { ORDERS_UPDATED_EVENT } from "../lib/clientOrdersStorage";

function ClientLayoutInner() {
  const { t } = useI18n();
  const { profile } = useClientProfile();
  const { unreadCount } = useVipUnread();
  const [online, setOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifyTick, setNotifyTick] = useState(0);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    void pullInventoryFromServer();
    void pullClientOrdersFromServer(profile.suite);
    void pullClientProfileFromServer().then((r) => {
      if (!r.ok && r.reason === "not_found") {
        clearClientProfile();
        window.location.assign("/app/entrar?relogin=perfil");
      }
    });
  }, [profile.suite]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key == null || e.key === CLIENT_INVENTORY_ADDITIONS_KEY || e.key === CLIENT_INVENTORY_DEDUCTIONS_KEY) {
        void pullInventoryFromServer();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      void pullInventoryFromServer();
      void pullClientOrdersFromServer(profile.suite);
      void pullClientProfileFromServer().then((r) => {
        if (!r.ok && r.reason === "not_found") {
          clearClientProfile();
          window.location.assign("/app/entrar?relogin=perfil");
        }
      });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [profile.suite]);

  const alertCount = useMemo(() => {
    void notifyTick;
    return unreadCount + countSyncUrgentNotifications(profile, profile.suite);
  }, [profile, unreadCount, notifyTick]);

  const pendingKyc = profile.verificationStatus === "pending_review";

  return (
    <div className="min-h-screen bg-ds-bg">
      <GlobalSearchPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-ds-btn focus:bg-ds-text focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-ds-surface"
      >
        {t("client.layout.skip")}
      </a>

      <div className="pointer-events-none fixed right-3 top-3 z-[95] flex flex-wrap items-center justify-end gap-2 sm:right-4 sm:top-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="inline-flex items-center gap-2 rounded-ds-btn border border-ds-border bg-ds-surface px-2.5 py-2 text-xs font-bold uppercase tracking-wide text-ds-text shadow-ds hover:bg-ds-bg"
            title={t("client.layout.searchPaletteHint")}
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">⌘K</span>
          </button>
          <Link
            to="/app/notificacoes"
            className="relative inline-flex items-center justify-center rounded-ds-btn border border-ds-border bg-ds-surface p-2 text-ds-text shadow-ds hover:bg-ds-bg"
            aria-label={t("client.layout.notificationsAria")}
          >
            <Bell className="size-4" aria-hidden />
            {alertCount > 0 ? (
              <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-ds-error px-1 text-center text-[10px] font-bold leading-[18px] text-white">
                {alertCount > 9 ? "9+" : alertCount}
              </span>
            ) : null}
          </Link>
          <LanguageSwitcher />
        </div>
      </div>

      {!online ? (
        <div className="border-b border-amber-200/80 bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-950">
          {t("client.layout.offline")}
        </div>
      ) : null}

      <div className="flex">
        <CollapsibleSidebar />
        <main id="conteudo" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:pb-10">
          {pendingKyc ? (
            <div
              className="mb-4 space-y-3 rounded-ds-card border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-ds"
              role="status"
            >
              <p>{t("client.layout.kyc")}</p>
              <p className="text-xs leading-relaxed text-amber-900/95">{t("client.layout.kycNext")}</p>
              <Link
                to="/app/suporte"
                className="inline-flex text-xs font-bold uppercase tracking-wide text-amber-950 underline-offset-2 hover:underline"
              >
                {t("client.layout.kycSupportCta")}
              </Link>
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>

      <MobileDock />
      <div className="h-16 lg:hidden" />
    </div>
  );
}

export function ClientLayout() {
  return (
    <NavigationGuardProvider>
      <VipUnreadProvider>
        <ClientLayoutInner />
      </VipUnreadProvider>
    </NavigationGuardProvider>
  );
}
