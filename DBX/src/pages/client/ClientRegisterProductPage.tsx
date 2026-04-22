import { useCallback, useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, Circle, ImagePlus, Link2, Loader2, PencilLine, Search } from "lucide-react";
import { toast } from "sonner";
import type { InventoryRow } from "../../types";
import { useClientProfile } from "../../context/ClientProfileContext";
import { amazonComDpUrl, extractAmazonAsin } from "../../lib/amazonAsin";
import { appendInventoryRow } from "../../lib/clientInventoryStorage";
import { decodeHtmlEntities } from "../../lib/decodeHtmlEntities";
import { ymdInLocalTimezone } from "../../lib/storageFreeTier";
import { fetchSupplierScrape } from "../../api/scrapeSupplier";
import { cn } from "../../lib/cn";
import {
  hasMeaningfulDraftContent,
  parseRegisterProductDraft,
  notifyRegisterProductDraftUpdated,
  registerProductDraftKey,
  type RegisterProductDraftV1,
} from "../../lib/registerProductDraft";
import {
  clampMarginPct,
  computeSuggestedUnitSalePrice,
  DEFAULT_PREP_SERVICE_ID,
  formatUsd,
  MARGIN_PCT_MAX,
  MARGIN_PCT_MIN,
  type PrepCenterPlan,
  PREP_CENTER_PRICING_EXTRA,
  PREP_CENTER_PRICING_MAIN,
  prepFeeUsd,
} from "../../lib/prepCenterPricing";

type EntryMode = "manual" | "link";

const CONDITIONS = [
  { value: "new", label: "Novo" },
  { value: "used", label: "Usado" },
  { value: "damaged", label: "Danificado" },
] as const;

const inputClass =
  "w-full rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2.5 text-sm text-ds-text shadow-ds placeholder:text-ds-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ds-primary";

