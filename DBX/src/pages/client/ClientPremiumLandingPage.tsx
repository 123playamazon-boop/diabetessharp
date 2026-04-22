import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  Camera,
  ChevronRight,
  Globe,
  MessageCircle,
  Sparkles,
  Target,
  Truck,
  TrendingDown,
} from "lucide-react";
import { cn } from "../../lib/cn";
import {
  PREMIUM_LANDING_DEFAULT_MONTHLY_PRODUCT_PHOTOS,
  PREMIUM_LANDING_PRODUCT_PHOTO_SERVICE_ID,
  PREMIUM_SUBSCRIPTION_USD_PER_MONTH,
  PREP_CENTER_PRICING_MAIN,
  compareAnnualPrepSpend,
  formatUsd,
  prepLineLabel,
} from "../../lib/prepCenterPricing";

const hooks = [
  {
    icon: TrendingDown,
    title: "Menos por unidade nas modalidades FBA / FBM",
    body: "O simulador usa o seu volume real de prep e soma o que o Básico cobra em fotos — para ver o total anual lado a lado.",
  },
  {
    icon: Camera,
    title: `${PREMIUM_LANDING_DEFAULT_MONTHLY_PRODUCT_PHOTOS} fotos de produto por mês na conta`,
    body: "Assumimos «Foto — Conferência» na tabela: no Básico paga cada pedido; no Premium passa a US$0 nessa linha — entra diretamente na tabela de totais.",
  },
  {
    icon: Truck,
    title: "FBM personalizado — envio no mesmo dia (multi-canal)",
    body: "«FBM» no prep é envio direto ao comprador com a sua etiqueta — Amazon, TikTok, Mercado Livre, internacional, etc. Premium inclui FBM personalizado com despacho no mesmo dia quando a operação permitir.",
  },
  {
    icon: MessageCircle,
    title: "Atendimento via WhatsApp com prioridade",
    body: "Canal direto para dúvidas urgentes e follow-up de envios — fila prioritária em relação ao atendimento standard.",
  },
];

/** Linha de prep inicial: com ~100 u./mês + 4 fotos/mês costuma mostrar poupança anual clara no simulador. */
const DEFAULT_PREP_SERVICE_ID = "fba-prep-pack4-6";

/** Média de dias por mês para converter volume mensal em “por dia” (contexto, não calendário fiscal). */
const AVG_DAYS_PER_MONTH = 30.4;

/** Referência de volume para copy “vendedor sério” (~10 un./dia). */
const SERIOUS_BASELINE_UNITS_PER_DAY = 10;

