import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

export function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 px-4 py-16 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 size-[520px] rounded-full bg-violet-600/35 blur-3xl" />
        <div className="absolute -right-40 top-10 size-[520px] rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="absolute bottom-[-200px] left-1/3 size-[640px] rounded-full bg-fuchsia-500/20 blur-3xl" />
      </div>

      <div className="relative mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
            <Sparkles className="size-4" />
            DBX NOVO
          </div>
          <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Prep logistics that feels like a premium SaaS.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/70">
            A redesigned client console: fewer tabs, stronger hierarchy, and action-first flows for Amazon FBA/FBM
            sellers.{" "}
            <span className="text-white/85">
              Retornos e remoções do armazém: <strong className="text-white">US$ 6,25</strong> por retorno no plano
              gratuito (Free) e <strong className="text-white">US$ 1,50</strong> com Direct Premium — menos custo
              operacional quando escala o volume.
            </span>
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            {["Suite-first", "Inbound → stock → shipment", "Fast UI"].map((t) => (
              <span key={t} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold">
                {t}
              </span>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              to="/app/entrar"
              className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-black/30 transition hover:translate-y-[-1px]"
            >
              Portal do cliente (entrar / registo)
            </Link>
            <Link
              to="/admin"
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Internal console
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-black/25 p-6 backdrop-blur-xl">
          <div className="text-sm font-semibold text-white/80">What ships in v0</div>
          <div className="mt-4 space-y-3 text-sm text-white/70">
            <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">Retornos</div>
              <p className="mt-2 leading-relaxed text-white/80">
                Processamento de retorno ou remoção a partir do nosso armazém: no plano{" "}
                <strong className="text-white">Free</strong>, <strong className="tabular-nums text-white">US$ 6,25</strong>{" "}
                por retorno; com assinatura <strong className="text-white">Direct Premium</strong>,{" "}
                <strong className="tabular-nums text-white">US$ 1,50</strong> por retorno.
              </p>
              <p className="mt-2 text-xs leading-relaxed text-white/55">
                Valores indicativos para o cliente decidir entre o plano básico e o Premium; confira a tabela completa no
                portal em Direct Premium.
              </p>
              <Link
                to="/app/premium"
                className="mt-3 inline-flex text-xs font-semibold text-amber-200 underline-offset-2 hover:text-white hover:underline"
              >
                Ver plano Premium no portal →
              </Link>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs font-semibold text-white/60">Dashboard</div>
              <div className="mt-1 font-semibold text-white">KPIs, quick actions, pipeline, insights</div>
            </div>
            <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-200/90">Direct Leads Pro</div>
              <p className="mt-2 leading-relaxed text-white/80">
                Até <strong className="text-white">50 produtos Amazon</strong> validados por dia útil (seg.–sex.),{" "}
                <strong className="tabular-nums text-white">US$ 49,99</strong>/mês — lista e CSV no painel do cliente.
              </p>
              <Link
                to="/direct-leads-pro"
                className="mt-3 inline-flex text-xs font-semibold text-emerald-200 underline-offset-2 hover:text-white hover:underline"
              >
                Ver landpage do produto →
              </Link>
            </div>
            <div className="rounded-2xl border border-violet-400/25 bg-violet-500/10 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-violet-200/90">DBX Reprice</div>
              <p className="mt-2 leading-relaxed text-white/80">
                Repricing e visão de margem no portal — <strong className="tabular-nums text-white">US$ 49,99</strong>
                /mês (add-on; beta com demo até ligação SP-API).
              </p>
              <Link
                to="/dbx-reprice"
                className="mt-3 inline-flex text-xs font-semibold text-violet-200 underline-offset-2 hover:text-white hover:underline"
              >
                Ver landpage e contratar →
              </Link>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs font-semibold text-white/60">Next</div>
              <div className="mt-1 font-semibold text-white">Auth + API + Bubble migration</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
