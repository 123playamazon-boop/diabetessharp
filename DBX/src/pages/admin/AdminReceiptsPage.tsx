import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Package } from "lucide-react";
import { toast } from "sonner";
import type { ClientOrderShipmentLine, InventoryRow } from "../../types";
import { amazonComDpUrl, extractAmazonAsin } from "../../lib/amazonAsin";
import { decodeHtmlEntities } from "../../lib/decodeHtmlEntities";
import { OrderLineThumb } from "../../components/OrderLineThumb";
import {
  CLIENT_INVENTORY_ADDITIONS_KEY,
  CLIENT_INVENTORY_DEDUCTIONS_KEY,
  type ConfirmReceiptBody,
  confirmInventoryReceiptOnServer,
  INVENTORY_UPDATED_EVENT,
  loadAddedInventory,
  pullInventoryFromServer,
} from "../../lib/clientInventoryStorage";
import { PageHeader } from "../../ui/PageHeader";
import { useI18n } from "../../i18n/context";

const CONDITIONS = [
  { value: "new", label: "Novo" },
  { value: "used", label: "Usado" },
  { value: "damaged", label: "Danificado" },
] as const;

const PACKAGING = [
  { value: "", label: "Escolha uma opção" },
  { value: "caixa", label: "Caixa" },
  { value: "saco", label: "Saco" },
] as const;

function looksLikeAmazonAsin(asin: string): boolean {
  const a = asin.trim().toUpperCase();
  return /^[A-Z0-9]{10}$/.test(a);
}

function shipmentLineFromInventoryRow(r: InventoryRow): ClientOrderShipmentLine {
  return {
    inventoryId: r.id,
    asin: r.asin,
    title: r.title,
    qty: r.qty,
    imageUrl: r.imageUrl,
  };
}

function formatCadastroLabel(r: InventoryRow): string {
  const raw = r.arrivalDate?.trim() || r.storageFreeStartIso?.trim();
  if (!raw) return "—";
  const t = Date.parse(raw);
  if (Number.isFinite(t)) {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(t));
  }
  return raw;
}

