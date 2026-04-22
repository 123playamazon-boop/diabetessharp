import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, FileDown, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { PageHeader } from "../../ui/PageHeader";
import { useI18n } from "../../i18n/context";
import { LISTING_PLATFORM_IDS, type ListingGeneratorOperation, type ListingPlatformId } from "../../../shared/listingGenerator";
import {
  postListingGenerator,
  type GeneratedListing,
  type ListingGeneratorPayload,
} from "../../lib/aiListingGeneratorApi";
import { downloadListingExcel } from "../../lib/listingExportXlsx";

const inputClass =
  "mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 text-sm text-ds-text shadow-ds placeholder:text-ds-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ds-primary";

function isValidImproveUrlClient(raw: string): boolean {
  const u = raw.trim();
  if (u.length < 12 || u.length > 2048) return false;
  try {
    const x = new URL(u);
    return x.protocol === "http:" || x.protocol === "https:";
  } catch {
    return false;
  }
}

function CopyBlock({
  label,
  text,
  copiedKey,
  copied,
  onCopy,
}: {
  label: string;
  text: string;
  copiedKey: string;
  copied: string | null;
  onCopy: (k: string, t: string) => void;
}) {
  return (
    <div className="rounded-ds-btn border border-ds-border bg-ds-bg/80 p-4 shadow-ds">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-ds-muted">{label}</h3>
        <button
          type="button"
          onClick={() => void onCopy(copiedKey, text)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-ds-btn border border-ds-border bg-ds-surface px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-ds-text shadow-ds hover:bg-ds-bg"
        >
          {copied === copiedKey ? <Check className="size-3.5 text-ds-success" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        </button>
      </div>
      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-ds-text">{text}</pre>
    </div>
  );
}

const defaultPlatform: ListingPlatformId = "amazon_us";

export function ClientAiListingGeneratorPage() {
  const { t } = useI18n();
  const [listingOperation, setListingOperation] = useState<ListingGeneratorOperation>("generate");
  const [existingListing, setExistingListing] = useState("");
  const [productName, setProductName] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [platform, setPlatform] = useState<ListingPlatformId>(defaultPlatform);
  const [targetAudience, setTargetAudience] = useState("");
  const [mainBenefit, setMainBenefit] = useState("");
  const [productDifferentiation, setProductDifferentiation] = useState("");
  const [brandOwner, setBrandOwner] = useState(false);
  const [internationalProduct, setInternationalProduct] = useState(false);
  const [busy, setBusy] = useState(false);
  const [listing, setListing] = useState<GeneratedListing | null>(null);
  const [mode, setMode] = useState<"live" | "demo" | null>(null);
  const [warnBanner, setWarnBanner] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [lastOperation, setLastOperation] = useState<ListingGeneratorOperation | null>(null);

  const isMercadoIntl = platform === "mercado_livre_intl";

  useEffect(() => {
    if (!isMercadoIntl) {
      setBrandOwner(false);
      setInternationalProduct(false);
    }
  }, [isMercadoIntl]);

  const onCopy = useCallback(
    async (key: string, text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(key);
        window.setTimeout(() => setCopied(null), 2000);
        toast.success(t("client.listingGenerator.copied"));
      } catch {
        toast.error(t("client.listingGenerator.copyFail"));
      }
    },
    [t],
  );

  const onDownloadExcel = () => {
    if (!listing) return;
    const op = lastOperation ?? listingOperation;
    const opLabel = op === "improve_existing" ? t("client.listingGenerator.operationImprove") : t("client.listingGenerator.operationGenerate");
    try {
      downloadListingExcel({
        listing,
        platform,
        operationLabel: opLabel,
        fileBase: "listagem-ia-dbx",
      });
      toast.success(t("client.listingGenerator.excelDownloaded"));
    } catch {
      toast.error(t("client.listingGenerator.excelFail"));
    }
  };

  const generate = async () => {
    if (listingOperation === "improve_existing") {
      if (!isValidImproveUrlClient(productUrl)) {
        toast.error(t("client.listingGenerator.validationImproveUrl"));
        return;
      }
    } else if (!productName.trim() && !productUrl.trim() && !productDescription.trim()) {
      toast.error(t("client.listingGenerator.validationContext"));
      return;
    }

    const payload: ListingGeneratorPayload =
      listingOperation === "improve_existing"
        ? {
            productName: "",
            productUrl: productUrl.trim(),
            productDescription: "",
            platform,
            targetAudience: "",
            mainBenefit: "",
            productDifferentiation: "",
            brandOwner: isMercadoIntl && brandOwner,
            internationalProduct: isMercadoIntl && internationalProduct,
            operation: "improve_existing",
            existingListing: existingListing.trim(),
          }
        : {
            productName,
            productUrl,
            productDescription,
            platform,
            targetAudience,
            mainBenefit,
            productDifferentiation,
            brandOwner: isMercadoIntl && brandOwner,
            internationalProduct: isMercadoIntl && internationalProduct,
            operation: "generate",
          };

    setBusy(true);
    setWarnBanner(null);
    try {
      const r = await postListingGenerator(payload);
      if (!r.ok) {
        toast.error(r.error);
        setListing(null);
        setMode(null);
        setLastOperation(null);
        return;
      }
      setListing(r.listing);
      setMode(r.mode);
      setLastOperation(r.listingOperation ?? listingOperation);
      if (r.warn) setWarnBanner(r.warn);
      toast.success(r.mode === "live" ? t("client.listingGenerator.toastLive") : t("client.listingGenerator.toastDemo"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow={t("client.listingGenerator.eyebrow")}
        title={t("client.listingGenerator.title")}
        subtitle={t("client.listingGenerator.subtitle")}
        actions={<LanguageSwitcher />}
      />

      <p className="text-sm text-ds-muted">
        <Link to="/app/dashboard" className="font-semibold text-ds-primary underline-offset-2 hover:underline">
          {t("client.listingGenerator.backDashboard")}
        </Link>
        {" · "}
        <Link to="/app/tools" className="font-semibold text-ds-primary underline-offset-2 hover:underline">
          {t("client.nav.tools")}
        </Link>
        {" · "}
        <Link to="/ai-listing-plans" className="font-semibold text-ds-primary underline-offset-2 hover:underline">
          {t("client.listingGenerator.pricingPlansLink")}
        </Link>
        {" · "}
        <Link to="/app/improve-listing" className="font-semibold text-ds-primary underline-offset-2 hover:underline">
          {t("client.listingGenerator.linkImprovePaste")}
        </Link>
      </p>

      <div className="rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds">
        <div className="grid gap-4 sm:grid-cols-1">
          <fieldset className="space-y-2">
            <legend className="block text-xs font-bold uppercase tracking-wide text-ds-muted">{t("client.listingGenerator.operationLabel")}</legend>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ds-text">
                <input
                  type="radio"
                  name="listing-op"
                  checked={listingOperation === "generate"}
                  onChange={() => setListingOperation("generate")}
                  className="size-4 border-ds-border text-ds-primary"
                />
                {t("client.listingGenerator.operationGenerate")}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ds-text">
                <input
                  type="radio"
                  name="listing-op"
                  checked={listingOperation === "improve_existing"}
                  onChange={() => setListingOperation("improve_existing")}
                  className="size-4 border-ds-border text-ds-primary"
                />
                {t("client.listingGenerator.operationImprove")}
              </label>
            </div>
          </fieldset>

          {listingOperation === "improve_existing" ? (
            <>
              <label className="block text-xs font-bold uppercase tracking-wide text-ds-muted">
                {t("client.listingGenerator.improveUrlLabel")}
                <input
                  className={inputClass}
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  placeholder={t("client.listingGenerator.improveUrlPh")}
                  maxLength={2048}
                  inputMode="url"
                  autoComplete="url"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-ds-muted">
                {t("client.listingGenerator.improveNotesLabel")}
                <textarea
                  className={`${inputClass} min-h-[100px] resize-y`}
                  value={existingListing}
                  onChange={(e) => setExistingListing(e.target.value)}
                  placeholder={t("client.listingGenerator.improveNotesPh")}
                  maxLength={8000}
                />
                <span className="mt-1 block text-xs text-ds-muted">{t("client.listingGenerator.improveNotesHint")}</span>
              </label>
            </>
          ) : (
            <>
              <label className="block text-xs font-bold uppercase tracking-wide text-ds-muted">
                {t("client.listingGenerator.productNameLabel")}
                <input className={inputClass} value={productName} onChange={(e) => setProductName(e.target.value)} placeholder={t("client.listingGenerator.productNamePh")} maxLength={300} />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-ds-muted">
                {t("client.listingGenerator.productUrlLabel")}
                <input className={inputClass} value={productUrl} onChange={(e) => setProductUrl(e.target.value)} placeholder={t("client.listingGenerator.productUrlPh")} maxLength={2000} />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-ds-muted">
                {t("client.listingGenerator.productDescLabel")}
                <textarea
                  className={`${inputClass} min-h-[100px] resize-y`}
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder={t("client.listingGenerator.productDescPh")}
                  maxLength={8000}
                />
              </label>
              <p className="text-xs text-ds-muted">{t("client.listingGenerator.contextHint")}</p>
            </>
          )}

          <label className="block text-xs font-bold uppercase tracking-wide text-ds-muted">
            {t("client.listingGenerator.platformLabel")}
            <select className={inputClass} value={platform} onChange={(e) => setPlatform(e.target.value as ListingPlatformId)}>
              {LISTING_PLATFORM_IDS.map((id) => (
                <option key={id} value={id}>
                  {t(`client.listingGenerator.platform.${id}`)}
                </option>
              ))}
            </select>
          </label>

          {listingOperation === "generate" ? (
            <>
              <label className="block text-xs font-bold uppercase tracking-wide text-ds-muted">
                {t("client.listingGenerator.audienceLabel")}
                <input className={inputClass} value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} placeholder={t("client.listingGenerator.audiencePh")} maxLength={500} />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-ds-muted">
                {t("client.listingGenerator.benefitLabel")}
                <input className={inputClass} value={mainBenefit} onChange={(e) => setMainBenefit(e.target.value)} placeholder={t("client.listingGenerator.benefitPh")} maxLength={500} />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-ds-muted">
                {t("client.listingGenerator.diffLabel")}
                <textarea className={`${inputClass} min-h-[80px] resize-y`} value={productDifferentiation} onChange={(e) => setProductDifferentiation(e.target.value)} placeholder={t("client.listingGenerator.diffPh")} maxLength={2000} />
              </label>
            </>
          ) : null}

          {isMercadoIntl ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ds-text">
                <input type="checkbox" checked={brandOwner} onChange={(e) => setBrandOwner(e.target.checked)} className="size-4 rounded border-ds-border text-ds-primary" />
                {t("client.listingGenerator.brandOwner")}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ds-text">
                <input type="checkbox" checked={internationalProduct} onChange={(e) => setInternationalProduct(e.target.checked)} className="size-4 rounded border-ds-border text-ds-primary" />
                {t("client.listingGenerator.intlProduct")}
              </label>
            </div>
          ) : (
            <p className="text-xs text-ds-muted">{t("client.listingGenerator.mercadoOnlyFlagsHint")}</p>
          )}
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void generate()}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-ds-btn bg-ds-primary px-4 py-3 text-sm font-bold text-white shadow-ds hover:opacity-95 disabled:opacity-50 sm:w-auto"
        >
          <Sparkles className="size-4" aria-hidden />
          {busy ? t("common.loading") : listingOperation === "improve_existing" ? t("client.listingGenerator.submitImprove") : t("client.listingGenerator.generate")}
        </button>
      </div>

      {mode === "demo" && !warnBanner ? (
        <div className="rounded-ds-card border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm text-amber-950">{t("client.listingGenerator.demoBanner")}</div>
      ) : null}
      {mode === "live" ? (
        <div className="rounded-ds-card border border-emerald-200/90 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">{t("client.listingGenerator.liveBanner")}</div>
      ) : null}
      {warnBanner ? (
        <div className="rounded-ds-card border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {t("client.listingGenerator.warnFallback")} <span className="font-mono text-xs opacity-90">{warnBanner}</span>
        </div>
      ) : null}

      {listing ? (
        <section className="space-y-4" aria-labelledby="listing-output-heading">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="listing-output-heading" className="text-lg font-bold tracking-tight text-ds-text">
              {t("client.listingGenerator.outputTitle")}
            </h2>
            <button
              type="button"
              onClick={onDownloadExcel}
              className="inline-flex items-center justify-center gap-2 rounded-ds-btn border border-ds-border bg-ds-surface px-4 py-2.5 text-sm font-bold text-ds-text shadow-ds hover:bg-ds-bg"
            >
              <FileDown className="size-4" aria-hidden />
              {t("client.listingGenerator.downloadExcel")}
            </button>
          </div>
          <CopyBlock
            label={t(
              platform === "tiktok_shop_us"
                ? "client.listingGenerator.tiktokScrollTitle"
                : platform === "shopify"
                  ? "client.listingGenerator.shopifyHeadlineLabel"
                  : "client.listingGenerator.sectionTitle",
            )}
            text={listing.title}
            copiedKey="title"
            copied={copied}
            onCopy={onCopy}
          />
          {platform === "tiktok_shop_us" && listing.hook ? (
            <CopyBlock label={t("client.listingGenerator.tiktokHookLabel")} text={listing.hook} copiedKey="hook" copied={copied} onCopy={onCopy} />
          ) : null}
          {platform === "shopify" && listing.subheadline ? (
            <CopyBlock
              label={t("client.listingGenerator.shopifySubheadlineLabel")}
              text={listing.subheadline}
              copiedKey="subheadline"
              copied={copied}
              onCopy={onCopy}
            />
          ) : null}
          {platform === "shopify" && listing.callToAction ? (
            <CopyBlock label={t("client.listingGenerator.shopifyCtaLabel")} text={listing.callToAction} copiedKey="cta" copied={copied} onCopy={onCopy} />
          ) : null}
          <div className="rounded-ds-btn border border-ds-border bg-ds-bg/80 p-4 shadow-ds">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-ds-muted">
                {t(
                  platform === "tiktok_shop_us"
                    ? "client.listingGenerator.tiktokBulletsLabel"
                    : platform === "shopify"
                      ? "client.listingGenerator.shopifyBulletsLabel"
                      : "client.listingGenerator.sectionBullets",
                )}
              </h3>
              <button
                type="button"
                onClick={() => void onCopy("bullets", listing.bulletPoints.map((b) => `• ${b}`).join("\n"))}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-ds-btn border border-ds-border bg-ds-surface px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-ds-text shadow-ds hover:bg-ds-bg"
              >
                {copied === "bullets" ? <Check className="size-3.5 text-ds-success" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
              </button>
            </div>
            <ul className="mt-3 list-inside list-disc space-y-2 text-sm leading-relaxed text-ds-text">
              {listing.bulletPoints.map((b, idx) => (
                <li key={`${idx}-${b.slice(0, 24)}`}>{b}</li>
              ))}
            </ul>
          </div>
          <CopyBlock
            label={t(
              platform === "tiktok_shop_us"
                ? "client.listingGenerator.tiktokDescriptionLabel"
                : platform === "shopify"
                  ? "client.listingGenerator.shopifyDescriptionLabel"
                  : "client.listingGenerator.sectionDescription",
            )}
            text={listing.description}
            copiedKey="desc"
            copied={copied}
            onCopy={onCopy}
          />
          <CopyBlock
            label={t(platform === "amazon_us" ? "client.listingGenerator.sectionKeywordsAmazon" : "client.listingGenerator.sectionKeywords")}
            text={listing.keywords}
            copiedKey="kw"
            copied={copied}
            onCopy={onCopy}
          />
        </section>
      ) : null}
    </div>
  );
}
