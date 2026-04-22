import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useClientProfile } from "../../context/ClientProfileContext";
import { useGrowthLandingStrings } from "../../hooks/useGrowthLandingStrings";
import {
  GROWTH_BUSINESS_MODELS,
  GROWTH_INVESTMENT_READINESS,
  GROWTH_PREP_CENTER_USAGE,
  GROWTH_PRODUCT_COUNT_BANDS,
  GROWTH_REVENUE_BANDS,
} from "../../lib/growthLeadQualificationSlugs";
import { postGrowthLeadIntake, postGrowthLandingConversionEvent } from "../../lib/growthProgramApi";

const STEPS = 3;

function emailOk(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export function GrowthProgramLeadForm() {
  const { tl } = useGrowthLandingStrings();
  const { profile } = useClientProfile();
  const suiteDefault = profile.suite?.trim() ?? "";

  const [step, setStep] = useState(0);
  const [businessModel, setBusinessModel] = useState("");
  const [monthlyRevenueBand, setMonthlyRevenueBand] = useState("");
  const [productCountBand, setProductCountBand] = useState("");
  const [biggestChallenge, setBiggestChallenge] = useState("");
  const [prepCenterUsage, setPrepCenterUsage] = useState("");
  const [investmentReadiness, setInvestmentReadiness] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [suite, setSuite] = useState(suiteDefault);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (suiteDefault) setSuite((s) => s || suiteDefault);
  }, [suiteDefault]);

  const challengeOk = biggestChallenge.trim().length >= 30;
  const step0Ok = businessModel && monthlyRevenueBand && productCountBand;
  const step1Ok = challengeOk && prepCenterUsage && investmentReadiness;
  const step2Ok = fullName.trim().length >= 2 && emailOk(email) && whatsapp.trim().length >= 6;

  const goNext = () => {
    setError(null);
    if (step === 0 && !step0Ok) {
      setError(tl("growth.lv2.formStep0Error"));
      return;
    }
    if (step === 1 && !step1Ok) {
      setError(tl("growth.lv2.formStep1Error"));
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS - 1));
  };

  const goBack = () => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sending || success) return;
    if (!step2Ok) {
      setError(tl("growth.lv2.formStep2Error"));
      return;
    }
    setError(null);
    postGrowthLandingConversionEvent("lead_intake_submit", suite.trim() || suiteDefault || undefined);
    setSending(true);
    void postGrowthLeadIntake({
      fullName: fullName.trim(),
      email: email.trim(),
      whatsapp: whatsapp.trim(),
      suite: suite.trim() || undefined,
      businessModel,
      monthlyRevenueBand,
      productCountBand,
      biggestChallenge: biggestChallenge.trim(),
      prepCenterUsage,
      investmentReadiness,
    }).then((r) => {
      setSending(false);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSuccess(true);
    });
  };

  const resetForm = () => {
    setSuccess(false);
    setStep(0);
    setBusinessModel("");
    setMonthlyRevenueBand("");
    setProductCountBand("");
    setBiggestChallenge("");
    setPrepCenterUsage("");
    setInvestmentReadiness("");
    setFullName("");
    setEmail("");
    setWhatsapp("");
    setSuite(suiteDefault);
    setError(null);
  };

  const field =
    "block w-full rounded-xl border border-ds-border bg-ds-bg px-3 py-2.5 text-sm text-ds-text shadow-sm outline-none transition placeholder:text-ds-muted/70 focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/20";
  const label = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-ds-muted";

  const opt = (prefix: string, slug: string) => (
    <option key={slug} value={slug}>
      {tl(`${prefix}.${slug}`)}
    </option>
  );

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-8 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-teal-600">{tl("growth.lv2.formKicker")}</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-ds-text sm:text-3xl">{tl("growth.lv2.formTitle")}</h2>
        </div>
        <div className="flex shrink-0 gap-1.5" aria-hidden>
          {Array.from({ length: STEPS }, (_, i) => (
            <span
              key={i}
              className={`h-2 w-8 rounded-full transition ${i <= step ? "bg-teal-500" : "bg-ds-border"}`}
            />
          ))}
        </div>
      </div>
      <p className="mb-8 text-sm font-medium leading-relaxed text-ds-muted">{tl("growth.lv2.formSubtitle")}</p>

      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-ds-bg px-6 py-10 text-center shadow-ds ring-1 ring-emerald-100">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
            <Check className="size-7" strokeWidth={2.5} aria-hidden />
          </div>
          <p className="mt-6 text-base font-bold leading-relaxed text-emerald-950 sm:text-lg">{tl("growth.lv2.formSuccess")}</p>
          <button
            type="button"
            onClick={resetForm}
            className="mt-8 text-sm font-bold text-teal-700 underline-offset-4 hover:underline"
          >
            {tl("growth.lv2.formAnother")}
          </button>
        </div>
      ) : (
        <form
          onSubmit={step === STEPS - 1 ? onSubmit : (e) => e.preventDefault()}
          className="rounded-2xl border border-ds-border bg-ds-surface p-5 shadow-ds ring-1 ring-ds-border/60 sm:p-8"
        >
          {error ? (
            <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900" role="alert">
              {error}
            </p>
          ) : null}

          {step === 0 ? (
            <div className="space-y-5">
              <p className="text-sm font-black text-ds-text">{tl("growth.lv2.formStep1Title")}</p>
              <div>
                <label className={label} htmlFor="bm">{tl("growth.lv2.formBusinessModel")}</label>
                <select id="bm" required className={field} value={businessModel} onChange={(e) => setBusinessModel(e.target.value)}>
                  <option value="">{tl("growth.lv2.formSelectPlaceholder")}</option>
                  {GROWTH_BUSINESS_MODELS.map((s) => opt("growth.lv2.funnel.opt.model", s))}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="rev">{tl("growth.lv2.formRevenue")}</label>
                <select id="rev" required className={field} value={monthlyRevenueBand} onChange={(e) => setMonthlyRevenueBand(e.target.value)}>
                  <option value="">{tl("growth.lv2.formSelectPlaceholder")}</option>
                  {GROWTH_REVENUE_BANDS.map((s) => opt("growth.lv2.funnel.opt.revenue", s))}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="pc">{tl("growth.lv2.formProductCount")}</label>
                <select id="pc" required className={field} value={productCountBand} onChange={(e) => setProductCountBand(e.target.value)}>
                  <option value="">{tl("growth.lv2.formSelectPlaceholder")}</option>
                  {GROWTH_PRODUCT_COUNT_BANDS.map((s) => opt("growth.lv2.funnel.opt.products", s))}
                </select>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-5">
              <p className="text-sm font-black text-ds-text">{tl("growth.lv2.formStep2Title")}</p>
              <div>
                <label className={label} htmlFor="ch">{tl("growth.lv2.formChallenge")}</label>
                <textarea
                  id="ch"
                  className={`${field} min-h-[140px] resize-y`}
                  value={biggestChallenge}
                  onChange={(e) => setBiggestChallenge(e.target.value)}
                  placeholder={tl("growth.lv2.formChallengePlaceholder")}
                />
                <p className={`mt-1.5 text-xs font-medium ${challengeOk ? "text-emerald-700" : "text-ds-muted"}`}>{tl("growth.lv2.formChallengeHint")}</p>
              </div>
              <div>
                <label className={label} htmlFor="prep">{tl("growth.lv2.formPrep")}</label>
                <select id="prep" required className={field} value={prepCenterUsage} onChange={(e) => setPrepCenterUsage(e.target.value)}>
                  <option value="">{tl("growth.lv2.formSelectPlaceholder")}</option>
                  {GROWTH_PREP_CENTER_USAGE.map((s) => opt("growth.lv2.funnel.opt.prep", s))}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="inv">{tl("growth.lv2.formInvestment")}</label>
                <select id="inv" required className={field} value={investmentReadiness} onChange={(e) => setInvestmentReadiness(e.target.value)}>
                  <option value="">{tl("growth.lv2.formSelectPlaceholder")}</option>
                  {GROWTH_INVESTMENT_READINESS.map((s) => opt("growth.lv2.funnel.opt.investment", s))}
                </select>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <p className="text-sm font-black text-ds-text">{tl("growth.lv2.formStep3Title")}</p>
              <div>
                <label className={label} htmlFor="nm">{tl("growth.lv2.formName")}</label>
                <input id="nm" className={field} value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" />
              </div>
              <div>
                <label className={label} htmlFor="em">{tl("growth.lv2.formEmail")}</label>
                <input id="em" type="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div>
                <label className={label} htmlFor="wa">{tl("growth.lv2.formWhatsapp")}</label>
                <input id="wa" type="tel" className={field} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} required autoComplete="tel" />
              </div>
              <div>
                <label className={label} htmlFor="su">{tl("growth.lv2.formSuite")}</label>
                <input id="su" className={field} value={suite} onChange={(e) => setSuite(e.target.value)} autoComplete="off" />
              </div>
            </div>
          ) : null}

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 0 || sending}
              className="inline-flex min-h-[48px] items-center justify-center gap-1 rounded-xl border border-ds-border bg-ds-bg px-4 py-3 text-sm font-bold text-ds-text transition hover:bg-ds-surface disabled:opacity-40"
            >
              <ChevronLeft className="size-4" aria-hidden />
              {tl("growth.lv2.formBack")}
            </button>
            {step < STEPS - 1 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={sending}
                className="inline-flex min-h-[48px] items-center justify-center gap-1 rounded-xl bg-teal-600 px-6 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-teal-600/25 transition hover:bg-teal-500"
              >
                {tl("growth.lv2.formNext")}
                <ChevronRight className="size-4" aria-hidden />
              </button>
            ) : (
              <button
                type="submit"
                disabled={sending || !step2Ok}
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-teal-600 px-6 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-teal-600/25 transition hover:bg-teal-500 disabled:pointer-events-none disabled:opacity-50"
              >
                {sending ? tl("growth.lv2.formSending") : tl("growth.lv2.formSubmit")}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
