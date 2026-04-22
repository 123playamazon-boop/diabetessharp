import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { AppLocale } from "../../i18n/catalog";
import type { InventoryRow } from "../../types";
import { getCustomerReturnMerchandiseFeePerUnitUsd } from "../../lib/customerReturnFee";
import {
  appendCustomerReturnIntake,
  CUSTOMER_RETURNS_UPDATED_EVENT,
  loadCustomerReturnIntakes,
  type CustomerReturnDisposition,
  type CustomerReturnIntakeRecord,
} from "../../lib/customerReturnIntakeStorage";
import { updateAddedInventoryRow, loadAddedInventory, INVENTORY_UPDATED_EVENT } from "../../lib/clientInventoryStorage";
import { postAdminWalletAdjust } from "../../lib/walletApi";
import { decodeHtmlEntities } from "../../lib/decodeHtmlEntities";

function formatWhen(iso: string, locale: AppLocale): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  const tag = locale === "pt-BR" ? "pt-BR" : locale === "es" ? "es" : "en-US";
  return new Intl.DateTimeFormat(tag, { dateStyle: "short", timeStyle: "short" }).format(new Date(ms));
}

export function CustomerReturnsAdminPanel({
  rows,
  premiumBySuite,
  t,
  locale,
}: {
  rows: InventoryRow[];
  premiumBySuite: Record<string, boolean>;
  t: (k: string, v?: Record<string, string | number>) => string;
  locale: AppLocale;
}) {
  const [tick, setTick] = useState(0);
  const [suite, setSuite] = useState("");
  const [rowId, setRowId] = useState("");
  const [qty, setQty] = useState("1");
  const [disposition, setDisposition] = useState<CustomerReturnDisposition>("resellable");
  const [notes, setNotes] = useState("");
  const [alsoStock, setAlsoStock] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const fn = () => setTick((x) => x + 1);
    window.addEventListener(CUSTOMER_RETURNS_UPDATED_EVENT, fn);
    return () => window.removeEventListener(CUSTOMER_RETURNS_UPDATED_EVENT, fn);
  }, []);

  const suiteOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      if (r.clientSuite?.trim()) s.add(r.clientSuite.trim());
    }
    return [...s].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [rows]);

  const rowsForSuite = useMemo(() => {
    if (!suite.trim()) return [];
    return rows.filter((r) => (r.clientSuite ?? "").trim() === suite.trim());
  }, [rows, suite]);

  const selectedRow = useMemo(() => rowsForSuite.find((r) => r.id === rowId) ?? null, [rowsForSuite, rowId]);

  const plan: "basic" | "premium" = selectedRow
    ? premiumBySuite[(selectedRow.clientSuite ?? "").trim()] === true
      ? "premium"
      : "basic"
    : "basic";

  const rate = getCustomerReturnMerchandiseFeePerUnitUsd(plan);
  const qtyN = Number(String(qty).replace(",", ".").trim());
  const totalFee = Number.isFinite(qtyN) && qtyN > 0 ? Math.round(qtyN * rate * 100) / 100 : 0;

  useEffect(() => {
    if (!suite.trim()) {
      setRowId("");
      return;
    }
    if (rowId && !rowsForSuite.some((r) => r.id === rowId)) setRowId("");
  }, [suite, rowsForSuite, rowId]);

  const history = useMemo(() => {
    void tick;
    return loadCustomerReturnIntakes().slice(0, 15);
  }, [tick]);

  const submit = useCallback(async () => {
    if (!suite.trim()) {
      toast.error(t("admin.stock.returnsErrSuite"));
      return;
    }
    if (!selectedRow) {
      toast.error(t("admin.stock.returnsErrRow"));
      return;
    }
    const q = Number(String(qty).replace(",", ".").trim());
    if (!Number.isFinite(q) || q < 1 || !Number.isInteger(q)) {
      toast.error(t("admin.stock.returnsErrQty"));
      return;
    }
    const addedIds = new Set(loadAddedInventory().map((r) => r.id));
    if (!addedIds.has(selectedRow.id)) {
      toast.error(t("admin.stock.returnsErrNotClientRow"));
      return;
    }

    const fee = Math.round(q * getCustomerReturnMerchandiseFeePerUnitUsd(plan) * 100) / 100;
    if (!window.confirm(t("admin.stock.returnsConfirm", { fee: String(fee), qty: q }))) return;

    setBusy(true);
    try {
      const id = `RET-${Date.now()}`;
      const wallet = await postAdminWalletAdjust({
        suite: suite.trim(),
        deltaUsd: -fee,
        reason: "customer_return_merchandise",
        reference: id,
      });
      if (!wallet.ok) {
        toast.error(wallet.error || t("admin.stock.returnsWalletFail"));
        return;
      }

      let stockUpdated = false;
      if (alsoStock) {
        stockUpdated = await updateAddedInventoryRow(selectedRow.id, {
          qty: selectedRow.qty + q,
          kind: "retorno",
        });
        if (!stockUpdated) toast.message(t("admin.stock.returnsStockWarn"));
      }

      const rec: CustomerReturnIntakeRecord = {
        id,
        recordedAtIso: new Date().toISOString(),
        suite: suite.trim(),
        inventoryId: selectedRow.id,
        asin: selectedRow.asin,
        title: selectedRow.title,
        qtyProcessed: q,
        disposition,
        inspectionNotes: notes.trim() || undefined,
        feeUsd: fee,
        planUsed: plan,
        walletDebited: true,
        stockUpdated,
      };
      appendCustomerReturnIntake(rec);
      window.dispatchEvent(new CustomEvent(INVENTORY_UPDATED_EVENT));
      toast.success(t("admin.stock.returnsOk", { balance: wallet.balanceUsd.toFixed(2) }));
      setNotes("");
      setQty("1");
    } finally {
      setBusy(false);
    }
  }, [suite, selectedRow, qty, plan, disposition, notes, alsoStock, t]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-violet-200/80 bg-violet-50/50 p-4 shadow-sm">
        <p className="text-sm font-bold text-violet-950">{t("admin.stock.returnsTitle")}</p>
        <p className="mt-2 text-xs leading-relaxed text-violet-950/90">{t("admin.stock.returnsIntro")}</p>
        <ul className="mt-2 list-inside list-decimal space-y-1 text-xs text-violet-950/85">
          <li>{t("admin.stock.returnsStep1")}</li>
          <li>{t("admin.stock.returnsStep2")}</li>
          <li>{t("admin.stock.returnsStep3")}</li>
        </ul>
      </div>

      <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:grid-cols-2">
        <label className="block text-xs font-semibold text-zinc-700">
          {t("admin.orders.col.suite")}
          <select
            value={suite}
            onChange={(e) => setSuite(e.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
          >
            <option value="">{t("admin.stock.returnsPickSuite")}</option>
            {suiteOptions.map((su) => (
              <option key={su} value={su}>
                {su}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold text-zinc-700">
          {t("admin.stock.returnsSkuLine")}
          <select
            value={rowId}
            onChange={(e) => setRowId(e.target.value)}
            disabled={!suite.trim() || rowsForSuite.length === 0}
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 disabled:opacity-50"
          >
            <option value="">{t("admin.stock.returnsPickRow")}</option>
            {rowsForSuite.map((r) => (
              <option key={r.id} value={r.id}>
                {r.asin} · {decodeHtmlEntities(r.title).slice(0, 48)}
                {r.title.length > 48 ? "…" : ""} (qty {r.qty})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold text-zinc-700">
          {t("admin.stock.returnsQty")}
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            inputMode="numeric"
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm tabular-nums text-zinc-900"
          />
        </label>
        <div className="block text-xs font-semibold text-zinc-700">
          {t("admin.stock.returnsDisposition")}
          <div className="mt-2 flex flex-col gap-2">
            {(["resellable", "damaged", "mixed"] as const).map((d) => (
              <label key={d} className="flex cursor-pointer items-center gap-2 text-sm font-normal text-zinc-800">
                <input type="radio" name="ret-disp" checked={disposition === d} onChange={() => setDisposition(d)} />
                {t(`admin.stock.returnsDisp.${d}`)}
              </label>
            ))}
          </div>
        </div>
        <label className="md:col-span-2 block text-xs font-semibold text-zinc-700">
          {t("admin.stock.returnsNotes")}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
            placeholder={t("admin.stock.returnsNotesPh")}
          />
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800 md:col-span-2">
          <input type="checkbox" checked={alsoStock} onChange={(e) => setAlsoStock(e.target.checked)} />
          {t("admin.stock.returnsAlsoStock")}
        </label>
        <div className="md:col-span-2 rounded-xl border border-teal-100 bg-teal-50/60 px-3 py-2 text-sm text-teal-950">
          <p>
            <span className="font-semibold">{t("admin.stock.returnsFeeLine")}</span>{" "}
            <span className="tabular-nums font-bold">
              US$ {rate.toFixed(2)} × {Number.isFinite(qtyN) && qtyN > 0 ? qtyN : "—"} = US$ {totalFee.toFixed(2)}
            </span>
          </p>
          <p className="mt-1 text-xs text-teal-900/85">
            {t("admin.stock.returnsPlanHint", { plan: t(plan === "premium" ? "admin.stock.returnsPlanPremium" : "admin.stock.returnsPlanBasic") })}
          </p>
        </div>
        <div className="md:col-span-2">
          <button
            type="button"
            disabled={busy || !selectedRow}
            onClick={() => void submit()}
            className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {busy ? "…" : t("admin.stock.returnsSubmit")}
          </button>
        </div>
      </div>

      {history.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {t("admin.stock.returnsHistory")}
          </div>
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs text-zinc-800">
              <thead className="border-b border-zinc-100 text-[10px] uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2">{t("admin.stock.returnsColWhen")}</th>
                  <th className="px-3 py-2">{t("admin.orders.col.suite")}</th>
                  <th className="px-3 py-2">ASIN</th>
                  <th className="px-3 py-2">{t("admin.stock.returnsColQty")}</th>
                  <th className="px-3 py-2">{t("admin.stock.returnsColFee")}</th>
                  <th className="px-3 py-2">{t("admin.stock.returnsColPlan")}</th>
                  <th className="px-3 py-2">{t("admin.stock.returnsColStock")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="px-3 py-2 whitespace-nowrap">{formatWhen(h.recordedAtIso, locale)}</td>
                    <td className="px-3 py-2 font-mono font-semibold">{h.suite}</td>
                    <td className="px-3 py-2">{h.asin}</td>
                    <td className="px-3 py-2 tabular-nums">{h.qtyProcessed}</td>
                    <td className="px-3 py-2 tabular-nums font-semibold">US$ {h.feeUsd.toFixed(2)}</td>
                    <td className="px-3 py-2">
                      {h.planUsed === "premium" ? t("admin.stock.returnsPlanPremium") : t("admin.stock.returnsPlanBasic")}
                    </td>
                    <td className="px-3 py-2">{h.stockUpdated ? "✓" : "—"}</td>
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
