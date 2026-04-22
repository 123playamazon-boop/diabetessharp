import { CtaButton } from "@/components/CtaButton";

const BUNDLES = [
  {
    name: "Starter",
    range: "$59 – $99",
    tag: "Prove the stack",
    desc: "Onboard fast. Core AI listing tools, compliance checks, and visibility into what actually moves units.",
    for: "New sellers, side hustlers, and anyone validating SKUs before they pour fuel on the fire.",
    bullets: ["AI listing generator + templates", "Compliance & risk scanner", "Multi-marketplace copy adapter", "Email + portal access"],
  },
  {
    name: "Scale",
    range: "$149 – $249",
    tag: "Turn velocity into profit",
    desc: "Operational rhythm: repricing discipline, sourcing signals, and listing ops that keep you in stock and in the Buy Box.",
    for: "Growing brands doing real volume who need systems—not another Chrome extension.",
    bullets: ["DBX Reprice (Buy Box warfare)", "Amazon leads / sourcing lane", "Listing analysis + bulk workflows", "Priority support queue"],
  },
  {
    name: "Domination",
    range: "$399 – $999",
    tag: "Own the stack",
    desc: "Full operating system: logistics-backed execution, AI at every listing touchpoint, and pricing that hunts margin 24/7.",
    for: "Serious operators, aggregators, and teams that treat marketplaces as a balance sheet line item.",
    bullets: ["Everything in Scale", "Logistics + prep orchestration hooks", "Custom repricing & guardrails", "Strategic reviews & playbooks"],
  },
] as const;

const FEATURES = [
  { title: "AI Listing Generator", body: "Spin up Amazon, Walmart, TikTok Shop, Shopify-native copy in minutes—not hours." },
  { title: "Leads Amazon", body: "Product sourcing intelligence so you stop guessing what to launch next." },
  { title: "DBX Reprice", body: "Buy Box optimization that reacts faster than your competitors’ spreadsheets." },
  { title: "Compliance Checker", body: "Kill policy risk before Amazon kills your ASIN." },
  { title: "Profit Calculator", body: "Know your real margin after fees, freight, and prep—before you reorder." },
  { title: "Multi-marketplace", body: "One brain. Amazon, Walmart, TikTok Shop, Shopify, eBay, Mercado Livre International." },
] as const;

const FAQ = [
  {
    q: "Is DBX beginner-friendly?",
    a: "Yes—but we don’t babysit. Starter gets you structured tools and guardrails. If you want hand-holding, Scale adds the workflows serious sellers actually run.",
  },
  {
    q: "Does it work across multiple marketplaces?",
    a: "That’s the point. DBX is built for US velocity first, with Mercado Livre International and other channels wired into the same operating layer—not siloed toys.",
  },
  {
    q: "Do I need prior experience?",
    a: "You need execution appetite. We compress learning curves with AI + ops templates. Domination is for teams who already feel the pain of scale.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Bundle terms apply per plan—talk to sales for annual vs monthly. We win when you print money, not when you’re trapped in fine print.",
  },
] as const;

