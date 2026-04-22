import { Link } from "react-router-dom";
import { BarChart3, Bot, CalendarClock, LineChart, Sparkles, Target } from "lucide-react";
import { AMAZON_LEADS_DAILY_PUBLISH_CAP, AMAZON_LEADS_PRO_MONTHLY_USD } from "../lib/amazonLeadsProProduct";
import { formatUsd } from "../lib/prepCenterPricing";
import { cn } from "../lib/cn";

const bullets = [
  {
    icon: Target,
    title: "O desafio do vendedor Amazon",
    body: "Encontrar SKUs com giro, margem e concorrência saudável consome horas — e um ASIN fraco custa stock e taxas.",
  },
  {
    icon: Bot,
    title: "Curadoria com dados + critérios",
    body: "A equipa cruza Keepa (e outras fontes quando aplicável) com filtros operacionais: vendas, ofertas «new», buy box fora da Amazon retail — e revisão humana antes de publicar.",
  },
  {
    icon: CalendarClock,
    title: `${AMAZON_LEADS_DAILY_PUBLISH_CAP} oportunidades por dia útil`,
    body: "De segunda a sexta publicamos uma edição com até 50 ASINs validados para a sua análise — sem correr atrás de planilhas soltas.",
  },
];

type AmazonLeadsProMarketingProps = {
  variant: "public" | "portal";
  className?: string;
};

export function AmazonLeadsProMarketing({ variant, className }: AmazonLeadsProMarketingProps) {
  const price = formatUsd(AMAZON_LEADS_PRO_MONTHLY_USD);
  const enterHref = variant === "public" ? "/app/entrar" : "/app/leads-amazon";
  const enterLabel = variant === "public" ? "Entrar no portal" : "Ir para Leads Amazon";

  return (
    <div className={cn("space-y-10", className)}>
      <section className="relative overflow-hidden rounded-ds-card border border-ds-border bg-ds-surface shadow-ds">
        <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-emerald-500/15 blur-3xl" aria-hidden />
        <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-800">
              <Sparkles className="size-3.5" aria-hidden />
              Direct Leads Pro
            </p>
            <h1 className="mt-4 text-balance text-3xl font-bold tracking-tight text-ds-text sm:text-4xl">
              Lista diária de produtos altamente lucrativos — entregues no seu painel.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-ds-muted">
              Produto extra <strong className="text-ds-text">{price}/mês</strong> (fora do prep standard). A nossa equipa
              gera e valida até <strong className="text-ds-text">{AMAZON_LEADS_DAILY_PUBLISH_CAP} ASINs por dia útil</strong>{" "}
              (segunda a sexta); você recebe a tabela e o CSV para decidir o que comprar e enviar para o prep.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to={enterHref}
                className="inline-flex items-center justify-center rounded-ds-btn bg-ds-primary px-5 py-3 text-sm font-bold text-white shadow-ds transition hover:opacity-95"
              >
                {enterLabel}
              </Link>
              {variant === "portal" ? (
                <Link
                  to="/app/suporte"
                  className="inline-flex items-center justify-center rounded-ds-btn border border-ds-border bg-ds-bg px-5 py-3 text-sm font-semibold text-ds-text shadow-ds"
                >
                  Falar com a equipa
                </Link>
              ) : (
                <Link
                  to="/"
                  className="inline-flex items-center justify-center rounded-ds-btn border border-ds-border bg-ds-bg px-5 py-3 text-sm font-semibold text-ds-text shadow-ds"
                >
                  Voltar ao site
                </Link>
              )}
            </div>
          </div>
          <div className="rounded-ds-card border border-ds-border bg-ds-bg p-6 ring-1 ring-ds-border/60">
            <div className="flex items-center gap-2 text-ds-muted">
              <LineChart className="size-5 text-ds-primary" aria-hidden />
              <span className="text-xs font-bold uppercase tracking-wide">O que inclui</span>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-ds-text">
              <li className="flex gap-2">
                <BarChart3 className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden />
                <span>Colunas prontas para análise (foto, título, ASIN, preço ref., EMS, ofertas new, BSR).</span>
              </li>
              <li className="flex gap-2">
                <CalendarClock className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden />
                <span>Uma edição por dia útil — ritmo previsível para o seu pipeline de sourcing.</span>
              </li>
              <li className="flex gap-2">
                <Bot className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden />
                <span>Pipeline interno: dados Keepa + regras + revisão (IA assiste onde configurado).</span>
              </li>
            </ul>
            <p className="mt-4 text-[11px] leading-relaxed text-ds-muted">
              A assinatura é activada pela equipa após pagamento (como Direct Premium na demo). No painel, a aba «Leads
              Amazon» mostra só a lista publicada — não gasta tokens Keepa da sua conta.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {bullets.map((b) => {
          const Icon = b.icon;
          return (
            <div key={b.title} className="rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds">
              <div className="inline-flex size-10 items-center justify-center rounded-ds-btn bg-ds-bg ring-1 ring-ds-border">
                <Icon className="size-5 text-ds-primary" aria-hidden />
              </div>
              <h2 className="mt-3 text-sm font-bold text-ds-text">{b.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ds-muted">{b.body}</p>
            </div>
          );
        })}
      </section>
    </div>
  );
}
