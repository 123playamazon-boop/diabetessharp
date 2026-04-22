import { Link } from "react-router-dom";
import {
  ChevronLeft,
  Gauge,
  LineChart,
  ListOrdered,
  Package,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Truck,
  Zap,
} from "lucide-react";
import { DBX_REPRICE_MONTHLY_USD } from "../lib/dbxRepriceProduct";
import { formatUsd } from "../lib/prepCenterPricing";
import { cn } from "../lib/cn";

const priceLabel = `${formatUsd(DBX_REPRICE_MONTHLY_USD)}/mês`;

const pillars = [
  {
    icon: Target,
    title: "Ganhar mais Buy Box",
    body: "Estratégias de preço para competir na Buy Box sem “chutar” o mínimo: regras com piso de margem e teto de lucro — o que dropshippers e OA mais pedem.",
  },
  {
    icon: LineChart,
    title: "Um painel para decidir rápido",
    body: "Receita, vendas, % Buy Box e lucro em um só lugar — menos tempo no Seller Central e mais tempo comprando bem.",
  },
  {
    icon: Package,
    title: "Anúncios + custos alinhados",
    body: "Lista de SKUs com custo de fornecedor, mínimos/máximos e lucro estimado — para não vender no prejuízo quando o mercado mexer.",
  },
  {
    icon: Zap,
    title: "Menos “apagar incêndio”",
    body: "Modelos (taxa Amazon, frete do fornecedor, margem) e automações no roadmap — objetivo: menos estoque fantasma e menos preço desatualizado.",
  },
];

const steps = [
  {
    n: "1",
    title: "Abra sua conta no portal DBX",
    body: "Cadastro completo; sua suite fica pronta para add-ons como o Reprice.",
  },
  {
    n: "2",
    title: "Combine o pagamento mensal",
    body: `Valor de referência: ${priceLabel}. A cobrança real (cartão, Pix, boleto, Stripe etc.) fica no processo comercial da Direct Box — aqui registramos apenas que a assinatura está ativa.`,
  },
  {
    n: "3",
    title: "A equipe ativa o serviço",
    body: "Depois da confirmação do pagamento, a operação ativa o DBX Reprice na sua suite no painel admin. Atualize o perfil no portal (F5) ou entre de novo e abra o módulo no menu.",
  },
];