export function ClientRegisterProductPage() {
  const { profile } = useClientProfile();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formId = useId();

  const [mode, setMode] = useState<EntryMode>("manual");
  const [asin, setAsin] = useState("");
  const [supplierUrl, setSupplierUrl] = useState("");
  const [productName, setProductName] = useState("");
  const [supplier, setSupplier] = useState("");
  const [condition, setCondition] = useState<string>("new");
  const [quantity, setQuantity] = useState("1");
  const [poNumber, setPoNumber] = useState("");
  const [arrivalDate, setArrivalDate] = useState(() => ymdInLocalTimezone());
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [upc, setUpc] = useState("");
  const [tracking, setTracking] = useState("");
  const [notes, setNotes] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [asinLookupBusy, setAsinLookupBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prepPlan, setPrepPlan] = useState<PrepCenterPlan>("basic");
  const [prepServiceId, setPrepServiceId] = useState(DEFAULT_PREP_SERVICE_ID);
  const [productCost, setProductCost] = useState("");
  const [platformPct, setPlatformPct] = useState("15");
  const [labelUsd, setLabelUsd] = useState("8");
  const [marginPct, setMarginPct] = useState("25");
  const [previewQty, setPreviewQty] = useState("10");
  const [premiumSubTab, setPremiumSubTab] = useState<"rates" | "subscribe">("rates");

  const parseMoneyInput = (s: string) => {
    const n = Number(String(s).trim().replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  };

  const priceBreakdown = useMemo(() => {
    const cost = parseMoneyInput(productCost);
    const pct = parseMoneyInput(platformPct);
    const label = parseMoneyInput(labelUsd);
    const marginRaw = parseMoneyInput(marginPct);
    const margin = clampMarginPct(Number.isFinite(marginRaw) ? marginRaw : 25);
    const prep = prepFeeUsd(prepPlan, prepServiceId);
    const qRaw = parseMoneyInput(previewQty);
    const previewQtyNorm =
      Number.isFinite(qRaw) && qRaw >= 1 ? Math.min(99_999, Math.floor(qRaw)) : 10;

    if (!Number.isFinite(cost) || cost < 0 || productCost.trim() === "") {
      return { ready: false as const, prep, margin, previewQty: previewQtyNorm };
    }
    const p = Number.isFinite(pct) && pct >= 0 ? pct : 0;
    const l = Number.isFinite(label) && label >= 0 ? label : 0;

    const calc = computeSuggestedUnitSalePrice({
      productCostUsd: cost,
      prepFeeUsd: prep,
      labelFeeUsd: l,
      platformFeePct: p,
      marginPct: margin,
    });

    if (!calc.ok) {
      return {
        ready: "error" as const,
        reason: calc.reason,
        cost,
        platformPct: p,
        prep,
        label: l,
        marginPct: margin,
        previewQty: previewQtyNorm,
      };
    }

    const projectedProfit = Math.round(calc.profitPerUnit * previewQtyNorm * 100) / 100;
    return {
      ready: true as const,
      cost,
      platformPct: p,
      prep,
      label: l,
      marginPct: margin,
      previewQty: previewQtyNorm,
      projectedProfit,
      ...calc,
    };
  }, [productCost, platformPct, labelUsd, marginPct, previewQty, prepPlan, prepServiceId]);

  const preSaveChecklist = useMemo(() => {
    const q = Number(quantity);
    const qtyOk = Number.isFinite(q) && q >= 1;
    const costStr = productCost.trim();
    const costVal = parseMoneyInput(productCost);
    const hasCost = costStr !== "" && Number.isFinite(costVal) && costVal >= 0;
    let pricingVisual: "ok" | "optional" | "error" = "optional";
    if (hasCost) {
      if (priceBreakdown.ready === true) pricingVisual = "ok";
      else if (priceBreakdown.ready === "error") pricingVisual = "error";
    }
    const basicsComplete = !!photoPreview && !!productName.trim() && !!supplier.trim() && qtyOk;
    const pricingBlocksSave = hasCost && priceBreakdown.ready === "error";
    const requiredComplete = basicsComplete && !pricingBlocksSave;
    return {
      rows: [
        { anchor: `${formId}-photo-h`, ok: !!photoPreview, label: "Foto do produto" },
        { anchor: `${formId}-name`, ok: !!productName.trim(), label: "Nome do produto" },
        { anchor: `${formId}-sup`, ok: !!supplier.trim(), label: "Fornecedor" },
        { anchor: `${formId}-qty`, ok: qtyOk, label: "Quantidade (mín. 1)" },
        {
          anchor: `${formId}-pricing-h`,
          ok: pricingVisual === "ok",
          label: "Custo USD e simulação de preço",
          optional: true,
          warn: pricingVisual === "error",
        },
      ],
      requiredComplete,
    };
  }, [formId, photoPreview, productName, supplier, quantity, productCost, priceBreakdown]);

  const scrollToAnchor = useCallback((anchorId: string) => {
    document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    const key = registerProductDraftKey(profile.suite);
    const d = parseRegisterProductDraft(localStorage.getItem(key));
    if (!d || !hasMeaningfulDraftContent(d)) return;
    setMode(d.mode === "link" ? "link" : "manual");
    setAsin(d.asin ?? "");
    setSupplierUrl(d.supplierUrl ?? "");
    setProductName(d.productName ?? "");
    setSupplier(d.supplier ?? "");
    setCondition(d.condition && ["new", "used", "damaged"].includes(d.condition) ? d.condition : "new");
    setQuantity(d.quantity ?? "1");
    setPoNumber(d.poNumber ?? "");
    setArrivalDate(d.arrivalDate?.trim() ? d.arrivalDate : ymdInLocalTimezone());
    setColor(d.color ?? "");
    setSize(d.size ?? "");
    setBrand(d.brand ?? "");
    setModel(d.model ?? "");
    setUpc(d.upc ?? "");
    setTracking(d.tracking ?? "");
    setNotes(d.notes ?? "");
    setPrepPlan(d.prepPlan === "premium" ? "premium" : "basic");
    setPrepServiceId(d.prepServiceId || DEFAULT_PREP_SERVICE_ID);
    setPremiumSubTab(d.premiumSubTab === "subscribe" ? "subscribe" : "rates");
    setProductCost(d.productCost ?? "");
    setPlatformPct(d.platformPct ?? "15");
    setLabelUsd(d.labelUsd ?? "8");
    setMarginPct(d.marginPct ?? "25");
    setPreviewQty(d.previewQty ?? "10");
    if (d.photoPreviewUrl?.startsWith("http")) {
      setPhotoPreview(d.photoPreviewUrl);
      setPhotoFile(null);
    }
  }, [profile.suite]);

  useEffect(() => {
    const key = registerProductDraftKey(profile.suite);
    const payload: RegisterProductDraftV1 = {
      v: 1,
      mode,
      asin,
      supplierUrl,
      productName,
      supplier,
      condition,
      quantity,
      poNumber,
      arrivalDate,
      color,
      size,
      brand,
      model,
      upc,
      tracking,
      notes,
      photoPreviewUrl: photoPreview?.startsWith("http") ? photoPreview : "",
      prepPlan,
      prepServiceId,
      premiumSubTab,
      productCost,
      platformPct,
      labelUsd,
      marginPct,
      previewQty,
    };
    const t = window.setTimeout(() => {
      if (!hasMeaningfulDraftContent(payload)) return;
      try {
        localStorage.setItem(key, JSON.stringify(payload));
        notifyRegisterProductDraftUpdated();
      } catch {
        /* quota */
      }
    }, 650);
    return () => window.clearTimeout(t);
  }, [
    profile.suite,
    mode,
    asin,
    supplierUrl,
    productName,
    supplier,
    condition,
    quantity,
    poNumber,
    arrivalDate,
    color,
    size,
    brand,
    model,
    upc,
    tracking,
    notes,
    photoPreview,
    prepPlan,
    prepServiceId,
    premiumSubTab,
    productCost,
    platformPct,
    labelUsd,
    marginPct,
    previewQty,
  ]);

  const onPickPhoto = (file: File | null) => {
    setPhotoFile(file);
    if (photoPreview && photoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreview);
    }
    if (!file) {
      setPhotoPreview(null);
      return;
    }
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onPickPhoto(f);
  };

  const lookupAsin = async () => {
    const extracted = extractAmazonAsin(asin);
    if (!extracted) {
      toast.error("ASIN inválido.", {
        description: "Use 10 caracteres alfanuméricos ou um link de produto com /dp/ ou /gp/product/.",
      });
      return;
    }
    setAsin(extracted);
    setAsinLookupBusy(true);
    try {
      const url = amazonComDpUrl(extracted);
      const data = await fetchSupplierScrape(url);
      if ("error" in data) {
        toast.error(data.error, {
          description:
            "O site pode bloquear leitura automática; preencha nome e foto à mão ou cole o link completo em «Link do fornecedor».",
        });
        return;
      }
      setProductName(decodeHtmlEntities(data.title?.trim() || `Produto — ${data.supplier}`));
      setSupplier(data.supplier?.trim() || "Loja online");
      if (data.brand?.trim()) setBrand(decodeHtmlEntities(data.brand.trim()));
      if (data.model?.trim()) setModel(data.model.trim());
      if (data.description?.trim() && !notes.trim()) {
        setNotes(data.description.trim().slice(0, 2000));
      }
      if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
      setPhotoFile(null);
      if (data.imageUrl) setPhotoPreview(data.imageUrl);
      toast.success("Dados obtidos pelo ASIN.", { description: "Confira título e imagem antes de salvar." });
    } catch {
      toast.error("Não foi possível contactar a API de scrape.", {
        description: "Confirme «npm run dev» ou que o Express está na porta 8787.",
      });
    } finally {
      setAsinLookupBusy(false);
    }
  };

  const importFromLink = async () => {
    if (!supplierUrl.trim()) {
      toast.error("Cole o link do produto no fornecedor.");
      return;
    }
    setImporting(true);
    try {
      const data = await fetchSupplierScrape(supplierUrl.trim());
      if ("error" in data) {
        toast.error(data.error);
        return;
      }
      setProductName(decodeHtmlEntities(data.title?.trim() || `Produto — ${data.supplier}`));
      setSupplier(data.supplier);
      if (data.brand?.trim()) setBrand(decodeHtmlEntities(data.brand.trim()));
      if (data.model?.trim()) setModel(data.model.trim());
      if (data.description?.trim() && !notes.trim()) {
        setNotes(data.description.trim());
      }
      if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
      setPhotoFile(null);
      setPhotoPreview(data.imageUrl);
      toast.success("Dados importados da página do fornecedor.", {
        description: "Confira título e imagem. Alguns sites bloqueiam acesso automático.",
      });
      setMode("manual");
    } catch {
      toast.error("Não foi possível importar.", {
        description:
          "Confirme que a API está a correr («npm run dev» inicia o Express na porta 8787, ou «docker compose up scrape-api»).",
      });
    } finally {
      setImporting(false);
    }
  };

  const fileToDataUrl = (file: File): Promise<string | undefined> =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const r = reader.result as string;
        resolve(r.length > 450_000 ? undefined : r);
      };
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(file);
    });

  const validate = useCallback(() => {
    const errs: string[] = [];
    if (!productName.trim()) errs.push("Nome do produto é obrigatório.");
    if (!supplier.trim()) errs.push("Fornecedor é obrigatório.");
    const q = Number(quantity);
    if (!Number.isFinite(q) || q < 1) errs.push("Quantidade deve ser pelo menos 1.");
    if (!photoPreview) errs.push("Envie uma foto do produto (ou importe pelo link do fornecedor).");
    return errs;
  }, [productName, supplier, quantity, photoPreview]);

  const save = async () => {
    const errs = validate();
    if (errs.length) {
      toast.error(errs[0], { description: errs.slice(1).join(" ") || undefined });
      return;
    }
    setSaving(true);
    const q = Number(quantity);
    let imageUrl: string | undefined;
    if (photoFile) {
      imageUrl = await fileToDataUrl(photoFile);
      if (!imageUrl) toast.message("Foto muito grande para o armazenamento local de demo.", { description: "O cadastro foi salvo sem imagem; na API real a foto seguirá para o admin." });
    } else if (photoPreview && photoPreview.startsWith("http")) {
      imageUrl = photoPreview;
    }

    const asinNorm = extractAmazonAsin(asin) ?? asin.trim().toUpperCase();
    const row: InventoryRow = {
      id: `inv-${Date.now()}`,
      asin: /^[A-Z0-9]{10}$/i.test(asinNorm) ? asinNorm.toUpperCase() : `PEND-${Math.floor(10000 + Math.random() * 89999)}`,
      title: decodeHtmlEntities(productName.trim()),
      qty: q,
      kind: "cadastro_pendente",
      storageDays: 0,
      storageLimitDays: 30,
      storageFreeStartIso: new Date().toISOString(),
      imageUrl,
      clientSuite: profile.suite,
      clientName: profile.name,
      supplier: supplier.trim() || undefined,
      brand: brand.trim() || undefined,
      condition: condition || undefined,
      poNumber: poNumber.trim() || undefined,
      arrivalDate: arrivalDate.trim() || undefined,
      notes: notes.trim() || undefined,
      color: color.trim() || undefined,
      size: size.trim() || undefined,
      model: model.trim() || undefined,
      upc: upc.trim() || undefined,
      tracking: tracking.trim() || undefined,
    };

    const costNum = parseMoneyInput(productCost);
    if (productCost.trim() !== "" && Number.isFinite(costNum) && costNum >= 0) {
      const pctNum = parseMoneyInput(platformPct);
      const labelNum = parseMoneyInput(labelUsd);
      const marginRaw = parseMoneyInput(marginPct);
      const platPct = Number.isFinite(pctNum) && pctNum >= 0 ? pctNum : 15;
      const labelF = Number.isFinite(labelNum) && labelNum >= 0 ? labelNum : 8;
      const margin = clampMarginPct(Number.isFinite(marginRaw) ? marginRaw : 25);
      const prep = prepFeeUsd(prepPlan, prepServiceId);
      const qRaw = parseMoneyInput(previewQty);
      const qtyNorm = Number.isFinite(qRaw) && qRaw >= 1 ? Math.min(99_999, Math.floor(qRaw)) : 10;

      const calc = computeSuggestedUnitSalePrice({
        productCostUsd: costNum,
        prepFeeUsd: prep,
        labelFeeUsd: labelF,
        platformFeePct: platPct,
        marginPct: margin,
      });
      if (!calc.ok) {
        setSaving(false);
        toast.error(calc.reason);
        return;
      }

      row.productCostUsd = costNum;
      row.prepCenterPlan = prepPlan;
      row.prepCenterServiceId = prepServiceId;
      row.platformFeePct = platPct;
      row.desiredMarginPct = margin;
      row.labelFeeUsd = labelF;
      row.prepCenterFeeUsd = prep;
      row.pricingPreviewQty = qtyNorm;
      row.profitPerUnitUsd = calc.profitPerUnit;
      row.projectedProfitUsd = Math.round(calc.profitPerUnit * qtyNorm * 100) / 100;
      row.suggestedSaleUsd = calc.salePrice;
    }

    await appendInventoryRow(row);
    try {
      localStorage.removeItem(registerProductDraftKey(profile.suite));
      notifyRegisterProductDraftUpdated();
    } catch {
      /* ignore */
    }
    setSaving(false);
    toast.success("Produto cadastrado.", {
      description:
        "Já aparece em «Receber» e no admin (Inventory) quando a API demo está a correr — «npm run dev» inicia Vite + servidor na 8787.",
    });
    navigate("/app/estoque?aba=receber");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-24 sm:pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Inbound</p>
          <h1 className="mt-1 text-2xl font-bold uppercase tracking-tight text-ds-text sm:text-3xl">
            Cadastrar produto
          </h1>
          {profile.suite ? (
            <p className="mt-3 inline-flex rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-ds-text shadow-ds">
              Suite <span className="ml-1 tabular-nums text-ds-primary">{profile.suite}</span>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-ds-btn bg-ds-primary px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-ds transition hover:opacity-95 disabled:opacity-60"
          >
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Salvar
          </button>
          <Link
            to="/app/estoque"
            className="inline-flex items-center justify-center rounded-ds-btn border border-ds-border bg-ds-surface px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-ds-text shadow-ds transition hover:bg-ds-bg"
          >
            Voltar
          </Link>
        </div>
      </header>

      <section
        className="rounded-ds-card border border-ds-border bg-ds-surface p-4 shadow-ds"
        aria-label="Checklist antes de salvar"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ds-text">Checklist rápido</h2>
          <p className="text-xs text-ds-muted">
            Toque num item para saltar ao campo. Rascunho guardado neste aparelho (reabre a página e continua de onde
            parou).
          </p>
        </div>
        <ul className="mt-3 space-y-2">
          {preSaveChecklist.rows.map((row) => (
            <li key={row.label}>
              <button
                type="button"
                onClick={() => scrollToAnchor(row.anchor)}
                className="flex w-full items-start gap-2 rounded-ds-btn border border-transparent px-2 py-1.5 text-left text-sm transition hover:border-ds-primary/25 hover:bg-ds-bg"
              >
                {"optional" in row && row.optional ? (
                  row.warn ? (
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-ds-error" aria-hidden />
                  ) : row.ok ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                  ) : (
                    <Circle className="mt-0.5 size-4 shrink-0 text-ds-muted" aria-hidden />
                  )
                ) : row.ok ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <Circle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                )}
                <span className={cn("leading-snug", row.ok ? "text-ds-text" : "text-ds-muted")}>{row.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div
        className="flex flex-wrap gap-2 rounded-ds-card border border-ds-border bg-ds-surface p-2 shadow-ds"
        role="tablist"
        aria-label="Modo de cadastro"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "manual"}
          onClick={() => setMode("manual")}
          className={cn(
            "inline-flex items-center gap-2 rounded-ds-btn px-4 py-2.5 text-sm font-semibold uppercase tracking-wide transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary",
            mode === "manual" ? "bg-ds-primary text-white shadow-ds" : "text-ds-muted hover:bg-ds-bg hover:text-ds-text",
          )}
        >
          <PencilLine className="size-4" aria-hidden />
          Cadastro manual
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "link"}
          onClick={() => setMode("link")}
          className={cn(
            "inline-flex items-center gap-2 rounded-ds-btn px-4 py-2.5 text-sm font-semibold uppercase tracking-wide transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary",
            mode === "link" ? "bg-ds-primary text-white shadow-ds" : "text-ds-muted hover:bg-ds-bg hover:text-ds-text",
          )}
        >
          <Link2 className="size-4" aria-hidden />
          Link do fornecedor
        </button>
      </div>

      {mode === "manual" ? (
        <div className="flex flex-col gap-3 rounded-ds-card border border-ds-border bg-ds-surface p-4 shadow-ds sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[180px] flex-1">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ds-muted" htmlFor={`${formId}-asin`}>
              ASIN
            </label>
            <input
              id={`${formId}-asin`}
              className={inputClass}
              placeholder="ASIN (10 caracteres) ou link com /dp/…"
              value={asin}
              onChange={(e) => setAsin(e.target.value)}
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            disabled={asinLookupBusy}
            onClick={() => void lookupAsin()}
            className="inline-flex items-center justify-center gap-2 rounded-ds-btn bg-ds-primary px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-ds transition hover:opacity-95 disabled:opacity-60"
          >
            {asinLookupBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />}
            Buscar ASIN / link
          </button>
        </div>
      ) : (
        <div className="space-y-3 rounded-ds-card border-2 border-amber-400 bg-amber-50 p-4 shadow-md ring-1 ring-amber-200/80">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-950">Importar pelo link do fornecedor</p>
          <label className="block text-xs font-semibold text-amber-950/90" htmlFor={`${formId}-url`}>
            Cole o URL do produto
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <input
              id={`${formId}-url`}
              className={cn(inputClass, "sm:flex-1 border-amber-200 bg-white")}
              placeholder="https://…"
              value={supplierUrl}
              onChange={(e) => setSupplierUrl(e.target.value)}
              inputMode="url"
              autoComplete="url"
            />
            <button
              type="button"
              onClick={importFromLink}
              disabled={importing}
              className="inline-flex items-center justify-center gap-2 rounded-ds-btn border border-amber-600 bg-amber-600 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-ds transition hover:bg-amber-700 disabled:opacity-60"
            >
              {importing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
              Importar dados
            </button>
          </div>
          <p className="text-xs text-amber-950/80">
            O servidor lê metadados da página. Se falhar, volte a «Cadastro manual» e preencha à mão.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        <section
          className="rounded-ds-card border border-ds-border bg-ds-surface p-4 shadow-ds lg:col-span-4"
          aria-labelledby={`${formId}-photo-h`}
        >
          <h2 id={`${formId}-photo-h`} className="text-sm font-bold uppercase tracking-wide text-ds-text">
            Foto do produto
          </h2>
          <p className="mt-1 text-xs text-ds-muted">Obrigatória — o time usa na conferência com o físico.</p>
          <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 flex min-h-[220px] w-full flex-col items-center justify-center gap-2 rounded-ds-card border border-dashed border-ds-border bg-ds-bg px-4 py-6 text-center text-sm font-semibold text-ds-muted transition hover:border-ds-primary/35 hover:bg-ds-soft-violet/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
          >
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="Pré-visualização do produto"
                className="max-h-48 w-full max-w-xs rounded-ds-btn object-contain"
              />
            ) : (
              <>
                <ImagePlus className="size-10 text-ds-primary" aria-hidden />
                Clique para enviar foto do produto
              </>
            )}
          </button>
          {photoPreview ? (
            <button
              type="button"
              onClick={() => onPickPhoto(null)}
              className="mt-2 text-xs font-semibold text-ds-error hover:underline"
            >
              Remover foto
            </button>
          ) : null}
        </section>

        <section
          className="rounded-ds-card border border-ds-border bg-ds-surface p-4 shadow-ds lg:col-span-4"
          aria-labelledby={`${formId}-req-h`}
        >
          <h2
            id={`${formId}-req-h`}
            className="border-b border-ds-soft-amber-border pb-2 text-sm font-bold uppercase tracking-wide text-ds-text"
          >
            Campos obrigatórios
          </h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ds-muted" htmlFor={`${formId}-qty`}>
                Quantidade
              </label>
              <input
                id={`${formId}-qty`}
                className={inputClass}
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min={1}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ds-muted" htmlFor={`${formId}-name`}>
                Nome produto
              </label>
              <input
                id={`${formId}-name`}
                className={inputClass}
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Ex.: Panela antiaderente 24 cm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ds-muted" htmlFor={`${formId}-cond`}>
                Condições
              </label>
              <select
                id={`${formId}-cond`}
                className={inputClass}
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
              >
                {CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ds-muted" htmlFor={`${formId}-sup`}>
                Fornecedor
              </label>
              <input
                id={`${formId}-sup`}
                className={inputClass}
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Nome da loja onde foi comprado"
              />
            </div>
          </div>
        </section>

        <section
          className="rounded-ds-card border border-ds-border bg-ds-surface p-4 shadow-ds lg:col-span-4"
          aria-labelledby={`${formId}-opt-h`}
        >
          <h2
            id={`${formId}-opt-h`}
            className="border-b border-ds-soft-violet-border pb-2 text-sm font-bold uppercase tracking-wide text-ds-text"
          >
            Campos opcionais
          </h2>
          <p className="mt-2 text-xs text-ds-muted">PO, chegada, cor, marca, UPC, rastreio — preencha o que tiver.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div className="xl:col-span-1">
              <label className="mb-1.5 block text-xs font-semibold text-ds-muted" htmlFor={`${formId}-po`}>
                N. ordem de compra
              </label>
              <input id={`${formId}-po`} className={inputClass} value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
            </div>
            <div className="xl:col-span-1">
              <label className="mb-1.5 block text-xs font-semibold text-ds-muted" htmlFor={`${formId}-arrival`}>
                Previsão de chegada
              </label>
              <input
                id={`${formId}-arrival`}
                type="date"
                className={inputClass}
                value={arrivalDate}
                onChange={(e) => setArrivalDate(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ds-muted" htmlFor={`${formId}-color`}>
                Cor
              </label>
              <input id={`${formId}-color`} className={inputClass} value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ds-muted" htmlFor={`${formId}-size`}>
                Tamanho
              </label>
              <input id={`${formId}-size`} className={inputClass} value={size} onChange={(e) => setSize(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ds-muted" htmlFor={`${formId}-brand`}>
                Marca
              </label>
              <input id={`${formId}-brand`} className={inputClass} value={brand} onChange={(e) => setBrand(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ds-muted" htmlFor={`${formId}-model`}>
                Modelo
              </label>
              <input id={`${formId}-model`} className={inputClass} value={model} onChange={(e) => setModel(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ds-muted" htmlFor={`${formId}-upc`}>
                UPC
              </label>
              <input id={`${formId}-upc`} className={inputClass} value={upc} onChange={(e) => setUpc(e.target.value)} />
            </div>
            <div className="sm:col-span-2 xl:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-ds-muted" htmlFor={`${formId}-track`}>
                Número de rastreio
              </label>
              <input id={`${formId}-track`} className={inputClass} value={tracking} onChange={(e) => setTracking(e.target.value)} />
            </div>
          </div>
        </section>

        <section
          className="rounded-ds-card border border-ds-border bg-ds-surface p-4 shadow-ds lg:col-span-12"
          aria-labelledby={`${formId}-pricing-h`}
        >
          <h2 id={`${formId}-pricing-h`} className="text-sm font-bold uppercase tracking-wide text-ds-text">
            Custo e preço sugerido
          </h2>
          <p className="mt-1 text-xs uppercase tracking-wide text-ds-muted">
            Custos fixos + margem só sobre o custo do produto + taxa da plataforma no preço — guardado no cadastro.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ds-muted" htmlFor={`${formId}-pcost`}>
                Custo do produto (USD)
              </label>
              <input
                id={`${formId}-pcost`}
                className={inputClass}
                inputMode="decimal"
                placeholder="0.00"
                value={productCost}
                onChange={(e) => setProductCost(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ds-muted" htmlFor={`${formId}-platpct`}>
                Taxa plataforma (% do preço de venda)
              </label>
              <input
                id={`${formId}-platpct`}
                className={inputClass}
                inputMode="decimal"
                value={platformPct}
                onChange={(e) => setPlatformPct(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ds-muted" htmlFor={`${formId}-labelusd`}>
                Etiqueta / label (USD)
              </label>
              <input
                id={`${formId}-labelusd`}
                className={inputClass}
                inputMode="decimal"
                value={labelUsd}
                onChange={(e) => setLabelUsd(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ds-muted" htmlFor={`${formId}-previewqty`}>
                Simular venda de (unidades)
              </label>
              <input
                id={`${formId}-previewqty`}
                className={inputClass}
                inputMode="numeric"
                min={1}
                value={previewQty}
                onChange={(e) => setPreviewQty(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 rounded-ds-btn border border-ds-border bg-ds-bg px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="text-xs font-semibold text-ds-muted" htmlFor={`${formId}-marginslider`}>
                Margem de lucro ({MARGIN_PCT_MIN}%–{MARGIN_PCT_MAX}% sobre o custo do produto)
              </label>
              <span className="text-sm font-bold tabular-nums text-ds-primary">
                {clampMarginPct(parseMoneyInput(marginPct) || 25)}%
              </span>
            </div>
            <input
              id={`${formId}-marginslider`}
              type="range"
              min={MARGIN_PCT_MIN}
              max={MARGIN_PCT_MAX}
              step={1}
              value={clampMarginPct(parseMoneyInput(marginPct) || 25)}
              onChange={(e) => setMarginPct(e.target.value)}
              className="mt-2 w-full accent-ds-primary"
            />
            <div className="mt-2 flex items-center gap-2">
              <label className="sr-only" htmlFor={`${formId}-marginnum`}>
                Margem %
              </label>
              <input
                id={`${formId}-marginnum`}
                className={cn(inputClass, "max-w-[100px]")}
                inputMode="numeric"
                value={marginPct}
                onChange={(e) => {
                  const v = parseMoneyInput(e.target.value);
                  if (!Number.isFinite(v)) setMarginPct(e.target.value);
                  else setMarginPct(String(clampMarginPct(v)));
                }}
              />
              <span className="text-xs text-ds-muted">% só sobre custo produto (US$ de lucro alvo)</span>
            </div>
          </div>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ds-muted">Plano prep</p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Plano prep">
            <button
              type="button"
              onClick={() => {
                setPrepPlan("basic");
                setPremiumSubTab("rates");
              }}
              className={cn(
                "rounded-ds-btn border px-4 py-2 text-sm font-semibold uppercase tracking-wide transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary",
                prepPlan === "basic"
                  ? "border-ds-primary bg-ds-primary text-white shadow-ds"
                  : "border-ds-border bg-ds-bg text-ds-text hover:border-ds-primary/35",
              )}
            >
              Básico (grátis)
            </button>
            <button
              type="button"
              onClick={() => {
                setPrepPlan("premium");
                setPremiumSubTab("rates");
              }}
              className={cn(
                "rounded-ds-btn border px-4 py-2 text-sm font-semibold uppercase tracking-wide transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary",
                prepPlan === "premium"
                  ? "border-ds-primary bg-ds-primary text-white shadow-ds"
                  : "border-ds-border bg-ds-bg text-ds-text hover:border-ds-primary/35",
              )}
            >
              Direct Premium (US$49,99/mês)
            </button>
          </div>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ds-muted">Modalidades FBA / FBM</p>
          <div
            className="mt-2 max-w-2xl space-y-3 rounded-ds-card border border-ds-border bg-ds-surface p-4 text-xs leading-relaxed text-ds-muted shadow-ds"
            role="region"
            aria-label="O que é FBA e FBM nesta tabela"
          >
            <p className="rounded-ds-btn border border-ds-primary/30 bg-ds-soft-violet/40 px-3 py-2 text-center text-[11px] font-bold tracking-tight text-ds-text sm:text-xs">
              FBA = envio para a Amazon (EUA) · FBM = envio direto ao cliente final (qualquer plataforma)
            </p>
            <div>
              <p className="flex items-center gap-2 font-bold text-ds-text">
                <span className="inline-flex size-2.5 shrink-0 rounded-full bg-ds-primary" aria-hidden />
                FBM (Fulfillment by Merchant)
              </p>
              <p className="mt-2">
                Refere-se a <strong className="text-ds-text">todos os envios feitos direto ao cliente final</strong>,
                com <strong className="text-ds-text">etiqueta de envio própria</strong> (gerada por você na
                transportadora ou no marketplace).
              </p>
              <p className="mt-2">
                <span className="font-semibold text-ds-text" aria-hidden>
                  →
                </span>{" "}
                Esse modelo é <strong className="text-ds-text">mais flexível</strong> e pode ser usado em várias
                plataformas, por exemplo:{" "}
                <strong className="text-ds-text">
                  Amazon (FBM), Mercado Livre, TikTok Shop, Shopify, eBay
                </strong>
                , envios internacionais, entre outras.
              </p>
            </div>
          </div>
          {prepPlan === "premium" ? (
            <div className="mt-2 space-y-3">
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Direct Premium">
                <button
                  type="button"
                  role="tab"
                  aria-selected={premiumSubTab === "rates"}
                  onClick={() => setPremiumSubTab("rates")}
                  className={cn(
                    "rounded-ds-btn border px-3 py-2 text-xs font-bold uppercase tracking-wide transition",
                    premiumSubTab === "rates"
                      ? "border-ds-primary bg-ds-primary text-white"
                      : "border-ds-border bg-ds-bg text-ds-text hover:bg-ds-bg",
                  )}
                >
                  Tabela de taxas
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={premiumSubTab === "subscribe"}
                  onClick={() => setPremiumSubTab("subscribe")}
                  className={cn(
                    "rounded-ds-btn border px-3 py-2 text-xs font-bold uppercase tracking-wide transition",
                    premiumSubTab === "subscribe"
                      ? "border-amber-600 bg-amber-500 text-white"
                      : "border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100",
                  )}
                >
                  Não é assinante? Assine agora
                </button>
              </div>
              {premiumSubTab === "subscribe" ? (
                <div className="rounded-ds-card border-2 border-amber-400 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm">
                  <p className="font-bold uppercase tracking-wide">Direct Premium — US$49,99/mês</p>
                  <p className="mt-2 text-xs leading-relaxed">
                    Taxas de prep mais baixas, fotos incluídas em vários serviços e outras vantagens. Se ainda não tem o
                    plano, faça a assinatura e passe a pagar menos por unidade no simulador acima.
                  </p>
                  <Link
                    to="/app/premium"
                    className="mt-3 inline-flex items-center justify-center rounded-ds-btn bg-amber-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow-ds transition hover:bg-amber-700"
                  >
                    Fazer assinatura agora
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-ds-btn border border-ds-border">
                  <table className="min-w-[640px] w-full text-left text-sm">
                    <caption className="caption-bottom px-3 pb-2 pt-1 text-left text-[11px] leading-snug text-ds-muted">
                      FBA = Amazon EUA · FBM = envio direto com sua etiqueta em{" "}
                      <strong className="text-ds-text">qualquer marketplace</strong>.
                    </caption>
                    <thead className="border-b border-ds-border bg-ds-bg text-xs font-semibold uppercase tracking-wide text-ds-muted">
                      <tr>
                        <th className="w-10 px-2 py-2" scope="col">
                          {" "}
                        </th>
                        <th className="px-3 py-2" scope="col">
                          Modalidade / serviço
                        </th>
                        <th className="px-3 py-2 tabular-nums" scope="col">
                          Básico
                        </th>
                        <th className="px-3 py-2 tabular-nums" scope="col">
                          Premium
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ds-border text-ds-text">
                      {PREP_CENTER_PRICING_MAIN.map((line) => {
                        const selected = prepServiceId === line.id;
                        return (
                          <tr key={line.id} className={selected ? "bg-ds-soft-violet/35" : "hover:bg-ds-bg/80"}>
                            <td className="px-2 py-2 text-center align-middle">
                              <input
                                type="radio"
                                name={`${formId}-prep-svc`}
                                className="size-4 accent-ds-primary"
                                checked={selected}
                                onChange={() => setPrepServiceId(line.id)}
                                aria-labelledby={`${formId}-prep-lbl-${line.id}`}
                              />
                            </td>
                            <td className="px-3 py-2 align-middle">
                              <span id={`${formId}-prep-lbl-${line.id}`}>{line.label}</span>
                            </td>
                            <td className="px-3 py-2 tabular-nums align-middle">{formatUsd(line.basicUsd)}</td>
                            <td
                              className={cn(
                                "px-3 py-2 tabular-nums align-middle",
                                selected && "font-bold text-ds-primary",
                              )}
                            >
                              {formatUsd(line.premiumUsd)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-2 overflow-x-auto rounded-ds-btn border border-ds-border">
              <table className="min-w-[640px] w-full text-left text-sm">
                <caption className="caption-bottom px-3 pb-2 pt-1 text-left text-[11px] leading-snug text-ds-muted">
                  FBA = Amazon EUA · FBM = envio direto com sua etiqueta em{" "}
                  <strong className="text-ds-text">qualquer marketplace</strong>.
                </caption>
                <thead className="border-b border-ds-border bg-ds-bg text-xs font-semibold uppercase tracking-wide text-ds-muted">
                  <tr>
                    <th className="w-10 px-2 py-2" scope="col">
                      {" "}
                    </th>
                    <th className="px-3 py-2" scope="col">
                      Modalidade / serviço
                    </th>
                    <th className="px-3 py-2 tabular-nums" scope="col">
                      Básico
                    </th>
                    <th className="px-3 py-2 tabular-nums" scope="col">
                      Premium
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ds-border text-ds-text">
                  {PREP_CENTER_PRICING_MAIN.map((line) => {
                    const selected = prepServiceId === line.id;
                    return (
                      <tr key={line.id} className={selected ? "bg-ds-soft-violet/35" : "hover:bg-ds-bg/80"}>
                        <td className="px-2 py-2 text-center align-middle">
                          <input
                            type="radio"
                            name={`${formId}-prep-svc`}
                            className="size-4 accent-ds-primary"
                            checked={selected}
                            onChange={() => setPrepServiceId(line.id)}
                            aria-labelledby={`${formId}-prep-lbl-${line.id}`}
                          />
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <span id={`${formId}-prep-lbl-${line.id}`}>{line.label}</span>
                        </td>
                        <td
                          className={cn(
                            "px-3 py-2 tabular-nums align-middle",
                            selected && "font-bold text-ds-primary",
                          )}
                        >
                          {formatUsd(line.basicUsd)}
                        </td>
                        <td className="px-3 py-2 tabular-nums align-middle">{formatUsd(line.premiumUsd)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <details className="mt-4 rounded-ds-btn border border-ds-border bg-ds-bg/50 p-3 text-sm">
            <summary className="cursor-pointer select-none font-semibold text-ds-text">
              Ver tabela de serviços extra (fotos, pallet, remoção…)
            </summary>
            <p className="mt-2 text-xs text-ds-muted">Valores de referência — não entram no simulador de preço acima.</p>
            <div className="mt-2 overflow-x-auto rounded-ds-btn border border-ds-border bg-ds-surface">
              <table className="min-w-[520px] w-full text-left text-xs">
                <thead className="border-b border-ds-border bg-ds-bg font-semibold uppercase tracking-wide text-ds-muted">
                  <tr>
                    <th className="px-3 py-2">Serviço</th>
                    <th className="px-3 py-2 tabular-nums">Básico</th>
                    <th className="px-3 py-2 tabular-nums">Premium</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ds-border text-ds-text">
                  {PREP_CENTER_PRICING_EXTRA.map((line) => (
                    <tr key={line.id}>
                      <td className="px-3 py-2">{line.label}</td>
                      <td className="px-3 py-2 tabular-nums">{formatUsd(line.basicUsd)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatUsd(line.premiumUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <div className="mt-4 rounded-ds-btn border border-ds-soft-amber-border bg-ds-soft-amber/25 p-4">
            {priceBreakdown.ready === true ? (
              <div className="space-y-2 text-sm text-ds-text">
                <p className="font-semibold">Resumo</p>
                <ul className="space-y-1 text-xs sm:text-sm">
                  <li className="flex justify-between gap-4">
                    <span>Custo produto</span>
                    <span className="tabular-nums font-medium">{formatUsd(priceBreakdown.cost)}</span>
                  </li>
                  <li className="flex justify-between gap-4">
                    <span>Prep ({prepPlan === "premium" ? "Premium" : "Básico"})</span>
                    <span className="tabular-nums font-medium">{formatUsd(priceBreakdown.prep)}</span>
                  </li>
                  <li className="flex justify-between gap-4">
                    <span>Etiqueta</span>
                    <span className="tabular-nums font-medium">{formatUsd(priceBreakdown.label)}</span>
                  </li>
                  <li className="flex justify-between gap-4 border-b border-ds-soft-amber-border/60 pb-1 text-ds-muted">
                    <span>Subtotal fixo por unidade</span>
                    <span className="tabular-nums font-medium">{formatUsd(priceBreakdown.landedPerUnit)}</span>
                  </li>
                  <li className="flex justify-between gap-4">
                    <span>Lucro alvo ({priceBreakdown.marginPct}% × custo produto)</span>
                    <span className="tabular-nums font-medium">{formatUsd(priceBreakdown.profitTargetUsd)}</span>
                  </li>
                  <li className="flex justify-between gap-4">
                    <span>Taxa plataforma ({priceBreakdown.platformPct}% do preço — custo)</span>
                    <span className="tabular-nums font-medium">{formatUsd(priceBreakdown.platformFeeOnSale)}</span>
                  </li>
                  <li className="flex justify-between gap-4 border-t border-ds-soft-amber-border pt-2 text-base font-bold">
                    <span>Preço sugerido de venda (unitário)</span>
                    <span className="tabular-nums text-ds-primary">{formatUsd(priceBreakdown.salePrice)}</span>
                  </li>
                  <li className="flex justify-between gap-4 text-ds-muted">
                    <span>Lucro por unidade (preço − custos − taxa plataforma)</span>
                    <span className="tabular-nums font-semibold text-ds-text">{formatUsd(priceBreakdown.profitPerUnit)}</span>
                  </li>
                  <li className="flex justify-between gap-4 rounded-ds-btn bg-white/60 px-2 py-2 text-ds-text">
                    <span>
                      Vender <strong className="tabular-nums">{priceBreakdown.previewQty}</strong> unidades — lucro
                      total (após custos e taxa)
                    </span>
                    <span className="tabular-nums font-bold text-ds-primary">{formatUsd(priceBreakdown.projectedProfit)}</span>
                  </li>
                </ul>
              </div>
            ) : priceBreakdown.ready === "error" ? (
              <p className="text-sm font-medium text-ds-error">{priceBreakdown.reason}</p>
            ) : (
              <p className="text-sm text-ds-muted">
                Preencha o <strong className="font-semibold text-ds-text">custo do produto</strong> para calcular o
                preço. Taxa prep com o plano escolhido:{" "}
                <strong className="tabular-nums">{formatUsd(priceBreakdown.prep)}</strong>. Margem usada no exemplo:{" "}
                {priceBreakdown.margin}%.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-ds-card border border-ds-border bg-ds-surface p-4 shadow-ds lg:col-span-12">
          <label className="mb-1.5 block text-xs font-semibold text-ds-muted" htmlFor={`${formId}-notes`}>
            Observações adicionais (seja objetivo)
          </label>
          <textarea
            id={`${formId}-notes`}
            className={cn(inputClass, "min-h-[100px] resize-y")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Instruções para receção, embalagem frágil, etc."
          />
        </section>
      </div>

      <div className="hidden justify-center sm:flex">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex min-w-[200px] items-center justify-center gap-2 rounded-ds-btn bg-ds-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-ds transition hover:opacity-95 disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Salvar cadastro
        </button>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ds-border bg-ds-surface/95 p-3 shadow-[0_-6px_20px_rgba(0,0,0,0.08)] backdrop-blur-sm sm:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <p className="min-w-0 flex-1 text-xs leading-snug text-ds-muted">
            {preSaveChecklist.requiredComplete ? (
              <span className="font-semibold text-emerald-800">Pronto para salvar</span>
            ) : (
              <span>Complete foto, nome, fornecedor e quantidade</span>
            )}
          </p>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-ds-btn bg-ds-primary px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-ds disabled:opacity-60"
          >
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Salvar
          </button>
        </div>
      </div>

      <p className="text-center text-xs font-semibold uppercase tracking-wide text-ds-muted">
        Cadastro de produtos — Direct Box USA
      </p>
    </div>
  );
}
