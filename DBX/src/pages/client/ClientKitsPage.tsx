import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "../../ui/PageHeader";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { useI18n } from "../../i18n/context";
import { useClientProfile } from "../../context/ClientProfileContext";
import { cn } from "../../lib/cn";
import { fetchBundles, postCreateBundle, type BundleItem, type BundleRecord } from "../../lib/bundleApi";
import {
  getMergedInventoryView,
  INVENTORY_UPDATED_EVENT,
  pullInventoryFromServer,
} from "../../lib/clientInventoryStorage";
import { decodeHtmlEntities } from "../../lib/decodeHtmlEntities";
import type { InventoryKind, InventoryRow } from "../../types";

function emptyLine(defaultSku: string): BundleItem {
  return { productSku: defaultSku, qtyPerBundle: 1 };
}

const ASSEMBLABLE_KINDS: InventoryKind[] = ["novo", "retorno"];

function isPickableRow(r: InventoryRow, suite: string): boolean {
  if (r.qty <= 0) return false;
  if (!ASSEMBLABLE_KINDS.includes(r.kind)) return false;
  if (r.asin === "BUNDLE") return false;
  if (r.clientSuite && r.clientSuite !== suite) return false;
  return true;
}

function briefText(s: string, max: number): string {
  const t = s.trim();
  if (!t) return "—";
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export function ClientKitsPage() {
  const { t } = useI18n();
  const { profile } = useClientProfile();
  const [loading, setLoading] = useState(true);
  const [invTick, setInvTick] = useState(0);
  const [bundles, setBundles] = useState<BundleRecord[]>([]);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [bundleSku, setBundleSku] = useState("");
  const [clientDescription, setClientDescription] = useState("");
  const [lines, setLines] = useState<BundleItem[]>([emptyLine("")]);

  const pickable = useMemo(() => {
    void invTick;
    return getMergedInventoryView().filter((r) => isPickableRow(r, profile.suite));
  }, [profile.suite, invTick]);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchBundles(profile.suite);
    setLoading(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setBundles(r.bundles);
  }, [profile.suite]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const bump = () => setInvTick((n) => n + 1);
    window.addEventListener(INVENTORY_UPDATED_EVENT, bump);
    return () => window.removeEventListener(INVENTORY_UPDATED_EVENT, bump);
  }, []);

  useEffect(() => {
    void pullInventoryFromServer();
  }, [profile.suite]);

  const openModal = () => {
    void (async () => {
      await pullInventoryFromServer();
      setInvTick((n) => n + 1);
      const rows = getMergedInventoryView().filter((r) => isPickableRow(r, profile.suite));
      const first = rows[0]?.id ?? "";
      setName("");
      setBundleSku("");
      setClientDescription("");
      setLines([emptyLine(first)]);
      setModal(true);
    })();
  };

  const onSubmit = async () => {
    const items = lines
      .map((l) => {
        const skuRaw = l.productSku.trim().toUpperCase();
        const sku =
          skuRaw && pickable.some((p) => p.id === skuRaw) ? skuRaw : pickable[0]?.id ?? "";
        if (!sku) return null;
        const row = pickable.find((p) => p.id === sku);
        const cap = row ? Math.max(1, Math.floor(row.qty)) : Math.max(1, Math.floor(l.qtyPerBundle));
        const qtyPerBundle = Math.min(Math.max(1, Math.floor(l.qtyPerBundle)), cap);
        return { productSku: sku, qtyPerBundle };
      })
      .filter((l): l is BundleItem => l != null && l.productSku.length > 0);
    if (items.length === 0) {
      toast.error(t("client.bundles.needProduct"));
      return;
    }
    if (clientDescription.trim().length < 8) {
      toast.error(t("client.bundles.descriptionRequired"));
      return;
    }
    setSaving(true);
    const r = await postCreateBundle({
      suite: profile.suite,
      name: name.trim(),
      bundleSku: bundleSku.trim(),
      items,
      clientDescription: clientDescription.trim() || undefined,
    });
    setSaving(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(t("client.bundles.toastCreated"));
    setModal(false);
    setBundles((prev) => [r.bundle, ...prev]);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6 sm:pb-12 sm:pt-8">
      <div className="mb-4 flex flex-wrap items-start justify-end gap-2">
        <LanguageSwitcher />
      </div>
      <PageHeader
        title={t("client.bundles.title")}
        subtitle={t("client.bundles.subtitle")}
        actions={
          <button
            type="button"
            onClick={openModal}
            className="inline-flex items-center gap-2 rounded-ds-btn bg-ds-primary px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-ds hover:opacity-95"
          >
            <Plus className="size-4" aria-hidden />
            {t("client.bundles.create")}
          </button>
        }
      />

      <p className="mb-6 text-sm text-ds-muted">
        <Link to="/app/montagem-kits" className="font-semibold text-ds-primary underline-offset-2 hover:underline">
          {t("client.bundles.linkAssembly")}
        </Link>
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-ds-muted">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          {t("common.loading")}
        </div>
      ) : bundles.length === 0 ? (
        <div className="rounded-ds-card border border-ds-border bg-ds-surface p-8 text-center text-sm text-ds-muted">
          {t("client.bundles.empty")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-ds-card border border-ds-border bg-ds-surface shadow-ds">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ds-border bg-ds-bg text-[11px] font-bold uppercase tracking-wide text-ds-muted">
              <tr>
                <th className="px-4 py-3">{t("client.bundles.col.sku")}</th>
                <th className="px-4 py-3">{t("client.bundles.col.name")}</th>
                <th className="px-4 py-3">{t("client.bundles.col.brief")}</th>
                <th className="px-4 py-3">{t("client.bundles.col.items")}</th>
              </tr>
            </thead>
            <tbody>
              {bundles.map((b) => (
                <tr key={b.id} className="border-b border-ds-border/80 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-ds-text">{b.bundleSku}</td>
                  <td className="px-4 py-3 font-medium text-ds-text">{b.name}</td>
                  <td className="max-w-[220px] px-4 py-3 text-xs text-ds-muted">
                    {briefText(b.clientDescription ?? "", 100)}
                  </td>
                  <td className="px-4 py-3 text-ds-muted">{t("client.bundles.itemsCount", { n: b.items.length })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0 bg-ds-text/50" aria-label={t("common.close")} onClick={() => setModal(false)} />
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-ds-card border border-ds-border bg-ds-surface shadow-ds sm:rounded-ds-card">
            <div className="flex items-center justify-between border-b border-ds-border px-4 py-3">
              <h2 className="text-base font-bold text-ds-text">{t("client.bundles.modalTitle")}</h2>
              <button
                type="button"
                onClick={() => setModal(false)}
                className="rounded-ds-btn p-2 text-ds-muted hover:bg-ds-bg"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <p className="border-b border-ds-border px-4 py-3 text-sm leading-relaxed text-ds-muted">{t("client.bundles.modalIntro")}</p>
            <div className="space-y-4 p-4">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-ds-muted">{t("client.bundles.fieldName")}</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-ds-muted">{t("client.bundles.fieldSku")}</span>
                <input
                  value={bundleSku}
                  onChange={(e) => setBundleSku(e.target.value)}
                  className="mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-2 font-mono text-sm uppercase"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-ds-muted">{t("client.bundles.fieldDescription")}</span>
                <textarea
                  value={clientDescription}
                  onChange={(e) => setClientDescription(e.target.value)}
                  rows={4}
                  placeholder={t("client.bundles.fieldDescriptionPlaceholder")}
                  className="mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-2 text-sm"
                />
              </label>

              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-ds-muted">{t("client.bundles.components")}</div>
                <p className="mt-1 text-xs text-ds-muted">{t("client.bundles.pickProductHint")}</p>
                {pickable.length === 0 ? (
                  <p className="mt-3 rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-2 text-sm text-ds-muted">
                    {t("client.bundles.emptyInventoryHint")}{" "}
                    <Link to="/app/estoque" className="font-semibold text-ds-primary underline">
                      {t("client.bundles.openInventory")}
                    </Link>
                  </p>
                ) : (
                  <div className="mt-2 space-y-3">
                    {lines.map((line, idx) => {
                      const selectedId =
                        line.productSku && pickable.some((p) => p.id === line.productSku)
                          ? line.productSku
                          : pickable[0]!.id;
                      const row = pickable.find((p) => p.id === selectedId);
                      const maxQty = row ? Math.max(1, Math.floor(row.qty)) : undefined;
                      return (
                        <div key={idx} className="rounded-ds-btn border border-ds-border bg-ds-bg p-3">
                          <label className="block">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-ds-muted">
                              {t("client.bundles.pickProduct")}
                            </span>
                            <select
                              value={selectedId}
                              onChange={(e) => {
                                const v = e.target.value;
                                const capRow = pickable.find((p) => p.id === v);
                                const cap = capRow ? Math.max(1, Math.floor(capRow.qty)) : undefined;
                                setLines((prev) =>
                                  prev.map((x, i) =>
                                    i === idx
                                      ? {
                                          ...x,
                                          productSku: v,
                                          qtyPerBundle:
                                            cap != null ? Math.min(Math.max(1, x.qtyPerBundle), cap) : Math.max(1, x.qtyPerBundle),
                                        }
                                      : x,
                                  ),
                                );
                              }}
                              className="mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-surface px-2 py-2.5 text-xs"
                            >
                              {pickable.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.id} — {briefText(decodeHtmlEntities(p.title), 48)} ({p.qty})
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="mt-3 flex flex-wrap items-end gap-3">
                            <label className="min-w-[7rem] flex-1">
                              <span className="text-[10px] font-bold uppercase tracking-wide text-ds-muted">
                                {t("client.bundles.fieldQty")}
                              </span>
                              <input
                                type="number"
                                min={1}
                                max={maxQty}
                                inputMode="numeric"
                                value={line.qtyPerBundle}
                                onChange={(e) => {
                                  const raw = Math.floor(Number(e.target.value) || 1);
                                  const cap = maxQty ?? raw;
                                  const n = Math.min(Math.max(1, raw), cap);
                                  setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, qtyPerBundle: n } : x)));
                                }}
                                className="mt-1 w-full max-w-[8rem] rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2.5 text-sm tabular-nums"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)))}
                              className="ml-auto shrink-0 rounded-ds-btn border border-ds-border px-3 py-2.5 text-xs font-bold text-ds-muted hover:bg-ds-surface"
                            >
                              {t("client.bundles.removeLine")}
                            </button>
                          </div>
                          {row ? (
                            <p className="mt-2 text-[11px] text-ds-muted">
                              SKU <span className="font-mono font-semibold text-ds-text">{row.id}</span> ·{" "}
                              {t("client.bundles.stockAvail", { n: row.qty })}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
                {pickable.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setLines((prev) => [...prev, emptyLine(pickable[0]?.id ?? "")])}
                    className="mt-2 text-sm font-semibold text-ds-primary hover:underline"
                  >
                    {t("client.bundles.addLine")}
                  </button>
                ) : null}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-ds-border p-4">
              <button
                type="button"
                onClick={() => setModal(false)}
                className="rounded-ds-btn border border-ds-border px-4 py-2 text-sm font-semibold text-ds-text hover:bg-ds-bg"
              >
                {t("client.bundles.modalCancel")}
              </button>
              <button
                type="button"
                disabled={saving || pickable.length === 0}
                onClick={() => void onSubmit()}
                className={cn(
                  "inline-flex items-center gap-2 rounded-ds-btn bg-ds-primary px-4 py-2 text-sm font-bold uppercase tracking-wide text-white",
                  (saving || pickable.length === 0) && "opacity-60",
                )}
              >
                {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {t("client.bundles.modalSubmit")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
