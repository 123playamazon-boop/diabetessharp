import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data", "vip-announcements.json");

export type VipAnnouncementChannel = "amazon" | "mercado_livre" | "ebay" | "walmart" | "geral";
export type VipAnnouncementAudience = "all" | "premium_only";
export type VipAnnouncementAttachmentKind = "image" | "video" | "pdf";

/** Anexo opcional (data URL na demo, ou URL https). */
export type VipAnnouncementAttachment = {
  kind: VipAnnouncementAttachmentKind;
  url: string;
};

export type VipAnnouncement = {
  id: string;
  title: string;
  body: string;
  channel: VipAnnouncementChannel;
  audience: VipAnnouncementAudience;
  pinned: boolean;
  publishedAtIso: string;
  active: boolean;
  attachment?: VipAnnouncementAttachment;
};

type FileShape = { announcements: VipAnnouncement[] };

export function normalizeAttachment(raw: unknown): VipAnnouncementAttachment | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const kind = o.kind;
  const url = typeof o.url === "string" ? o.url.trim() : "";
  if (!url || url.length > 3_500_000) return undefined;
  if (kind !== "image" && kind !== "video" && kind !== "pdf") return undefined;
  if (!url.startsWith("data:") && !url.startsWith("https://") && !url.startsWith("http://")) return undefined;
  return { kind, url };
}

function normalizeAnnouncementRow(x: unknown): VipAnnouncement | null {
  if (!x || typeof x !== "object") return null;
  const r = x as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  const title = typeof r.title === "string" ? r.title.trim() : "";
  const body = typeof r.body === "string" ? r.body.trim() : "";
  if (!id || !title) return null;
  const att = normalizeAttachment(r.attachment);
  if (!body && !att) return null;
  const channel =
    r.channel === "amazon" ||
    r.channel === "mercado_livre" ||
    r.channel === "ebay" ||
    r.channel === "walmart" ||
    r.channel === "geral"
      ? r.channel
      : "geral";
  const audience = r.audience === "premium_only" ? "premium_only" : "all";
  return {
    id,
    title,
    body,
    channel,
    audience,
    pinned: r.pinned === true,
    publishedAtIso: typeof r.publishedAtIso === "string" && r.publishedAtIso.trim() ? r.publishedAtIso : new Date().toISOString(),
    active: r.active !== false,
    ...(att ? { attachment: att } : {}),
  };
}

function readFile(): FileShape {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const j = JSON.parse(raw) as unknown;
    if (j && typeof j === "object" && Array.isArray((j as FileShape).announcements)) {
      const rawList = (j as FileShape).announcements;
      const announcements: VipAnnouncement[] = [];
      for (const item of rawList) {
        const n = normalizeAnnouncementRow(item);
        if (n) announcements.push(n);
      }
      return { announcements };
    }
  } catch {
    /* empty */
  }
  return { announcements: [] };
}

function writeFile(data: FileShape): void {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

export function getVipAnnouncement(id: string): VipAnnouncement | undefined {
  return readFile().announcements.find((x) => x.id === id);
}

export function listVipAnnouncementsAdmin(): VipAnnouncement[] {
  return readFile().announcements.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return Date.parse(b.publishedAtIso) - Date.parse(a.publishedAtIso);
  });
}

export function listVipAnnouncementsForClient(_suite: string, premiumActive: boolean): VipAnnouncement[] {
  const c = readFile().announcements.filter((a) => a.active);
  return c
    .filter((a) => {
      if (a.audience === "premium_only" && !premiumActive) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return Date.parse(b.publishedAtIso) - Date.parse(a.publishedAtIso);
    });
}

export function upsertVipAnnouncement(row: VipAnnouncement): void {
  const data = readFile();
  const i = data.announcements.findIndex((x) => x.id === row.id);
  if (i >= 0) data.announcements[i] = row;
  else data.announcements.push(row);
  writeFile(data);
}

export function deleteVipAnnouncement(id: string): boolean {
  const data = readFile();
  const next = data.announcements.filter((x) => x.id !== id);
  if (next.length === data.announcements.length) return false;
  data.announcements = next;
  writeFile(data);
  return true;
}

export function replaceAllVipAnnouncements(rows: VipAnnouncement[]): void {
  writeFile({ announcements: rows });
}

const CHANNELS_IN: VipAnnouncementChannel[] = ["amazon", "mercado_livre", "ebay", "walmart", "geral"];
const AUDIENCES_IN: VipAnnouncementAudience[] = ["all", "premium_only"];

/** Corpo completo a partir do JSON admin (criar / atualizar). */
export function parseVipAnnouncementFromRequestBody(b: Record<string, unknown>, idFallback: string): VipAnnouncement | null {
  const title = typeof b.title === "string" ? b.title.trim() : "";
  const body = typeof b.body === "string" ? b.body.trim() : "";
  const attachment = normalizeAttachment(b.attachment);
  if (!title) return null;
  if (!body && !attachment) return null;
  const channel =
    typeof b.channel === "string" && CHANNELS_IN.includes(b.channel as VipAnnouncementChannel)
      ? (b.channel as VipAnnouncementChannel)
      : "geral";
  const audience =
    typeof b.audience === "string" && AUDIENCES_IN.includes(b.audience as VipAnnouncementAudience)
      ? (b.audience as VipAnnouncementAudience)
      : "all";
  const pinned = b.pinned === true;
  const active = b.active !== false;
  const publishedAtIso =
    typeof b.publishedAtIso === "string" && b.publishedAtIso.trim() ? b.publishedAtIso.trim() : new Date().toISOString();
  const id = typeof b.id === "string" && b.id.trim() ? b.id.trim() : idFallback;
  const row: VipAnnouncement = {
    id,
    title,
    body,
    channel,
    audience,
    pinned,
    publishedAtIso,
    active,
  };
  if (attachment) row.attachment = attachment;
  return row;
}
