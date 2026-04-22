import { useCallback, useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Boxes,
  ChevronLeft,
  ClipboardList,
  FileSignature,
  Minus,
  Package,
  Plus,
  Trash2,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import type {
  ClientOrderShipmentLine,
  IntlBrCustomsDeclaration,
  InventoryKind,
  InventoryRow,
  PrepKitWorkType,
  ServiceType,
  ShippingLabelFile,
} from "../../types";
import { inventoryRowsForSuite } from "../../lib/clientDashboardMetrics";
import { addInventoryDeductions, getMergedInventoryView, INVENTORY_UPDATED_EVENT } from "../../lib/clientInventoryStorage";
import { useClientProfile } from "../../context/ClientProfileContext";
import { useI18n } from "../../i18n/context";
import { formatDateTimeShortPtBr } from "../../lib/localePtBr";
import { prependClientOrder } from "../../lib/clientOrdersStorage";
import { saveClientProfile } from "../../lib/clientProfileStorage";
import { computeShipmentFeeDemo } from "../../lib/shipmentFeeDemo";
import { postWalletAdjust } from "../../lib/walletApi";
import { resolveLabelTrackingMatch } from "../../lib/requestShippingLabelParse";
import type { ShippingTrackingMatch } from "../../lib/shippingTrackingDetect";
import { saveIntlBrDeclaration } from "../../lib/intlBrDeclarationStorage";
import { cn } from "../../lib/cn";
import { FbaAmazonStep1 } from "./FbaAmazonStep1";

type ShipmentMode = "fbm" | "amazon_fba" | "intl_ml" | "intl_br" | "prep_kit";

const inputClass =
  "w-full rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 text-sm text-ds-text shadow-ds placeholder:text-ds-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ds-primary";

const RF_MANUAL =
  "https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/manuais/remessas-postal-e-expressa";
const RF_DECLARACAO =
  "https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/manuais/remessas-postal-e-expressa/topicos/declaracao";
const RF_PROCEDIMENTOS =
  "https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/manuais/remessas-postal-e-expressa/topicos/Procedimentos";
const CORREIOS_INTL = "https://www.correios.com.br/receber/encomenda/internacional";
const CORREIOS_RESTRICOES = "https://www.correios.com.br/enviar/restricoes-e-limites";

/** Sugestão para clientes comprarem etiquetas USPS nos EUA (evita dúvidas recorrentes). */
const PIRATE_SHIP_URL = "https://ship.pirateship.com/";

const PIRATE_SHIP_TOAST_TAIL =
  `Sugestão para etiquetas de envio nos EUA: ${PIRATE_SHIP_URL} (Pirate Ship). Opcional — confirme o serviço e as medidas com o prep.`;

/** Limite para caber no localStorage (demo). */
const MAX_SHIPPING_LABEL_BYTES = Math.floor(1.65 * 1024 * 1024);
const MAX_FNSKU_LABEL_BYTES = Math.floor(0.95 * 1024 * 1024);
const MAX_FNSKU_FILES = 6;
const LABEL_FILE_ACCEPT = "application/pdf,image/png,image/jpeg,image/webp,.pdf";

/** Quantidade mínima total no pedido FBA (alinha à referência Seller Central / operação). */
const FBA_MIN_ORDER_UNITS = 10;

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

function aggregateWizardToLegacy(
  wizard: FbaWizardLine[],
  groups: { id: string }[],
): { lines: Record<string, number>; splits: Record<string, Record<string, number>> } {
  const lines: Record<string, number> = {};
  const splits: Record<string, Record<string, number>> = {};
  for (const w of wizard) {
    lines[w.inventoryId] = (lines[w.inventoryId] ?? 0) + w.qty;
  }
  for (const w of wizard) {
    if (!splits[w.inventoryId]) splits[w.inventoryId] = {};
    splits[w.inventoryId][w.groupId] = (splits[w.inventoryId][w.groupId] ?? 0) + w.qty;
  }
  for (const invId of Object.keys(lines)) {
    const cell = { ...(splits[invId] ?? {}) };
    for (const g of groups) {
      if (cell[g.id] === undefined) cell[g.id] = 0;
    }
    splits[invId] = cell;
  }
  return { lines, splits };
}

function readLabelFile(file: File, maxBytes: number): Promise<ShippingLabelFile> {
  if (file.size > maxBytes) return Promise.reject(new Error("big"));
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const u = r.result;
      if (typeof u === "string") resolve({ name: file.name, dataUrl: u });
      else reject(new Error("read"));
    };
    r.onerror = () => reject(new Error("read"));
    r.readAsDataURL(file);
  });
}

/** ASIN típico Amazon (10 caracteres alfanuméricos) — evita pedir imagem na CDN com códigos PEND-… */
function looksLikeAmazonAsin(asin: string): boolean {
  const a = asin.trim().toUpperCase();
  return /^[A-Z0-9]{10}$/.test(a);
}

/** Miniatura: `imageUrl` do inventário ou imagem pública típica por ASIN; ícone se falhar. */
function ProductThumb({
  row,
  className,
  size = "md",
}: {
  row: InventoryRow;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  type Stage = "primary" | "asinA" | "asinB" | "icon";
  const asinA = `https://images-na.ssl-images-amazon.com/images/P/${encodeURIComponent(row.asin)}.01._AC_SL200_.jpg`;
  const asinB = `https://m.media-amazon.com/images/P/${encodeURIComponent(row.asin)}.01._AC_SL200_.jpg`;
  const computeStage = (): Stage => {
    if (row.imageUrl?.trim()) return "primary";
    if (looksLikeAmazonAsin(row.asin)) return "asinA";
    return "icon";
  };
  const [stage, setStage] = useState<Stage>(() => computeStage());

  useEffect(() => {
    setStage(computeStage());
  }, [row.id, row.asin, row.imageUrl]);

  const tryAmazon = looksLikeAmazonAsin(row.asin);
  const src =
    stage === "primary" && row.imageUrl?.trim()
      ? row.imageUrl.trim()
      : stage === "asinA" && tryAmazon
        ? asinA
        : stage === "asinB" && tryAmazon
          ? asinB
          : null;
  const box =
    size === "sm" ? "size-12" : size === "lg" ? "size-16" : "size-14";
  const iconSz = size === "sm" ? "size-5" : size === "lg" ? "size-8" : "size-7";

  const onImgError = () => {
    setStage((s) => {
      if (s === "primary") return tryAmazon ? "asinA" : "icon";
      if (s === "asinA") return tryAmazon ? "asinB" : "icon";
      return "icon";
    });
  };

  return (
    <span
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-ds-btn bg-ds-surface ring-1 ring-ds-border",
        box,
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={onImgError}
        />
      ) : (
        <span className="flex size-full items-center justify-center">
          <Package className={cn(iconSz, "text-ds-muted")} aria-hidden />
        </span>
      )}
    </span>
  );
}

function pirateShipSuggestModes(mode: ShipmentMode): boolean {
  return mode === "fbm" || mode === "intl_ml" || mode === "intl_br";
}

function isShippableKind(k: InventoryKind): boolean {
  return k === "novo" || k === "retorno";
}

/** FBA: permite enviar stock já contabilizado ou ainda em receção (cadastro / trânsito). */
function isFbaPickableKind(k: InventoryKind): boolean {
  return isShippableKind(k) || k === "cadastro_pendente" || k === "transito";
}

function fbmEligible(row: InventoryRow): boolean {
  return row.fbmUnitLabelReady !== false;
}

function modeToService(mode: ShipmentMode): ServiceType {
  switch (mode) {
    case "amazon_fba":
      return "FBA";
    case "fbm":
      return "FBM";
    case "intl_ml":
      return "INTL_ML";
    case "intl_br":
      return "INTL_BR";
    case "prep_kit":
      return "PREP_KIT";
    default: {
      const _e: never = mode;
      return _e;
    }
  }
}

function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

function emptyIntlBr(): IntlBrCustomsDeclaration {
  return {
    recipientFullName: "",
    recipientCpf: "",
    addressLine: "",
    cityStateCep: "",
    goodsDescriptionPt: "",
    quantityPieces: "",
    unitValueUsd: "",
    totalValueUsd: "",
    freightUsd: "",
    insuranceUsd: "",
    ncm: "",
    grossWeightKg: "",
    correiosRestrictionsAcknowledged: false,
    importerTaxesResponsibilityAccepted: false,
    truthfulnessAccepted: false,
    signerFullName: "",
    signatureAccepted: false,
    signedAtIso: "",
  };
}