function ReceiptHeroImage({ row }: { row: InventoryRow }) {
  type Stage = "primary" | "asinA" | "asinB" | "icon";
  const tryAmazon = looksLikeAmazonAsin(row.asin);
  const asinA = `https://images-na.ssl-images-amazon.com/images/P/${encodeURIComponent(row.asin)}.01._AC_SL500_.jpg`;
  const asinB = `https://m.media-amazon.com/images/P/${encodeURIComponent(row.asin)}.01._AC_SL500_.jpg`;
  const computeStage = (): Stage => {
    if (row.imageUrl?.trim()) return "primary";
    if (tryAmazon) return "asinA";
    return "icon";
  };
  const [stage, setStage] = useState<Stage>(() => computeStage());
  useEffect(() => {
    setStage(computeStage());
  }, [row.id, row.asin, row.imageUrl]);

  const src =
    stage === "primary" && row.imageUrl?.trim()
      ? row.imageUrl.trim()
      : stage === "asinA" && tryAmazon
        ? asinA
        : stage === "asinB" && tryAmazon
          ? asinB
          : null;

  const onError = () => {
    setStage((s) => {
      if (s === "primary") return tryAmazon ? "asinA" : "icon";
      if (s === "asinA") return tryAmazon ? "asinB" : "icon";
      return "icon";
    });
  };

  if (!src) {
    return (
      <div className="flex aspect-square max-h-[min(360px,45vh)] w-full items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-zinc-400">
        <Package className="size-16" aria-hidden />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      className="max-h-[min(360px,45vh)] w-full rounded-2xl border border-zinc-200 object-contain bg-white"
      onError={onError}
    />
  );
}

export function AdminReceiptsPage() {
  const { t } = useI18n();
  const [suiteQ, setSuiteQ] = useState("");
  const [nameQ, setNameQ] = useState("");
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [selected, setSelected] = useState<InventoryRow | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    const pending = loadAddedInventory().filter((r) => r.kind === "cadastro_pendente");
    setRows(pending);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await pullInventoryFromServer();
      if (!cancelled) refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    refresh();
    const on = () => refresh();
    window.addEventListener(INVENTORY_UPDATED_EVENT, on);
    return () => window.removeEventListener(INVENTORY_UPDATED_EVENT, on);
  }, [refresh]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (
        e.key == null ||
        e.key === CLIENT_INVENTORY_ADDITIONS_KEY ||
        e.key === CLIENT_INVENTORY_DEDUCTIONS_KEY
      ) {
        refresh();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onFocus = () => refresh();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const filtered = useMemo(() => {
    const s = suiteQ.trim().toLowerCase();
    const n = nameQ.trim().toLowerCase();
    return rows.filter((r) => {
      const suite = (r.clientSuite ?? "").toLowerCase();
      const name = (r.clientName ?? "").toLowerCase();
      if (s && !suite.includes(s)) return false;
      if (n && !name.includes(n)) return false;
      return true;
    });
  }, [rows, suiteQ, nameQ]);

  const hasReceiptFilter = suiteQ.trim() !== "" || nameQ.trim() !== "";

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Recebimentos"
        title="Confirmação de recebimento"
        subtitle="Fila só para cadastros inbound do portal (estado «cadastro pendente»): mercadoria ainda por conferir fisicamente no prep. Pedidos de envio (FBM/FBA) aparecem em Início / Pedidos — criar envio não duplica a linha aqui."
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-violet-600 px-4 py-3 text-sm text-white shadow-md">
        <label className="flex items-center gap-2 font-semibold">
          <span className="shrink-0 text-violet-100">Suite</span>
          <input
            className="w-28 rounded-lg border-0 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus-visible:outline focus-visible:ring-2 focus-visible:ring-white/80"
            placeholder="—"
            value={suiteQ}
            onChange={(e) => setSuiteQ(e.target.value)}
          />
        </label>
        <label className="flex min-w-[200px] flex-1 items-center gap-2 font-semibold">
          <span className="shrink-0 text-violet-100">Nome</span>
          <input
            className="min-w-0 flex-1 rounded-lg border-0 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus-visible:outline focus-visible:ring-2 focus-visible:ring-white/80"
            placeholder="Nome do cliente"
            value={nameQ}
            onChange={(e) => setNameQ(e.target.value)}
          />
        </label>
        <span className="ml-auto text-sm font-bold tabular-nums text-violet-100">
          {hasReceiptFilter ? (
            <>
              Mostrando {filtered.length} de {rows.length}
            </>
          ) : (
            <>Total: {rows.length}</>
          )}
        </span>
        <button
          type="button"
          className="shrink-0 rounded-lg border border-violet-400 bg-violet-500 px-4 py-2 text-sm font-bold text-white hover:bg-violet-400"
          onClick={() => refresh()}
        >
          Atualizar
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[960px] w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-[11px] font-bold uppercase tracking-wide text-zinc-600">
              <tr>
                <th className="px-3 py-3 pl-4">Suíte</th>
                <th className="px-3 py-3">Produto</th>
                <th className="px-3 py-3">Cliente</th>
                <th className="px-3 py-3">Fornecedor</th>
                <th className="px-3 py-3 text-center">Qtd</th>
                <th className="px-3 py-3">Cadastrado</th>
                <th className="px-3 py-3 text-center">Foto</th>
                <th className="px-3 py-3 pr-4 text-right"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-zinc-500">
                    <p className="mx-auto max-w-lg leading-relaxed">
                      Nenhum produto em «cadastro pendente» para conferir. Só entram aqui os SKUs registados pelo
                      cliente em «Cadastrar produto» (antes do prep libertar stock). Se o que procura é o envio que
                      acabou de aparecer no painel, abra{" "}
                      <Link to="/admin/pedidos" className="font-semibold text-violet-700 underline-offset-2 hover:underline">
                        Pedidos
                      </Link>
                      . Com a API demo parada ou snapshot vazio, confirme «npm run dev» (Vite + Express :8787) para
                      sincronizar cadastros.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-violet-50/40">
                    <td className="px-3 py-3 pl-4 font-bold tabular-nums text-zinc-900">{r.clientSuite ?? "—"}</td>
                    <td className="max-w-[min(320px,32vw)] px-3 py-3">
                      <span className="line-clamp-2 font-medium text-zinc-900" title={decodeHtmlEntities(r.title)}>
                        {decodeHtmlEntities(r.title)}
                      </span>
                    </td>
                    <td className="max-w-[200px] px-3 py-3 text-zinc-800">
                      <span className="line-clamp-2" title={r.clientName ?? ""}>
                        {r.clientName ?? "—"}
                      </span>
                    </td>
                    <td className="max-w-[160px] px-3 py-3 text-zinc-600">
                      <span className="line-clamp-2" title={r.supplier ?? ""}>
                        {r.supplier ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center font-bold tabular-nums text-zinc-900">{r.qty}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-zinc-600">{formatCadastroLabel(r)}</td>
                    <td className="px-3 py-3">
                      <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                        <OrderLineThumb line={shipmentLineFromInventoryRow(r)} size={48} zoomable />
                      </div>
                    </td>
                    <td className="px-3 py-3 pr-4 text-right">
                      <button
                        type="button"
                        className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-violet-700"
                        onClick={() => setSelected(r)}
                      >
                        Confirmar recebimento
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected ? (
        <ReceiptModal
          row={selected}
          busy={busy}
          onClose={() => !busy && setSelected(null)}
          onSubmit={async (payload) => {
            setBusy(true);
            try {
              const res = await confirmInventoryReceiptOnServer(selected.id, payload);
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              toast.success(
                payload.mode === "release" ? t("admin.receipts.toastReleaseOk") : t("admin.receipts.toastIssueOk"),
              );
              setSelected(null);
              refresh();
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function ReceiptModal({
  row,
  busy,
  onClose,
  onSubmit,
}: {
  row: InventoryRow;
  busy: boolean;
  onClose: () => void;
  onSubmit: (p: ConfirmReceiptBody) => Promise<void>;
}) {
  const [qtyReceived, setQtyReceived] = useState(String(row.qty));
  const [condition, setCondition] = useState(row.condition ?? "new");
  const [color, setColor] = useState(row.color ?? "");
  const [size, setSize] = useState(row.size ?? "");
  const [brand, setBrand] = useState(row.brand ?? "");
  const [model, setModel] = useState(row.model ?? "");
  const [upc, setUpc] = useState(row.upc ?? "");
  const [tracking, setTracking] = useState(row.tracking ?? "");
  const [comments, setComments] = useState("");
  const [packaging, setPackaging] = useState("");
  const [hasExpiry, setHasExpiry] = useState(false);
  const [receivedLocal, setReceivedLocal] = useState(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [damageNotes, setDamageNotes] = useState("");
  const [notifyClient, setNotifyClient] = useState(true);

  useEffect(() => {
    setQtyReceived(String(row.qty));
    setCondition(row.condition ?? "new");
    setColor(row.color ?? "");
    setSize(row.size ?? "");
    setBrand(row.brand ?? "");
    setModel(row.model ?? "");
    setUpc(row.upc ?? "");
    setTracking(row.tracking ?? "");
    setComments("");
    setPackaging("");
    setHasExpiry(false);
    setDamageNotes("");
    setNotifyClient(true);
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    setReceivedLocal(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
    );
  }, [row.id, row.qty, row.condition, row.color, row.size, row.brand, row.model, row.upc, row.tracking]);

  const openAmazon = () => {
    const a = extractAmazonAsin(row.asin);
    if (!a) {
      toast.message("Sem ASIN Amazon nesta linha.", { description: "Use o cadastro com ASIN ou verifique no stock." });
      return;
    }
    window.open(amazonComDpUrl(a), "_blank", "noopener,noreferrer");
  };

  const buildAdminNotes = () => {
    const parts: string[] = [];
    if (comments.trim()) parts.push(comments.trim());
    if (packaging === "caixa" || packaging === "saco") {
      parts.push(`Embalagem recebida: ${packaging === "caixa" ? "caixa" : "saco"}.`);
    }
    if (hasExpiry) parts.push("Produto com validade a tratar.");
    if (receivedLocal) {
      try {
        const dt = new Date(receivedLocal);
        if (!Number.isNaN(dt.getTime())) {
          parts.push(`Data/hora recebido (prep): ${dt.toLocaleString()}.`);
        }
      } catch {
        /* ignore */
      }
    }
    return parts.join("\n");
  };

  const metadata: ConfirmReceiptBody["metadata"] = {
    color: color.trim() || undefined,
    size: size.trim() || undefined,
    brand: brand.trim() || undefined,
    model: model.trim() || undefined,
    upc: upc.trim() || undefined,
    tracking: tracking.trim() || undefined,
    condition: condition || undefined,
  };

  const submitRelease = async () => {
    const q = Number(qtyReceived);
    if (!Number.isFinite(q) || q < 0) {
      toast.error("Indique a quantidade recebida (número ≥ 0).");
      return;
    }
    await onSubmit({
      mode: "release",
      qtyReceived: q,
      notifyClient: false,
      adminNotes: buildAdminNotes(),
      damageNotes: undefined,
      metadata,
    });
  };

  const submitIssue = async () => {
    const q = Number(qtyReceived);
    if (!Number.isFinite(q) || q < 0) {
      toast.error("Indique a quantidade recebida (número ≥ 0).");
      return;
    }
    if (!damageNotes.trim()) {
      toast.error("Descreva a avaria ou a divergência para o cliente.");
      return;
    }
    await onSubmit({
      mode: "issue",
      qtyReceived: q,
      notifyClient,
      adminNotes: buildAdminNotes(),
      damageNotes: damageNotes.trim(),
      metadata,
    });
  };

  const field =
    "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-500";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-zinc-900/50"
        aria-label="Fechar"
        onClick={onClose}
        disabled={busy}
      />
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between bg-violet-700 px-5 py-4 text-white">
          <h2 className="text-sm font-bold uppercase tracking-wide">Confirmação de recebimento</h2>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-xs font-semibold text-violet-100 hover:bg-white/10"
            onClick={onClose}
            disabled={busy}
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="border-b border-zinc-100 p-4">
            <button
              type="button"
              onClick={openAmazon}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-amber-950 shadow-sm hover:bg-amber-400"
            >
              <span className="text-xs font-black tracking-tight">A</span>
              Checar na Amazon
              <ExternalLink className="size-4 opacity-80" aria-hidden />
            </button>
          </div>

          <div className="grid gap-6 p-5 lg:grid-cols-[1fr_280px]">
            <div className="space-y-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Descrição
                <input readOnly className={`${field} mt-1 bg-zinc-50`} value={decodeHtmlEntities(row.title)} />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Quantidade comprada (cliente)
                  <input readOnly className={`${field} mt-1 bg-zinc-100 tabular-nums`} value={row.qty} />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wide text-red-600">
                  Quantidade recebida
                  <input
                    className={`${field} mt-1 border-red-300 tabular-nums focus-visible:outline-red-500`}
                    inputMode="numeric"
                    value={qtyReceived}
                    onChange={(e) => setQtyReceived(e.target.value)}
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Condições
                  <select className={`${field} mt-1`} value={condition} onChange={(e) => setCondition(e.target.value)}>
                    {CONDITIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Data recebido (prep)
                  <input
                    type="datetime-local"
                    className={`${field} mt-1`}
                    value={receivedLocal}
                    onChange={(e) => setReceivedLocal(e.target.value)}
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Cor
                  <input className={`${field} mt-1`} value={color} onChange={(e) => setColor(e.target.value)} />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Tamanho
                  <input className={`${field} mt-1`} value={size} onChange={(e) => setSize(e.target.value)} />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Marca
                  <input className={`${field} mt-1`} value={brand} onChange={(e) => setBrand(e.target.value)} />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Modelo
                  <input className={`${field} mt-1`} value={model} onChange={(e) => setModel(e.target.value)} />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Número de rastreio
                  <input className={`${field} mt-1`} value={tracking} onChange={(e) => setTracking(e.target.value)} />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  UPC do produto
                  <input className={`${field} mt-1`} value={upc} onChange={(e) => setUpc(e.target.value)} />
                </label>
              </div>

              {row.notes?.trim() ? (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-sm text-zinc-700">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Notas do cliente</p>
                  <p className="mt-1 whitespace-pre-wrap">{row.notes}</p>
                </div>
              ) : null}
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Comentários do prep (opcional)
                <textarea
                  className={`${field} mt-1 min-h-[88px] resize-y`}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Observações internas / prep — ficam anexadas ao registo com marca de data."
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Caixa ou saco?
                  <select
                    className={`${field} mt-1`}
                    value={packaging}
                    onChange={(e) => setPackaging(e.target.value)}
                  >
                    {PACKAGING.map((p) => (
                      <option key={p.value || "none"} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-col justify-end gap-2 rounded-xl border border-red-200 bg-red-50/40 px-3 py-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-red-600">Tem validade?</span>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-zinc-300"
                      checked={hasExpiry}
                      onChange={(e) => setHasExpiry(e.target.checked)}
                    />
                    Sim — requer tratamento de validade
                  </label>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Problema / avaria</p>
                <textarea
                  className={`${field} mt-2 min-h-[80px]`}
                  value={damageNotes}
                  onChange={(e) => setDamageNotes(e.target.value)}
                  placeholder="Quebrado, embalagem danificada, quantidade em falta…"
                />
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-amber-950">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-amber-400"
                    checked={notifyClient}
                    onChange={(e) => setNotifyClient(e.target.checked)}
                  />
                  Enviar aviso por e-mail ao cliente (e-mail da suite) — demo grava fila no servidor
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Foto do cadastro</p>
              <ReceiptHeroImage row={row} />
              <p className="text-xs leading-relaxed text-zinc-500">
                Compare com o artigo físico. PO: {row.poNumber ?? "—"} · ASIN: {row.asin}
              </p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-zinc-100 bg-zinc-50 px-5 py-4">
          <button
            type="button"
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
            onClick={onClose}
            disabled={busy}
          >
            Fechar
          </button>
          <button
            type="button"
            className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            onClick={() => void submitIssue()}
            disabled={busy}
          >
            Reportar problema
          </button>
          <button
            type="button"
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
            onClick={() => void submitRelease()}
            disabled={busy}
          >
            Concluir e disponibilizar
          </button>
        </div>
      </div>
    </div>
  );
}
