const KEY = "dbx.vip.announcementReadIds";

export function loadVipAnnouncementReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const j = JSON.parse(raw) as unknown;
    if (!Array.isArray(j)) return new Set();
    return new Set(j.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

export function markVipAnnouncementsRead(ids: string[]): void {
  const cur = loadVipAnnouncementReadIds();
  for (const id of ids) cur.add(id);
  try {
    localStorage.setItem(KEY, JSON.stringify([...cur]));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("dbx:vip-announcements"));
}
