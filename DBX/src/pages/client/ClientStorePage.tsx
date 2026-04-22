import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { useClientProfile } from "../../context/ClientProfileContext";
import { useI18n } from "../../i18n/context";
import { saveClientProfile } from "../../lib/clientProfileStorage";
import {
  fetchVipStoreCatalog,
  fetchVipStoreOrders,
  postVipStoreCheckout,
  type VipStoreOrderDto,
  type VipStoreProductDto,
} from "../../lib/vipStoreApi";
import { formatUsd } from "../../lib/prepCenterPricing";
import { PageHeader } from "../../ui/PageHeader";
import type { AppLocale } from "../../i18n/catalog";

type CartLine = { productId: string; qty: number };

function orderStatusLabel(t: (k: string) => string, s: string): string {
  const k = `client.store.orderStatus.${s}` as const;
  const x = t(k);
  return x === k ? s : x;
}

function formatIso(iso: string, locale: AppLocale): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  const tag = locale === "pt-BR" ? "pt-BR" : locale === "es" ? "es" : "en-US";
  return new Intl.DateTimeFormat(tag, { dateStyle: "short", timeStyle: "short" }).format(new Date(ms));
}

export function ClientStorePage() {
  const { t, locale } = useI18n();
  const { profile } = useClientProfile();
  const [feePct, setFeePct] = useState(0.05);
  const [products, setProducts] = useState<VipStoreProductDto[]>([]);
  const [orders, setOrders] = useState<VipStoreOrderDto[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, o] = await Promise.all([fetchVipStoreCatalog(), fetchVipStoreOrders(profile.suite)]);
    setLoading(false);
    if (!c.ok) {
      toast.error(c.error);
      setProducts([]);
    } else {
      setFeePct(c.feePct);
      setProducts(c.products);
    }
    if (!o.ok) {
      toast.error(o.error);
      setOrders([]);
    } else {
      setOrders(o.orders);
    }
  }, [profile.suite]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = (id: string) => {
    const p = products.find((x) => x.id === id);
    if (!p || p.stockQty <= 0) return;
    setCart((prev) => {
      const q = (prev[id] ?? 0) + 1;
      if (q > p.stockQty) return prev;
      return { ...prev, [id]: q };
    });
  };

  const dec = (id: string) => {
    setCart((prev) => {
      const q = (prev[id] ?? 0) - 1;
      if (q <= 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: q };
    });
  };

  const lines = useMemo((): CartLine[] => Object.entries(cart).map(([productId, qty]) => ({ productId, qty })), [cart]);

  const { subtotal, fee, total } = useMemo(() => {
    let s = 0;
    for (const ln of lines) {
      const p = products.find((x) => x.id === ln.productId);
      if (p) s += ln.qty * p.unitPriceUsd;
    }
    s = Math.round(s * 100) / 100;
    const f = Math.round(s * feePct * 100) / 100;
    const tot = Math.round((s + f) * 100) / 100;
    return { subtotal: s, fee: f, total: tot };
  }, [lines, products, feePct]);

  const checkout = async () => {
    if (lines.length === 0) return;
    setBusy(true);
    try {
      const r = await postVipStoreCheckout(profile.suite, lines);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      saveClientProfile({ ...profile, balanceUsd: r.balanceUsd });
      setCart({});
      toast.success(t("client.store.checkoutOk", { id: r.order.id }));
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        eyebrow={t("client.store.eyebrow")}
        title={t("client.store.title")}
        subtitle={t("client.store.subtitle")}
        actions={<LanguageSwitcher />}
      />

      <p className="rounded-ds-card border border-ds-border bg-ds-surface px-4 py-3 text-sm text-ds-muted shadow-ds">
        {t("client.store.feeHint", { pct: String(Math.round(feePct * 1000) / 10) })}
      </p>

      {loading ? (
        <p className="text-sm text-ds-muted">{t("client.store.loading")}</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4 2xl:grid-cols-5">
            {products.length === 0 ? (
              <p className="col-span-full rounded-sm border border-[#e3e3e3] bg-white px-4 py-10 text-center text-sm text-[#565959]">
                {t("client.store.noProducts")}
              </p>
            ) : (
              products.map((p) => {
                const inCart = cart[p.id] ?? 0;
                const soldOut = p.stockQty <= 0;
                return (
                  <article
                    key={p.id}
                    className="flex h-full min-w-0 flex-col rounded-sm border border-[#e3e3e3] bg-white p-2 shadow-sm sm:p-3"
                  >
                    <div className="flex aspect-square items-center justify-center bg-white p-2">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt="" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <span className="text-xs text-[#565959]">—</span>
                      )}
                    </div>
                    <div className="mt-2 flex min-w-0 gap-1.5">
                      <span
                        className="mt-0.5 size-4 shrink-0 rounded-full bg-gradient-to-br from-orange-400 to-sky-600"
                        aria-hidden
                      />
                      <h2 className="line-clamp-4 min-w-0 flex-1 text-left text-sm font-medium leading-snug text-[#0f1111]">
                        {p.title}
                      </h2>
                    </div>
                    {p.shortDescription?.trim() ? (
                      <p className="mt-1 line-clamp-2 min-w-0 break-words text-[11px] leading-snug text-[#565959] [overflow-wrap:anywhere]">
                        {p.shortDescription}
                      </p>
                    ) : null}
                    <p className="mt-2 text-lg tabular-nums text-[#0f1111]">{formatUsd(p.unitPriceUsd)}</p>
                    <p className="text-[11px] text-[#565959]">
                      {soldOut ? t("client.store.soldOut") : t("client.store.stockLine", { n: p.stockQty })}
                    </p>
                    {p.observationsDetail?.trim() ? (
                      <div className="mt-2 min-w-0 rounded border border-[#e3e3e3] bg-[#f7f7f7] px-2 py-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#0f1111]">{t("client.store.observationsTitle")}</p>
                        <p className="mt-0.5 max-w-full whitespace-pre-wrap break-words text-[11px] leading-relaxed text-[#0f1111] [overflow-wrap:anywhere]">
                          {p.observationsDetail}
                        </p>
                      </div>
                    ) : null}
                    {p.designerNotes?.trim() ? (
                      <div className="mt-2 min-w-0 rounded border border-teal-200 bg-teal-50/80 px-2 py-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-teal-900">{t("client.store.designerNotesTitle")}</p>
                        <p className="mt-0.5 max-w-full whitespace-pre-wrap break-words text-[11px] leading-relaxed text-teal-950 [overflow-wrap:anywhere]">
                          {p.designerNotes}
                        </p>
                      </div>
                    ) : null}
                    {p.supplierUrl ? (
                      <a
                        href={p.supplierUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex min-w-0 max-w-full items-center gap-1 text-[11px] font-semibold text-[#2162a1] hover:underline"
                      >
                        {t("client.store.viewSupplier")}
                        <ExternalLink className="size-3 shrink-0" aria-hidden />
                      </a>
                    ) : null}
                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                      <button
                        type="button"
                        disabled={soldOut}
                        onClick={() => add(p.id)}
                        className="rounded-full bg-[#ffd814] px-3 py-1.5 text-[11px] font-semibold text-[#0f1111] shadow-sm hover:bg-[#f7ca00] disabled:opacity-40"
                      >
                        {t("client.store.add")}
                      </button>
                      {inCart > 0 ? (
                        <div className="flex items-center gap-1 rounded-full border border-[#d5d9d9] bg-white px-2 py-1">
                          <button type="button" className="px-1.5 text-sm font-bold text-[#0f1111]" onClick={() => dec(p.id)}>
                            −
                          </button>
                          <span className="min-w-[1.25rem] text-center text-xs font-bold tabular-nums text-[#0f1111]">{inCart}</span>
                          <button
                            type="button"
                            className="px-1.5 text-sm font-bold text-[#0f1111]"
                            disabled={soldOut || inCart >= p.stockQty}
                            onClick={() => add(p.id)}
                          >
                            +
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })
            )}
            </div>
          </div>

          <aside className="h-fit space-y-3 rounded-ds-card border border-ds-border bg-ds-surface p-4 shadow-ds lg:sticky lg:top-24">
            <div className="flex items-center gap-2 text-ds-text">
              <ShoppingBag className="size-5 text-ds-primary" aria-hidden />
              <span className="text-sm font-black uppercase tracking-wide">{t("client.store.cartTitle")}</span>
            </div>
            {lines.length === 0 ? (
              <p className="text-xs text-ds-muted">{t("client.store.cartEmpty")}</p>
            ) : (
              <>
                <ul className="space-y-2 text-sm">
                  {lines.map((ln) => {
                    const p = products.find((x) => x.id === ln.productId);
                    if (!p) return null;
                    return (
                      <li key={ln.productId} className="flex justify-between gap-2 border-b border-ds-border pb-2">
                        <span className="min-w-0 flex-1 truncate font-medium">{p.title}</span>
                        <span className="shrink-0 tabular-nums text-ds-muted">
                          ×{ln.qty} {formatUsd(ln.qty * p.unitPriceUsd)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div className="space-y-1 text-xs tabular-nums text-ds-muted">
                  <div className="flex justify-between">
                    <span>{t("client.store.subtotal")}</span>
                    <span>{formatUsd(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("client.store.platformFee")}</span>
                    <span>{formatUsd(fee)}</span>
                  </div>
                  <div className="flex justify-between border-t border-ds-border pt-2 text-sm font-bold text-ds-text">
                    <span>{t("client.store.total")}</span>
                    <span>{formatUsd(total)}</span>
                  </div>
                  <p className="pt-1 text-[11px]">
                    {t("client.store.balanceLine", { bal: formatUsd(profile.balanceUsd) })}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={busy || total > profile.balanceUsd + 1e-6}
                    onClick={() => void checkout()}
                    className="w-full rounded-ds-btn bg-ds-primary px-3 py-3 text-xs font-black uppercase tracking-wide text-white shadow-ds hover:opacity-95 disabled:opacity-40"
                  >
                    {busy ? t("client.store.checkoutBusy") : t("client.store.checkout")}
                  </button>
                  {total > profile.balanceUsd + 1e-6 ? (
                    <p className="text-center text-xs font-semibold text-rose-700">{t("client.store.insufficient")}</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setCart({})}
                    className="inline-flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wide text-ds-muted hover:text-ds-text"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    {t("client.store.clearCart")}
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      <section className="rounded-ds-card border border-ds-border bg-ds-surface p-4 shadow-ds">
        <h3 className="text-xs font-black uppercase tracking-wide text-ds-muted">{t("client.store.ordersTitle")}</h3>
        {orders.length === 0 ? (
          <p className="mt-3 text-sm text-ds-muted">{t("client.store.ordersEmpty")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-ds-border">
            {orders.map((o) => (
              <li key={o.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-ds-text">{o.id}</span>
                  <span className="rounded-full bg-ds-bg px-2 py-0.5 text-[10px] font-bold uppercase text-ds-muted">
                    {orderStatusLabel(t, o.status)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ds-muted">{formatIso(o.createdAtIso, locale)}</p>
                <p className="mt-1 font-semibold tabular-nums text-ds-text">{formatUsd(o.totalUsd)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
