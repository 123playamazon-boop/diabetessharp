import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "../../ui/PageHeader";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { useI18n } from "../../i18n/context";
import { useClientProfile } from "../../context/ClientProfileContext";
import { cn } from "../../lib/cn";
import {
  fetchBundles,
  fetchBundleOrders,
  postCreateBundleOrder,
  type BundleOrder,
  type BundleOrderLinePayload,
  type BundleOrderStatus,
  type BundleRecord,
} from "../../lib/bundleApi";
import { pullClientProfileFromServer } from "../../lib/clientProfileStorage";
import { INVENTORY_UPDATED_EVENT, pullInventoryFromServer } from "../../lib/clientInventoryStorage";
import { formatUsd } from "../../lib/prepCenterPricing";

type LineDraft = { bundleId: string; quantity: string; lineNotes: string };

function emptyLine(defaultBundleId: string): LineDraft {
  return { bundleId: defaultBundleId, quantity: "1", lineNotes: "" };
}

function statusLabel(t: (k: string) => string, s: BundleOrderStatus): string {
  return t(`client.bundleOrders.status.${s}`);
}

export function ClientKitAssemblyPage() {
  const { t } = useI18n();
  const { profile } = useClientProfile();
  const [loading, setLoading] = useState(true);
  const [bundles, setBundles] = useState<BundleRecord[]>([]);
  const [orders, setOrders] = useState<BundleOrder[]>([]);
  const [lines, setLines] = useState<LineDraft[]>([emptyLine("")]);
  const [pickingNotes, setPickingNotes] = useState("");
  const [batchSize, setBatchSize] = useState("");
  const [fnsku, setFnsku] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [rb, ro] = await Promise.all([fetchBundles(profile.suite), fetchBundleOrders(profile.suite)]);
    setLoading(false);
    if (!rb.ok) {
      toast.error(rb.error);
      return;
    }
    if (!ro.ok) {
      toast.error(ro.error);
      return;
    }
    setBundles(rb.bundles);
    setOrders(ro.orders);
    const firstId = rb.bundles[0]?.id ?? "";
    setLines((prev) => {
      if (prev.length === 1 && !prev[0]!.bundleId && firstId) {
        return [emptyLine(firstId)];
      }
      return prev.map((row) => (row.bundleId && rb.bundles.some((b) => b.id === row.bundleId) ? row : { ...row, bundleId: firstId }));
    });
  }, [profile.suite]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const bump = () => void load();
    window.addEventListener(INVENTORY_UPDATED_EVENT, bump);
    return () => window.removeEventListener(INVENTORY_UPDATED_EVENT, bump);
  }, [load]);

  const defaultBundleId = bundles[0]?.id ?? "";

  const onAddLine = () => {
    setLines((prev) => [...prev, emptyLine(defaultBundleId)]);
  };

  const onRemoveLine = (idx: number) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const buildPayloadLines = (): BundleOrderLinePayload[] | null => {
    const out: BundleOrderLinePayload[] = [];
    for (const row of lines) {
      const bundleId = row.bundleId.trim();
      const q = Math.max(1, Math.floor(Number(row.quantity) || 1));
      if (!bundleId) return null;
      const ln = row.lineNotes.trim();
      out.push({ bundleId, quantity: q, lineNotes: ln || undefined });
    }
    return out.length ? out : null;
  };

  const onCreate = async () => {
    const payloadLines = buildPayloadLines();
    if (!payloadLines) {
      toast.error(t("client.bundleOrders.pickBundle"));
      return;
    }
    setSubmitting(true);
    const batchNum = batchSize.trim() ? Math.floor(Number(batchSize)) : undefined;
    const one = payloadLines[0]!;
    const r = await postCreateBundleOrder({
      suite: profile.suite,
      lines: payloadLines.length > 1 ? payloadLines : undefined,
      bundleId: payloadLines.length === 1 ? one.bundleId : undefined,
      quantity: payloadLines.length === 1 ? one.quantity : undefined,
      lineNotes: payloadLines.length === 1 ? one.lineNotes : undefined,
      pickingNotes: pickingNotes.trim() || undefined,
      batchSize: batchNum != null && Number.isFinite(batchNum) && batchNum >= 1 ? batchNum : undefined,
      labelFnsku: fnsku.trim() || undefined,
    });
    setSubmitting(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    if ("orders" in r && r.orders.length > 0) {
      toast.success(t("client.bundleOrders.toastCreatedGroup", { n: r.orders.length }));
      setOrders((prev) => [...r.orders, ...prev]);
    } else if ("order" in r) {
      toast.success(t("client.bundleOrders.toastCreated"));
      setOrders((prev) => [r.order, ...prev]);
    }
    void pullClientProfileFromServer();
    void pullInventoryFromServer();
    setFnsku("");
    setPickingNotes("");
    setBatchSize("");
    setLines([emptyLine(defaultBundleId)]);
  };

  const groupLabel = useCallback((o: BundleOrder) => {
    if (o.assemblyGroupId && o.groupLineIndex != null && o.groupLineCount != null) {
      return `${o.assemblyGroupId.slice(0, 12)}… (${o.groupLineIndex + 1}/${o.groupLineCount})`;
    }
    return "—";
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6 sm:pb-12 sm:pt-8">
      <div className="mb-4 flex flex-wrap items-start justify-end gap-2">
        <LanguageSwitcher />
      </div>
      <PageHeader title={t("client.bundleOrders.title")} subtitle={t("client.bundleOrders.subtitle")} />

      <p className="mb-6 text-sm text-ds-muted">
        <Link to="/app/kits" className="font-semibold text-ds-primary underline-offset-2 hover:underline">
          {t("client.bundleOrders.linkKits")}
        </Link>
      </p>

      <section className="mb-10 rounded-ds-card border border-ds-border bg-ds-surface p-4 shadow-ds sm:p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ds-muted">{t("client.bundleOrders.createTitle")}</h2>
        {bundles.length === 0 ? (
          <p className="mt-3 text-sm text-ds-muted">{t("client.bundleOrders.noKits")}</p>
        ) : (
          <div className="mt-4 space-y-6">
            <p className="text-sm leading-relaxed text-ds-muted">{t("client.bundleOrders.multiHint")}</p>

            <div className="space-y-4">
              {lines.map((row, idx) => {
                const sel = bundles.find((b) => b.id === row.bundleId);
                return (
                  <div
                    key={idx}
                    className="rounded-ds-btn border border-ds-border bg-ds-bg p-4"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">
                        {t("client.bundleOrders.lineTitle", { n: idx + 1 })}
                      </span>
                      {lines.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => onRemoveLine(idx)}
                          className="inline-flex items-center gap-1 rounded-ds-btn border border-ds-border px-2 py-1 text-[11px] font-bold uppercase text-ds-muted hover:bg-ds-surface"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                          {t("client.bundleOrders.removeKitLine")}
                        </button>
                      ) : null}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block sm:col-span-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-ds-muted">{t("client.bundleOrders.bundle")}</span>
                        <select
                          value={row.bundleId}
                          onChange={(e) => {
                            const v = e.target.value;
                            setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, bundleId: v } : x)));
                          }}
                          className="mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 text-sm"
                        >
                          {bundles.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.bundleSku} — {b.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      {sel ? (
                        <div className="sm:col-span-2 rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 text-xs text-ds-muted">
                          <div className="font-semibold text-ds-text">{t("client.bundleOrders.components")}</div>
                          <ul className="mt-1 list-inside list-disc">
                            {sel.items.map((it) => (
                              <li key={it.productSku}>
                                {it.productSku} × {it.qtyPerBundle}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      <label className="block">
                        <span className="text-xs font-bold uppercase tracking-wide text-ds-muted">{t("client.bundleOrders.qty")}</span>
                        <input
                          type="number"
                          min={1}
                          value={row.quantity}
                          onChange={(e) => {
                            const v = e.target.value;
                            setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: v } : x)));
                          }}
                          className="mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-ds-muted">{t("client.bundleOrders.lineNotes")}</span>
                        <input
                          value={row.lineNotes}
                          onChange={(e) => {
                            const v = e.target.value;
                            setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, lineNotes: v } : x)));
                          }}
                          placeholder={t("client.bundleOrders.lineNotesPlaceholder")}
                          className="mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 text-sm"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onAddLine}
              className="inline-flex items-center gap-2 text-sm font-semibold text-ds-primary hover:underline"
            >
              <Plus className="size-4" aria-hidden />
              {t("client.bundleOrders.addKitLine")}
            </button>

            <div className="grid gap-4 border-t border-ds-border pt-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-xs font-bold uppercase tracking-wide text-ds-muted">{t("client.bundleOrders.pickingNotes")}</span>
                <textarea
                  value={pickingNotes}
                  onChange={(e) => setPickingNotes(e.target.value)}
                  rows={3}
                  placeholder={t("client.bundleOrders.pickingNotesPlaceholder")}
                  className="mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-ds-muted">{t("client.bundleOrders.batchSize")}</span>
                <input
                  type="number"
                  min={1}
                  value={batchSize}
                  onChange={(e) => setBatchSize(e.target.value)}
                  placeholder="10"
                  className="mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-ds-muted">{t("client.bundleOrders.batchHint")}</p>
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-ds-muted">{t("client.bundleOrders.fnsku")}</span>
                <input
                  value={fnsku}
                  onChange={(e) => setFnsku(e.target.value)}
                  placeholder="FNSKU…"
                  className="mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 font-mono text-sm"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void onCreate()}
                className={cn(
                  "inline-flex items-center gap-2 rounded-ds-btn bg-ds-primary px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-white",
                  submitting && "opacity-60",
                )}
              >
                {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {t("client.bundleOrders.submit")}
              </button>
            </div>
          </div>
        )}
      </section>

      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ds-muted">{t("client.bundleOrders.listTitle")}</h2>
      {loading ? (
        <div className="flex items-center gap-2 text-ds-muted">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          {t("common.loading")}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-ds-card border border-ds-border bg-ds-surface p-8 text-center text-sm text-ds-muted">
          {t("client.bundleOrders.empty")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-ds-card border border-ds-border bg-ds-surface shadow-ds">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ds-border bg-ds-bg text-[11px] font-bold uppercase tracking-wide text-ds-muted">
              <tr>
                <th className="px-4 py-3">{t("client.bundleOrders.col.id")}</th>
                <th className="px-4 py-3">{t("client.bundleOrders.col.group")}</th>
                <th className="px-4 py-3">{t("client.bundleOrders.col.bundle")}</th>
                <th className="px-4 py-3">{t("client.bundleOrders.col.qty")}</th>
                <th className="px-4 py-3">{t("client.bundleOrders.col.fee")}</th>
                <th className="px-4 py-3">{t("client.bundleOrders.col.status")}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-ds-border/80 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-ds-text">{o.id}</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-ds-muted">{groupLabel(o)}</td>
                  <td className="px-4 py-3 text-ds-text">{o.bundleSku ?? o.bundleId}</td>
                  <td className="px-4 py-3 tabular-nums">{o.quantity}</td>
                  <td className="px-4 py-3 tabular-nums text-ds-muted">{formatUsd(o.totalFeeUsd)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full border border-ds-border bg-ds-bg px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ds-text">
                      {statusLabel(t, o.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
