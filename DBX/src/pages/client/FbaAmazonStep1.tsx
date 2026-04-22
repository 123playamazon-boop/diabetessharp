import type { ComponentType, Dispatch, SetStateAction } from "react";
import { Search, ShoppingCart, Trash2, Truck } from "lucide-react";
import type { ClientProfile, InventoryRow } from "../../types";
import { cn } from "../../lib/cn";

type FbaWizardLine = {
  key: string;
  inventoryId: string;
  asin: string;
  title: string;
  imageUrl?: string;
  qty: number;
  groupId: string;
  pack: boolean;
  unitPriceUsd?: number;
};

function usedQtyInWizard(wizard: FbaWizardLine[], inventoryId: string): number {
  return wizard.filter((l) => l.inventoryId === inventoryId).reduce((a, l) => a + l.qty, 0);
}

type ProductThumbComponent = ComponentType<{
  row: InventoryRow;
  className?: string;
  size?: "sm" | "md" | "lg";
}>;

type Props = {
  uid: string;
  clientProfile: ClientProfile;
  inputClass: string;
  ProductThumb: ProductThumbComponent;
  fbaMinOrderUnits: number;
  fbaLeftInventoryRows: InventoryRow[];
  fbaStockTab: "novos" | "retornos" | "receber";
  setFbaStockTab: (t: "novos" | "retornos" | "receber") => void;
  fbaSearch: string;
  setFbaSearch: (s: string) => void;
  fbaSelectedInvId: string | null;
  setFbaSelectedInvId: (id: string | null) => void;
  fbaSelectedRow: InventoryRow | null;
  fbaDraftUnits: number;
  setFbaDraftUnits: Dispatch<SetStateAction<number>>;
  fbaDraftGroupId: string;
  setFbaDraftGroupId: (s: string) => void;
  fbaDraftPack: boolean;
  setFbaDraftPack: (v: boolean) => void;
  fbaGroups: { id: string; label: string }[];
  addFbaGroup: () => void;
  fbaWizardLines: FbaWizardLine[];
  addFbaLineToOrder: () => void;
  clearFbaDraftFields: () => void;
  cancelFbaOrderDraft: () => void;
  removeFbaWizardLineByKey: (key: string) => void;
  updateFbaWizardLineQty: (key: string, qty: number) => void;
  fbaCartTotalUsd: number;
  fbaTotalUnitsInWizard: number;
};

