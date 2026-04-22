import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, FileDown, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { PageHeader } from "../../ui/PageHeader";
import { useI18n } from "../../i18n/context";
import { LISTING_PLATFORM_IDS, type ListingPlatformId } from "../../../shared/listingGenerator";
import { isValidHttpListingUrl } from "../../../shared/listingUrlInput";
import { postListingGenerator, type GeneratedListing, type ListingGeneratorPayload } from "../../lib/aiListingGeneratorApi";
import { downloadListingExcel } from "../../lib/listingExportXlsx";
import { cn } from "../../lib/cn";

const inputClass =
  "mt-1 w-full rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 text-sm text-ds-text shadow-ds placeholder:text-ds-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ds-primary";

const MIN_CHARS = 80;

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

type InputTab = "url" | "paste";

export function ClientImproveListingPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<InputTab>("url");
  const [productUrl, setProductUrl] = useState("");
  const [listingTitle, setListingTitle] = useState("");
  const [listingBullets, setListingBullets] = useState("");
  const [listingDescription, setListingDescription] = useState("");
  const [optionalNotes, setOptionalNotes] = useState("");
  const [platform, setPlatform] = useState<ListingPlatformId>(defaultPlatform);
  const [brandOwner, setBrandOwner] = useState(false);
  const [internationalProduct, setInternationalProduct] = useState(false);
  const [busy, setBusy] = useState(false);
  const [listing, setListing] = useState<GeneratedListing | null>(null);
  const [mode, setMode] = useState<"live" | "demo" | null>(null);
  const [warnBanner, setWarnBanner] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

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

  const pastedLen = `${listingTitle}\n${listingBullets}\n${listingDescription}`.trim().length;

  const run = async () => {
    const notes = optionalNotes.trim() ? { existingListing: optionalNotes.trim() } : {};
    const core = {
      productName: "",
      productDescription: "",
      platform,
      targetAudience: "",
      mainBenefit: "",
      productDifferentiation: "",
      brandOwner: isMercadoIntl && brandOwner,
      internationalProduct: isMercadoIntl && internationalProduct,
      ...notes,
    };

    if (tab === "url") {
      const u = productUrl.trim();
      if (!isValidHttpListingUrl(u)) {
        toast.error(t("client.improveListing.validationUrl"));
        return;
      }
      const payload: ListingGeneratorPayload = {
        ...core,
        productUrl: u,
        operation: "improve_existing",
      };
      setBusy(true);
      setWarnBanner(null);
      try {
        const r = await postListingGenerator(payload);
        if (!r.ok) {
          toast.error(r.error);
          setListing(null);
          setMode(null);
          return;
        }
        setListing(r.listing);
        setMode(r.mode);
        if (r.warn) setWarnBanner(r.warn);
        toast.success(r.mode === "live" ? t("client.improveListing.toastLive") : t("client.improveListing.toastDemo"));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (pastedLen < MIN_CHARS) {
      toast.error(t("client.improveListing.validationMin", { n: MIN_CHARS }));
      return;
    }
    const payload: ListingGeneratorPayload = {
      ...core,
      productUrl: "",
      operation: "improve_pasted",
      listingTitle,
      listingBullets,
      listingDescription,
    };
    setBusy(true);
    setWarnBanner(null);
    try {
      const r = await postListingGenerator(payload);
      if (!r.ok) {
        toast.error(r.error);
        setListing(null);
        setMode(null);
        return;
      }
      setListing(r.listing);
      setMode(r.mode);
      if (r.warn) setWarnBanner(r.warn);
      toast.success(r.mode === "live" ? t("client.improveListing.toastLive") : t("client.improveListing.toastDemo"));
    } finally {
      setBusy(false);
    }
  };

  const onDownloadExcel = () => {
    if (!listing) return;
    try {
      downloadListingExcel({
        listing,
        platform,
        operationLabel: t("client.improveListing.pageTitle"),
        fileBase: "listagem-melhorada-dbx",
      });
      toast.success(t("client.listingGenerator.excelDownloaded"));
    } catch {
      toast.error(t("client.listingGenerator.excelFail"));
    }
  };

  const tabBtn = (id: InputTab, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      className={cn(
        "rounded-ds-btn px-3 py-2 text-xs font-bold uppercase tracking-wide transition",
        tab === id ? "bg-ds-primary text-white shadow-ds" : "bg-ds-bg text-ds-muted ring-1 ring-ds-border hover:text-ds-text",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow={t("client.improveListing.eyebrow")}
        title={t("client.improveListing.pageTitle")}
        subtitle={t("client.improveListing.subtitle")}
        actions={<LanguageSwitcher />}
      />

      <p className="text-sm text-ds-muted">
        <Link to="/app/dashboard" className="font-semibold text-ds-primary underline-offset-2 hover:underline">
          {t("client.improveListing.backDashboard")}
        </Link>
        {" · "}
        <Link to="/app/tools" className="font-semibold text-ds-primary underline-offset-2 hover:underline">
          {t("client.improveListing.linkTools")}
        </Link>
        {" · "}
        <Link to="/app/listing-generator" className="font-semibold text-ds-primary underline-offset-2 hover:underline">
          {t("client.improveListing.linkGenerator")}
        </Link>
        {" · "}
        <Link to="/app/listing-analysis" className="font-semibold text-ds-primary underline-offset-2 hover:underline">
          {t("client.improveListing.linkAnalysis")}
        </Link>
      </p>

      <div className="rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds">
        <p className="text-sm leading-relaxed text-ds-muted">{t("client.improveListing.intro")}</p>

        <div className="mt-4 flex flex-wrap gap-2" role="tablist">
          {tabBtn("url", t("client.improveListing.tabUrl"))}
          {tabBtn("paste", t("client.improveListing.tabPaste"))}
        </div>

        <div className="mt-4 grid gap-4">
          <label className="block text-xs font-bold uppercase tracking-wide text-ds-muted">
            {t("client.improveListing.platformLabel")}
            <select className={inputClass} value={platform} onChange={(e) => setPlatform(e.target.value as ListingPlatformId)}>
              {LISTING_PLATFORM_IDS.map((id) => (
                <option key={id} value={id}>
                  {t(`client.listingGenerator.platform.${id}`)}
                </option>
              ))}
            </select>
          </label>

          {tab === "url" ? (
            <label className="block text-xs font-bold uppercase tracking-wide text-ds-muted">
              {t("client.improveListing.listingUrlLabel")}
              <input
                className={inputClass}
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                placeholder={t("client.listingGenerator.improveUrlPh")}
                inputMode="url"
                autoComplete="url"
                maxLength={2048}
              />
            </label>
          ) : (
            <>
              <label className="block text-xs font-bold uppercase tracking-wide text-ds-muted">
                {t("client.improveListing.currentTitle")}
                <input className={inputClass} value={listingTitle} onChange={(e) => setListingTitle(e.target.value)} placeholder={t("client.improveListing.currentTitlePh")} maxLength={2000} />
              </label>

              <label className="block text-xs font-bold uppercase tracking-wide text-ds-muted">
                {t("client.improveListing.currentBullets")}
                <textarea
                  className={`${inputClass} min-h-[140px] resize-y font-mono text-xs`}
                  value={listingBullets}
                  onChange={(e) => setListingBullets(e.target.value)}
                  placeholder={t("client.improveListing.currentBulletsPh")}
                  maxLength={12000}
                />
              </label>

              <label className="block text-xs font-bold uppercase tracking-wide text-ds-muted">
                {t("client.improveListing.currentDescription")}
                <textarea
                  className={`${inputClass} min-h-[160px] resize-y`}
                  value={listingDescription}
                  onChange={(e) => setListingDescription(e.target.value)}
                  placeholder={t("client.improveListing.currentDescriptionPh")}
                  maxLength={24000}
                />
              </label>

              <p className="text-xs text-ds-muted">{t("client.improveListing.charCount", { current: pastedLen, min: MIN_CHARS })}</p>
            </>
          )}

          <label className="block text-xs font-bold uppercase tracking-wide text-ds-muted">
            {t("client.improveListing.optionalNotes")}
            <textarea className={`${inputClass} min-h-[72px] resize-y`} value={optionalNotes} onChange={(e) => setOptionalNotes(e.target.value)} placeholder={t("client.improveListing.optionalNotesPh")} maxLength={8000} />
          </label>

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
          onClick={() => void run()}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-ds-btn bg-ds-primary px-4 py-3 text-sm font-bold text-white shadow-ds hover:opacity-95 disabled:opacity-50 sm:w-auto"
        >
          <Sparkles className="size-4" aria-hidden />
          {busy ? t("common.loading") : t("client.improveListing.submit")}
        </button>
      </div>

      {mode === "demo" && !warnBanner ? (
        <div className="rounded-ds-card border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm text-amber-950">{t("client.improveListing.demoBanner")}</div>
      ) : null}
      {mode === "live" ? (
        <div className="rounded-ds-card border border-emerald-200/90 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">{t("client.improveListing.liveBanner")}</div>
      ) : null}
      {warnBanner ? (
        <div className="rounded-ds-card border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {t("client.improveListing.warnFallback")} <span className="font-mono text-xs opacity-90">{warnBanner}</span>
        </div>
      ) : null}

      {listing ? (
        <section className="space-y-4" aria-labelledby="improve-out-heading">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="improve-out-heading" className="text-lg font-bold tracking-tight text-ds-text">
              {t("client.improveListing.outputTitle")}
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
            <CopyBlock label={t("client.listingGenerator.shopifySubheadlineLabel")} text={listing.subheadline} copiedKey="subheadline" copied={copied} onCopy={onCopy} />
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