export function ClientPremiumLandingPage() {
  const [monthlyUnits, setMonthlyUnits] = useState(100);
  const [serviceId, setServiceId] = useState(DEFAULT_PREP_SERVICE_ID);

  const cmp = useMemo(
    () => compareAnnualPrepSpend({ monthlyUnits, serviceId }),
    [monthlyUnits, serviceId],
  );

  const serviceLabel = prepLineLabel(serviceId) ?? "Serviço";
  const photoLabel = prepLineLabel(PREMIUM_LANDING_PRODUCT_PHOTO_SERVICE_ID) ?? "Fotos de produto";
  const photoUnitBasicUsd =
    cmp.monthlyProductPhotos > 0 ? cmp.basicPhotosYearUsd / (cmp.monthlyProductPhotos * 12) : 0;

  const unitsPerDayApprox = monthlyUnits / AVG_DAYS_PER_MONTH;
  const seriousMonthlyApprox = Math.round(SERIOUS_BASELINE_UNITS_PER_DAY * AVG_DAYS_PER_MONTH);

  return (
    <div className="mx-auto max-w-6xl space-y-10 pb-12">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link
          to="/app/cadastro-produto"
          className="inline-flex items-center gap-1.5 font-semibold text-ds-muted transition hover:text-ds-primary"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Voltar ao cadastro / simulador de produto
        </Link>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-ds-card border border-ds-border bg-ds-surface shadow-ds">
        <div
          className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-ds-soft-violet opacity-90 blur-3xl"
          aria-hidden
        />
        <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-ds-soft-violet-border bg-ds-soft-violet px-3 py-1 text-xs font-bold uppercase tracking-wide text-ds-soft-violet-icon">
              <Sparkles className="size-3.5" aria-hidden />
              Direct Premium
            </p>
            <h1 className="mt-4 text-balance text-3xl font-bold tracking-tight text-ds-text sm:text-4xl">
              Pague menos por unidade, fotos incluídas na conta e operação que acompanha o seu ritmo.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ds-muted">
              O Básico é grátis, mas cada envio e cada foto somam. O Premium custa{" "}
              <strong className="text-ds-text">{formatUsd(PREMIUM_SUBSCRIPTION_USD_PER_MONTH)}/mês</strong> e o
              simulador começa em <strong className="text-ds-text">100 unidades/mês</strong> — isto é, cerca de{" "}
              <strong className="text-ds-text">3 unidades por dia</strong> em média — com{" "}
              <strong className="text-ds-text">{PREMIUM_LANDING_DEFAULT_MONTHLY_PRODUCT_PHOTOS} fotos de produto/mês</strong>{" "}
              para mostrar o impacto real no ano. É um ponto de partida conservador; na Amazon EUA o teto de escala é
              outro.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                id="comprar-premium"
                to="/app/settings"
                className="inline-flex items-center justify-center gap-2 rounded-ds-btn bg-cta-gradient px-6 py-3.5 text-sm font-bold text-white shadow-ds transition hover:opacity-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
              >
                Comprar Direct Premium
                <ChevronRight className="size-4" aria-hidden />
              </Link>
              <p className="max-w-xs text-xs text-ds-muted">
                Checkout automático em preparação — por agora o plano é ativado nas configurações. Este botão
                encaminha para o próximo passo.
              </p>
            </div>
          </div>
          <div className="rounded-ds-card border border-ds-border bg-ds-bg p-5 text-sm">
            <p className="font-bold text-ds-text">Incluído na proposta Premium</p>
            <ul className="mt-3 space-y-2.5 text-ds-muted">
              <li className="flex gap-2">
                <span className="mt-0.5 font-bold text-ds-success">✓</span>
                <span>
                  FBM personalizado com envio no mesmo dia (quando aplicável) — FBM = envio direto com a sua etiqueta em
                  qualquer canal, não só Amazon.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 font-bold text-ds-success">✓</span>
                <span>WhatsApp com prioridade para suporte e acompanhamento.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 font-bold text-ds-success">✓</span>
                <span>Tabela de prep mais baixa + fotos de produto a US$0 nas linhas indicadas na tabela oficial.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Volume + Amazon context */}
      <section
        className="grid gap-4 rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds sm:grid-cols-2 lg:grid-cols-3"
        aria-labelledby="volume-context-heading"
      >
        <div className="lg:col-span-1">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-ds-btn bg-ds-soft-indigo text-ds-soft-indigo-icon">
              <BarChart3 className="size-5" aria-hidden />
            </span>
            <div>
              <h2 id="volume-context-heading" className="text-sm font-bold text-ds-text">
                O que {monthlyUnits} un./mês significam por dia
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ds-muted">
                <strong className="text-ds-text">{monthlyUnits} unidades/mês</strong> ≈{" "}
                <strong className="tabular-nums text-ds-text">{unitsPerDayApprox.toFixed(1)}</strong> unidades por dia
                (média ~{AVG_DAYS_PER_MONTH} dias/mês). O simulador abre em <strong className="text-ds-text">100/mês</strong>{" "}
                (~<strong className="tabular-nums text-ds-text">{(100 / AVG_DAYS_PER_MONTH).toFixed(1)}</strong>/dia) só
                para ser fácil de ler — <strong className="text-ds-text">é pouco volume</strong> para quem já trata a
                operação como negócio recorrente.
              </p>
            </div>
          </div>
        </div>
        <div>
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-ds-btn bg-ds-soft-amber text-ds-soft-amber-icon">
              <Target className="size-5" aria-hidden />
            </span>
            <div>
              <h3 className="text-sm font-bold text-ds-text">Mínimo mental para quem está começando mas é sério</h3>
              <p className="mt-2 text-sm leading-relaxed text-ds-muted">
                Pelo potencial de escala da <strong className="text-ds-text">Amazon.com (EUA)</strong>, muitos
                vendedores alinham metas na ordem de grandeza de pelo menos{" "}
                <strong className="text-ds-text">~{SERIOUS_BASELINE_UNITS_PER_DAY} unidades por dia</strong> quando o
                catálogo e o tráfego começam a responder — isto é, na casa das{" "}
                <strong className="tabular-nums text-ds-text">~{seriousMonthlyApprox} unidades/mês</strong>. Abaixo
                disso o simulador serve principalmente para ver custo de prep; acima disso a diferença Básico vs Premium
                fica ainda mais relevante.
              </p>
            </div>
          </div>
        </div>
        <div className="sm:col-span-2 lg:col-span-1">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-ds-btn bg-ds-soft-emerald text-ds-soft-emerald-icon">
              <Globe className="size-5" aria-hidden />
            </span>
            <div>
              <h3 className="text-sm font-bold text-ds-text">Porque a Amazon EUA importa</h3>
              <p className="mt-2 text-sm leading-relaxed text-ds-muted">
                A <strong className="text-ds-text">Amazon</strong> aparece de forma recorrente nos relatórios como o{" "}
                <strong className="text-ds-text">maior marketplace online do mundo</strong>. Nos Estados Unidos — o
                maior mercado de e-commerce do planeta — estudos (Digital Commerce 360, eMarketer, Statista) indicam
                que a Amazon <strong className="text-ds-text">sozinha concentra mais de um terço</strong> das{" "}
                <strong className="text-ds-text">vendas online no varejo</strong> do país (faixa ~35–40%, conforme o
                ano e a metodologia). Ou seja: o teto de demanda é enorme;{" "}
                <strong className="text-ds-text">100 unidades/mês é um piso baixo</strong> frente ao que o canal aguenta
                quando o produto encaixa.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Simulator */}
      <section className="space-y-4" aria-labelledby="sim-heading">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="sim-heading" className="text-xl font-bold tracking-tight text-ds-text">
              Simulador: quanto poupa por ano vs Básico?
            </h2>
            <p className="max-w-2xl text-sm text-ds-muted">
              Cenário base: <strong className="text-ds-text">100 unidades/mês</strong> (~
              <strong className="tabular-nums text-ds-text">{(100 / AVG_DAYS_PER_MONTH).toFixed(1)}</strong>/dia) de prep
              na linha que escolher, mais{" "}
              <strong className="text-ds-text">
                {PREMIUM_LANDING_DEFAULT_MONTHLY_PRODUCT_PHOTOS} fotos de produto por mês
              </strong>{" "}
              ({photoLabel}; Básico paga tabela, Premium US$0 nesta linha). Inclui 12 meses de prep, fotos e assinatura
              Premium.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="space-y-5 rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds">
            <div>
              <label htmlFor="units-slider" className="text-xs font-bold uppercase tracking-wide text-ds-muted">
                Unidades por mês (linha de prep)
              </label>
              <div className="mt-2 flex items-center gap-4">
                <input
                  id="units-slider"
                  type="range"
                  min={10}
                  max={800}
                  step={5}
                  value={monthlyUnits}
                  onChange={(e) => setMonthlyUnits(Number(e.target.value))}
                  className="h-2 w-full flex-1 cursor-pointer accent-ds-primary"
                />
                <input
                  type="number"
                  min={0}
                  max={50000}
                  value={monthlyUnits}
                  onChange={(e) => setMonthlyUnits(Math.max(0, Number(e.target.value) || 0))}
                  className="w-24 rounded-ds-btn border border-ds-border bg-ds-bg px-2 py-1.5 text-center text-sm font-semibold tabular-nums text-ds-text"
                  aria-label="Unidades por mês (valor exato)"
                />
              </div>
            </div>
            <div>
              <label htmlFor="svc-select" className="text-xs font-bold uppercase tracking-wide text-ds-muted">
                Linha de serviço (referência de prep)
              </label>
              <select
                id="svc-select"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="mt-2 w-full rounded-ds-btn border border-ds-border bg-ds-bg px-3 py-2.5 text-sm font-medium text-ds-text"
              >
                {PREP_CENTER_PRICING_MAIN.map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.label} — {formatUsd(line.basicUsd)} → {formatUsd(line.premiumUsd)}
                  </option>
                ))}
              </select>
            </div>
            <p className="rounded-ds-btn border border-ds-soft-violet-border bg-ds-soft-violet/60 px-3 py-2 text-xs leading-relaxed text-ds-text">
              Na tabela ao lado entram sempre{" "}
              <strong>{cmp.monthlyProductPhotos} fotos/mês</strong> ({photoLabel}, preço Básico {formatUsd(photoUnitBasicUsd)}{" "}
              cada × 12 meses). FBM mesmo dia (Amazon ou outras plataformas) e WhatsApp prioritário são benefícios
              operacionais — não entram como linha monetária na conta.
            </p>
          </div>

          <div className="space-y-4">
            <div className="overflow-x-auto rounded-ds-card border border-ds-border bg-ds-surface shadow-ds">
              <table className="min-w-full text-left text-sm">
                <caption className="border-b border-ds-border bg-ds-bg px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-ds-muted">
                  Conta anual estimada (prep + fotos + subscrição)
                </caption>
                <thead className="border-b border-ds-border bg-ds-bg text-xs font-semibold uppercase tracking-wide text-ds-muted">
                  <tr>
                    <th className="px-4 py-2.5" scope="col">
                      Item
                    </th>
                    <th className="px-4 py-2.5 tabular-nums" scope="col">
                      Básico
                    </th>
                    <th className="px-4 py-2.5 tabular-nums" scope="col">
                      Direct Premium
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ds-border text-ds-text">
                  <tr>
                    <td className="px-4 py-3">
                      <span className="font-medium">{serviceLabel}</span>
                      <span className="mt-0.5 block text-xs text-ds-muted">
                        {monthlyUnits} u./mês × 12 meses
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold">{formatUsd(cmp.basicPrepYearUsd)}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold text-ds-primary">{formatUsd(cmp.premiumPrepYearUsd)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">
                      <span className="font-medium">{photoLabel}</span>
                      <span className="mt-0.5 block text-xs text-ds-muted">
                        {cmp.monthlyProductPhotos} pedidos/mês × 12 (produto)
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold">{formatUsd(cmp.basicPhotosYearUsd)}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold text-ds-primary">{formatUsd(cmp.premiumPhotosYearUsd)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">Assinatura Direct Premium</td>
                    <td className="px-4 py-3 tabular-nums text-ds-muted">—</td>
                    <td className="px-4 py-3 tabular-nums font-semibold text-ds-primary">
                      {formatUsd(cmp.premiumSubscriptionYearUsd)}
                      <span className="mt-0.5 block text-xs font-normal text-ds-muted">12 × {formatUsd(PREMIUM_SUBSCRIPTION_USD_PER_MONTH)}</span>
                    </td>
                  </tr>
                  <tr className="bg-ds-bg font-bold">
                    <td className="px-4 py-3">Total no ano</td>
                    <td className="px-4 py-3 tabular-nums">{formatUsd(cmp.basicTotalYearUsd)}</td>
                    <td className="px-4 py-3 tabular-nums text-ds-primary">{formatUsd(cmp.premiumTotalYearUsd)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="rounded-ds-card border border-ds-border bg-ds-bg px-4 py-3 text-xs text-ds-muted">
              <p className="font-bold uppercase tracking-wide text-ds-text">Benefícios incluídos (sem linha de preço)</p>
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>
                  FBM personalizado — mesmo dia quando aplicável (válido para envios diretos com a sua etiqueta em
                  qualquer marketplace, não exclusivo Amazon).
                </li>
                <li>Atendimento via WhatsApp com prioridade.</li>
              </ul>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-ds-card border border-ds-border bg-ds-bg p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-ds-muted">Básico (1 ano)</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-ds-text">{formatUsd(cmp.basicTotalYearUsd)}</p>
                <p className="mt-1 text-xs text-ds-muted">Prep + fotos (sem mensalidade)</p>
              </div>
              <div className="rounded-ds-card border-2 border-ds-primary/40 bg-ds-soft-violet/40 p-4 shadow-ds">
                <p className="text-xs font-bold uppercase tracking-wide text-ds-soft-violet-icon">Premium (1 ano)</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-ds-text">{formatUsd(cmp.premiumTotalYearUsd)}</p>
                <p className="mt-1 text-xs text-ds-muted">Prep + fotos + assinatura</p>
              </div>
            </div>

            <div
              className={cn(
                "rounded-ds-card border p-5 shadow-ds",
                cmp.savingsYearUsd > 0
                  ? "border-ds-soft-emerald-border bg-ds-soft-emerald"
                  : "border-ds-soft-amber-border bg-ds-soft-amber",
              )}
            >
              {cmp.savingsYearUsd > 0 ? (
                <>
                  <p className="text-xs font-bold uppercase tracking-wide text-ds-soft-emerald-icon">
                    Poupança estimada no ano (prep + {cmp.monthlyProductPhotos} fotos/mês)
                  </p>
                  <p className="mt-1 text-3xl font-bold tabular-nums text-ds-text">{formatUsd(cmp.savingsYearUsd)}</p>
                  <p className="mt-2 text-sm text-ds-text">
                    Com <strong>{monthlyUnits}</strong> unidades/mês em «{serviceLabel}» e{" "}
                    <strong>{cmp.monthlyProductPhotos}</strong> fotos de produto/mês, o pacote Premium fica abaixo do
                    custo anual equivalente no Básico — além de FBM mesmo dia (multi-canal) e WhatsApp prioritário.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs font-bold uppercase tracking-wide text-ds-soft-amber-icon">
                    Neste mix o Premium pode sair mais caro só em dinheiro
                  </p>
                  <p className="mt-1 text-lg font-bold text-ds-text">
                    Diferença: {formatUsd(-cmp.savingsYearUsd)} a mais no Premium/ano{" "}
                    <span className="text-sm font-normal text-ds-muted">(prep + fotos + sub)</span>
                  </p>
                  <p className="mt-2 text-sm text-ds-text">
                    Suba o volume ou escolha uma linha com maior spread; o valor de{" "}
                    <strong>FBM no mesmo dia</strong> (outras plataformas incluídas) e <strong>WhatsApp prioritário</strong>{" "}
                    entra na decisão além da
                    conta acima.
                  </p>
                </>
              )}
            </div>

            <Link
              to="/app/settings"
              className="flex w-full items-center justify-center gap-2 rounded-ds-btn bg-cta-gradient px-6 py-3.5 text-sm font-bold text-white shadow-ds transition hover:opacity-[0.97]"
            >
              Comprar Direct Premium — {formatUsd(PREMIUM_SUBSCRIPTION_USD_PER_MONTH)}/mês
            </Link>
          </div>
        </div>
      </section>

      {/* Hooks grid */}
      <section className="space-y-4" aria-labelledby="vantagens-heading">
        <h2 id="vantagens-heading" className="text-xl font-bold tracking-tight text-ds-text">
          O que muda no dia a dia
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {hooks.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds transition hover:border-ds-primary/25"
            >
              <div className="flex size-10 items-center justify-center rounded-ds-btn bg-ds-soft-violet text-ds-soft-violet-icon">
                <Icon className="size-5" aria-hidden />
              </div>
              <h3 className="mt-3 text-sm font-bold text-ds-text">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ds-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA strip */}
      <section className="rounded-ds-card border border-ds-primary/20 bg-gradient-to-br from-ds-soft-violet to-ds-surface p-8 text-center shadow-ds">
        <h2 className="text-balance text-xl font-bold text-ds-text sm:text-2xl">
          Volume, fotos e suporte no mesmo pacote — Direct Premium alinha custo fixo com operação que não pára.
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-ds-muted">
          Já viu a tabela com 100 unidades/mês (~{(100 / AVG_DAYS_PER_MONTH).toFixed(1)}/dia) como ponto de partida. O
          passo seguinte é ativar o plano no portal (checkout
          recorrente em integração).
        </p>
        <Link
          to="/app/settings"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-ds-btn bg-cta-gradient px-8 py-3.5 text-sm font-bold text-white shadow-ds"
        >
          Comprar agora
        </Link>
      </section>
    </div>
  );
}