export function ClientCreateShipmentPage() {
  const { profile } = useClientProfile();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const uid = useId();
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<ShipmentMode>("fbm");
  const [lines, setLines] = useState<Record<string, number>>({});
  const [fbaGroups, setFbaGroups] = useState<{ id: string; label: string }[]>([
    { id: "g1", label: "Grupo 01" },
  ]);
  const [fbaSplits, setFbaSplits] = useState<Record<string, Record<string, number>>>({});
  const prevShipmentMode = useRef<ShipmentMode | null>(null);
  const [invTick, setInvTick] = useState(0);
  const [intlBr, setIntlBr] = useState<IntlBrCustomsDeclaration>(() => emptyIntlBr());
  const [shippingLabel, setShippingLabel] = useState<ShippingLabelFile | null>(null);
  const [intlMlAmericasLabel, setIntlMlAmericasLabel] = useState<ShippingLabelFile | null>(null);
  const [intlMlCarrierLabel, setIntlMlCarrierLabel] = useState<ShippingLabelFile | null>(null);
  const [fbmParsedTracking, setFbmParsedTracking] = useState<ShippingTrackingMatch | null>(null);
  const [fbmParseLoading, setFbmParseLoading] = useState(false);
  const [fbaCarrierParsedTracking, setFbaCarrierParsedTracking] = useState<ShippingTrackingMatch | null>(null);
  const [fbaCarrierParseLoading, setFbaCarrierParseLoading] = useState(false);
  const [fbaFnskuLabels, setFbaFnskuLabels] = useState<ShippingLabelFile[]>([]);
  const [fbaAmazonBox, setFbaAmazonBox] = useState<ShippingLabelFile | null>(null);
  const [fbaCarrier, setFbaCarrier] = useState<ShippingLabelFile | null>(null);
  const [fbaWizardLines, setFbaWizardLines] = useState<FbaWizardLine[]>([]);
  const [fbaStockTab, setFbaStockTab] = useState<"novos" | "retornos" | "receber">("novos");
  const [fbaSearch, setFbaSearch] = useState("");
  const [fbaSelectedInvId, setFbaSelectedInvId] = useState<string | null>(null);
  const [fbaDraftUnits, setFbaDraftUnits] = useState(1);
  const [fbaDraftGroupId, setFbaDraftGroupId] = useState("");
  const [fbaDraftPack, setFbaDraftPack] = useState(false);
  const [prepKitWorkType, setPrepKitWorkType] = useState<PrepKitWorkType>("custom");
  const [prepInstructions, setPrepInstructions] = useState("");
  const [prepOutputsNote, setPrepOutputsNote] = useState("");

  const isIntlBr = mode === "intl_br";
  const isPrepKit = mode === "prep_kit";
  const confirmStep = isIntlBr ? 3 : 2;
  const customsStep = 2;

  useEffect(() => {
    const fn = () => setInvTick((t) => t + 1);
    window.addEventListener(INVENTORY_UPDATED_EVENT, fn);
    return () => window.removeEventListener(INVENTORY_UPDATED_EVENT, fn);
  }, []);

  useEffect(() => {
    if (searchParams.get("tipo") === "prep_kit") {
      setMode("prep_kit");
      setStep(0);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isIntlBr) setIntlBr(emptyIntlBr());
  }, [isIntlBr]);

  useEffect(() => {
    setShippingLabel(null);
    setIntlMlAmericasLabel(null);
    setIntlMlCarrierLabel(null);
    setFbaFnskuLabels([]);
    setFbaAmazonBox(null);
    setFbaCarrier(null);
    setFbmParsedTracking(null);
    setFbaCarrierParsedTracking(null);
  }, [mode]);

  useEffect(() => {
    const labelForParse =
      mode === "fbm" ? shippingLabel : mode === "intl_ml" ? intlMlCarrierLabel : null;
    if (!labelForParse?.dataUrl?.startsWith("data:application/pdf")) {
      setFbmParsedTracking(null);
      setFbmParseLoading(false);
      return;
    }
    let cancelled = false;
    setFbmParseLoading(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        const r = await resolveLabelTrackingMatch(labelForParse.dataUrl, labelForParse.name);
        if (cancelled) return;
        setFbmParseLoading(false);
        if (r.ok && r.match) setFbmParsedTracking(r.match);
        else setFbmParsedTracking(null);
      })();
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mode, shippingLabel?.dataUrl, shippingLabel?.name, intlMlCarrierLabel?.dataUrl, intlMlCarrierLabel?.name]);

  useEffect(() => {
    if (mode !== "amazon_fba" || !fbaCarrier?.dataUrl?.startsWith("data:application/pdf")) {
      setFbaCarrierParsedTracking(null);
      setFbaCarrierParseLoading(false);
      return;
    }
    let cancelled = false;
    setFbaCarrierParseLoading(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        const r = await resolveLabelTrackingMatch(fbaCarrier.dataUrl, fbaCarrier.name);
        if (cancelled) return;
        setFbaCarrierParseLoading(false);
        if (r.ok && r.match) setFbaCarrierParsedTracking(r.match);
        else setFbaCarrierParsedTracking(null);
      })();
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mode, fbaCarrier?.dataUrl, fbaCarrier?.name]);

  useEffect(() => {
    const prev = prevShipmentMode.current;
    if (mode === "amazon_fba" && prev !== null && prev !== "amazon_fba") {
      setFbaGroups([{ id: `g-${Date.now().toString(36)}`, label: "Grupo 01" }]);
      setFbaSplits({});
      setFbaWizardLines([]);
      setFbaSelectedInvId(null);
      setFbaSearch("");
      setFbaStockTab("novos");
      setFbaDraftGroupId("");
      setFbaDraftPack(false);
      setLines({});
    }
    if (prev === "amazon_fba" && mode !== "amazon_fba") {
      setFbaWizardLines([]);
      setFbaSelectedInvId(null);
      setFbaSearch("");
      setFbaStockTab("novos");
      setFbaDraftGroupId("");
      setFbaDraftPack(false);
      setLines({});
      setFbaSplits({});
    }
    prevShipmentMode.current = mode;
  }, [mode]);

  useEffect(() => {
    if (mode !== "amazon_fba") return;
    if (step !== 1 && step !== confirmStep) return;
    const { lines: L, splits: S } = aggregateWizardToLegacy(fbaWizardLines, fbaGroups);
    setLines(L);
    setFbaSplits(S);
  }, [mode, step, fbaWizardLines, fbaGroups, confirmStep]);

  const onShippingLabelFile = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void readLabelFile(file, MAX_SHIPPING_LABEL_BYTES)
      .then(setShippingLabel)
      .catch(() => toast.error("Arquivo muito grande ou inválido. Use PDF/imagem até cerca de 1,6 MB."));
  }, []);

  const onIntlBrCommercialInvoice = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void readLabelFile(file, MAX_SHIPPING_LABEL_BYTES)
      .then((f) =>
        setIntlBr((d) => ({
          ...d,
          commercialInvoiceFileName: f.name,
          commercialInvoiceDataUrl: f.dataUrl,
        })),
      )
      .catch(() => toast.error("Arquivo muito grande ou inválido. Use PDF/imagem até cerca de 1,6 MB."));
  }, []);

  const onIntlMlAmericasFile = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void readLabelFile(file, MAX_SHIPPING_LABEL_BYTES)
      .then(setIntlMlAmericasLabel)
      .catch(() => toast.error("Arquivo muito grande ou inválido. Use PDF/imagem até cerca de 1,6 MB."));
  }, []);

  const onIntlMlCarrierFile = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void readLabelFile(file, MAX_SHIPPING_LABEL_BYTES)
      .then(setIntlMlCarrierLabel)
      .catch(() => toast.error("Arquivo muito grande ou inválido. Use PDF/imagem até cerca de 1,6 MB."));
  }, []);

  const onFnskuBatch = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    const acc: ShippingLabelFile[] = [];
    for (const file of files) {
      try {
        acc.push(await readLabelFile(file, MAX_FNSKU_LABEL_BYTES));
      } catch {
        toast.error(`Arquivo muito grande ou inválido: ${file.name}`);
      }
    }
    if (!acc.length) return;
    setFbaFnskuLabels((prev) => [...prev, ...acc].slice(0, MAX_FNSKU_FILES));
  }, []);

  const onFbaAmazonOptional = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void readLabelFile(file, MAX_SHIPPING_LABEL_BYTES)
      .then(setFbaAmazonBox)
      .catch(() => toast.error("Arquivo inválido ou muito grande."));
  }, []);

  const onFbaCarrierOptional = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void readLabelFile(file, MAX_SHIPPING_LABEL_BYTES)
      .then(setFbaCarrier)
      .catch(() => toast.error("Arquivo inválido ou muito grande."));
  }, []);

  const baseRows = useMemo(() => {
    void invTick;
    const all = inventoryRowsForSuite(getMergedInventoryView(), profile.suite).filter((r) => r.qty > 0);
    if (mode === "amazon_fba") return all.filter((r) => isFbaPickableKind(r.kind));
    return all.filter((r) => isShippableKind(r.kind));
  }, [invTick, mode, profile.suite]);

  const rowsForMode = useMemo(() => {
    if (mode === "fbm") return baseRows.filter(fbmEligible);
    if (mode === "prep_kit") return baseRows.filter((r) => isShippableKind(r.kind));
    return baseRows;
  }, [baseRows, mode]);

  const fbaLeftInventoryRows = useMemo(() => {
    const kinds: InventoryKind[] =
      fbaStockTab === "novos"
        ? ["novo"]
        : fbaStockTab === "retornos"
          ? ["retorno"]
          : ["cadastro_pendente", "transito"];
    const q = fbaSearch.trim().toLowerCase();
    return baseRows
      .filter((r) => kinds.includes(r.kind))
      .filter((r) => {
        if (!q) return true;
        return r.asin.toLowerCase().includes(q) || r.title.toLowerCase().includes(q);
      });
  }, [baseRows, fbaStockTab, fbaSearch]);

  const fbaCartTotalUsd = useMemo(() => {
    return fbaWizardLines.reduce((acc, l) => acc + l.qty * (l.unitPriceUsd ?? 0), 0);
  }, [fbaWizardLines]);

  const fbaTotalUnitsInWizard = useMemo(() => fbaWizardLines.reduce((a, l) => a + l.qty, 0), [fbaWizardLines]);

  const fbaSelectedRow = useMemo(
    () => (fbaSelectedInvId ? baseRows.find((r) => r.id === fbaSelectedInvId) ?? null : null),
    [fbaSelectedInvId, baseRows],
  );

  /** Ao mudar de SKU selecionado (ou stock na conta), define unidades sugeridas — não depende de `fbaWizardLines` para não sobrescrever o número enquanto o usuário edita. */
  useEffect(() => {
    if (mode !== "amazon_fba" || step !== 1 || !fbaSelectedInvId) return;
    const row = baseRows.find((r) => r.id === fbaSelectedInvId);
    if (!row) return;
    const free = Math.max(0, row.qty - usedQtyInWizard(fbaWizardLines, row.id));
    setFbaDraftUnits(free > 0 ? free : 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ver comentário acima
  }, [mode, step, fbaSelectedInvId, baseRows, invTick]);

  const setQty = useCallback(
    (id: string, q: number, max: number) => {
      const v = Math.max(0, Math.min(max, Math.floor(q)));
      setLines((prev) => {
        const next = { ...prev };
        if (v <= 0) delete next[id];
        else next[id] = v;
        return next;
      });
      setFbaSplits((prev) => {
        if (mode !== "amazon_fba") return prev;
        const g0 = fbaGroups[0]?.id;
        if (!g0) return prev;
        if (v <= 0) {
          const { [id]: _, ...rest } = prev;
          return rest;
        }
        const cur = prev[id];
        if (!cur) return { ...prev, [id]: { [g0]: v } };
        const sum = Object.values(cur).reduce((a, b) => a + b, 0);
        if (sum === v) return prev;
        if (sum < v) return { ...prev, [id]: { ...cur, [g0]: (cur[g0] ?? 0) + (v - sum) } };
        return { ...prev, [id]: { [g0]: v } };
      });
    },
    [mode, fbaGroups],
  );

  const addFbaGroup = () => {
    const id = `g${Date.now().toString(36)}`;
    setFbaGroups((g) => [...g, { id, label: `Grupo ${String(g.length + 1).padStart(2, "0")}` }]);
  };

  const addFbaLineToOrder = useCallback(() => {
    if (!fbaSelectedInvId) {
      toast.error("Selecione um produto na lista à esquerda.");
      return;
    }
    if (!fbaDraftGroupId) {
      toast.error("Escolha o grupo de envio.");
      return;
    }
    const row = baseRows.find((r) => r.id === fbaSelectedInvId);
    if (!row) return;
    const free = Math.max(0, row.qty - usedQtyInWizard(fbaWizardLines, row.id));
    if (free < 1) {
      toast.error("Sem stock disponível para mais unidades deste SKU.");
      return;
    }
    const draft = fbaDraftUnits < 1 ? 1 : fbaDraftUnits;
    const u = Math.max(1, Math.min(Math.floor(draft), free));
    const newLine: FbaWizardLine = {
      key: `wl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      inventoryId: row.id,
      asin: row.asin,
      title: row.title,
      imageUrl: row.imageUrl,
      qty: u,
      groupId: fbaDraftGroupId,
      pack: fbaDraftPack,
      unitPriceUsd: row.unitPriceUsd,
    };
    const nextWizard = [...fbaWizardLines, newLine];
    setFbaWizardLines(nextWizard);
    const freeAfter = Math.max(0, row.qty - usedQtyInWizard(nextWizard, row.id));
    setFbaDraftUnits(freeAfter > 0 ? freeAfter : 1);
    toast.success("Linha adicionada ao pedido.");
  }, [fbaSelectedInvId, fbaDraftGroupId, fbaDraftPack, fbaDraftUnits, baseRows, fbaWizardLines]);

  const updateFbaWizardLineQty = useCallback((lineKey: string, raw: number) => {
    const q = Math.floor(Number(raw));
    if (!Number.isFinite(q)) return;
    setFbaWizardLines((prev) => {
      const line = prev.find((l) => l.key === lineKey);
      if (!line) return prev;
      const row = baseRows.find((r) => r.id === line.inventoryId);
      if (!row) return prev;
      const usedOthers = prev
        .filter((l) => l.inventoryId === line.inventoryId && l.key !== lineKey)
        .reduce((a, l) => a + l.qty, 0);
      const maxForLine = Math.max(1, row.qty - usedOthers);
      const v = Math.max(1, Math.min(q, maxForLine));
      return prev.map((l) => (l.key === lineKey ? { ...l, qty: v } : l));
    });
  }, [baseRows]);

  const clearFbaDraftFields = useCallback(() => {
    setFbaDraftPack(false);
    setFbaDraftGroupId("");
    const row = fbaSelectedInvId ? baseRows.find((r) => r.id === fbaSelectedInvId) : undefined;
    if (row) {
      const free = Math.max(0, row.qty - usedQtyInWizard(fbaWizardLines, row.id));
      setFbaDraftUnits(free > 0 ? free : 1);
    } else {
      setFbaDraftUnits(1);
    }
  }, [fbaSelectedInvId, baseRows, fbaWizardLines]);

  const cancelFbaOrderDraft = useCallback(() => {
    setFbaWizardLines([]);
    setFbaSelectedInvId(null);
    setFbaDraftGroupId("");
    setFbaDraftPack(false);
    setFbaDraftUnits(1);
  }, []);

  const removeFbaWizardLineByKey = useCallback((key: string) => {
    setFbaWizardLines((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const selectedSummary = useMemo(() => {
    return Object.entries(lines)
      .filter(([, q]) => q > 0)
      .map(([id, qty]) => {
        const row = baseRows.find((r) => r.id === id);
        return row ? { row, qty } : null;
      })
      .filter(Boolean) as { row: InventoryRow; qty: number }[];
  }, [lines, baseRows]);

  const confirmFeeUsd = useMemo(() => {
    const units =
      mode === "amazon_fba"
        ? fbaWizardLines.reduce((a, l) => a + (Number.isFinite(l.qty) ? l.qty : 0), 0)
        : selectedSummary.reduce((a, { qty }) => a + (Number.isFinite(qty) ? qty : 0), 0);
    return computeShipmentFeeDemo(units);
  }, [mode, fbaWizardLines, selectedSummary]);

  const validateFbaSplits = (): string | null => {
    for (const { row, qty } of selectedSummary) {
      const sp = fbaSplits[row.id];
      if (!sp) return `Informe quantas unidades de «${row.title}» vão em cada grupo.`;
      const s = Object.values(sp).reduce((a, b) => a + b, 0);
      if (s !== qty)
        return `«${row.title}»: soma nos grupos (${s}) tem de ser igual à quantidade a enviar (${qty}).`;
    }
    return null;
  };

  const validateIntlBrForm = (): string | null => {
    const d = intlBr;
    if (!d.recipientFullName.trim()) return "Informe o nome completo do destinatário.";
    const cpf = onlyDigits(d.recipientCpf);
    if (cpf.length !== 11) return "CPF do destinatário deve ter 11 dígitos.";
    if (!d.addressLine.trim()) return "Informe o endereço de entrega no Brasil.";
    if (!d.cityStateCep.trim()) return "Informe cidade, UF e CEP.";
    if (!d.goodsDescriptionPt.trim()) return "Descreve a mercadoria em português (detalhado).";
    if (!d.quantityPieces.trim()) return "Informe a quantidade de peças.";
    if (!d.totalValueUsd.trim()) return "Informe o valor total declarado (USD).";
    if (!d.grossWeightKg.trim()) return "Informe o peso bruto estimado (kg).";
    if (!d.truthfulnessAccepted) return "Aceita a declaração de veracidade das informações.";
    if (!d.signerFullName.trim()) return "Informe o nome completo para assinatura eletrônica.";
    if (!d.signatureAccepted) return "Confirme a assinatura eletrônica como declarante.";
    if (!d.correiosRestrictionsAcknowledged)
      return "Confirme que consultou as restrições de envio (Correios / remessas internacionais).";
    if (!d.importerTaxesResponsibilityAccepted)
      return "Confirme a ciência sobre impostos e desembaraço no Brasil (responsabilidade do importador/destinatário).";
    return null;
  };

  const buildSignedDeclaration = (): IntlBrCustomsDeclaration => ({
    ...intlBr,
    recipientCpf: onlyDigits(intlBr.recipientCpf),
    signedAtIso: new Date().toISOString(),
  });

  const goNext = () => {
    if (step === 0) {
      setStep(1);
      return;
    }
    if (step === 1) {
      if (mode === "amazon_fba") {
        if (!fbaWizardLines.length) {
          toast.error("Adicione pelo menos uma linha ao pedido (botão «Adicionar ao pedido»).");
          return;
        }
        const tot = fbaWizardLines.reduce((a, l) => a + l.qty, 0);
        if (tot < FBA_MIN_ORDER_UNITS) {
          toast.error(
            `Pedido FBA: o total tem de ser pelo menos ${FBA_MIN_ORDER_UNITS} unidades (regra da operação / alinhamento ao Seller Central).`,
          );
          return;
        }
        const err = validateFbaSplits();
        if (err) {
          toast.error(err);
          return;
        }
      } else if (!selectedSummary.length) {
        toast.error("Selecione pelo menos um produto e quantidade.");
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2 && isIntlBr) {
      const err = validateIntlBrForm();
      if (err) {
        toast.error(err);
        return;
      }
      setStep(3);
    }
  };

  const submit = async () => {
    const isFba = mode === "amazon_fba";
    if (isPrepKit) {
      if (prepInstructions.trim().length < 12) {
        toast.error(t("client.shipment.prepKitInstructionsShort"));
        return;
      }
    }
    if (isFba) {
      if (fbaFnskuLabels.length === 0) {
        toast.error("Envie pelo menos um arquivo com as etiquetas FNSKU (barcode Amazon) para o prep nas unidades.");
        return;
      }
      if ((fbaAmazonBox && !fbaCarrier) || (!fbaAmazonBox && fbaCarrier)) {
        toast.error(
          "Para etiquetas da caixa master neste momento, envie as duas (Amazon + transportadora) ou deixe as duas em branco e complete depois em «Pedidos».",
        );
        return;
      }
    } else if (mode === "intl_ml") {
      if (!intlMlAmericasLabel || !intlMlCarrierLabel) {
        toast.error(t("client.shipment.intlMlLabelsMissing"));
        return;
      }
    } else if (!isPrepKit && !shippingLabel) {
      toast.error("Envie o arquivo da etiqueta de envio (PDF ou imagem) que você gerou.");
      return;
    }
    const items = selectedSummary.map(({ row, qty }) => ({ id: row.id, qty }));
    const service = modeToService(mode) as ServiceType;
    const orderId = `ENV-${Date.now().toString(36).toUpperCase()}`;
    const createdAt = new Date();
    const totalUnitsForFee = isFba
      ? fbaWizardLines.reduce((a, l) => a + (Number.isFinite(l.qty) ? l.qty : 0), 0)
      : selectedSummary.reduce((a, { qty }) => a + (Number.isFinite(qty) ? qty : 0), 0);
    const prepFeeUsd = computeShipmentFeeDemo(totalUnitsForFee);
    const debit = await postWalletAdjust({
      suite: profile.suite,
      deltaUsd: -prepFeeUsd,
      reason: "shipment_fee",
      reference: orderId,
    });
    if (!debit.ok) {
      const errLow = debit.error.toLowerCase();
      const insuf = errLow.includes("insuficiente") || errLow.includes("insufficient");
      toast.error(
        insuf ? t("client.shipment.feeInsufficient", { fee: prepFeeUsd.toFixed(2) }) : debit.error,
      );
      return;
    }
    saveClientProfile({ ...profile, balanceUsd: debit.balanceUsd });
    const feeLine = t("client.shipment.feeCharged", { amount: prepFeeUsd.toFixed(2) });
    const shipmentLines: ClientOrderShipmentLine[] = isFba
      ? fbaWizardLines.map((l) => ({
          inventoryId: l.inventoryId,
          asin: l.asin,
          title: l.title,
          qty: l.qty,
          imageUrl: l.imageUrl,
        }))
      : selectedSummary.map(({ row, qty }) => ({
          inventoryId: row.id,
          asin: row.asin,
          title: row.title,
          qty,
          imageUrl: row.imageUrl,
        }));
    const snapTracking = (m: ShippingTrackingMatch | null) =>
      !m
        ? {}
        : {
            shippingTrackingCarrierId: m.carrierId,
            shippingTrackingCarrierLabel: m.carrierLabel,
            shippingTrackingNumber: m.tracking,
            shippingTrackingUrl: m.trackingUrl,
          };
    const newOrder = {
      id: orderId,
      status: "em_fila" as const,
      service,
      suite: profile.suite,
      clientName: profile.name,
      createdAtIso: createdAt.toISOString(),
      createdLabel: formatDateTimeShortPtBr(createdAt),
      inventoryDeductions: items,
      shipmentLines,
      ...(isPrepKit
        ? {
            prepKitWork: {
              workType: prepKitWorkType,
              instructions: prepInstructions.trim(),
              outputsRequested: prepOutputsNote.trim() || undefined,
            },
          }
        : {}),
      ...(isFba
        ? {
            fbaFnskuLabels,
            fbaAmazonBoxLabel: fbaAmazonBox ?? undefined,
            fbaCarrierLabel: fbaCarrier ?? undefined,
            fbaBoxGroups: fbaGroups.map((g) => ({ id: g.id, label: g.label })),
            fbaBoxSplits: Object.fromEntries(
              Object.entries(fbaSplits).map(([invId, byBox]) => [invId, { ...byBox }]),
            ),
            fbaItemsSnapshot: selectedSummary.map(({ row, qty }) => ({
              inventoryId: row.id,
              asin: row.asin,
              title: row.title,
              totalQty: qty,
              imageUrl: row.imageUrl,
            })),
            fbaLineDetails: fbaWizardLines.map((l) => {
              const groupLabel = fbaGroups.find((g) => g.id === l.groupId)?.label ?? l.groupId;
              const unit = l.unitPriceUsd ?? 0;
              const lineTotal = l.qty * unit;
              return {
                key: l.key,
                inventoryId: l.inventoryId,
                asin: l.asin,
                title: l.title,
                qty: l.qty,
                groupId: l.groupId,
                groupLabel,
                pack: l.pack,
                unitPriceUsd: l.unitPriceUsd,
                lineTotalUsd: lineTotal > 0 ? lineTotal : undefined,
              };
            }),
          }
        : mode === "intl_ml"
          ? {
              intlMlAmericasLabelFileName: intlMlAmericasLabel!.name,
              intlMlAmericasLabelDataUrl: intlMlAmericasLabel!.dataUrl,
              intlMlCarrierLabelFileName: intlMlCarrierLabel!.name,
              intlMlCarrierLabelDataUrl: intlMlCarrierLabel!.dataUrl,
            }
          : isPrepKit
            ? {}
            : {
                shippingLabelFileName: shippingLabel!.name,
                shippingLabelDataUrl: shippingLabel!.dataUrl,
              }),
      ...snapTracking(isFba ? fbaCarrierParsedTracking : isPrepKit ? null : fbmParsedTracking),
    };
    try {
      await prependClientOrder(newOrder);
    } catch {
      const refund = await postWalletAdjust({
        suite: profile.suite,
        deltaUsd: prepFeeUsd,
        reason: "shipment_fee_rollback",
        reference: orderId,
      });
      if (refund.ok) saveClientProfile({ ...profile, balanceUsd: refund.balanceUsd });
      toast.error(
        "Não foi possível salvar a etiqueta (armazenamento do navegador cheio ou arquivo grande). Tente um PDF mais leve.",
      );
      return;
    }
    await addInventoryDeductions(items);
    if (isIntlBr) {
      saveIntlBrDeclaration(orderId, buildSignedDeclaration());
      toast.success("Envio internacional Brasil criado.", {
        description: `${feeLine}\n\nDeclaração e assinatura guardadas na plataforma (demo). O desembaraço oficial continua a ser tratado pela Receita Federal / Correios (DIR, Siscomex Remessa, Minhas Importações). ${PIRATE_SHIP_TOAST_TAIL}`,
      });
    } else if (mode === "intl_ml") {
      toast.success("Envio internacional Mercado Livre criado.", {
        description: `${feeLine}\n\nSegue o fluxo acordado com o prep para ML (etiquetas e documentação). ${PIRATE_SHIP_TOAST_TAIL}`,
      });
    } else if (mode === "amazon_fba") {
      toast.success("Envio FBA criado — etapa FNSKU concluída.", {
        description: `${feeLine}\n\nAs etiquetas FNSKU ficam no pedido para o prep. Quando tiver peso/medidas e criar o envio no Seller Central, envie as duas etiquetas da caixa master em «Pedidos».`,
      });
    } else if (mode === "fbm") {
      toast.success("Envio FBM criado.", {
        description: `${feeLine}\n\nEtiqueta própria até o cliente final (qualquer marketplace). ${PIRATE_SHIP_TOAST_TAIL}`,
      });
    } else if (mode === "prep_kit") {
      toast.success(t("client.shipment.prepKitToast"), { description: feeLine });
    }
    navigate("/app/pedidos");
  };

  const modeCards: { id: ShipmentMode; title: string; desc: string }[] = [
    {
      id: "fbm",
      title: "FBM — envio direto ao cliente",
      desc: "Fulfillment por você: saída direta ao comprador final com etiqueta própria. Serve para Amazon (FBM), TikTok Shop, Shopify, Mercado Livre, eBay, Walmart, envio doméstico nos EUA e outros canais — o mesmo conceito da linha «FBM» na tabela de prep. Não use para estoque que entra na Amazon (FBA) nem para os dois fluxos internacionais ao lado (ML intl / Brasil com DIR).",
    },
    {
      id: "amazon_fba",
      title: "Amazon FBA",
      desc: "Duas fases de etiquetas: FNSKU nas unidades; depois caixa master (Amazon + transportadora). Ver guia no passo 1.",
    },
    {
      id: "intl_ml",
      title: "Envio internacional Mercado Livre",
      desc: "Fluxo dedicado ML — documentação e etiquetas conforme acordo com o prep.",
    },
    {
      id: "intl_br",
      title: "Envio internacional Brasil",
      desc: "EUA → Brasil: produtos → declaração em 5 blocos (RF/Correios) com checklist DIR, invoice opcional e confirmações legais → etiqueta e confirmação.",
    },
    {
      id: "prep_kit",
      title: t("client.shipment.prepKitCardTitle"),
      desc: t("client.shipment.prepKitCardDesc"),
    },
  ];

  const progressLen = confirmStep + 1;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/app/pedidos"
            className="inline-flex items-center gap-1 text-sm font-semibold text-ds-muted transition hover:text-ds-primary"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Voltar aos envios
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-ds-text sm:text-3xl">Criar envio</h1>
          <p className="mt-1 max-w-2xl text-sm text-ds-muted">
            Escolha o tipo de operação, depois os produtos e quantidades (baixa no estoque). Quatro opções: FBM unificado,
            FBA Amazon, ou um dos fluxos internacionais dedicados.
          </p>
          <div className="mt-3 max-w-3xl rounded-ds-card border border-ds-border bg-ds-bg px-4 py-3 text-xs leading-relaxed text-ds-muted shadow-ds">
            <p>
              <strong className="text-ds-text">FBM</strong> na operação significa{" "}
              <strong className="text-ds-text">você envia direto ao cliente final</strong> com{" "}
              <strong className="text-ds-text">etiqueta própria</strong>, em{" "}
              <strong className="text-ds-text">qualquer marketplace</strong> (Amazon FBM, TikTok, Shopify, ML, eBay,
              Walmart, envio doméstico nos EUA, etc.). <strong className="text-ds-text">FBA</strong> é só envio de
              estoque para os <strong className="text-ds-text">centros da Amazon nos EUA</strong>. Os cartões de{" "}
              <strong className="text-ds-text">Mercado Livre internacional</strong> e{" "}
              <strong className="text-ds-text">Brasil</strong> existem quando há documentação ou acordo específico
              (além do FBM genérico).
            </p>
          </div>
        </div>
        <span className="rounded-full border border-ds-border bg-ds-bg px-3 py-1 text-xs font-semibold text-ds-muted">
          Passo {step + 1} de {progressLen}
        </span>
      </div>

      <div className="flex gap-2 rounded-ds-card border border-ds-border bg-ds-surface p-2 shadow-ds" aria-hidden>
        {Array.from({ length: progressLen }, (_, i) => (
          <div
            key={i}
            className={cn("h-1.5 flex-1 rounded-full transition", i <= step ? "bg-ds-primary" : "bg-ds-border")}
          />
        ))}
      </div>

      {step === 0 ? (
        <section className="space-y-4 rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds" aria-labelledby={`${uid}-s0`}>
          <h2 id={`${uid}-s0`} className="text-lg font-bold text-ds-text">
            Tipo de envio
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {modeCards.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setMode(c.id)}
                className={cn(
                  "rounded-ds-card border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary",
                  mode === c.id ? "border-ds-primary bg-ds-soft-violet ring-1 ring-ds-primary/25" : "border-ds-border bg-ds-bg hover:border-ds-primary/20",
                )}
              >
                <Truck className="size-5 text-ds-primary" aria-hidden />
                <p className="mt-2 font-bold text-ds-text">{c.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-ds-muted">{c.desc}</p>
              </button>
            ))}
          </div>
          {mode === "amazon_fba" ? (
            <p className="text-sm">
              <Link
                to="/app/guia-envio-fba"
                className="font-semibold text-ds-primary underline-offset-2 hover:underline"
              >
                Ver guia prático: como enviar para a Amazon FBA com a Direct Box USA
              </Link>
            </p>
          ) : null}
        </section>
      ) : null}

      {step === 1 ? (
        mode === "amazon_fba" ? (
          <FbaAmazonStep1
            uid={uid}
            clientProfile={profile}
            inputClass={inputClass}
            ProductThumb={ProductThumb}
            fbaMinOrderUnits={FBA_MIN_ORDER_UNITS}
            fbaLeftInventoryRows={fbaLeftInventoryRows}
            fbaStockTab={fbaStockTab}
            setFbaStockTab={setFbaStockTab}
            fbaSearch={fbaSearch}
            setFbaSearch={setFbaSearch}
            fbaSelectedInvId={fbaSelectedInvId}
            setFbaSelectedInvId={setFbaSelectedInvId}
            fbaSelectedRow={fbaSelectedRow}
            fbaDraftUnits={fbaDraftUnits}
            setFbaDraftUnits={setFbaDraftUnits}
            fbaDraftGroupId={fbaDraftGroupId}
            setFbaDraftGroupId={setFbaDraftGroupId}
            fbaDraftPack={fbaDraftPack}
            setFbaDraftPack={setFbaDraftPack}
            fbaGroups={fbaGroups}
            addFbaGroup={addFbaGroup}
            fbaWizardLines={fbaWizardLines}
            addFbaLineToOrder={addFbaLineToOrder}
            clearFbaDraftFields={clearFbaDraftFields}
            cancelFbaOrderDraft={cancelFbaOrderDraft}
            removeFbaWizardLineByKey={removeFbaWizardLineByKey}
            updateFbaWizardLineQty={updateFbaWizardLineQty}
            fbaCartTotalUsd={fbaCartTotalUsd}
            fbaTotalUnitsInWizard={fbaTotalUnitsInWizard}
          />
        ) : (
        <section className="grid gap-5 lg:grid-cols-2" aria-labelledby={`${uid}-s1`}>
          <div className="rounded-ds-card border border-ds-border bg-ds-surface p-4 shadow-ds">
            <h2 id={`${uid}-s1`} className="text-lg font-bold text-ds-text">
              Seu estoque
            </h2>
            <p className="mt-1 text-xs font-semibold text-ds-text">
              Conta registada — Suite <span className="font-mono">{profile.suite}</span> · {profile.name}
            </p>
            <p className="mt-1 text-sm text-ds-muted">
              {mode === "fbm"
                ? "FBM: produtos com etiqueta pronta na unidade (Amazon FBM, TikTok, Shopify, eBay, Walmart, envio doméstico EUA, etc.). No passo final envie a etiqueta de envio que você gerou."
                : mode === "prep_kit"
                  ? t("client.shipment.prepKitCardDesc")
                  : mode === "intl_ml"
                    ? "Mercado Livre internacional: selecione SKUs; no passo final envie as duas etiquetas (Mercado Livre Américas e transportadora)."
                    : mode === "intl_br"
                      ? "Brasil: selecione SKUs; depois a declaração em 5 blocos (checklist DIR, valores, confirmações Correios/RF) e, no fim, a etiqueta de envio (PDF/imagem)."
                      : "«Na conta» reflete o estoque após envios já concluídos na plataforma."}
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-ds-muted">
              <strong className="text-ds-text">Disp.</strong> = o que fica livre na conta depois do que você já colocou neste
              envio. A baixa <strong className="text-ds-text">definitiva</strong> no armazém ocorre quando confirmares o
              envio no passo final.
            </p>
            <ul className="mt-4 max-h-[min(520px,55vh)] space-y-2 overflow-y-auto pr-1">
              {rowsForMode.length === 0 ? (
                <li className="rounded-ds-btn border border-dashed border-ds-border bg-ds-bg px-3 py-6 text-center text-sm text-ds-muted">
                  Não há SKUs disponíveis para este modo.
                </li>
              ) : (
                rowsForMode.map((row) => {
                  const q = lines[row.id] ?? 0;
                  const onAccount = row.qty;
                  const dispAfterDraft = Math.max(0, onAccount - q);
                  return (
                    <li
                      key={row.id}
                      className="flex flex-col gap-2 rounded-ds-btn border border-ds-border bg-ds-bg p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <ProductThumb row={row} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ds-text">{row.title}</p>
                          <p className="text-xs text-ds-muted">
                            ASIN {row.asin} · <span className="text-ds-text">Na conta</span>{" "}
                            <strong className="tabular-nums text-ds-text">{onAccount}</strong> u ·{" "}
                            <span className="text-ds-text">Neste envio</span>{" "}
                            <strong className="tabular-nums text-ds-text">{q}</strong> u ·{" "}
                            <span className="text-ds-text">Disp.</span>{" "}
                            <strong className="tabular-nums text-ds-primary">{dispAfterDraft}</strong> u
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          type="button"
                          aria-label="Menos uma unidade"
                          className="inline-flex size-9 items-center justify-center rounded-ds-btn border border-ds-border bg-ds-surface text-ds-text shadow-ds focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
                          onClick={() => setQty(row.id, q - 1, row.qty)}
                        >
                          <Minus className="size-4" />
                        </button>
                        <input
                          className="w-16 rounded-ds-btn border border-ds-border bg-ds-surface py-2 text-center text-sm font-bold tabular-nums text-ds-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
                          inputMode="numeric"
                          value={q || ""}
                          placeholder="0"
                          onChange={(e) => setQty(row.id, Number(e.target.value || 0), row.qty)}
                          aria-label={`Quantidade a enviar para ${row.title}`}
                        />
                        <button
                          type="button"
                          aria-label="Mais uma unidade"
                          className="inline-flex size-9 items-center justify-center rounded-ds-btn border border-ds-border bg-ds-surface text-ds-text shadow-ds focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
                          onClick={() => setQty(row.id, q + 1, row.qty)}
                        >
                          <Plus className="size-4" />
                        </button>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          <div className="space-y-4">
            <div className="rounded-ds-card border border-ds-border bg-ds-surface p-4 shadow-ds">
              <h3 className="flex items-center gap-2 text-sm font-bold text-ds-text">
                <Boxes className="size-4 text-ds-primary" aria-hidden />
                Neste envio
              </h3>
              {!selectedSummary.length ? (
                <p className="mt-3 text-sm text-ds-muted">Você ainda não definiu as quantidades.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {selectedSummary.map(({ row, qty }) => (
                    <li
                      key={row.id}
                      className="flex items-center gap-3 rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-2"
                    >
                      <ProductThumb row={row} size="lg" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-ds-text">{row.title}</p>
                        <p className="text-[11px] text-ds-muted">
                          ASIN {row.asin} · <span className="font-bold text-ds-primary">{qty} u</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setQty(row.id, 0, row.qty)}
                        className="inline-flex size-9 shrink-0 items-center justify-center rounded-ds-btn border border-ds-error/30 bg-red-50 text-ds-error shadow-ds transition hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
                        aria-label={`Remover ${row.title} deste envio`}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
        )
      ) : null}

      {step === customsStep && isIntlBr ? (
        <section
          className="space-y-6 rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds"
          aria-labelledby={`${uid}-rf`}
        >
          <div className="flex flex-wrap items-start gap-3">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-ds-card bg-ds-soft-sky ring-1 ring-ds-soft-sky-border">
              <FileSignature className="size-6 text-ds-soft-sky-icon" aria-hidden />
            </span>
            <div>
              <h2 id={`${uid}-rf`} className="text-lg font-bold text-ds-text">
                Declaração à Receita Federal (EUA → Brasil)
              </h2>
              <p className="mt-1 text-sm text-ds-muted">
                Fluxo em blocos para alinhar com a{" "}
                <strong className="text-ds-text">Declaração de Importação de Remessa (DIR)</strong> e remessas postais
                tratadas pela <strong className="text-ds-text">Receita Federal</strong> e pelos{" "}
                <strong className="text-ds-text">Correios</strong>. Os dados aqui instruem o prep; o registo formal da
                DIR é feito pelo transportador no <strong className="text-ds-text">Siscomex Remessa</strong>, com base
                em documentos como <strong className="text-ds-text">commercial invoice</strong>, conhecimento de carga
                e formulários <strong className="text-ds-text">CN 22 / CN 23</strong>, conforme o manual oficial.
              </p>
              <p className="mt-2 text-xs text-ds-muted">
                Referências:{" "}
                <a href={RF_MANUAL} target="_blank" rel="noopener noreferrer" className="font-semibold text-ds-primary underline">
                  Manual remessas internacionais
                </a>{" "}
                ·{" "}
                <a href={RF_DECLARACAO} target="_blank" rel="noopener noreferrer" className="font-semibold text-ds-primary underline">
                  Tópico «Declaração» (DIR)
                </a>{" "}
                ·{" "}
                <a href={RF_PROCEDIMENTOS} target="_blank" rel="noopener noreferrer" className="font-semibold text-ds-primary underline">
                  Procedimentos
                </a>{" "}
                ·{" "}
                <a href={CORREIOS_INTL} target="_blank" rel="noopener noreferrer" className="font-semibold text-ds-primary underline">
                  Correios — receber internacional
                </a>{" "}
                ·{" "}
                <a href={CORREIOS_RESTRICOES} target="_blank" rel="noopener noreferrer" className="font-semibold text-ds-primary underline">
                  Restrições e limites (envio)
                </a>
              </p>
            </div>
          </div>

          <div className="rounded-ds-card border border-ds-primary/20 bg-ds-soft-violet/20 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-ds-text">
              <ClipboardList className="size-4 shrink-0 text-ds-primary" aria-hidden />
              Checklist — o que a documentação da DIR costuma reunir
            </h3>
            <p className="mt-2 text-[11px] leading-relaxed text-ds-muted">
              Resumo didático com base no material público da Receita Federal sobre composição da DIR; limites de
              valor, regimes especiais (ex.: medicamentos, revenda) e tributação exata variam conforme caso e
              legislação vigente — confirme sempre no site oficial ou com profissional habilitado.
            </p>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-ds-text">
              <li>
                <strong className="text-ds-text">Destinatário:</strong> identificação (PF com CPF ou PJ com CNPJ em
                situação regular) e endereço completo no Brasil.
              </li>
              <li>
                <strong className="text-ds-text">Encomenda:</strong> dados de rastreamento, peso, transporte, frete e
                seguro quando existirem.
              </li>
              <li>
                <strong className="text-ds-text">Remetente:</strong> nome, endereço e país de origem (no envio físico
                costuma constar na etiqueta e na invoice).
              </li>
              <li>
                <strong className="text-ds-text">Bens:</strong> descrição detalhada, quantidade e valor unitário
                coerentes com a prova de compra (invoice/recibo).
              </li>
              <li>
                <strong className="text-ds-text">Desembaraço:</strong> acompanhamento em canais oficiais (ex.:{" "}
                <em>Minhas Importações</em> nos Correios) e pagamento de tributos/taxas quando exigidos, antes de
                liberar a mercadoria.
              </li>
            </ol>
          </div>

          <div className="rounded-ds-btn border border-ds-error/25 bg-red-50/80 p-3 text-xs text-ds-text">
            <strong>Aviso legal:</strong> este formulário é operacional na plataforma para instruir o prep e arquivo do
            cliente. Não substitui orientação fiscal ou despachante. O desembaraço definitivo segue a Receita Federal e
            os sistemas oficiais (Siscomex Remessa, portais da transportadora/Correios).
          </div>

          <div className="space-y-4">
            <h3 className="flex items-center gap-2 border-b border-ds-border pb-2 text-sm font-bold text-ds-text">
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-ds-primary/15 text-xs font-black text-ds-primary">
                1
              </span>
              Destinatário e endereço no Brasil
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold text-ds-muted">
                Nome completo do destinatário
                <input
                  className={cn(inputClass, "mt-1")}
                  value={intlBr.recipientFullName}
                  onChange={(e) => setIntlBr((d) => ({ ...d, recipientFullName: e.target.value }))}
                  autoComplete="name"
                />
              </label>
              <label className="text-xs font-semibold text-ds-muted">
                CPF (11 dígitos) — deve bater com o cadastro na Receita / portal de importação
                <input
                  className={cn(inputClass, "mt-1 tabular-nums")}
                  value={intlBr.recipientCpf}
                  onChange={(e) => setIntlBr((d) => ({ ...d, recipientCpf: e.target.value }))}
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                />
              </label>
              <label className="sm:col-span-2 text-xs font-semibold text-ds-muted">
                Endereço (rua, número, complemento)
                <input
                  className={cn(inputClass, "mt-1")}
                  value={intlBr.addressLine}
                  onChange={(e) => setIntlBr((d) => ({ ...d, addressLine: e.target.value }))}
                />
              </label>
              <label className="sm:col-span-2 text-xs font-semibold text-ds-muted">
                Cidade, UF, CEP
                <input
                  className={cn(inputClass, "mt-1")}
                  value={intlBr.cityStateCep}
                  onChange={(e) => setIntlBr((d) => ({ ...d, cityStateCep: e.target.value }))}
                  placeholder="Ex.: São Paulo, SP, 01310-100"
                />
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="flex items-center gap-2 border-b border-ds-border pb-2 text-sm font-bold text-ds-text">
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-ds-primary/15 text-xs font-black text-ds-primary">
                2
              </span>
              Mercadoria (descrição fiel à alfândega)
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2 text-xs font-semibold text-ds-muted">
                Descrição detalhada em português
                <textarea
                  className={cn(inputClass, "mt-1 min-h-[88px] resize-y")}
                  value={intlBr.goodsDescriptionPt}
                  onChange={(e) => setIntlBr((d) => ({ ...d, goodsDescriptionPt: e.target.value }))}
                  placeholder="Material, uso, marca, modelo, função do produto…"
                />
              </label>
              <label className="text-xs font-semibold text-ds-muted">
                Quantidade (peças / unidades)
                <input
                  className={cn(inputClass, "mt-1")}
                  value={intlBr.quantityPieces}
                  onChange={(e) => setIntlBr((d) => ({ ...d, quantityPieces: e.target.value }))}
                />
              </label>
              <label className="text-xs font-semibold text-ds-muted">
                Peso bruto estimado (kg)
                <input
                  className={cn(inputClass, "mt-1")}
                  value={intlBr.grossWeightKg}
                  onChange={(e) => setIntlBr((d) => ({ ...d, grossWeightKg: e.target.value }))}
                  inputMode="decimal"
                />
              </label>
              <label className="sm:col-span-2 text-xs font-semibold text-ds-muted">
                NCM (opcional, ajuda na classificação fiscal)
                <input
                  className={cn(inputClass, "mt-1")}
                  value={intlBr.ncm}
                  onChange={(e) => setIntlBr((d) => ({ ...d, ncm: e.target.value }))}
                  placeholder="Nomenclatura Comum do Mercosul, se souber"
                />
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="flex items-center gap-2 border-b border-ds-border pb-2 text-sm font-bold text-ds-text">
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-ds-primary/15 text-xs font-black text-ds-primary">
                3
              </span>
              Valores (USD) e comprovante de compra
            </h3>
            <p className="text-[11px] text-ds-muted">
              Os valores declarados devem ser compatíveis com a prova de aquisição. Anexe invoice/recibo em PDF ou
              imagem quando existir (recomendado).
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold text-ds-muted">
                Valor unitário (USD)
                <input
                  className={cn(inputClass, "mt-1")}
                  value={intlBr.unitValueUsd}
                  onChange={(e) => setIntlBr((d) => ({ ...d, unitValueUsd: e.target.value }))}
                  inputMode="decimal"
                />
              </label>
              <label className="text-xs font-semibold text-ds-muted">
                Valor total da mercadoria (USD)
                <input
                  className={cn(inputClass, "mt-1")}
                  value={intlBr.totalValueUsd}
                  onChange={(e) => setIntlBr((d) => ({ ...d, totalValueUsd: e.target.value }))}
                  inputMode="decimal"
                />
              </label>
              <label className="text-xs font-semibold text-ds-muted">
                Frete (USD, opcional)
                <input
                  className={cn(inputClass, "mt-1")}
                  value={intlBr.freightUsd}
                  onChange={(e) => setIntlBr((d) => ({ ...d, freightUsd: e.target.value }))}
                  inputMode="decimal"
                />
              </label>
              <label className="text-xs font-semibold text-ds-muted">
                Seguro (USD, opcional)
                <input
                  className={cn(inputClass, "mt-1")}
                  value={intlBr.insuranceUsd}
                  onChange={(e) => setIntlBr((d) => ({ ...d, insuranceUsd: e.target.value }))}
                  inputMode="decimal"
                />
              </label>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-ds-muted" htmlFor={`${uid}-intl-br-invoice`}>
                  Invoice / recibo de compra (opcional, PDF ou imagem até ~1,6 MB)
                </label>
                <input
                  id={`${uid}-intl-br-invoice`}
                  type="file"
                  accept={LABEL_FILE_ACCEPT}
                  onChange={onIntlBrCommercialInvoice}
                  className="mt-2 block w-full max-w-md text-sm text-ds-text file:mr-3 file:rounded-ds-btn file:border file:border-ds-border file:bg-ds-bg file:px-3 file:py-2 file:text-xs file:font-semibold file:text-ds-text hover:file:border-ds-primary/30"
                />
                {intlBr.commercialInvoiceFileName ? (
                  <p className="mt-2 text-xs font-medium text-ds-primary">
                    Arquivo: <span className="text-ds-text">{intlBr.commercialInvoiceFileName}</span>{" "}
                    <button
                      type="button"
                      className="text-ds-muted underline"
                      onClick={() =>
                        setIntlBr((d) => {
                          const next = { ...d };
                          delete next.commercialInvoiceFileName;
                          delete next.commercialInvoiceDataUrl;
                          return next;
                        })
                      }
                    >
                      remover
                    </button>
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-ds-btn border border-amber-200/80 bg-amber-50/70 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-ds-text">
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-200/90 text-xs font-black text-amber-950">
                4
              </span>
              Conformidade antes de avançar
            </h3>
            <label className="flex cursor-pointer items-start gap-3 text-sm text-ds-text">
              <input
                type="checkbox"
                checked={intlBr.correiosRestrictionsAcknowledged}
                onChange={(e) => setIntlBr((d) => ({ ...d, correiosRestrictionsAcknowledged: e.target.checked }))}
                className="mt-1 size-4 rounded border-ds-border text-ds-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
              />
              <span>
                Li e compreendi as{" "}
                <a
                  href={CORREIOS_RESTRICOES}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-ds-primary underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  restrições de envio e importação
                </a>{" "}
                aplicáveis à minha mercadoria (itens proibidos ou sujeitos a exigências especiais geram retenção,
                devolução ou destruição).
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 text-sm text-ds-text">
              <input
                type="checkbox"
                checked={intlBr.importerTaxesResponsibilityAccepted}
                onChange={(e) =>
                  setIntlBr((d) => ({ ...d, importerTaxesResponsibilityAccepted: e.target.checked }))
                }
                className="mt-1 size-4 rounded border-ds-border text-ds-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
              />
              <span>
                Tenho ciência de que <strong className="text-ds-text">impostos, taxas e o desembaraço</strong> no Brasil
                são de responsabilidade do importador/destinatário perante a Receita Federal e os canais oficiais (ex.:{" "}
                <a href={CORREIOS_INTL} target="_blank" rel="noopener noreferrer" className="font-semibold text-ds-primary underline" onClick={(e) => e.stopPropagation()}>
                  Minhas Importações / Correios
                </a>
                ), e que divergência de valor ou descrição pode gerar fiscalização ou multa.
              </span>
            </label>
          </div>

          <div className="space-y-3 rounded-ds-btn border border-ds-border bg-ds-bg p-4">
            <h3 className="flex items-center gap-2 border-b border-ds-border pb-2 text-sm font-bold text-ds-text">
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-ds-primary/15 text-xs font-black text-ds-primary">
                5
              </span>
              Declaração de veracidade e assinatura
            </h3>
            <label className="flex cursor-pointer items-start gap-3 text-sm text-ds-text">
              <input
                type="checkbox"
                checked={intlBr.truthfulnessAccepted}
                onChange={(e) => setIntlBr((d) => ({ ...d, truthfulnessAccepted: e.target.checked }))}
                className="mt-1 size-4 rounded border-ds-border text-ds-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
              />
              <span>
                Declaro que as informações prestadas correspondem à realidade e estou ciente de que declarações falsas
                implicam sanções legais.
              </span>
            </label>
            <label className="text-xs font-semibold text-ds-muted">
              Assinatura eletrônica — nome completo do declarante
              <input
                className={cn(inputClass, "mt-1")}
                value={intlBr.signerFullName}
                onChange={(e) => setIntlBr((d) => ({ ...d, signerFullName: e.target.value }))}
              />
            </label>
            <label className="flex cursor-pointer items-start gap-3 text-sm text-ds-text">
              <input
                type="checkbox"
                checked={intlBr.signatureAccepted}
                onChange={(e) => setIntlBr((d) => ({ ...d, signatureAccepted: e.target.checked }))}
                className="mt-1 size-4 rounded border-ds-border text-ds-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
              />
              <span>
                Assino eletronicamente como declarante responsável e autorizo o prep center a usar estes dados no
                processo de exportação EUA → Brasil.
              </span>
            </label>
          </div>
        </section>
      ) : null}

      {((step === customsStep && !isIntlBr) || step === confirmStep) && (
        <section className="space-y-4 rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds">
          <h2 className="text-lg font-bold text-ds-text">Confirmar</h2>
          <p className="text-sm text-ds-muted">
            {t("client.financial.shipFeeHint")}{" "}
            {t("client.shipment.balanceAfterPreview", {
              fee: confirmFeeUsd.toFixed(2),
              after: Math.max(0, profile.balanceUsd - confirmFeeUsd).toFixed(2),
            })}
          </p>
          {mode === "amazon_fba" ? (
            <p className="text-sm">
              <Link to="/app/guia-envio-fba" className="font-semibold text-ds-primary underline-offset-2 hover:underline">
                Abrir guia prático FBA (Direct Box USA)
              </Link>
            </p>
          ) : null}
          {isIntlBr && step === confirmStep ? (
            <div className="rounded-ds-btn border border-ds-primary/25 bg-ds-soft-violet/25 p-4 text-xs leading-relaxed text-ds-text">
              <p className="font-bold text-ds-text">Resumo da declaração (revisão antes da etiqueta)</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-ds-muted">
                <li>
                  <span className="font-semibold text-ds-text">Destinatário:</span> {intlBr.recipientFullName} · CPF com{" "}
                  {onlyDigits(intlBr.recipientCpf).length} dígitos
                </li>
                <li>
                  <span className="font-semibold text-ds-text">Entrega:</span> {intlBr.cityStateCep.trim() || "—"}
                </li>
                <li>
                  <span className="font-semibold text-ds-text">Mercadoria:</span>{" "}
                  {intlBr.goodsDescriptionPt.trim().slice(0, 120)}
                  {intlBr.goodsDescriptionPt.trim().length > 120 ? "…" : ""}
                </li>
                <li>
                  <span className="font-semibold text-ds-text">Valor total USD:</span> {intlBr.totalValueUsd.trim() || "—"}{" "}
                  · <span className="font-semibold text-ds-text">Peso (kg):</span> {intlBr.grossWeightKg.trim() || "—"}
                </li>
                <li>
                  <span className="font-semibold text-ds-text">Invoice anexada:</span>{" "}
                  {intlBr.commercialInvoiceFileName ? `sim (${intlBr.commercialInvoiceFileName})` : "não"}
                </li>
              </ul>
              <p className="mt-2 text-[11px] text-ds-muted">
                Se algo estiver incorreto, use «Anterior» para voltar ao passo da declaração e corrigir antes de enviar a
                etiqueta.
              </p>
            </div>
          ) : null}
          <ul className="divide-y divide-ds-border rounded-ds-btn border border-ds-border bg-ds-bg text-sm">
            {mode === "amazon_fba"
              ? fbaWizardLines.map((line) => {
                  const row =
                    baseRows.find((r) => r.id === line.inventoryId) ??
                    ({
                      id: line.inventoryId,
                      asin: line.asin,
                      title: line.title,
                      qty: 0,
                      kind: "novo" as const,
                      storageDays: 0,
                      storageLimitDays: 0,
                      imageUrl: line.imageUrl,
                    } as InventoryRow);
                  const gl = fbaGroups.find((g) => g.id === line.groupId)?.label ?? line.groupId;
                  return (
                    <li key={line.key} className="flex flex-wrap items-center gap-3 px-3 py-2">
                      <ProductThumb row={row} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-ds-text">{line.title}</span>
                        <span className="text-[11px] text-ds-muted">
                          {line.qty} u · {gl} · pack {line.pack ? "SIM" : "NÃO"}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFbaWizardLineByKey(line.key)}
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-ds-btn border border-ds-error/25 text-ds-error hover:bg-red-50"
                        aria-label="Remover linha"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </li>
                  );
                })
              : selectedSummary.map(({ row, qty }) => (
                  <li key={row.id} className="flex items-center gap-3 px-3 py-2">
                    <ProductThumb row={row} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-ds-text">{row.title}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-ds-primary">{qty} u</span>
                    <button
                      type="button"
                      onClick={() => setQty(row.id, 0, row.qty)}
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-ds-btn border border-ds-error/25 text-ds-error hover:bg-red-50"
                      aria-label={`Remover ${row.title}`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </li>
                ))}
          </ul>
          {mode === "prep_kit" ? (
            <div className="space-y-4 rounded-ds-btn border border-violet-200 bg-violet-50/50 p-4">
              <label className="block text-xs font-bold uppercase tracking-wide text-violet-900">
                {t("client.shipment.prepKitWorkType")}
                <select
                  value={prepKitWorkType}
                  onChange={(e) => setPrepKitWorkType(e.target.value as PrepKitWorkType)}
                  className="mt-2 w-full max-w-md rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 text-sm text-ds-text"
                >
                  <option value="split_bulk">{t("client.shipment.prepKitWork.split_bulk")}</option>
                  <option value="combine_stock">{t("client.shipment.prepKitWork.combine_stock")}</option>
                  <option value="custom">{t("client.shipment.prepKitWork.custom")}</option>
                </select>
              </label>
              <label className="block text-xs font-semibold text-ds-text">
                {t("client.shipment.prepKitInstructions")}
                <textarea
                  value={prepInstructions}
                  onChange={(e) => setPrepInstructions(e.target.value)}
                  rows={5}
                  placeholder={t("client.shipment.prepKitInstructionsPh")}
                  className="mt-2 w-full rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 text-sm text-ds-text"
                />
              </label>
              <label className="block text-xs font-semibold text-ds-muted">
                {t("client.shipment.prepKitOutputsNote")}
                <textarea
                  value={prepOutputsNote}
                  onChange={(e) => setPrepOutputsNote(e.target.value)}
                  rows={2}
                  placeholder={t("client.shipment.prepKitOutputsNotePh")}
                  className="mt-2 w-full rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 text-sm text-ds-text"
                />
              </label>
              <p className="text-xs leading-relaxed text-violet-950/90">{t("client.shipment.prepKitConfirmBlurb")}</p>
            </div>
          ) : mode === "amazon_fba" ? (
            <div className="space-y-5">
              <div className="rounded-ds-btn border border-ds-primary/20 bg-ds-soft-violet/30 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-ds-primary">Etapa 1 — FNSKU (obrigatório)</p>
                <label className="mt-2 block text-xs font-semibold text-ds-muted" htmlFor={`${uid}-fnsku`}>
                  Etiquetas com código FNSKU (barcode Amazon) para o prep aplicar em cada unidade
                </label>
                <input
                  id={`${uid}-fnsku`}
                  type="file"
                  multiple
                  accept={LABEL_FILE_ACCEPT}
                  onChange={onFnskuBatch}
                  className="mt-2 block w-full max-w-md text-sm text-ds-text file:mr-3 file:rounded-ds-btn file:border file:border-ds-border file:bg-ds-bg file:px-3 file:py-2 file:text-xs file:font-semibold file:text-ds-text hover:file:border-ds-primary/30"
                />
                <p className="mt-1 text-[11px] text-ds-muted">
                  Você pode selecionar vários arquivos (máx. {MAX_FNSKU_FILES}, cada um até ~1 MB). Sem FNSKU o sistema não
                  aceita o envio.
                </p>
                {fbaFnskuLabels.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {fbaFnskuLabels.map((f, i) => (
                      <li
                        key={`${f.name}-${i}`}
                        className="inline-flex max-w-full items-center gap-1 rounded-full border border-ds-border bg-ds-bg px-2 py-1 text-[11px] font-medium text-ds-text"
                      >
                        <a href={f.dataUrl} target="_blank" rel="noopener noreferrer" className="truncate text-ds-primary underline">
                          {f.name}
                        </a>
                        <button
                          type="button"
                          className="shrink-0 rounded px-1 text-ds-muted hover:text-ds-error"
                          aria-label={`Remover ${f.name}`}
                          onClick={() => setFbaFnskuLabels((prev) => prev.filter((_, j) => j !== i))}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="rounded-ds-btn border border-ds-border bg-ds-bg p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-ds-muted">Etapa 2 — Caixa master (opcional agora)</p>
                <p className="mt-1 text-[11px] text-ds-muted">
                  Depois do prep fechar as caixas e enviar peso/medidas, cria o envio no Seller Central. Se já tiver
                  as duas etiquetas, você pode enviar aqui; caso contrário use{" "}
                  <strong className="text-ds-text">«Completar etiquetas da caixa»</strong> no pedido, em Pedidos.
                </p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-ds-muted" htmlFor={`${uid}-fba-amz`}>
                      Etiqueta Amazon (Box Labels)
                    </label>
                    <input
                      id={`${uid}-fba-amz`}
                      type="file"
                      accept={LABEL_FILE_ACCEPT}
                      onChange={onFbaAmazonOptional}
                      className="mt-1 block w-full text-sm text-ds-text file:mr-2 file:rounded-ds-btn file:border file:border-ds-border file:bg-ds-surface file:px-2 file:py-1.5 file:text-[11px] file:font-semibold"
                    />
                    {fbaAmazonBox ? (
                      <p className="mt-1 text-[11px] text-ds-primary">
                        ✓ {fbaAmazonBox.name}{" "}
                        <button type="button" className="text-ds-muted underline" onClick={() => setFbaAmazonBox(null)}>
                          remover
                        </button>
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ds-muted" htmlFor={`${uid}-fba-carr`}>
                      Etiqueta transportadora (UPS / FedEx)
                    </label>
                    <input
                      id={`${uid}-fba-carr`}
                      type="file"
                      accept={LABEL_FILE_ACCEPT}
                      onChange={onFbaCarrierOptional}
                      className="mt-1 block w-full text-sm text-ds-text file:mr-2 file:rounded-ds-btn file:border file:border-ds-border file:bg-ds-surface file:px-2 file:py-1.5 file:text-[11px] file:font-semibold"
                    />
                    {fbaCarrier ? (
                      <p className="mt-1 text-[11px] text-ds-primary">
                        ✓ {fbaCarrier.name}{" "}
                        <button type="button" className="text-ds-muted underline" onClick={() => setFbaCarrier(null)}>
                          remover
                        </button>
                      </p>
                    ) : null}
                    {fbaCarrierParseLoading ? (
                      <p className="mt-2 text-[11px] text-ds-muted">A analisar PDF da transportadora…</p>
                    ) : null}
                    {fbaCarrierParsedTracking ? (
                      <div className="mt-2 rounded-ds-btn border border-ds-primary/25 bg-ds-bg px-2 py-2 text-[11px]">
                        <p className="font-bold text-ds-text">Rastreio (PDF transportadora)</p>
                        <p className="mt-0.5 text-ds-muted">
                          {fbaCarrierParsedTracking.carrierLabel} · {fbaCarrierParsedTracking.tracking}
                        </p>
                        <a
                          href={fbaCarrierParsedTracking.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block font-semibold text-ds-primary underline"
                        >
                          Abrir rastreamento
                        </a>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : mode === "intl_ml" ? (
            <div className="space-y-5">
              <div className="rounded-ds-card border-2 border-ds-soft-amber-border bg-ds-soft-amber p-4 shadow-ds ring-2 ring-amber-400/25">
                <label
                  className="block text-xs font-bold uppercase tracking-wide text-ds-soft-amber-icon"
                  htmlFor={`${uid}-intl-ml-ml`}
                >
                  {t("client.shipment.intlMlAmericasLabel")}
                </label>
                <input
                  id={`${uid}-intl-ml-ml`}
                  type="file"
                  accept={LABEL_FILE_ACCEPT}
                  onChange={onIntlMlAmericasFile}
                  className="mt-3 block w-full max-w-md text-sm text-ds-text file:mr-3 file:rounded-ds-btn file:border file:border-ds-border file:bg-white file:px-3 file:py-2 file:text-xs file:font-semibold file:text-ds-text hover:file:border-ds-primary/40"
                />
                {intlMlAmericasLabel ? (
                  <p className="mt-2 text-xs font-medium text-ds-primary">
                    {t("client.shipment.fileSelected")}: <span className="text-ds-text">{intlMlAmericasLabel.name}</span>{" "}
                    <button type="button" className="text-ds-muted underline" onClick={() => setIntlMlAmericasLabel(null)}>
                      {t("client.shipment.removeFile")}
                    </button>
                  </p>
                ) : null}
              </div>
              <div className="rounded-ds-card border-2 border-ds-primary/35 bg-ds-soft-violet/70 p-4 shadow-ds ring-2 ring-ds-primary/15">
                <label
                  className="block text-xs font-bold uppercase tracking-wide text-ds-primary"
                  htmlFor={`${uid}-intl-ml-carr`}
                >
                  {t("client.shipment.intlMlCarrierLabel")}
                </label>
                <input
                  id={`${uid}-intl-ml-carr`}
                  type="file"
                  accept={LABEL_FILE_ACCEPT}
                  onChange={onIntlMlCarrierFile}
                  className="mt-3 block w-full max-w-md text-sm text-ds-text file:mr-3 file:rounded-ds-btn file:border file:border-ds-border file:bg-white file:px-3 file:py-2 file:text-xs file:font-semibold file:text-ds-text hover:file:border-ds-primary/40"
                />
                {intlMlCarrierLabel ? (
                  <p className="mt-2 text-xs font-medium text-ds-primary">
                    {t("client.shipment.fileSelected")}: <span className="text-ds-text">{intlMlCarrierLabel.name}</span>{" "}
                    <button type="button" className="text-ds-muted underline" onClick={() => setIntlMlCarrierLabel(null)}>
                      {t("client.shipment.removeFile")}
                    </button>
                  </p>
                ) : null}
                {intlMlCarrierLabel && fbmParseLoading ? (
                  <p className="mt-2 text-[11px] text-ds-muted">A analisar o PDF da transportadora…</p>
                ) : null}
                {intlMlCarrierLabel && fbmParsedTracking ? (
                  <div className="mt-2 max-w-md rounded-ds-btn border border-ds-primary/25 bg-ds-soft-violet/25 px-3 py-2 text-[11px]">
                    <p className="font-bold text-ds-text">Rastreio detetado no PDF (transportadora)</p>
                    <p className="mt-1 text-ds-muted">
                      {fbmParsedTracking.carrierLabel} · <span className="font-mono">{fbmParsedTracking.tracking}</span>
                    </p>
                    <a
                      href={fbmParsedTracking.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block font-semibold text-ds-primary underline"
                    >
                      Abrir página da transportadora
                    </a>
                  </div>
                ) : null}
                {intlMlCarrierLabel &&
                !fbmParseLoading &&
                intlMlCarrierLabel.dataUrl.startsWith("data:application/pdf") &&
                !fbmParsedTracking ? (
                  <p className="mt-2 max-w-md text-[11px] leading-relaxed text-amber-900/90">
                    Não encontrámos rastreio conhecido no PDF da transportadora. O envio continua válido; o prep pode
                    confirmar manualmente.
                  </p>
                ) : null}
              </div>
              {!intlMlAmericasLabel || !intlMlCarrierLabel ? (
                <p className="text-[11px] text-ds-muted">{t("client.shipment.intlMlLabelsHint")}</p>
              ) : null}
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold text-ds-muted" htmlFor={`${uid}-shipping-label`}>
                Etiqueta de envio (obrigatório)
              </label>
              <input
                id={`${uid}-shipping-label`}
                type="file"
                accept={LABEL_FILE_ACCEPT}
                onChange={onShippingLabelFile}
                className="mt-2 block w-full max-w-md text-sm text-ds-text file:mr-3 file:rounded-ds-btn file:border file:border-ds-border file:bg-ds-bg file:px-3 file:py-2 file:text-xs file:font-semibold file:text-ds-text hover:file:border-ds-primary/30"
              />
              {shippingLabel ? (
                <p className="mt-2 text-xs font-medium text-ds-primary">
                  Arquivo selecionado: <span className="text-ds-text">{shippingLabel.name}</span>
                </p>
              ) : null}
              {shippingLabel && fbmParseLoading ? (
                <p className="mt-2 text-[11px] text-ds-muted">A analisar o PDF para transportadora e número de rastreio…</p>
              ) : null}
              {shippingLabel && fbmParsedTracking ? (
                <div className="mt-2 max-w-md rounded-ds-btn border border-ds-primary/25 bg-ds-soft-violet/25 px-3 py-2 text-[11px]">
                  <p className="font-bold text-ds-text">Rastreio detetado no PDF</p>
                  <p className="mt-1 text-ds-muted">
                    {fbmParsedTracking.carrierLabel} · <span className="font-mono">{fbmParsedTracking.tracking}</span>
                  </p>
                  <a
                    href={fbmParsedTracking.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block font-semibold text-ds-primary underline"
                  >
                    Abrir página da transportadora
                  </a>
                </div>
              ) : null}
              {shippingLabel && !fbmParseLoading && shippingLabel.dataUrl.startsWith("data:application/pdf") && !fbmParsedTracking ? (
                <p className="mt-2 max-w-md text-[11px] leading-relaxed text-amber-900/90">
                  Não encontrámos um número de rastreio conhecido no texto do PDF (etiquetas escaneadas ou layout
                  diferente). O envio continua válido; o prep pode confirmar manualmente.
                </p>
              ) : null}
              {!shippingLabel ? (
                <p className="mt-2 text-[11px] text-ds-muted">
                  Gere a etiqueta na ferramenta que você usa (ex.{" "}
                  <a
                    href={PIRATE_SHIP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-ds-primary underline underline-offset-2"
                  >
                    Pirate Ship
                  </a>
                  , eBay, Amazon, etc.) e envie aqui o PDF ou imagem. O prep vê o arquivo no admin — não é preciso
                  colar endereços neste passo.
                </p>
              ) : null}
            </div>
          )}
          <div className="rounded-ds-btn border border-ds-soft-amber-border bg-ds-soft-amber p-3 text-xs text-ds-soft-amber-icon">
            {mode === "amazon_fba" ? (
              <p>
                <strong className="text-ds-text">FBA:</strong> primeiro as etiquetas <strong className="text-ds-text">FNSKU</strong>{" "}
                para o prep preparar unidades; depois, com peso/medidas do prep, as etiquetas da{" "}
                <strong className="text-ds-text">caixa master</strong> (Amazon + transportadora) — aqui ou em «Pedidos».
              </p>
            ) : mode === "fbm" ? (
              <p>
                <strong className="text-ds-text">FBM:</strong> estoque com etiqueta na unidade; o arquivo acima é a
                etiqueta de envio <strong className="text-ds-text">própria</strong> até o cliente final (Amazon FBM,
                TikTok Shop, Shopify, Mercado Livre, eBay, Walmart, envio doméstico nos EUA, entre outros). Na tabela de
                prep, todas essas saídas usam o mesmo conceito «FBM».
              </p>
            ) : mode === "intl_ml" ? (
              <p>
                <strong className="text-ds-text">Mercado Livre internacional:</strong> envie as duas etiquetas acima
                (Mercado Livre Américas e transportadora); o prep consulta ambos no admin conforme o fluxo acordado.
              </p>
            ) : mode === "intl_br" ? (
              <p>
                <strong className="text-ds-text">Brasil:</strong> declaração e assinatura guardadas (demo) para alfândega;
                a etiqueta postal de envio EUA→Brasil é o arquivo que você carregou. Desembaraço oficial: Receita / Correios.
              </p>
            ) : mode === "prep_kit" ? (
              <p>
                <strong className="text-ds-text">Montagem / prep:</strong> {t("client.shipment.prepKitAmber")}
              </p>
            ) : null}
          </div>
          {pirateShipSuggestModes(mode) ? (
            <div className="rounded-ds-btn border border-ds-soft-sky-border bg-ds-soft-sky/60 p-3 text-xs text-ds-soft-sky-icon">
              <p className="text-ds-text">
                <strong className="text-ds-text">Etiquetas de envio (sugestão):</strong> para comprar etiquetas USPS
                (e envios postais comuns nos EUA) você pode usar a{" "}
                <a
                  href={PIRATE_SHIP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-ds-primary underline underline-offset-2"
                >
                  Pirate Ship
                </a>{" "}
                — <span className="tabular-nums">{PIRATE_SHIP_URL}</span>. É apenas uma sugestão para reduzir dúvidas;
                confirme sempre peso, medidas e transportadora com o prep.
              </p>
            </div>
          ) : null}
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="rounded-ds-btn border border-ds-border bg-ds-surface px-4 py-2.5 text-sm font-semibold text-ds-text shadow-ds disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
        >
          Anterior
        </button>
        {step < confirmStep ? (
          <button
            type="button"
            onClick={goNext}
            className="rounded-ds-btn bg-ds-primary px-4 py-2.5 text-sm font-bold text-white shadow-ds focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
          >
            Seguinte
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            className="rounded-ds-btn bg-cta-gradient px-5 py-2.5 text-sm font-bold text-white shadow-ds focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
          >
            {mode === "prep_kit" ? t("client.shipment.prepKitSubmit") : "Confirmar envio"}
          </button>
        )}
      </div>
    </div>
  );
}