export default function HomePage() {
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <a href="#" className="flex items-center gap-2 font-black tracking-tighter text-white">
            <span className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-sm text-white">D</span>
            <span className="text-lg sm:text-xl">
              DBX<span className="text-zinc-500">.</span>
            </span>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-semibold text-zinc-400 md:flex">
            <a href="#problem" className="hover:text-white">
              Problem
            </a>
            <a href="#bundles" className="hover:text-white">
              Bundles
            </a>
            <a href="#features" className="hover:text-white">
              Stack
            </a>
            <a href="#pricing" className="hover:text-white">
              Pricing
            </a>
            <a href="#faq" className="hover:text-white">
              FAQ
            </a>
          </nav>
          <CtaButton href="#pricing" variant="primary" className="!py-2.5 !px-4 text-sm sm:!px-6">
            Start Scaling Now
          </CtaButton>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden border-b border-zinc-800">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(139,92,246,0.35),transparent)]" />
          <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 sm:pb-32 sm:pt-24 lg:px-8 lg:pt-28">
            <p className="mb-4 inline-flex rounded-full border border-violet-500/30 bg-violet-950/50 px-3 py-1 text-xs font-bold uppercase tracking-widest text-violet-300">
              Direct Box USA · US e-commerce infrastructure
            </p>
            <h1 className="max-w-4xl text-4xl font-black leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl xl:text-7xl">
              Stop Selling Like a Hobbyist.
              <span className="mt-2 block bg-gradient-to-r from-violet-400 via-fuchsia-400 to-orange-300 bg-clip-text text-transparent">
                Build a Marketplace Machine.
              </span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-relaxed text-zinc-400 sm:text-xl">
              DBX is not &ldquo;another SaaS tool.&rdquo; It&apos;s a full <strong className="text-zinc-200">e-commerce operating system</strong>—AI listings,
              repricing, sourcing, compliance, logistics, and multi-channel execution—built for sellers who want money, scale, and speed on{" "}
              <strong className="text-zinc-200">Amazon, Walmart, TikTok Shop, Shopify, eBay &amp; Mercado Livre International</strong>.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              <CtaButton href="#pricing">Start Scaling Now</CtaButton>
              <CtaButton href="#bundles" variant="secondary">
                See bundles
              </CtaButton>
            </div>
            <p className="mt-6 text-sm font-medium text-zinc-500">Bundles from $59 · Real logistics backbone · Built for US marketplaces</p>
          </div>
        </section>

        {/* PROBLEM */}
        <section id="problem" className="border-b border-zinc-800 bg-zinc-900/30 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">The US marketplace eats careless sellers.</h2>
            <p className="mt-4 max-w-2xl text-lg text-zinc-400">Random tactics don&apos;t compound. Here&apos;s what actually bleeds accounts dry:</p>
            <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { t: "Wrong products", d: "You launch SKUs nobody searches for—or can’t defend on margin." },
                { t: "Pricing mistakes", d: "You race to the bottom or leave money on the table while fees eat you alive." },
                { t: "No scaling system", d: "Spreadsheets and gut feel don’t survive Q4, case packs, or multi-channel ops." },
                { t: "Losing Buy Box", d: "You don’t lose to “luck”—you lose to operators with repricing infrastructure." },
                { t: "Logistics chaos", d: "Prep, inbound, storage, and SLAs break before your listing ever gets a chance." },
                { t: "Tool sprawl", d: "Twelve subscriptions. Zero orchestration. That’s not a stack—that’s noise." },
              ].map((item) => (
                <li key={item.t} className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-xl shadow-black/20">
                  <h3 className="text-lg font-bold text-white">{item.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.d}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* SOLUTION */}
        <section className="border-b border-zinc-800 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">One operating system. Every channel that pays.</h2>
                <p className="mt-6 text-lg leading-relaxed text-zinc-400">
                  DBX bundles <strong className="text-zinc-200">AI</strong>, <strong className="text-zinc-200">pricing</strong>,{" "}
                  <strong className="text-zinc-200">sourcing</strong>, <strong className="text-zinc-200">compliance</strong>, and{" "}
                  <strong className="text-zinc-200">logistics-aware workflows</strong> into a single motion: pick a bundle, run the stack, compound
                  marketplace revenue.
                </p>
                <p className="mt-4 text-lg font-semibold text-violet-300">Software + operations—not software cosplaying as operations.</p>
              </div>
              <div className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-8 lg:p-10">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">What you get</p>
                <ul className="mt-6 space-y-4 text-zinc-300">
                  <li className="flex gap-3">
                    <span className="text-emerald-400">✓</span>
                    <span>Listing intelligence that ships revenue-ready copy—not generic ChatGPT slop.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-emerald-400">✓</span>
                    <span>Repricers and rules tuned for Buy Box reality—not academic pricing theory.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-emerald-400">✓</span>
                    <span>Sourcing lanes so you’re not guessing your next hero SKU.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-emerald-400">✓</span>
                    <span>Compliance scanning before Amazon turns your ASIN into a case study.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-emerald-400">✓</span>
                    <span>Infrastructure that respects logistics—because boxes still have to move.</span>
                  </li>
                </ul>
                <div className="mt-8">
                  <CtaButton href="#pricing">Lock your bundle</CtaButton>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* BUNDLES */}
        <section id="bundles" className="border-b border-zinc-800 bg-zinc-900/20 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Pick your firepower.</h2>
            <p className="mt-4 max-w-2xl text-lg text-zinc-400">Three bundles. Same DBX DNA. Different levels of aggression.</p>
            <div className="mt-14 grid gap-8 lg:grid-cols-3">
              {BUNDLES.map((b, i) => (
                <article
                  key={b.name}
                  className={`relative flex flex-col rounded-3xl border p-8 ${
                    i === 1 ? "border-violet-500/50 bg-zinc-900/90 shadow-2xl shadow-violet-950/40 ring-1 ring-violet-500/30" : "border-zinc-800 bg-zinc-950/80"
                  }`}
                >
                  {i === 1 ? (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">
                      Most picked
                    </span>
                  ) : null}
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">{b.tag}</p>
                  <h3 className="mt-2 text-2xl font-black text-white">{b.name} Bundle</h3>
                  <p className="mt-3 text-3xl font-black tracking-tight text-white">{b.range}</p>
                  <p className="mt-4 text-sm leading-relaxed text-zinc-400">{b.desc}</p>
                  <p className="mt-4 text-xs font-bold uppercase tracking-wide text-zinc-500">Who it&apos;s for</p>
                  <p className="mt-1 text-sm text-zinc-300">{b.for}</p>
                  <ul className="mt-6 flex-1 space-y-2 border-t border-zinc-800 pt-6 text-sm text-zinc-400">
                    {b.bullets.map((x) => (
                      <li key={x} className="flex gap-2">
                        <span className="text-violet-400">→</span>
                        {x}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-8">
                    <CtaButton href="#pricing" variant={i === 1 ? "primary" : "secondary"} className="w-full">
                      Choose {b.name}
                    </CtaButton>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="border-b border-zinc-800 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">The DBX weapon rack.</h2>
            <p className="mt-4 max-w-2xl text-lg text-zinc-400">Every module pushes one outcome: more profit per hour you spend in the business.</p>
            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 transition hover:border-zinc-700">
                  <h3 className="text-lg font-bold text-white">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{f.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-12 text-center">
              <CtaButton href="#pricing">Get the full stack</CtaButton>
            </div>
          </div>
        </section>

        {/* DIFFERENTIATION */}
        <section className="border-b border-zinc-800 bg-zinc-900/30 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Why DBX isn&apos;t another “AI wrapper.”</h2>
            <div className="mt-12 grid gap-8 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
                <h3 className="text-xl font-bold text-white">Real logistics company</h3>
                <p className="mt-3 text-zinc-400">
                  DBX lives where pallets and labels live—not just in a Figma file. That changes what our software is allowed to promise… and what it can
                  enforce.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
                <h3 className="text-xl font-bold text-white">Multi-marketplace by design</h3>
                <p className="mt-3 text-zinc-400">
                  One nervous system for Amazon, Walmart, TikTok Shop, Shopify, eBay, Mercado Livre International. Not six disconnected hacks duct-taped
                  together.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
                <h3 className="text-xl font-bold text-white">AI + operations fused</h3>
                <p className="mt-3 text-zinc-400">
                  Models that respect fees, inventory, and policy risk. Not “creative writing” that gets your account torched.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
                <h3 className="text-xl font-bold text-white">Battle-tested with real sellers</h3>
                <p className="mt-3 text-zinc-400">Built under load: Buy Box fights, inbound crunch, listing fires, and the ugly middle of scaling.</p>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="border-b border-zinc-800 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">How it works</h2>
            <p className="mt-4 text-lg text-zinc-400">Three moves. No theater.</p>
            <ol className="mt-14 grid gap-8 md:grid-cols-3">
              {[
                { step: "01", title: "Choose your bundle", body: "Starter, Scale, or Domination—match aggression to where you are today." },
                { step: "02", title: "Run tools + AI system", body: "Listings, repricing, sourcing, compliance—wired into one operating cadence." },
                { step: "03", title: "Scale across marketplaces", body: "Compound SKUs, defend margin, and expand channels without rebuilding your stack." },
              ].map((s) => (
                <li key={s.step} className="relative rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900/80 to-zinc-950 p-8">
                  <span className="text-5xl font-black text-zinc-800">{s.step}</span>
                  <h3 className="mt-4 text-xl font-bold text-white">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="border-b border-zinc-800 bg-zinc-900/20 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Pricing that scales with your aggression.</h2>
            <p className="mt-4 text-lg text-zinc-400">Pick a lane. Upgrade when your revenue forces the issue.</p>
            <div className="mt-14 grid gap-8 lg:grid-cols-3">
              {BUNDLES.map((b, i) => (
                <div
                  key={`price-${b.name}`}
                  className={`flex flex-col rounded-3xl border p-8 ${i === 1 ? "border-violet-500/40 bg-zinc-900 ring-1 ring-violet-500/25" : "border-zinc-800 bg-zinc-950"}`}
                >
                  <h3 className="text-xl font-black text-white">{b.name}</h3>
                  <p className="mt-2 text-4xl font-black text-white">{b.range}</p>
                  <p className="mt-4 flex-1 text-sm text-zinc-400">{b.desc}</p>
                  <ul className="mt-6 space-y-2 border-t border-zinc-800 pt-6 text-sm text-zinc-300">
                    {b.bullets.map((x) => (
                      <li key={x}>• {x}</li>
                    ))}
                  </ul>
                  <CtaButton href="mailto:sales@directboxusa.com?subject=DBX%20bundle%20-%20" variant="primary" className="mt-8 w-full">
                    Start Scaling Now
                  </CtaButton>
                </div>
              ))}
            </div>
            <p className="mt-8 text-center text-sm text-zinc-500">Exact SKU mix & contract terms confirmed with sales. This page is positioning, not a checkout.</p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-b border-zinc-800 py-20 sm:py-28">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">FAQ — objections, crushed.</h2>
            <dl className="mt-12 space-y-8">
              {FAQ.map((item) => (
                <div key={item.q} className="border-b border-zinc-800 pb-8 last:border-0">
                  <dt className="text-lg font-bold text-white">{item.q}</dt>
                  <dd className="mt-2 text-zinc-400">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="relative overflow-hidden py-24 sm:py-32">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_100%,rgba(217,70,239,0.2),transparent)]" />
          <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">Your competitors aren&apos;t waiting.</h2>
            <p className="mt-6 text-lg text-zinc-400 sm:text-xl">
              Every day without a system is a day you donate margin to someone who <em className="text-zinc-300 not-italic">already</em> bought infrastructure.
              DBX exists so you stop improvising—and start compounding.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <CtaButton href="mailto:sales@directboxusa.com?subject=DBX%20-%20Start%20scaling" className="!px-10 !py-4 text-lg">
                Start Scaling Now
              </CtaButton>
              <CtaButton href="#bundles" variant="secondary" className="!px-8">
                Compare bundles
              </CtaButton>
            </div>
            <p className="mt-8 text-sm font-semibold uppercase tracking-widest text-orange-300/90">Limited onboarding slots each month · Domination is invite-only</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-800 bg-zinc-950 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6 lg:px-8">
          <p className="text-sm text-zinc-500">
            © {new Date().getFullYear()} Direct Box USA (DBX). All rights reserved.
          </p>
          <div className="flex gap-6 text-sm font-semibold text-zinc-400">
            <a href="#pricing" className="hover:text-white">
              Pricing
            </a>
            <a href="mailto:sales@directboxusa.com" className="hover:text-white">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
