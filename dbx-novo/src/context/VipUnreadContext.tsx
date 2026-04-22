import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useClientProfile } from "./ClientProfileContext";
import { fetchClientVipAnnouncements } from "../lib/vipAnnouncementsApi";
import { loadVipAnnouncementReadIds } from "../lib/vipReadIds";

type VipUnreadContextValue = {
  unreadCount: number;
  refresh: () => Promise<void>;
};

const VipUnreadContext = createContext<VipUnreadContextValue | null>(null);

export function VipUnreadProvider({ children }: { children: ReactNode }) {
  const { profile } = useClientProfile();
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    const r = await fetchClientVipAnnouncements(profile.suite);
    if (!r.ok) {
      setUnreadCount(0);
      return;
    }
    const read = loadVipAnnouncementReadIds();
    const n = r.announcements.filter((a) => !read.has(a.id)).length;
    setUnreadCount(n);
  }, [profile.suite]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onEvt = () => void refresh();
    window.addEventListener("dbx:vip-announcements", onEvt);
    return () => window.removeEventListener("dbx:vip-announcements", onEvt);
  }, [refresh]);

  const value = useMemo(() => ({ unreadCount, refresh }), [unreadCount, refresh]);

  useEffect(() => {
    try {
      sessionStorage.setItem("dbx.quickExtras", JSON.stringify({ vipUnread: unreadCount }));
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event("dbx:quick-extras"));
  }, [unreadCount]);

  return <VipUnreadContext.Provider value={value}>{children}</VipUnreadContext.Provider>;
}

export function useVipUnread(): VipUnreadContextValue {
  const v = useContext(VipUnreadContext);
  if (!v) throw new Error("useVipUnread só dentro de VipUnreadProvider.");
  return v;
}
