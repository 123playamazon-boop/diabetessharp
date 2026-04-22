import { apiUrl } from "./apiUrl";
import { jsonAdminHeaders, jsonUserHeaders } from "./authHeaders";

export type VipAnnouncementAttachmentDto = {
  kind: "image" | "video" | "pdf";
  url: string;
};

export type VipAnnouncementDto = {
  id: string;
  title: string;
  body: string;
  channel: string;
  audience: string;
  pinned: boolean;
  publishedAtIso: string;
  active: boolean;
  attachment?: VipAnnouncementAttachmentDto;
};

export async function fetchClientVipAnnouncements(
  _suite: string,
): Promise<{ ok: true; announcements: VipAnnouncementDto[] } | { ok: false; error: string }> {
  try {
    const res = await fetch(apiUrl("/api/client/vip-announcements"), {
      headers: jsonUserHeaders(),
    });
    const j = (await res.json()) as { announcements?: unknown; error?: string };
    if (!res.ok) return { ok: false, error: typeof j.error === "string" ? j.error : "Falha ao carregar." };
    if (!Array.isArray(j.announcements)) return { ok: false, error: "Resposta inválida." };
    return { ok: true, announcements: j.announcements as VipAnnouncementDto[] };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

export async function fetchAdminVipAnnouncements(): Promise<
  { ok: true; announcements: VipAnnouncementDto[] } | { ok: false; error: string }
> {
  try {
    const res = await fetch(apiUrl("/api/admin/vip-announcements"), { headers: jsonAdminHeaders() });
    const j = (await res.json()) as { announcements?: unknown; error?: string };
    if (!res.ok) return { ok: false, error: typeof j.error === "string" ? j.error : "Falha." };
    if (!Array.isArray(j.announcements)) return { ok: false, error: "Resposta inválida." };
    return { ok: true, announcements: j.announcements as VipAnnouncementDto[] };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

export async function postAdminVipAnnouncement(body: Record<string, unknown>): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(apiUrl("/api/admin/vip-announcements"), {
      method: "POST",
      headers: jsonAdminHeaders(),
      body: JSON.stringify(body),
    });
    const j = (await res.json()) as { error?: string };
    if (!res.ok) return { ok: false, error: typeof j.error === "string" ? j.error : "Falha ao guardar." };
    return { ok: true };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

export async function patchAdminVipAnnouncement(
  id: string,
  body: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(apiUrl(`/api/admin/vip-announcements/${encodeURIComponent(id)}`), {
      method: "PATCH",
      headers: jsonAdminHeaders(),
      body: JSON.stringify(body),
    });
    const j = (await res.json()) as { error?: string };
    if (!res.ok) return { ok: false, error: typeof j.error === "string" ? j.error : "Falha ao guardar." };
    return { ok: true };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

export async function deleteAdminVipAnnouncement(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(apiUrl(`/api/admin/vip-announcements/${encodeURIComponent(id)}`), {
      method: "DELETE",
      headers: jsonAdminHeaders(),
    });
    const j = (await res.json()) as { error?: string };
    if (!res.ok) return { ok: false, error: typeof j.error === "string" ? j.error : "Falha ao apagar." };
    return { ok: true };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}
