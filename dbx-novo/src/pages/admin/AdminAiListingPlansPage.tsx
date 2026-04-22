import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { jsonAdminHeaders } from "../../lib/authHeaders";
import { apiUrl } from "../../lib/apiUrl";
import { formatUsd } from "../../lib/prepCenterPricing";
import {
  AI_LISTING_PRO_MONTHLY_CAP,
  AI_LISTING_PRO_MONTHLY_USD,
  AI_LISTING_STARTER_MONTHLY_CAP,
  AI_LISTING_STARTER_MONTHLY_USD,
} from "../../lib/aiListingProduct";
import type { AdminClientCard } from "../../types";
import { PageHeader } from "../../ui/PageHeader";

async function parseClients(res: Response): Promise<{ clients: AdminClientCard[] | null; err: string | null }> {
  const text = await res.text();
  if (text.trimStart().startsWith("<")) {
    return { clients: null, err: "API devolveu HTML — confirme «npm run dev» (Vite + 8787)." };
  }
  if (!res.ok) return { clients: null, err: "Não foi possível carregar clientes." };
  try {
    const j = JSON.parse(text) as { clients?: AdminClientCard[] };
    return { clients: Array.isArray(j.clients) ? j.clients : [], err: null };
  } catch {
    return { clients: null, err: "JSON inválido." };
  }
}

export function AdminAiListingPlansPage() {
  const [clients, setClients] = useState<AdminClientCard[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busySuite, setBusySuite] = useState<string | null>(null);
  const [busyKind, setBusyKind] = useState<"starter" | "pro" | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(apiUrl("/api/admin/clients"), { headers: jsonAdminHeaders() });
      const { clients: list, err } = await parseClients(res);
      if (err || !list) {
        setLoadError(err ?? "Erro ao carregar.");
        setClients([]);
        return;
      }
      setClients(list);
    } catch {
      setLoadError("Erro de rede.");
      setClients([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const postPlan = async (suite: string, kind: "starter" | "pro", active: boolean) => {
    const path = kind === "starter" ? "ai-listing-starter" : "ai-listing-pro";
    setBusySuite(suite);
    setBusyKind(kind);
    try {
      const res = await fetch(apiUrl(`/api/admin/clients/${encodeURIComponent(suite)}/${path}`), {
        method: "POST",
        headers: jsonAdminHeaders(),
        body: JSON.stringify({ active }),
      });
      const text = await res.text();
      if (text.trimStart().startsWith("<")) {
        toast.error("Resposta inválida (HTML). API na 8787?");
        return;
      }
      const j = JSON.parse(text) as { error?: string; ok?: boolean };
      if (!res.ok) {
        toast.error(typeof j.error === "string" ? j.error : "Falha ao actualizar.");
        return;
      }
      const label = kind === "starter" ? "Starter (20/mês)" : "Pro (100/mês)";
      toast.success(active ? `${label} activado.` : `${label} revogado.`);
      await refresh();
    } catch {
      toast.error("Erro de rede.");
    } finally {
      setBusySuite(null);
      setBusyKind(null);
    }
  };

  const starterPrice = formatUsd(AI_LISTING_STARTER_MONTHLY_USD);
  const proPrice = formatUsd(AI_LISTING_PRO_MONTHLY_USD);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Clientes"
        title="Gerador de listagens IA — planos"
        subtitle={`Starter: até ${AI_LISTING_STARTER_MONTHLY_CAP} listagens/mês (${starterPrice}/mês). Pro: até ${AI_LISTING_PRO_MONTHLY_CAP} listagens/mês (${proPrice}/mês). Só um plano activo por suite — activar um desliga o outro.`}
        actions={
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50"
          >
            Atualizar
          </button>
        }
      />

      {loadError ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{loadError}</p>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] table-fixed border-collapse text-left text-[13px] leading-snug text-zinc-800">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3.5">Suite</th>
                <th className="px-4 py-3.5">Cliente</th>
                <th className="px-4 py-3.5">Email</th>
                <th className="px-4 py-3.5">Starter</th>
                <th className="px-4 py-3.5">Pro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-zinc-500">
                    Nenhum cliente registado ainda.
                  </td>
                </tr>
              ) : (
                clients.map((c) => {
                  const starter = c.aiListingStarterActive === true;
                  const pro = c.aiListingProActive === true;
                  const busyHere = busySuite === c.suite;
                  return (
                    <tr key={c.suite} className="hover:bg-zinc-50/80">
                      <td className="px-4 py-3.5 font-mono text-sm font-semibold tabular-nums text-zinc-900">{c.suite}</td>
                      <td className="px-4 py-3.5 font-medium text-zinc-900">{c.name}</td>
                      <td className="break-all px-4 py-3.5 text-zinc-600">{c.email}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-2">
                          <span
                            className={
                              starter
                                ? "inline-flex w-fit rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900"
                                : "inline-flex w-fit rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-600"
                            }
                          >
                            {starter ? "Activo" : "Inactivo"}
                          </span>
                          {!starter ? (
                            <button
                              type="button"
                              disabled={busyHere && busyKind === "starter"}
                              onClick={() => void postPlan(c.suite, "starter", true)}
                              className="w-fit rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {busyHere && busyKind === "starter" ? "…" : "Activar Starter"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busyHere && busyKind === "starter"}
                              onClick={() => void postPlan(c.suite, "starter", false)}
                              className="w-fit rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                            >
                              {busyHere && busyKind === "starter" ? "…" : "Revogar Starter"}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-2">
                          <span
                            className={
                              pro
                                ? "inline-flex w-fit rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-900"
                                : "inline-flex w-fit rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-600"
                            }
                          >
                            {pro ? "Activo" : "Inactivo"}
                          </span>
                          {!pro ? (
                            <button
                              type="button"
                              disabled={busyHere && busyKind === "pro"}
                              onClick={() => void postPlan(c.suite, "pro", true)}
                              className="w-fit rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                            >
                              {busyHere && busyKind === "pro" ? "…" : "Activar Pro"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busyHere && busyKind === "pro"}
                              onClick={() => void postPlan(c.suite, "pro", false)}
                              className="w-fit rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                            >
                              {busyHere && busyKind === "pro" ? "…" : "Revogar Pro"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
