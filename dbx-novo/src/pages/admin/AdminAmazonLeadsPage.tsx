import { useCallback, useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { adminAuthHeaders, jsonAdminHeaders } from "../../lib/authHeaders";
import { apiUrl } from "../../lib/apiUrl";
import { AMAZON_LEADS_DAILY_PUBLISH_CAP } from "../../lib/amazonLeadsProProduct";
import type { AmazonLeadTableRow } from "../../lib/amazonLeadsApi";
import { PageHeader } from "../../ui/PageHeader";
import { cn } from "../../lib/cn";

type EditionMeta = {
  editionDate: string;
  publishedAtIso: string;
  rowCount: number;
  pipelineNote?: string;
  rulesSnapshot: { minMonthlySold: number; minNewOffersTotal: number; excludeAmazonBuyBox: boolean };
  asinsRequested: number;
  rejectedCount: number;
};

const inputClass =
  "w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-zinc-900";

/** Modelo para Excel: «Guardar como» → CSV UTF-8, depois colar aqui. */
const CSV_TEMPLATE = `asin,store_url,store_product_url,product_usd,notas
B08N5WRWNW,https://www.walmart.com/ip/exemplo,https://www.walmart.com/ip/exemplo,19.99,Substitua por dados reais`;

export function AdminAmazonLeadsPage() {
  const [editions, setEditions] = useState<EditionMeta[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [asinsText, setAsinsText] = useState("");
  const [spreadsheetCsv, setSpreadsheetCsv] = useState("");
  const [minMonthlySold, setMinMonthlySold] = useState(100);
  const [minNewOffers, setMinNewOffers] = useState(4);
  const [excludeAmazon, setExcludeAmazon] = useState(true);
  const [editionDate, setEditionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [maxPublish, setMaxPublish] = useState(AMAZON_LEADS_DAILY_PUBLISH_CAP);
  const [pipelineNote, setPipelineNote] = useState("Keepa + regras Direct Box + revisão.");
  const [publishing, setPublishing] = useState(false);
  const [spreadsheetUploading, setSpreadsheetUploading] = useState(false);
  const spreadsheetFileRef = useRef<HTMLInputElement>(null);
  const [previewRows, setPreviewRows] = useState<AmazonLeadTableRow[] | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(apiUrl("/api/admin/amazon-leads/editions"), { headers: jsonAdminHeaders() });
      const text = await res.text();
      if (text.trimStart().startsWith("<")) {
        setLoadError("API devolveu HTML — confirme o Express na 8787.");
        setEditions([]);
        return;
      }
      const j = JSON.parse(text) as { editions?: EditionMeta[] };
      setEditions(Array.isArray(j.editions) ? j.editions : []);
    } catch {
      setLoadError("Erro de rede.");
      setEditions([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const uploadSpreadsheetFile = async (file: File) => {
    setSpreadsheetUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(apiUrl("/api/admin/amazon-leads/spreadsheet-upload"), {
        method: "POST",
        body: fd,
        headers: adminAuthHeaders(),
      });
      const text = await res.text();
      const j = JSON.parse(text) as {
        ok?: boolean;
        error?: string;
        spreadsheetCsv?: string;
        sheetName?: string;
        rowCount?: number;
        warnings?: string[];
      };
      if (!res.ok) {
        toast.error(typeof j.error === "string" ? j.error : "Falha ao ler planilha.");
        return;
      }
      if (typeof j.spreadsheetCsv === "string") setSpreadsheetCsv(j.spreadsheetCsv);
      toast.success(
        `Planilha importada (${typeof j.rowCount === "number" ? j.rowCount : "—"} ASINs) — ${typeof j.sheetName === "string" ? j.sheetName : ""}`,
      );
      if (Array.isArray(j.warnings) && j.warnings.length > 0) {
        toast.message(`Avisos: ${j.warnings.slice(0, 5).join(" · ")}${j.warnings.length > 5 ? "…" : ""}`);
      }
    } catch {
      toast.error("Erro de rede ou JSON inválido.");
    } finally {
      setSpreadsheetUploading(false);
    }
  };

  const publish = async () => {
    setPublishing(true);
    setPreviewRows(null);
    try {
      const res = await fetch(apiUrl("/api/admin/amazon-leads/publish"), {
        method: "POST",
        headers: jsonAdminHeaders(),
        body: JSON.stringify({
          asinsText,
          spreadsheetCsv,
          minMonthlySold,
          minNewOffersTotal: minNewOffers,
          excludeAmazonBuyBox: excludeAmazon,
          editionDate: editionDate.trim() || undefined,
          maxPublish,
          pipelineNote: pipelineNote.trim() || undefined,
        }),
      });
      const text = await res.text();
      const j = JSON.parse(text) as {
        ok?: boolean;
        error?: string;
        edition?: { rows: AmazonLeadTableRow[]; rowCount: number; editionDate: string };
        tokensLeft?: number;
        rejectedTotal?: number;
        spreadsheetWarnings?: string[];
      };
      if (!res.ok) {
        toast.error(typeof j.error === "string" ? j.error : "Falha ao publicar.");
        return;
      }
      toast.success(`Edição ${j.edition?.editionDate ?? ""} publicada (${j.edition?.rowCount ?? 0} linhas).`);
      if (typeof j.tokensLeft === "number") {
        toast.message(`Tokens Keepa (aprox.): ${j.tokensLeft}`);
      }
      if (Array.isArray(j.spreadsheetWarnings) && j.spreadsheetWarnings.length > 0) {
        toast.message(`Planilha: ${j.spreadsheetWarnings.slice(0, 5).join(" · ")}${j.spreadsheetWarnings.length > 5 ? "…" : ""}`);
      }
      if (j.edition?.rows) setPreviewRows(j.edition.rows);
      await refresh();
    } catch {
      toast.error("Erro de rede ou JSON inválido.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Conteúdo"
        title="Leads Amazon — publicar edição"
        subtitle="Cole ASINs; o servidor usa KEEPA_API_KEY do .env, aplica filtros e grava a edição do dia (substitui se a data já existir). Os clientes com Direct Leads Pro vêem a lista no portal."
        actions={
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50"
          >
            Atualizar histórico
          </button>
        }
      />

      {loadError ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{loadError}</p>
      ) : null}

      <section className="rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-violet-900">
          <Info className="size-4 shrink-0" aria-hidden />
          O que fazer aqui (passo a passo)
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-800">
          <li>
            <strong>Arranje uma lista de candidatos</strong> — códigos ASIN (B + 9 caracteres). Isto vem do vosso
            processo de sourcing: Keepa Product Finder no site Keepa, planilha interna, fornecedor, outra ferramenta de
            arbitragem, etc. <em>Esta página não “descobre” o mercado sozinha.</em>
          </li>
          <li>
            <strong>Cole ASINs em texto</strong> e/ou carregue um <strong>Excel (.xlsx / .xls)</strong> ou{" "}
            <strong>CSV</strong> — o servidor lê a <em>primeira folha</em>, reconhece cabeçalhos em português ou inglês
            (ex.: <code className="rounded bg-violet-100 px-1 font-mono text-xs">asin</code>,{" "}
            <code className="font-mono text-xs">loja</code> → <code className="font-mono text-xs">store_url</code>) e
            preenche a caixa com um CSV normalizado para rever antes de publicar. Também pode colar CSV exportado do
            Excel («Guardar como» → CSV UTF-8).
          </li>
          <li>
            Ajuste <strong>data da edição</strong> e filtros (vendas mínimas, ofertas New, excluir Amazon na buy box),
            depois clique <strong>Analisar e publicar edição</strong>. O servidor chama a API Keepa, aplica as regras e
            grava até {AMAZON_LEADS_DAILY_PUBLISH_CAP} linhas para os clientes com Direct Leads Pro verem no portal.
          </li>
        </ol>
        <div className="mt-4 rounded-2xl border border-violet-100 bg-white/90 px-4 py-3 text-sm leading-relaxed text-zinc-700">
          <p className="font-semibold text-violet-950">E a IA? Faz o scraper completo por mim?</p>
          <p className="mt-1">
            <strong>Hoje, não nesta tela:</strong> não há um motor de IA nem um scraper genérico da Amazon ligado aqui.
            O que está automatizado é a <strong>validação em massa</strong> (Keepa + filtros + CSV + painel). Descobrir
            ASINs continua a ser um passo humano ou outra ferramenta à vossa escolha.
          </p>
          <p className="mt-2">
            <strong>O que se pode evoluir depois:</strong> integrar a API Keepa em modo “product finder” / pesquisa por
            critérios, ou um job que importa um ficheiro gerado por uma IA externa — isso é desenvolvimento extra e
            consome mais tokens Keepa.
          </p>
        </div>
        <details className="mt-3 text-sm text-zinc-600">
          <summary className="cursor-pointer font-semibold text-violet-800 hover:underline">
            Onde costuma vir a lista de ASINs?
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Keepa (site) → Product Finder / listas guardadas</li>
            <li>Planilhas ou Slack da equipa de sourcing</li>
            <li>Ferramentas de OA (Tactical Arbitrage, SellerAmp, etc.) → exportar ASINs</li>
            <li>Catálogo do fornecedor já mapeado para ASIN Amazon.com</li>
          </ul>
        </details>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
        <div className="space-y-4 rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">Nova publicação</h2>
          <p className="text-sm text-zinc-600">
            Chave Keepa: variável de ambiente <code className="rounded bg-zinc-100 px-1 font-mono text-xs">KEEPA_API_KEY</code>{" "}
            no processo Node — não é guardada nesta página.
          </p>
          <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Data da edição (YYYY-MM-DD)
            <input
              type="date"
              className={cn(inputClass, "mt-1 tabular-nums")}
              value={editionDate}
              onChange={(e) => setEditionDate(e.target.value)}
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
            ASINs (texto livre — extraímos o padrão B + 9)
            <textarea
              className={cn(inputClass, "mt-1 min-h-[120px] resize-y font-mono text-xs")}
              value={asinsText}
              onChange={(e) => setAsinsText(e.target.value)}
              placeholder="Cole até 150 ASINs… (opcional se usar CSV com coluna asin)"
            />
          </label>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Planilha (Excel ou CSV — 1.ª folha / cabeçalho na linha 1)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={spreadsheetFileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void uploadSpreadsheetFile(f);
                  }}
                />
                <button
                  type="button"
                  disabled={spreadsheetUploading}
                  onClick={() => spreadsheetFileRef.current?.click()}
                  className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-40"
                >
                  {spreadsheetUploading ? "A ler ficheiro…" : "Carregar ficheiro"}
                </button>
                <button
                  type="button"
                  onClick={() => setSpreadsheetCsv(CSV_TEMPLATE)}
                  className="rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-900 hover:bg-violet-100"
                >
                  Colar modelo
                </button>
              </div>
            </div>
            <textarea
              className={cn(inputClass, "min-h-[140px] resize-y font-mono text-xs")}
              value={spreadsheetCsv}
              onChange={(e) => setSpreadsheetCsv(e.target.value)}
              placeholder={"asin,store_url,store_product_url,product_usd,notas\nB0XXXXXXXXX,https://…,https://…,12.34,…"}
            />
            <p className="text-[11px] leading-relaxed text-zinc-500">
              Depois do upload pode editar o CSV abaixo. Os dados são <strong>fundidos</strong> nas linhas que
              passarem nos filtros Keepa. Linhas com ASIN inválido geram aviso e são ignoradas.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-semibold text-zinc-500">
              Vendas mín. / mês
              <input
                type="number"
                min={1}
                className={cn(inputClass, "mt-1 tabular-nums")}
                value={minMonthlySold}
                onChange={(e) => setMinMonthlySold(Number.parseInt(e.target.value, 10) || 0)}
              />
            </label>
            <label className="text-xs font-semibold text-zinc-500">
              Mín. ofertas New
              <input
                type="number"
                min={1}
                className={cn(inputClass, "mt-1 tabular-nums")}
                value={minNewOffers}
                onChange={(e) => setMinNewOffers(Number.parseInt(e.target.value, 10) || 1)}
              />
            </label>
            <label className="text-xs font-semibold text-zinc-500">
              Máx. linhas na edição
              <input
                type="number"
                min={1}
                max={100}
                className={cn(inputClass, "mt-1 tabular-nums")}
                value={maxPublish}
                onChange={(e) => setMaxPublish(Number.parseInt(e.target.value, 10) || AMAZON_LEADS_DAILY_PUBLISH_CAP)}
              />
            </label>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={excludeAmazon}
              onChange={(e) => setExcludeAmazon(e.target.checked)}
              className="size-4 rounded border-zinc-300"
            />
            Excluir buy box Amazon (ATVPDKIKX0DER)
          </label>
          <label className="block text-xs font-semibold text-zinc-500">
            Nota interna (pipeline)
            <input
              type="text"
              className={cn(inputClass, "mt-1")}
              value={pipelineNote}
              onChange={(e) => setPipelineNote(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={publishing || spreadsheetUploading || (!asinsText.trim() && !spreadsheetCsv.trim())}
            onClick={() => void publish()}
            className="rounded-2xl bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            {publishing ? "A processar Keepa…" : "Analisar e publicar edição"}
          </button>
        </div>

        <div className="rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">Últimas edições</h2>
          <div className="mt-3 max-h-[420px] overflow-auto text-sm">
            {editions.length === 0 ? (
              <p className="py-8 text-center text-zinc-500">Nenhuma edição gravada ainda.</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {editions.map((e) => (
                  <li key={e.editionDate + e.publishedAtIso} className="py-3">
                    <div className="font-mono text-xs font-bold text-zinc-900">{e.editionDate}</div>
                    <div className="text-xs text-zinc-500">{new Date(e.publishedAtIso).toLocaleString()}</div>
                    <div className="mt-1 text-zinc-700">
                      {e.rowCount} linhas · pedidos {e.asinsRequested} · rejeitados {e.rejectedCount}
                    </div>
                    {e.pipelineNote ? <div className="mt-1 text-xs text-zinc-500">{e.pipelineNote}</div> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {previewRows && previewRows.length > 0 ? (
        <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900">
            Pré-visualização da última publicação ({previewRows.length})
          </div>
          <div className="max-h-[min(400px,50vh)] overflow-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-3 py-2">ASIN</th>
                  <th className="px-3 py-2">Produto</th>
                  <th className="px-3 py-2 tabular-nums">EMS</th>
                  <th className="px-3 py-2 tabular-nums">New</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {previewRows.map((r) => (
                  <tr key={r.asin} className="hover:bg-zinc-50/80">
                    <td className="px-3 py-2 font-mono">{r.asin}</td>
                    <td className="max-w-[280px] truncate px-3 py-2 text-zinc-800" title={r.title}>
                      {r.title}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-emerald-800">{r.emsMonthly ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{r.newOffersTotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
