import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, Sparkles, Users, Zap } from "lucide-react";
import { useClientProfile } from "../../context/ClientProfileContext";
import { useI18n } from "../../i18n/context";
import { GrowthLandingAnchor, GrowthLandingCta } from "../../components/growth/GrowthLandingCta";
import { GrowthProgramLeadForm } from "../../components/growth/GrowthProgramLeadForm";
import { useGrowthLandingStrings } from "../../hooks/useGrowthLandingStrings";
import { postGrowthLandingConversionEvent } from "../../lib/growthProgramApi";

function SectionShell({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={className}>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">{children}</div>
    </section>
  );
}

const audienceKeys = ["oa", "wholesale", "pl", "dropship"] as const;

export function ClientGrowthProgramLandingPage() {
  const { t } = useI18n();
  const { tl } = useGrowthLandingStrings();
  const { profile } = useClientProfile();
  const suite = profile.suite;
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    postGrowthLandingConversionEvent("landing_view", suite);
  }, [suite]);

  const problems = ["problem1", "problem2", "problem3", "problem4"] as const;
  const serviceLines = ["serviceLine1", "serviceLine2", "serviceLine3", "serviceLine4", "serviceLine5"] as const;
  const howSteps = ["how1", "how2", "how3", "how4"] as const;
  const trust = ["trust1", "trust2", "trust3"] as const;

  return (
    <div className="pb-20">
      <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
        <Link
          to="/app/dashboard"
          className="inline-flex items-center gap-1 text-sm font-semibold text-ds-muted transition hover:text-ds-primary"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {t("growth.landing.back")}
        </Link>
      </div>

      {/* Hero */}
      <section className="relative mt-6 overflow-hidden border-b border-white/10 bg-gradient-to-br from-zinc-950 via-slate-950 to-teal-950 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(45,212,191,0.22),transparent)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(0,0,0,0.45))]" />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:py-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-teal-200/95">
            <Zap className="size-3.5 text-teal-300" aria-hidden />
            {tl("growth.lv2.heroKicker")}
          </div>
          <h1 className="mt-6 max-w-4xl text-[1.6rem] font-black leading-[1.1] tracking-tight sm:text-4xl lg:text-[2.65rem]">
            {tl("growth.lv2.heroHook")}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg">{tl("growth.lv2.heroValue")}</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <GrowthLandingAnchor
              href="#contacto"
              placement="hero_primary_plan"
              suite={suite}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-teal-400 px-6 py-3.5 text-center text-sm font-black uppercase tracking-wide text-zinc-950 shadow-lg shadow-teal-500/25 transition hover:bg-teal-300"
            >
              {tl("growth.lv2.heroCta")}
              <ArrowRight className="size-4 shrink-0" aria-hidden />
            </GrowthLandingAnchor>
            <GrowthLandingAnchor
              href="#how"
              placement="hero_secondary_how"
              suite={suite}
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/25 bg-white/5 px-6 py-3.5 text-center text-sm font-bold text-white backdrop-blur transition hover:bg-white/10"
            >
              {tl("growth.lv2.heroSecondary")}
            </GrowthLandingAnchor>
          </div>
          <p className="mt-8 max-w-2xl text-xs leading-relaxed text-zinc-400 sm:text-sm">{tl("growth.lv2.heroFootnote")}</p>
        </div>
      </section>

      {/* Target audience */}
      <SectionShell className="border-b border-ds-border bg-ds-bg">
        <div className="flex flex-wrap items-center gap-2 text-teal-700">
          <Users className="size-5 shrink-0" aria-hidden />
          <span className="text-xs font-black uppercase tracking-widest">{tl("growth.lv2.audienceKicker")}</span>
        </div>
        <h2 className="mt-3 max-w-3xl text-2xl font-black tracking-tight text-ds-text sm:text-3xl">{tl("growth.lv2.audienceTitle")}</h2>
        <p className="mt-3 max-w-2xl text-sm font-medium text-ds-muted sm:text-base">{tl("growth.lv2.audienceLead")}</p>
        <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {audienceKeys.map((k) => (
            <li
              key={k}
              className="flex min-h-[88px] items-center justify-center rounded-2xl border border-ds-border bg-ds-surface px-3 py-4 text-center text-xs font-black uppercase leading-snug tracking-wide text-ds-text shadow-sm ring-1 ring-ds-border/70 sm:text-sm"
            >
              {tl(`growth.lv2.audience.${k}`)}
            </li>
          ))}
        </ul>
      </SectionShell>

      {/* Problems */}
      <SectionShell id="problemas" className="scroll-mt-20 bg-ds-surface">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 text-rose-600">
            <Sparkles className="size-5" aria-hidden />
            <span className="text-xs font-black uppercase tracking-widest">{tl("growth.lv2.problemKicker")}</span>
          </div>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-ds-text sm:text-3xl">{tl("growth.lv2.problemTitle")}</h2>
          <p className="mt-3 text-sm font-medium text-ds-muted sm:text-base">{tl("growth.lv2.problemLead")}</p>
        </div>
        <ul className="mt-10 grid gap-3 sm:grid-cols-2">
          {problems.map((k) => (
            <li
              key={k}
              className="rounded-2xl border border-ds-border bg-ds-bg p-5 text-sm font-bold leading-snug text-ds-text shadow-sm ring-1 ring-ds-border/60 sm:text-base"
            >
              {tl(`growth.lv2.${k}`)}
            </li>
          ))}
        </ul>
      </SectionShell>

      {/* Value promise */}
      <SectionShell className="border-y border-ds-border bg-gradient-to-b from-teal-50/80 to-ds-bg">
        <div className="mx-auto max-w-3xl rounded-2xl border border-teal-200/80 bg-ds-surface px-6 py-10 text-center shadow-ds sm:px-10">
          <h2 className="text-xl font-black tracking-tight text-ds-text sm:text-2xl">{tl("growth.lv2.valueTitle")}</h2>
          <p className="mt-4 text-sm font-semibold leading-relaxed text-ds-muted sm:text-base">{tl("growth.lv2.valueBody")}</p>
          <div className="mt-8 rounded-xl border border-ds-border bg-ds-bg/80 px-4 py-4 text-left sm:px-5">
            <p className="text-xs font-black uppercase tracking-widest text-teal-800">{tl("growth.lv2.strategyAiBannerKicker")}</p>
            <p className="mt-2 text-sm font-bold text-ds-text">{tl("growth.lv2.strategyAiBannerTitle")}</p>
            <p className="mt-1 text-xs leading-relaxed text-ds-muted sm:text-sm">{tl("growth.lv2.strategyAiBannerBody")}</p>
            <Link
              to="/app/growth-program/strategy-ai"
              className="mt-4 inline-flex text-sm font-black uppercase tracking-wide text-ds-primary underline-offset-4 hover:underline"
            >
              {tl("growth.lv2.strategyAiBannerCta")} →
            </Link>
          </div>
        </div>
      </SectionShell>

      {/* Services */}
      <SectionShell className="bg-ds-bg">
        <h2 className="text-2xl font-black tracking-tight text-ds-text sm:text-3xl">{tl("growth.lv2.servicesTitle")}</h2>
        <ul className="mt-8 max-w-3xl space-y-3">
          {serviceLines.map((k) => (
            <li key={k} className="flex items-start gap-3 text-sm font-semibold text-ds-text sm:text-base">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-teal-500" aria-hidden />
              {tl(`growth.lv2.${k}`)}
            </li>
          ))}
        </ul>
      </SectionShell>

      {/* Qualification form */}
      <SectionShell id="contacto" className="scroll-mt-20 border-t border-ds-border bg-ds-surface">
        <h2 className="text-2xl font-black tracking-tight text-ds-text sm:text-3xl">{tl("growth.lv2.qualIntroTitle")}</h2>
        <p className="mt-3 max-w-2xl text-sm text-ds-muted sm:text-base">{tl("growth.lv2.qualIntroBody")}</p>
        <div className="mt-10">
          <GrowthProgramLeadForm />
        </div>
        <GrowthLandingAnchor
          href="#how"
          placement="form_scroll_how"
          suite={suite}
          className="mt-10 inline-flex text-sm font-bold text-ds-primary underline-offset-4 hover:underline"
        >
          {tl("growth.lv2.howAnchor")} →
        </GrowthLandingAnchor>
      </SectionShell>

      {/* How */}
      <SectionShell id="how" className="scroll-mt-20 bg-ds-bg">
        <h2 className="text-2xl font-black tracking-tight text-ds-text sm:text-3xl">{tl("growth.lv2.howTitle")}</h2>
        <ol className="mt-8 space-y-4">
          {howSteps.map((k, i) => (
            <li key={k} className="flex gap-4 rounded-2xl border border-ds-border bg-ds-surface p-4 shadow-sm ring-1 ring-ds-border/60 sm:p-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-600 text-sm font-black text-white">
                {i + 1}
              </span>
              <p className="pt-1 text-sm font-semibold leading-relaxed text-ds-text sm:text-base">{tl(`growth.lv2.${k}`)}</p>
            </li>
          ))}
        </ol>
      </SectionShell>

      {/* Trust */}
      <SectionShell className="border-y border-ds-border bg-ds-surface">
        <h2 className="text-2xl font-black tracking-tight text-ds-text sm:text-3xl">{tl("growth.lv2.trustTitle")}</h2>
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {trust.map((k) => (
            <li key={k} className="rounded-2xl border border-ds-border bg-ds-bg p-5 text-sm font-semibold leading-relaxed text-ds-text">
              {tl(`growth.lv2.${k}`)}
            </li>
          ))}
        </ul>
      </SectionShell>

      {/* Final CTA */}
      <section className="border-t border-ds-border bg-gradient-to-br from-zinc-900 via-slate-900 to-teal-950 text-white">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6 sm:py-16">
          <h2 className="text-2xl font-black leading-tight tracking-tight sm:text-4xl">{tl("growth.lv2.finalTitle")}</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-zinc-300 sm:text-base">{tl("growth.lv2.finalBody")}</p>
          <GrowthLandingAnchor
            href="#contacto"
            placement="final_cta_form"
            suite={suite}
            className="mt-8 inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-teal-400 px-8 py-4 text-sm font-black uppercase tracking-wide text-zinc-950 shadow-xl shadow-teal-500/20 transition hover:bg-teal-300"
          >
            {tl("growth.lv2.finalCta")}
            <ArrowRight className="size-4 shrink-0" aria-hidden />
          </GrowthLandingAnchor>
          <p className="mx-auto mt-8 max-w-md text-xs text-zinc-500">
            <GrowthLandingCta
              to="/app/growth-program/dashboard"
              placement="final_subscriber_dashboard"
              suite={suite}
              className="font-semibold text-teal-200 underline-offset-4 hover:text-teal-100 hover:underline"
            >
              {t("growth.landing.openDashboard")}
            </GrowthLandingCta>
          </p>
        </div>
      </section>
    </div>
  );
}