export function FbaAmazonStep1({
  uid,
  clientProfile,
  inputClass,
  ProductThumb,
  fbaMinOrderUnits,
  fbaLeftInventoryRows,
  fbaStockTab,
  setFbaStockTab,
  fbaSearch,
  setFbaSearch,
  fbaSelectedInvId,
  setFbaSelectedInvId,
  fbaSelectedRow,
  fbaDraftUnits,
  setFbaDraftUnits,
  fbaDraftGroupId,
  setFbaDraftGroupId,
  fbaDraftPack,
  setFbaDraftPack,
  fbaGroups,
  addFbaGroup,
  fbaWizardLines,
  addFbaLineToOrder,
  clearFbaDraftFields,
  cancelFbaOrderDraft,
  removeFbaWizardLineByKey,
  updateFbaWizardLineQty,
  fbaCartTotalUsd,
  fbaTotalUnitsInWizard,
}: Props) {
  const heading =
    (fbaWizardLines[0]?.title?.trim() ? fbaWizardLines[0]!.title.trim() : "") ||
    (fbaSelectedRow?.title?.trim() ? fbaSelectedRow.title.trim() : "");
  return (
    <section className="space-y-4" aria-labelledby={`${uid}-fba-pedido`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-[min(100%,520px)]">
          <h2
            id={`${uid}-fba-pedido`}
            className="flex flex-wrap items-center gap-2 text-xl font-bold leading-snug tracking-tight text-ds-text"
          >
            <Truck className="size-6 shrink-0 text-ds-primary" aria-hidden />
            <span className="min-w-0 break-words">{heading || "Novo pedido FBA"}</span>
          </h2>
          <p className="mt-1 text-xs font-semibold text-ds-text">
            Novo envio FBA · Suite <span className="font-mono">{clientProfile.suite}</span> · {clientProfile.name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ds-primary/25 bg-ds-soft-violet/40 px-3 py-1.5 text-sm font-bold tabular-nums text-ds-text">
            <ShoppingCart className="size-4 text-ds-primary" aria-hidden />$
            {fbaCartTotalUsd.toFixed(2)}
          </span>
          <span className="rounded-full border border-ds-border bg-ds-bg px-3 py-1.5 text-xs font-semibold text-ds-muted">
            Mínimo {fbaMinOrderUnits} unidades
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <div className="rounded-ds-card border border-ds-border bg-ds-surface p-4 shadow-ds">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ds-muted" aria-hidden />
            <input
              className={cn(inputClass, "pl-9")}
              placeholder="Pesquise por ASIN ou nome do produto"
              value={fbaSearch}
              onChange={(e) => setFbaSearch(e.target.value)}
              aria-label="Pesquisar produto"
            />
          </div>
          <div className="mt-3 flex rounded-ds-btn bg-ds-bg p-0.5" role="tablist" aria-label="Tipo de stock">
            {(["novos", "retornos", "receber"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={fbaStockTab === t}
                onClick={() => setFbaStockTab(t)}
                className={cn(
                  "flex-1 rounded-ds-btn py-2 text-xs font-bold transition",
                  fbaStockTab === t ? "bg-ds-surface text-ds-primary shadow-ds ring-1 ring-ds-border" : "text-ds-muted",
                )}
              >
                {t === "novos" ? "Novos" : t === "retornos" ? "Retornos" : "Recebimento"}
              </button>
            ))}
          </div>
          <ul className="mt-4 max-h-[min(480px,52vh)] space-y-2 overflow-y-auto pr-1">
            {fbaLeftInventoryRows.length === 0 ? (
              <li className="rounded-ds-btn border border-dashed border-ds-border px-3 py-8 text-center text-sm text-ds-muted">
                Nenhum SKU neste separador.
              </li>
            ) : (
              fbaLeftInventoryRows.map((row) => {
                const reserved = usedQtyInWizard(fbaWizardLines, row.id);
                const estoqueLive = Math.max(0, row.qty - reserved);
                const selected = fbaSelectedInvId === row.id;
                return (
                  <li
                    key={row.id}
                    className={cn(
                      "flex gap-3 rounded-ds-btn border p-3 transition",
                      selected ? "border-ds-primary bg-ds-soft-violet/25 ring-1 ring-ds-primary/20" : "border-ds-border bg-ds-bg",
                    )}
                  >
                    <ProductThumb key={row.id} row={row} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-ds-muted">Produto</p>
                      <p className="truncate text-sm font-semibold text-ds-text">{row.title}</p>
                      <p className="mt-0.5 text-xs text-ds-muted">
                        ASIN <span className="font-mono font-medium text-ds-text">{row.asin}</span>
                      </p>
                      <p className="mt-1 text-xs">
                        <span className="text-ds-muted">Estoque:</span>{" "}
                        <strong className="tabular-nums text-ds-text">{estoqueLive}</strong>
                        {(row.kind === "cadastro_pendente" || row.kind === "transito") && (
                          <span className="ml-2 rounded-full border border-amber-300/80 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                            Recebimento
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFbaSelectedInvId(row.id)}
                      className={cn(
                        "h-fit shrink-0 self-center rounded-ds-btn px-3 py-2 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary",
                        selected
                          ? "border border-ds-primary/40 bg-ds-soft-violet text-ds-primary"
                          : "bg-ds-primary text-white shadow-ds hover:opacity-95",
                      )}
                    >
                      {selected ? "Selecionado" : "Selecionar"}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="rounded-ds-card border border-ds-primary/20 bg-ds-soft-violet/25 p-4 shadow-ds">
            <p className="text-xs font-bold uppercase tracking-wide text-ds-primary">Montando seu pedido</p>
            <p className="mt-2 text-sm leading-relaxed text-ds-text">
              Começa por <strong>selecionar um produto</strong> à esquerda. Depois define unidades e{" "}
              <strong>grupo de envio</strong> (como no Seller Central) e carrega em{" "}
              <strong>Adicionar ao pedido</strong>. O pedido tem de bater com o plano de envio na Amazon. Quantidade
              mínima neste fluxo: <strong className="tabular-nums">{fbaMinOrderUnits} unidades</strong>. Em{" "}
              <strong>Recebimento</strong>: cadastros e trânsito — a foto vem do cadastro; o prep pode marcar como
              disponível em <strong>Admin → Stock</strong>.
            </p>
          </div>

          {fbaSelectedRow ? (
            <div className="rounded-ds-card border border-ds-border bg-ds-surface p-4 shadow-ds">
              <h3 className="text-sm font-bold text-ds-text">Itens adicionados ao pedido — configurar linha</h3>
              <div className="mt-3 flex flex-col gap-4 sm:flex-row">
                <ProductThumb key={fbaSelectedRow.id} row={fbaSelectedRow} size="lg" className="shrink-0" />
                <div className="min-w-0 flex-1 space-y-3">
                  <p className="text-xs text-ds-muted">
                    <span className="font-semibold text-ds-text">Produto:</span> {fbaSelectedRow.title}
                  </p>
                  <label className="block text-xs font-semibold text-ds-muted">
                    Unidades
                    <input
                      type="text"
                      inputMode="numeric"
                      className={cn(inputClass, "mt-1 tabular-nums")}
                      value={fbaDraftUnits < 1 ? "" : fbaDraftUnits}
                      onChange={(e) => {
                        const t = e.target.value.replace(/\D/g, "");
                        if (t === "") setFbaDraftUnits(0);
                        else setFbaDraftUnits(parseInt(t, 10) || 0);
                      }}
                      onBlur={() => setFbaDraftUnits((d) => (d < 1 ? 1 : d))}
                    />
                  </label>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="min-w-[12rem] flex-1 text-xs font-semibold text-ds-muted">
                      Grupo de envio
                      <select
                        className={cn(inputClass, "mt-1")}
                        value={fbaDraftGroupId}
                        onChange={(e) => setFbaDraftGroupId(e.target.value)}
                      >
                        <option value="">Selecione o grupo</option>
                        {fbaGroups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={addFbaGroup}
                      className="rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-2 text-xs font-semibold text-ds-text shadow-ds"
                    >
                      + Grupo
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-4 rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-2">
                    <span className="text-xs font-semibold text-ds-muted">Montar em pack?</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={fbaDraftPack}
                      onClick={() => setFbaDraftPack(!fbaDraftPack)}
                      className={cn(
                        "relative h-7 w-12 rounded-full transition",
                        fbaDraftPack ? "bg-ds-primary" : "bg-ds-border",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 size-6 rounded-full bg-white shadow transition",
                          fbaDraftPack ? "left-6" : "left-0.5",
                        )}
                      />
                    </button>
                    <span className="text-xs font-medium text-ds-text">{fbaDraftPack ? "SIM" : "NÃO"}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={addFbaLineToOrder}
                      className="rounded-ds-btn bg-ds-primary px-4 py-2.5 text-sm font-bold text-white shadow-ds"
                    >
                      Adicionar ao pedido
                    </button>
                    <button
                      type="button"
                      onClick={clearFbaDraftFields}
                      className="rounded-ds-btn border border-ds-border bg-ds-surface px-4 py-2.5 text-sm font-semibold text-ds-text"
                    >
                      Limpar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-ds-card border border-dashed border-ds-border bg-ds-surface/60 px-4 py-12 text-center text-sm text-ds-muted">
              Seleciona um produto à esquerda para definires unidades e grupo.
            </div>
          )}

          <div className="rounded-ds-card border border-ds-border bg-ds-surface p-4 shadow-ds">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-ds-text">
                Itens adicionados ao pedido
                {fbaTotalUnitsInWizard > 0 ? (
                  <span className="ml-2 font-normal text-ds-muted">· {fbaTotalUnitsInWizard} unidades</span>
                ) : null}
              </h3>
              {fbaWizardLines.length > 0 ? (
                <button
                  type="button"
                  onClick={cancelFbaOrderDraft}
                  className="rounded-ds-btn border border-ds-error/40 bg-red-50 px-3 py-1.5 text-xs font-bold text-ds-error"
                >
                  Cancelar pedido
                </button>
              ) : null}
            </div>
            {fbaWizardLines.length === 0 ? (
              <p className="mt-4 text-sm text-ds-muted">Ainda não há linhas — usa «Adicionar ao pedido».</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-ds-border text-xs font-bold uppercase tracking-wide text-ds-muted">
                      <th className="min-w-[140px] py-2 pr-2 sm:min-w-[200px]">Produto</th>
                      <th className="py-2 pr-2">Pack?</th>
                      <th className="py-2 pr-2">Unidades</th>
                      <th className="py-2 pr-2">Grupo</th>
                      <th className="py-2 pr-2">Img</th>
                      <th className="py-2 text-right">Excluir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ds-border">
                    {fbaWizardLines.map((line) => {
                      const gl = fbaGroups.find((g) => g.id === line.groupId)?.label ?? line.groupId;
                      const invRow: InventoryRow = {
                        id: line.inventoryId,
                        asin: line.asin,
                        title: line.title,
                        qty: 0,
                        kind: "novo",
                        storageDays: 0,
                        storageLimitDays: 0,
                        imageUrl: line.imageUrl,
                      };
                      return (
                        <tr key={line.key}>
                          <td className="min-w-0 max-w-[min(100%,20rem)] py-2 pr-2">
                            <span className="line-clamp-3 break-words font-medium leading-snug text-ds-text">{line.title}</span>
                          </td>
                      <td className="py-2 pr-2 font-semibold">{line.pack ? "SIM" : "NÃO"}</td>
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          min={1}
                          className={cn(inputClass, "w-20 py-1.5 text-sm tabular-nums")}
                          value={line.qty}
                          onChange={(e) => {
                            const n = parseInt(e.target.value, 10);
                            if (Number.isNaN(n)) return;
                            updateFbaWizardLineQty(line.key, n);
                          }}
                          aria-label={`Unidades — ${line.title}`}
                        />
                      </td>
                          <td className="py-2 pr-2 text-ds-primary">{gl}</td>
                          <td className="py-2 pr-2">
                            <ProductThumb key={line.key} row={invRow} size="sm" />
                          </td>
                          <td className="py-2 text-right">
                            <button
                              type="button"
                              onClick={() => removeFbaWizardLineByKey(line.key)}
                              className="inline-flex size-9 items-center justify-center rounded-ds-btn border border-ds-error/30 text-ds-error hover:bg-red-50"
                              aria-label="Excluir linha"
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