export function RepriceProPublicPage() {
  return (
    <div className="min-h-screen bg-ds-bg px-4 py-10 text-ds-text" lang="pt-BR">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm font-semibold text-ds-muted transition hover:text-ds-primary"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Início
        </Link>

        <section className="relative mt-8 overflow-hidden rounded-ds-card border border-ds-border bg-ds-surface shadow-ds">
          <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-violet-500/20 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-20 -left-16 size-64 rounded-full bg-emerald-500/15 blur-3xl" aria-hidden />
          <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.12fr_0.88fr] lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-violet-900">
                <Sparkles className="size-3.5" aria-hidden />
                DBX Reprice · Amazon
              </p>
              <h1 className="mt-4 text-balance text-3xl font-bold tracking-tight text-ds-text sm:text-4xl">
                Automatize dropshipping e OA: preço, Buy Box e lucro — no mesmo sistema do prep.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-ds-muted">
                Pare de ficar pulando entre planilhas, fornecedor e Seller Central. O{" "}
                <strong className="text-ds-text">DBX Reprice</strong> concentra a visão de{" "}
                <strong className="text-ds-text">margem</strong>, <strong className="text-ds-text">regras de repricing</strong>{" "}
                e <strong className="text-ds-text">pedidos</strong> — com o mesmo padrão operacional da Direct Box. Plano
                anunciado: <strong className="tabular-nums text-ds-text">{priceLabel}</strong> (add-on; ativação feita
                pela equipe após o pagamento).
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/app/entrar"
                  className="inline-flex items-center justify-center rounded-ds-btn bg-ds-primary px-5 py-3 text-sm font-bold text-white shadow-ds transition hover:opacity-95"
                >
                  Cadastrar / entrar para contratar
                </Link>
                <Link
                  to="/app/reprice/painel"
                  className="inline-flex items-center justify-center rounded-ds-btn border border-ds-border bg-ds-bg px-5 py-3 text-sm font-semibold text-ds-text shadow-ds"
                >
                  Já sou cliente — abrir o módulo
                </Link>
              </div>
              <p className="mt-4 text-[11px] leading-relaxed text-ds-muted">
                O produto em desenvolvimento segue a mesma lógica de valor de ferramentas “all-in-one” do mercado
                (pesquisa, repricer, pedidos, estoque) — por exemplo o posicionamento público de soluções como{" "}
                <a
                  href="https://www.repricehub.com/"
                  className="font-semibold text-ds-primary underline-offset-2 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Repricehub
                </a>
                ; o DBX Reprice é <strong className="text-ds-text">software próprio</strong>, integrado ao portal DBX.
              </p>
            </div>

            <div className="rounded-ds-card border border-ds-border bg-ds-bg p-6 ring-1 ring-ds-border/60">
              <div className="flex items-center gap-2 text-ds-muted">
                <Gauge className="size-5 text-ds-primary" aria-hidden />
                <span className="text-xs font-bold uppercase tracking-wide">Oferta</span>
              </div>
              <div className="mt-4 rounded-ds-btn border border-violet-200/80 bg-white px-4 py-5 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-wide text-violet-900">DBX Reprice</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-black tabular-nums text-ds-text">{formatUsd(DBX_REPRICE_MONTHLY_USD)}</span>
                  <span className="text-sm font-semibold text-ds-muted">/ mês</span>
                </div>
                <ul className="mt-4 space-y-2 text-sm text-ds-text">
                  <li className="flex gap-2">
                    <TrendingUp className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden />
                    <span>Foco em Buy Box, margem e ritmo de vendas — o que o vendedor quer ouvir.</span>
                  </li>
                  <li className="flex gap-2">
                    <Truck className="mt-0.5 size-4 shrink-0 text-violet-700" aria-hidden />
                    <span>No mesmo login do prep: menos atrito entre operação e precificação.</span>
                  </li>
                  <li className="flex gap-2">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-violet-700" aria-hidden />
                    <span>Ativar / revogar por suite no admin + registro no extrato (auditoria).</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className={cn("rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds")}>
                <div className="inline-flex size-10 items-center justify-center rounded-ds-btn bg-ds-bg ring-1 ring-ds-border">
                  <Icon className="size-5 text-ds-primary" aria-hidden />
                </div>
                <h2 className="mt-3 text-sm font-bold text-ds-text">{p.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-ds-muted">{p.body}</p>
              </div>
            );
          })}
        </section>

        <section className="mt-10 rounded-ds-card border border-ds-border bg-ds-surface p-6 shadow-ds sm:p-8">
          <h2 className="text-lg font-bold text-ds-text">Como contratar (fluxo DBX)</h2>
          <ol className="mt-6 grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <li key={s.n} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-black text-violet-900 ring-1 ring-violet-200">
                  {s.n}
                </span>
                <div>
                  <h3 className="font-bold text-ds-text">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ds-muted">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-6 rounded-ds-btn border border-ds-border bg-ds-bg px-4 py-3 text-xs leading-relaxed text-ds-muted">
            <strong className="text-ds-text">Operação:</strong> no menu Admin, abra «Assin. Reprice» — aparecem todas
            as suites com os botões <em>Ativar</em> / <em>Revogar</em>. Cada mudança gera uma linha no extrato do
            cliente (valor US$ 0, só auditoria), como no Direct Leads Pro.
          </p>
        </section>

        <section className="mt-10 rounded-ds-card border border-ds-border bg-ds-surface p-6 shadow-ds sm:p-8">
          <h2 className="text-lg font-bold text-ds-text">Perguntas rápidas</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="font-bold text-ds-text">Isso substitui minha conta Seller Central?</dt>
              <dd className="mt-1 text-ds-muted">
                Não. O objetivo é <strong className="text-ds-text">decidir e acompanhar</strong> com menos cliques. A
                conexão oficial com a Amazon (SP-API) será configurada por suite depois que o app estiver registrado na
                Amazon e aprovado.
              </dd>
            </div>
            <div>
              <dt className="font-bold text-ds-text">É só para dropshipping?</dt>
              <dd className="mt-1 text-ds-muted">
                O discurso comercial foca em <strong className="text-ds-text">dropshipping e OA</strong> (preço e
                estoque do fornecedor pesam); o motor de dados pode atender outros modelos na medida em que as
                integrações forem crescendo.
              </dd>
            </div>
            <div>
              <dt className="font-bold text-ds-text">Onde pago os US$ 49,99?</dt>
              <dd className="mt-1 text-ds-muted">
                Na demo, “cobrar” é processo interno + ativação no admin. Em produção dá para usar cartão, Pix, boleto,
                Stripe, fatura mensal ou débito no saldo do prep — o portal só libera o módulo quando{" "}
                <code className="font-mono text-xs">repriceProActive</code> estiver ligado.
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-ds-card border border-emerald-200/80 bg-emerald-50/60 px-6 py-5 shadow-ds">
          <div className="flex items-center gap-3">
            <ListOrdered className="size-8 text-emerald-800" aria-hidden />
            <div>
              <p className="text-sm font-bold text-emerald-950">Pronto para ganhar ritmo na Amazon?</p>
              <p className="text-xs text-emerald-900/90">Entre, fale com a equipe e peça a ativação do DBX Reprice.</p>
            </div>
          </div>
          <Link
            to="/app/suporte"
            className="inline-flex items-center justify-center rounded-ds-btn bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-800"
          >
            Abrir suporte
          </Link>
        </section>
      </div>
    </div>
  );
}
