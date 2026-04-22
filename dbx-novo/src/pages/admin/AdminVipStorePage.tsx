import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import {
  fetchAdminVipStore,
  patchAdminVipStoreFee,
  patchAdminVipStoreOrder,
  patchAdminVipStoreProduct,
  postAdminVipStorePreviewImport,
  postAdminVipStoreProduct,
  postAdminVipStoreRefund,
  type VipStoreOrderDto,
  type VipStoreProductDto,
} from "../../lib/vipStoreApi";
import { formatUsd } from "../../lib/prepCenterPricing";

const MAX_STORE_IMAGE_BYTES = 900_000;

function readImageDataUrl(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/") || file.size > MAX_STORE_IMAGE_BYTES) return Promise.resolve(null);
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => {
      const u = r.result;
      resolve(typeof u === "string" && u.length <= MAX_STORE_IMAGE_BYTES ? u : null);
    };
    r.onerror = () => resolve(null);
    r.readAsDataURL(file);
  });
}
import { PageHeader } from "../../ui/PageHeader";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { useI18n } from "../../i18n/context";

const ORDER_STATUSES = [
  "pago_aguardando_compra",
  "em_compra",
  "enviado_prep",
  "entregue",
  "cancelado",
] as const;

export function AdminVipStorePage() {
  const { t } = useI18n();
  const [feePct, setFeePct] = useState(0.05);
  const [feeInput, setFeeInput] = useState("5");
  const [products, setProducts] = useState<VipStoreProductDto[]>([]);
  const [orders, setOrders] = useState<VipStoreOrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"products" | "orders">("products");
  const [busy, setBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [newProd, setNewProd] = useState({
    supplierUrl: "",
    title: "",
    shortDescription: "",
    observationsDetail: "",
    designerNotes: "",
    imageDataUrl: "",
    imageName: "",
    unitPriceUsd: "",
    referenceCostUsd: "",
    stockQty: "10",
    category: "Geral",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchAdminVipStore();
    setLoading(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setFeePct(r.platformFeePct);
    setFeeInput(String(Math.round(r.platformFeePct * 1000) / 10));
    setProducts(r.products);
    setOrders(r.orders);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runImportFromSupplier = async () => {
    const url = newProd.supplierUrl.trim();
    if (!url) {
      toast.error(t("admin.store.importFail"));
      return;
    }
    setImportBusy(true);
    try {
      const r = await postAdminVipStorePreviewImport(url);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const d = r.data;
      const title = d.scraped.title?.replace(/\s+/g, " ").trim() ?? "";
      const desc = (d.scraped.description ?? "").replace(/\s+/g, " ").trim();
      const short = desc.length > 280 ? `${desc.slice(0, 277)}…` : desc;
      setNewProd((x) => ({
        ...x,
        title: title || x.title,
        shortDescription: short || x.shortDescription,
        imageDataUrl: d.scraped.imageUrl?.trim() ?? "",
        imageName: d.scraped.imageUrl ? "URL" : "",
        referenceCostUsd: d.referenceCostUsd != null ? String(d.referenceCostUsd) : x.referenceCostUsd,
        unitPriceUsd: d.unitPriceUsdSuggested != null ? String(d.unitPriceUsdSuggested) : x.unitPriceUsd,
      }));
      if (photoInputRef.current) photoInputRef.current.value = "";
      if (d.referenceCostUsd == null) toast.message(t("admin.store.importNoPrice"));
      else toast.success(t("admin.store.importOk"));
    } finally {
      setImportBusy(false);
    }
  };

  const saveFee = async () => {
    const n = Number(feeInput.replace(",", ".")) / 100;
    if (!Number.isFinite(n) || n < 0 || n > 50) {
      toast.error(t("admin.store.feeInvalid"));
      return;
    }
    const r = await patchAdminVipStoreFee(n);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(t("admin.store.feeSaved"));
    await load();
  };

  const addProduct = async () => {
    const price = Number(newProd.unitPriceUsd.replace(",", "."));
    const stock = Number(newProd.stockQty.replace(",", "."));
    const ref = newProd.referenceCostUsd.trim()
      ? Number(newProd.referenceCostUsd.replace(",", "."))
      : undefined;
    if (!newProd.title.trim() || !Number.isFinite(price) || price <= 0 || !Number.isInteger(stock) || stock < 0) {
      toast.error(t("admin.store.productInvalid"));
      return;
    }
    setBusy(true);
    try {
      const r = await postAdminVipStoreProduct({
        title: newProd.title.trim(),
        shortDescription: newProd.shortDescription.trim(),
        observationsDetail: newProd.observationsDetail.trim() || undefined,
        designerNotes: newProd.designerNotes.trim() || undefined,
        supplierUrl: newProd.supplierUrl.trim().startsWith("http") ? newProd.supplierUrl.trim() : undefined,
        imageUrl: newProd.imageDataUrl.trim() || undefined,
        unitPriceUsd: price,
        stockQty: stock,
        referenceCostUsd: ref,
        category: newProd.category.trim() || "Geral",
        active: true,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(t("admin.store.productSaved"));
      setNewProd({
        supplierUrl: "",
        title: "",
        shortDescription: "",
        observationsDetail: "",
        designerNotes: "",
        imageDataUrl: "",
        imageName: "",
        unitPriceUsd: "",
        referenceCostUsd: "",
        stockQty: "10",
        category: "Geral",
      });
      if (photoInputRef.current) photoInputRef.current.value = "";
      await load();
    } finally {
      setBusy(false);
    }
  };

  const patchProduct = async (p: VipStoreProductDto, patch: Record<string, unknown>) => {
    const r = await patchAdminVipStoreProduct(p.id, patch);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    await load();
  };

  const patchOrder = async (o: VipStoreOrderDto, nextStatus: string) => {
    const r = await patchAdminVipStoreOrder(o.id, { status: nextStatus });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    await load();
  };

  const refund = async (id: string) => {
    if (!window.confirm(t("admin.store.refundConfirm"))) return;
    const r = await postAdminVipStoreRefund(id);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(t("admin.store.refundOk"));
    await load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("admin.store.eyebrow")}
        title={t("admin.store.title")}
        subtitle={t("admin.store.subtitle")}
        actions={
          <div className="flex gap-2">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50"
            >
              {t("admin.store.refresh")}
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm">
        <button
          type="button"
          onClick={() => setTab("products")}
          className={`rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wide ${
            tab === "products" ? "bg-teal-600 text-white" : "text-zinc-600 hover:bg-zinc-50"
          }`}
        >
          {t("admin.store.tabProducts")}
        </button>
        <button
          type="button"
          onClick={() => setTab("orders")}
          className={`rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wide ${
            tab === "orders" ? "bg-teal-600 text-white" : "text-zinc-600 hover:bg-zinc-50"
          }`}
        >
          {t("admin.store.tabOrders")}
        </button>
      </div>

      <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-zinc-900">{t("admin.store.feeTitle")}</p>
        <p className="mt-1 text-xs text-zinc-600">{t("admin.store.feeHint")}</p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold text-zinc-600">
            {t("admin.store.feePctLabel")}
            <input
              className="mt-1 w-28 rounded-xl border border-zinc-200 px-3 py-2 text-sm tabular-nums"
              value={feeInput}
              onChange={(e) => setFeeInput(e.target.value)}
              inputMode="decimal"
            />
            <span className="ml-1 text-zinc-500">%</span>
          </label>
          <button
            type="button"
            onClick={() => void saveFee()}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800"
          >
            {t("admin.store.feeSave")}
          </button>
          <span className="text-xs text-zinc-500">
            {t("admin.store.feeCurrent", { pct: String(Math.round(feePct * 1000) / 10) })}
          </span>
        </div>
      </div>

      {tab === "products" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-zinc-900">{t("admin.store.newProduct")}</h2>
            <p className="mt-2 text-xs leading-relaxed text-zinc-600">{t("admin.store.markupHint")}</p>
            <div className="mt-3 grid gap-3">
              <label className="text-xs font-semibold text-zinc-600">
                {t("admin.store.fieldSupplierUrl")}
                <input
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                  placeholder="https://www.walmart.com/ip/…"
                  value={newProd.supplierUrl}
                  onChange={(e) => setNewProd((x) => ({ ...x, supplierUrl: e.target.value }))}
                />
              </label>
              <button
                type="button"
                disabled={importBusy || busy}
                onClick={() => void runImportFromSupplier()}
                className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-xs font-bold text-teal-900 hover:bg-teal-100 disabled:opacity-50"
              >
                {importBusy ? t("admin.store.importBusy") : t("admin.store.importFetch")}
              </button>
              <label className="text-xs font-semibold text-zinc-600">
                {t("admin.store.fieldTitle")}
                <input
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                  value={newProd.title}
                  onChange={(e) => setNewProd((x) => ({ ...x, title: e.target.value }))}
                />
              </label>
              <label className="text-xs font-semibold text-zinc-600">
                {t("admin.store.fieldDesc")}
                <input
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                  value={newProd.shortDescription}
                  onChange={(e) => setNewProd((x) => ({ ...x, shortDescription: e.target.value }))}
                />
              </label>
              <label className="text-xs font-semibold text-zinc-600">
                {t("admin.store.fieldCategory")}
                <input
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                  value={newProd.category}
                  onChange={(e) => setNewProd((x) => ({ ...x, category: e.target.value }))}
                />
              </label>
              <label className="text-xs font-semibold text-zinc-600">
                {t("admin.store.fieldObservations")}
                <textarea
                  className="mt-1 min-h-[88px] w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                  value={newProd.observationsDetail}
                  onChange={(e) => setNewProd((x) => ({ ...x, observationsDetail: e.target.value }))}
                />
              </label>
              <label className="text-xs font-semibold text-zinc-600">
                {t("admin.store.fieldDesignerNotes")}
                <textarea
                  className="mt-1 min-h-[72px] w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                  value={newProd.designerNotes}
                  onChange={(e) => setNewProd((x) => ({ ...x, designerNotes: e.target.value }))}
                />
              </label>
              <div>
                <p className="text-xs font-semibold text-zinc-600">{t("admin.store.fieldPhoto")}</p>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e: ChangeEvent<HTMLInputElement>) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const u = await readImageDataUrl(f);
                    if (!u) {
                      toast.error(t("admin.store.photoTooBig"));
                      return;
                    }
                    setNewProd((x) => ({ ...x, imageDataUrl: u, imageName: f.name }));
                  }}
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-100"
                  >
                    {t("admin.store.fieldPhoto")}
                  </button>
                  {newProd.imageName ? (
                    <span className="text-xs text-zinc-600">
                      {newProd.imageName}{" "}
                      <button
                        type="button"
                        className="font-semibold text-teal-700 hover:underline"
                        onClick={() => {
                          setNewProd((x) => ({ ...x, imageDataUrl: "", imageName: "" }));
                          if (photoInputRef.current) photoInputRef.current.value = "";
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ) : null}
                </div>
                {newProd.imageDataUrl ? (
                  <img src={newProd.imageDataUrl} alt="" className="mt-2 max-h-40 rounded-lg border border-zinc-200 object-contain" />
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-xs font-semibold text-zinc-600">
                  {t("admin.store.fieldPrice")}
                  <input
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm tabular-nums"
                    value={newProd.unitPriceUsd}
                    onChange={(e) => setNewProd((x) => ({ ...x, unitPriceUsd: e.target.value }))}
                    inputMode="decimal"
                  />
                </label>
                <label className="text-xs font-semibold text-zinc-600">
                  {t("admin.store.fieldCostRef")}
                  <input
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm tabular-nums"
                    value={newProd.referenceCostUsd}
                    onChange={(e) => setNewProd((x) => ({ ...x, referenceCostUsd: e.target.value }))}
                    inputMode="decimal"
                  />
                </label>
                <label className="text-xs font-semibold text-zinc-600">
                  {t("admin.store.fieldStock")}
                  <input
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm tabular-nums"
                    value={newProd.stockQty}
                    onChange={(e) => setNewProd((x) => ({ ...x, stockQty: e.target.value }))}
                    inputMode="numeric"
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void addProduct()}
                className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {t("admin.store.addProduct")}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-zinc-900">{t("admin.store.catalogTitle")}</h2>
            {loading ? (
              <p className="mt-4 text-sm text-zinc-600">…</p>
            ) : (
              <ul className="mt-4 max-h-[480px] space-y-3 overflow-y-auto">
                {products.map((p) => (
                  <li key={p.id} className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 gap-3">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt="" className="size-14 shrink-0 rounded-lg border border-zinc-200 object-cover" />
                        ) : null}
                        <div className="min-w-0">
                        <p className="font-semibold text-zinc-900">{p.title}</p>
                        <p className="text-xs text-zinc-600">
                          {p.id} · {formatUsd(p.unitPriceUsd)} · stock {p.stockQty}
                          {typeof p.referenceCostUsd === "number" ? ` · ref ${formatUsd(p.referenceCostUsd)}` : ""}
                        </p>
                        {p.observationsDetail ? (
                          <p className="mt-1 line-clamp-2 text-[11px] text-zinc-500">{p.observationsDetail}</p>
                        ) : null}
                        {p.designerNotes ? (
                          <p className="mt-1 line-clamp-2 text-[11px] text-teal-700">{p.designerNotes}</p>
                        ) : null}
                        {p.supplierUrl ? (
                          <a
                            href={p.supplierUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block text-[11px] font-semibold text-teal-700 hover:underline"
                          >
                            {t("admin.store.supplierLinkOpen")}
                          </a>
                        ) : null}
                        </div>
                      </div>
                      <label className="flex items-center gap-1 text-xs font-semibold text-zinc-700">
                        <input
                          type="checkbox"
                          checked={p.active}
                          onChange={() => void patchProduct(p, { active: !p.active })}
                        />
                        {t("admin.store.active")}
                      </label>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const s = window.prompt(t("admin.store.promptStock"), String(p.stockQty));
                          if (s == null) return;
                          const n = Number(s.replace(",", "."));
                          if (!Number.isInteger(n) || n < 0) return;
                          void patchProduct(p, { stockQty: n });
                        }}
                        className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-semibold"
                      >
                        {t("admin.store.adjustStock")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-zinc-200/80 bg-white shadow-sm">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm text-zinc-800">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">{t("admin.store.colOrder")}</th>
                <th className="px-4 py-3">{t("admin.store.colSuite")}</th>
                <th className="px-4 py-3">{t("admin.store.colTotal")}</th>
                <th className="px-4 py-3">{t("admin.store.colStatus")}</th>
                <th className="px-4 py-3">{t("admin.store.colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3 font-mono text-xs">{o.id}</td>
                  <td className="px-4 py-3 font-semibold">{o.suite}</td>
                  <td className="px-4 py-3 tabular-nums">{formatUsd(o.totalUsd)}</td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs"
                      value={o.status}
                      disabled={o.status === "cancelado"}
                      onChange={(e) => void patchOrder(o, e.target.value)}
                    >
                      {ORDER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {t(`client.store.orderStatus.${s}`)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {o.status !== "cancelado" ? (
                      <button
                        type="button"
                        onClick={() => void refund(o.id)}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-900"
                      >
                        {t("admin.store.refund")}
                      </button>
                    ) : (
                      "—"
                    )}
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
