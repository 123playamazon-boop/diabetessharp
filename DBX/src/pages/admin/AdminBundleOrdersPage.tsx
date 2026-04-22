import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { useI18n } from "../../i18n/context";
import { PageHeader } from "../../ui/PageHeader";
import { cn } from "../../lib/cn";
import {
  adminCompleteBundleOrder,
  adminFetchBundleOrders,
  adminPatchBundleOrderMeta,
  adminPatchBundleOrderStatus,
  fetchBundles,
  type BundleOrder,
  type BundleOrderStatus,
  type BundleRecord,
} from "../../lib/bundleApi";
import { formatUsd } from "../../lib/prepCenterPricing";

const STATUSES: BundleOrderStatus[] = [
  "pending",
  "picking",
  "assembling",
  "quality_check",
  "completed",
  "cancelled",
];

function nextStatus(cur: BundleOrderStatus): BundleOrderStatus | null {
  if (cur === "pending") return "picking";
  if (cur === "picking") return "assembling";
  if (cur === "assembling") return "quality_check";
  return null;
}

function batchSegments(total: number, batch: number | undefined): { from: number; to: number }[] {
  if (!batch || batch < 1 || total < 1) return [];
  if (batch >= total) return [{ from: 1, to: total }];
  const segs: { from: number; to: number }[] = [];
  let start = 1;
  while (start <= total) {
    const to = Math.min(start + batch - 1, total);
    segs.push({ from: start, to });
    start = to + 1;
  }
  return segs;
}

function consolidatedPick(
  siblingOrders: BundleOrder[],
  bundleMap: Record<string, BundleRecord | undefined>,
): { sku: string; qty: number }[] {
  const m: Record<string, number> = {};
  for (const o of siblingOrders) {
    const b = bundleMap[`${o.suite}:${o.bundleId}`];
    if (!b) continue;
    for (const it of b.items) {
      m[it.productSku] = (m[it.productSku] ?? 0) + it.qtyPerBundle * o.quantity;
    }
  }
  return Object.entries(m)
    .map(([sku, qty]) => ({ sku, qty }))
    .sort((a, b) => a.sku.localeCompare(b.sku));
}

