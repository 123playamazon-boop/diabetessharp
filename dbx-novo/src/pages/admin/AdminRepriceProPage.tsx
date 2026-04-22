import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { jsonAdminHeaders } from "../../lib/authHeaders";
import { apiUrl } from "../../lib/apiUrl";
import { formatUsd } from "../../lib/prepCenterPricing";
import { DBX_REPRICE_MONTHLY_USD } from "../../lib/dbxRepriceProduct";
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

export function AdminRepriceProPage() {
  const [clients, setClients] = useState<AdminClientCard[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busySuite, setBusySuite] = useState<string | null>(null);

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

  const setReprice = async (suite: string, active: boolean) => {
    setBusySuite(suite);
    try {
      const res = await fetch(apiUrl(`/api/admin/clients/${encodeURIComponent(suite)}/reprice-pro`), {
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
        toast.error(typeof j.error === "string" ? j.error : "Falha ao atualizar.");
        return;
      }
      toast.success(active ? "DBX Reprice ativado para esta suite." : "DBX Reprice revogado.");
      await refresh();
    } catch {
      toast.error("Erro de rede.");
    } finally {
      setBusySuite(null);
    }
  };

  const price = formatUsd(DBX_REPRICE_MONTHLY_USD);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Clientes"
        title="DBX Reprice — assinaturas"
        subtitle={`Add-on mensal (${price}/mês na oferta comercial). Ative ou revogue por suite após confirmação de pagamento. O cliente só vê o módulo no portal quando estiver ativo; registro no extrato (delta 0) para auditoria.`}
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

      <div className="overflow-hidden rounded-3xl border border-violet-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-[13px] leading-snug text-zinc-800">
            <thead className="border-b border-violet-100 bg-violet-50/80 text-[11px] font-semibold uppercase tracking-wide text-violet-900">
              <tr>
                <th className="px-4 py-3.5">Suite</th>
                <th className="px-4 py-3.5">Cliente</th>
                <th className="px-4 py-3.5">Email</th>
                <th className="px-4 py-3.5">Estado</th>
                <th className="px-4 py-3.5 text-right">Ações</th>
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
                  const active = c.repriceProActive === true;
                  return (
                    <tr key={c.suite} className="hover:bg-violet-50/40">
                      <td className="px-4 py-3.5 font-mono text-sm font-semibold tabular-nums text-zinc-900">{c.suite}</td>
                      <td className="px-4 py-3.5 font-medium text-zinc-900">{c.name}</td>
                      <td className="break-all px-4 py-3.5 text-zinc-600">{c.email}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={
                            active
                              ? "inline-flex rounded-full border border-violet-300 bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-950"
                              : "inline-flex rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-600"
                          }
                        >
                          {active ? "Reprice ativo" : "Sem Reprice"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          {!active ? (
                            <button
                              type="button"
                              disabled={busySuite === c.suite}
                              onClick={() => void setReprice(c.suite, true)}
                              className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                            >
                              {busySuite === c.suite ? "…" : "Ativar Reprice"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busySuite === c.suite}
                              onClick={() => void setReprice(c.suite, false)}
                              className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                            >
                              {busySuite === c.suite ? "…" : "Revogar Reprice"}
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
