import { apiUrl } from "./apiUrl";
import { jsonAdminHeaders, jsonUserHeaders } from "./authHeaders";

export type WalletLedgerEntryDto = {
  atIso: string;
  suite: string;
  deltaUsd: number;
  balanceAfter: number;
  reason: string;
  reference?: string;
};

export async function fetchWalletLedger(suite: string): Promise<
  { ok: true; entries: WalletLedgerEntryDto[] } | { ok: false; error: string }
> {
  try {
    const res = await fetch(apiUrl(`/api/client/wallet/ledger?${new URLSearchParams({ suite: suite.trim() })}`), {
      headers: jsonUserHeaders(),
    });
    const j = (await res.json()) as { entries?: unknown; error?: string };
    if (!res.ok) {
      return { ok: false, error: typeof j.error === "string" ? j.error : "Pedido falhou." };
    }
    if (!Array.isArray(j.entries)) return { ok: false, error: "Resposta inválida." };
    return { ok: true, entries: j.entries as WalletLedgerEntryDto[] };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

export async function fetchAdminWalletLedger(suite: string): Promise<
  { ok: true; entries: WalletLedgerEntryDto[] } | { ok: false; error: string }
> {
  try {
    const res = await fetch(apiUrl(`/api/admin/wallet/ledger?${new URLSearchParams({ suite: suite.trim() })}`), {
      headers: jsonAdminHeaders(),
    });
    const j = (await res.json()) as { entries?: unknown; error?: string };
    if (!res.ok) {
      return { ok: false, error: typeof j.error === "string" ? j.error : "Pedido falhou." };
    }
    if (!Array.isArray(j.entries)) return { ok: false, error: "Resposta inválida." };
    return { ok: true, entries: j.entries as WalletLedgerEntryDto[] };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

export async function postWalletAdjust(body: {
  suite: string;
  deltaUsd: number;
  reason: string;
  reference?: string;
}): Promise<{ ok: true; balanceUsd: number } | { ok: false; error: string }> {
  try {
    const res = await fetch(apiUrl("/api/client/wallet/adjust"), {
      method: "POST",
      headers: jsonUserHeaders(),
      body: JSON.stringify(body),
    });
    const j = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      return { ok: false, error: typeof j.error === "string" ? j.error : "Pedido falhou." };
    }
    const bal = j.balanceUsd;
    if (typeof bal !== "number" || !Number.isFinite(bal)) return { ok: false, error: "Resposta inválida." };
    return { ok: true, balanceUsd: bal };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

/** Ajuste de saldo pela consola admin (Bearer admin); não usa JWT do cliente. */
export async function postAdminWalletAdjust(body: {
  suite: string;
  deltaUsd: number;
  reason: string;
  reference?: string;
}): Promise<{ ok: true; balanceUsd: number } | { ok: false; error: string }> {
  try {
    const res = await fetch(apiUrl("/api/admin/wallet/adjust"), {
      method: "POST",
      headers: jsonAdminHeaders(),
      body: JSON.stringify(body),
    });
    const j = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      return { ok: false, error: typeof j.error === "string" ? j.error : "Pedido falhou." };
    }
    const bal = j.balanceUsd;
    if (typeof bal !== "number" || !Number.isFinite(bal)) return { ok: false, error: "Resposta inválida." };
    return { ok: true, balanceUsd: bal };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}

export async function postDemoFullReset(body?: {
  suite?: string;
  name?: string;
  balanceUsd?: number;
}): Promise<
  | {
      ok: true;
      loginSuite: string;
      loginName: string;
      loginEmail: string;
      loginPassword: string;
      balanceUsd: number;
    }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch(apiUrl("/api/admin/demo/full-reset"), {
      method: "POST",
      headers: jsonAdminHeaders(),
      body: JSON.stringify(body ?? {}),
    });
    const j = (await res.json()) as Record<string, unknown>;
    if (!res.ok || j.ok !== true) {
      return { ok: false, error: typeof j.error === "string" ? j.error : "Reset falhou." };
    }
    const loginSuite = typeof j.loginSuite === "string" ? j.loginSuite : "";
    const loginName = typeof j.loginName === "string" ? j.loginName : "";
    const loginPassword = typeof j.loginPassword === "string" ? j.loginPassword : "";
    const balanceUsd = typeof j.balanceUsd === "number" ? j.balanceUsd : 0;
    const loginEmailRaw = typeof j.loginEmail === "string" ? j.loginEmail.trim() : "";
    const loginEmail = loginEmailRaw || (loginSuite ? `${loginSuite}@demo.dbx` : "");
    if (!loginSuite || !loginName || !loginPassword || !loginEmail) return { ok: false, error: "Resposta inválida." };
    return { ok: true, loginSuite, loginName, loginEmail, loginPassword, balanceUsd };
  } catch {
    return { ok: false, error: "API indisponível." };
  }
}