export function AdminBundleOrdersPage() {
  const { t } = useI18n();
  const [filter, setFilter] = useState<"" | BundleOrderStatus>("");
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<BundleOrder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bundleCache, setBundleCache] = useState<Record<string, BundleRecord | undefined>>({});
  const [metaFnsku, setMetaFnsku] = useState("");
  const [metaBusy, setMetaBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await adminFetchBundleOrders(filter || undefined);
    setLoading(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setOrders(r.orders);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(() => orders.find((o) => o.id === selectedId) ?? null, [orders, selectedId]);

  const siblingOrders = useMemo(() => {
    if (!selected) return [];
    if (!selected.assemblyGroupId) return [selected];
    return orders
      .filter((o) => o.assemblyGroupId === selected.assemblyGroupId)
      .sort((a, b) => (a.groupLineIndex ?? 0) - (b.groupLineIndex ?? 0));
  }, [selected, orders]);

  useEffect(() => {
    if (!selected) {
      setMetaFnsku("");
      return;
    }
    setMetaFnsku(selected.labelFnsku ?? "");
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const suite = selected.suite;
    const bundleIds = new Set<string>();
    if (selected.assemblyGroupId) {
      orders.filter((o) => o.assemblyGroupId === selected.assemblyGroupId).forEach((o) => bundleIds.add(o.bundleId));
    } else {
      bundleIds.add(selected.bundleId);
    }
    const missing = [...bundleIds].some((bid) => !(`${suite}:${bid}` in bundleCache));
    if (!missing) return;
    void fetchBundles(suite).then((r) => {
      if (!r.ok) return;
      const next: Record<string, BundleRecord | undefined> = {};
      for (const bid of bundleIds) {
        const k = `${suite}:${bid}`;
        next[k] = r.bundles.find((x) => x.id === bid);
      }
      setBundleCache((prev) => ({ ...prev, ...next }));
    });
  }, [selected, orders, bundleCache]);

  const selectedBundle = selected ? bundleCache[`${selected.suite}:${selected.bundleId}`] : undefined;

  const consolidated = useMemo(() => consolidatedPick(siblingOrders, bundleCache), [siblingOrders, bundleCache]);

  const patchOrder = async (id: string, next: BundleOrderStatus) => {
    const r = await adminPatchBundleOrderStatus(id, next);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(t("admin.bundles.toastStatus"));
    setOrders((prev) => prev.map((o) => (o.id === id ? r.order : o)));
  };

  const complete = async (id: string) => {
    const r = await adminCompleteBundleOrder(id);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(t("admin.bundles.toastComplete"));
    setOrders((prev) => prev.map((o) => (o.id === id ? r.order : o)));
  };

  const saveMeta = async () => {
    if (!selected) return;
    setMetaBusy(true);
    const r = await adminPatchBundleOrderMeta(selected.id, { labelFnsku: metaFnsku.trim() || undefined });
    setMetaBusy(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(t("admin.bundles.toastMeta"));
    setOrders((prev) => prev.map((o) => (o.id === selected.id ? r.order : o)));
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <LanguageSwitcher />
      </div>
      <PageHeader title={t("admin.bundles.title")} subtitle={t("admin.bundles.subtitle")} />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <label className="text-xs font-bold uppercase tracking-wide text-zinc-500">
          {t("admin.bundles.filter")}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as "" | BundleOrderStatus)}
            className="ml-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800"
          >
            <option value="">{t("admin.bundles.filterAll")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`client.bundleOrders.status.${s}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {loading ? (
            <div className="flex items-center gap-2 text-zinc-500">
              <Loader2 className="size-5 animate-spin" aria-hidden />
              {t("common.loading")}
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
              {t("admin.bundles.empty")}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-100 bg-zinc-50 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">{t("admin.bundles.col.suite")}</th>
                    <th className="px-3 py-2">{t("admin.bundles.col.group")}</th>
                    <th className="px-3 py-2">{t("admin.bundles.col.bundle")}</th>
                    <th className="px-3 py-2">{t("admin.bundles.col.qty")}</th>
                    <th className="px-3 py-2">{t("admin.bundles.col.fee")}</th>
                    <th className="px-3 py-2">{t("admin.bundles.col.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr
                      key={o.id}
                      className={cn(
                        "cursor-pointer border-b border-zinc-100 last:border-0 hover:bg-teal-50/40",
                        selectedId === o.id && "bg-teal-50/60",
                      )}
                      onClick={() => setSelectedId(o.id)}
                    >
                      <td className="px-3 py-2 font-mono text-xs font-semibold text-zinc-900">{o.suite}</td>
                      <td className="max-w-[140px] truncate px-3 py-2 font-mono text-[10px] text-zinc-500" title={o.assemblyGroupId}>
                        {o.assemblyGroupId
                          ? `${o.assemblyGroupId.slice(0, 10)}…${o.groupLineIndex != null ? ` (${o.groupLineIndex + 1}/${o.groupLineCount ?? "?"})` : ""}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-zinc-800">{o.bundleSku ?? o.bundleId}</td>
                      <td className="px-3 py-2 tabular-nums">{o.quantity}</td>
                      <td className="px-3 py-2 tabular-nums text-zinc-600">{formatUsd(o.totalFeeUsd)}</td>
                      <td className="px-3 py-2">
                        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-700">
                          {t(`client.bundleOrders.status.${o.status}`)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {!selected ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 p-6 text-sm text-zinc-500">
              {t("admin.bundles.pickOrder")}
            </div>
          ) : (
            <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{t("admin.bundles.detailId")}</div>
                <div className="font-mono text-xs text-zinc-900">{selected.id}</div>
              </div>

              {selectedBundle?.clientDescription ? (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-950">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-indigo-900">
                    {t("admin.bundles.kitDefinition")}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-indigo-950">{selectedBundle.clientDescription}</p>
                </div>
              ) : null}

              {selected.pickingNotes ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-amber-800">
                    {t("admin.bundles.clientNotes")}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{selected.pickingNotes}</p>
                </div>
              ) : null}

              {selected.batchSize && selected.batchSize >= 1 && selected.quantity > 1 ? (
                <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-600">{t("admin.bundles.batchPlan")}</div>
                  <p className="mt-1 text-xs text-zinc-600">
                    {t("admin.bundles.batchSizeLabel", { n: selected.batchSize })}
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-zinc-800">
                    {batchSegments(selected.quantity, selected.batchSize).map((seg, i) => (
                      <li key={i}>
                        {t("admin.bundles.batchRow", {
                          from: seg.from,
                          to: seg.to,
                          n: seg.to - seg.from + 1,
                        })}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {siblingOrders.length > 1 ? (
                <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-3">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-teal-900">{t("admin.bundles.groupTitle")}</div>
                  <p className="mt-1 font-mono text-[10px] text-teal-800">{selected.assemblyGroupId}</p>
                  <table className="mt-2 w-full text-left text-xs">
                    <thead>
                      <tr className="text-[10px] font-bold uppercase text-teal-800">
                        <th className="py-1 pr-2">{t("admin.bundles.col.bundle")}</th>
                        <th className="py-1 pr-2">{t("admin.bundles.col.qty")}</th>
                        <th className="py-1">{t("admin.bundles.lineNote")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {siblingOrders.map((row) => (
                        <tr key={row.id} className="border-t border-teal-100 text-zinc-800">
                          <td className="py-1 pr-2 font-mono">{row.bundleSku ?? row.bundleId}</td>
                          <td className="py-1 pr-2 tabular-nums">{row.quantity}</td>
                          <td className="py-1 text-zinc-600">{row.lineNotes ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {siblingOrders.length > 1 && consolidated.length > 0 ? (
                <div className="rounded-xl border border-zinc-200 bg-white p-3">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-700">{t("admin.bundles.consolidatedPick")}</div>
                  <ul className="mt-2 space-y-1 text-sm text-zinc-900">
                    {consolidated.map((row) => (
                      <li key={row.sku} className="flex justify-between gap-2 font-mono text-xs">
                        <span>{row.sku}</span>
                        <span className="font-bold tabular-nums">{row.qty}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-600">{t("admin.bundles.warehouseTitle")}</div>
                {selectedBundle ? (
                  <ul className="mt-2 space-y-1 text-sm text-zinc-800">
                    {selectedBundle.items.map((it) => (
                      <li key={it.productSku} className="flex justify-between gap-2">
                        <span className="font-mono text-xs">{it.productSku}</span>
                        <span className="font-semibold tabular-nums">
                          {t("admin.bundles.need", { n: it.qtyPerBundle * selected.quantity })}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-zinc-500">{t("admin.bundles.bundleLoading")}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {nextStatus(selected.status) ? (
                  <button
                    type="button"
                    onClick={() => void patchOrder(selected.id, nextStatus(selected.status)!)}
                    className="rounded-full bg-teal-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-teal-700"
                  >
                    {t(`admin.bundles.action.to.${nextStatus(selected.status)!}`)}
                  </button>
                ) : null}
                {selected.status === "quality_check" ? (
                  <button
                    type="button"
                    onClick={() => void complete(selected.id)}
                    className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-emerald-700"
                  >
                    {t("admin.bundles.action.complete")}
                  </button>
                ) : null}
                {selected.status !== "completed" && selected.status !== "cancelled" ? (
                  <button
                    type="button"
                    onClick={() => void patchOrder(selected.id, "cancelled")}
                    className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-rose-800 hover:bg-rose-100"
                  >
                    {t("admin.bundles.action.cancel")}
                  </button>
                ) : null}
              </div>

              <div className="border-t border-zinc-100 pt-3">
                <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{t("admin.bundles.metaFnsku")}</div>
                <input
                  value={metaFnsku}
                  onChange={(e) => setMetaFnsku(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 font-mono text-sm"
                />
                <button
                  type="button"
                  disabled={metaBusy}
                  onClick={() => void saveMeta()}
                  className="mt-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-zinc-800 hover:bg-zinc-50"
                >
                  {t("admin.bundles.saveMeta")}
                </button>
                <div className="mt-4 text-[11px] font-bold uppercase tracking-wide text-zinc-500">{t("admin.bundles.metaPhoto")}</div>
                {selected.qcPhotoDataUrl ? (
                  <a
                    href={selected.qcPhotoDataUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs font-semibold text-teal-700 underline"
                  >
                    {t("admin.bundles.openPhoto")}
                  </a>
                ) : (
                  <p className="mt-1 text-xs text-zinc-400">{t("admin.bundles.noPhoto")}</p>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="mt-2 block w-full text-xs text-zinc-600 file:mr-2 file:rounded-lg file:border file:border-zinc-200 file:bg-white file:px-2 file:py-1 file:text-xs file:font-semibold"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f || !selected) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      void (async () => {
                        const qcPhotoDataUrl = String(reader.result || "");
                        const r = await adminPatchBundleOrderMeta(selected.id, { qcPhotoDataUrl });
                        if (!r.ok) {
                          toast.error(r.error);
                          return;
                        }
                        toast.success(t("admin.bundles.toastMeta"));
                        setOrders((prev) => prev.map((o) => (o.id === selected.id ? r.order : o)));
                      })();
                    };
                    reader.readAsDataURL(f);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
