import { Link } from "react-router-dom";
import { ChevronLeft, FileSpreadsheet, Sparkles, Wand2 } from "lucide-react";
import {
  AI_LISTING_PRO_MONTHLY_CAP,
  AI_LISTING_PRO_MONTHLY_USD,
  AI_LISTING_STARTER_MONTHLY_CAP,
  AI_LISTING_STARTER_MONTHLY_USD,
} from "../lib/aiListingProduct";
import { formatUsd } from "../lib/prepCenterPricing";

const starterLabel = formatUsd(AI_LISTING_STARTER_MONTHLY_USD);
const proLabel = formatUsd(AI_LISTING_PRO_MONTHLY_USD);

const steps = [
  {
    n: "1",
    title: "Crie a sua conta no portal DBX",
    body: "Registo com suite; o add-on de listagens IA é activado pela equipa após confirmação do plano.",
  },
  {
    n: "2",
    title: "Escolha Starter ou Pro",
    body: `Starter: até ${AI_LISTING_STARTER_MONTHLY_CAP} listagens geradas por mês por ${starterLabel}. Pro: até ${AI_LISTING_PRO_MONTHLY_CAP} listagens por mês por ${proLabel}. Só um plano activo por suite.`,
  },
  {
    n: "3",
    title: "Use o gerador no portal",
    body: "Após activação, em «Gerador IA» pode criar anúncios novos ou melhorar um existente a partir da URL pública do anúncio — e exportar o resultado em Excel.",
  },
];

export function AiListingProductPublicPage() {
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
          <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-teal-500/15 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-20 -left-16 size-64 rounded-full bg-emerald-500/15 blur-3xl" aria-hidden />
          <div className="relative p-6 sm:p-10">
            <p className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-teal-900">
              <Sparkles className="size-3.5" aria-hidden />
              DBX · Gerador de listagens IA
            </p>
            <h1 className="mt-4 max-w-3xl text-balance text-3xl font-bold tracking-tight text-ds-text sm:text-4xl">
              Anúncios para Amazon, Walmart, TikTok Shop, Shopify e Mercado Livre Internacional — com exportação em
              Excel.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ds-muted">
              Gere títulos, bullets, descrição e palavras-chave alinhados à plataforma. No modo{" "}
              <strong className="text-ds-text">melhorar anúncio</strong>, a análise parte da{" "}
              <strong className="text-ds-text">URL pública</strong> que enviar (o servidor extrai o texto visível).
              Depois pode <strong className="text-ds-text">descarregar tudo em planilha</strong> para a sua equipa.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/app/entrar"
                className="inline-flex items-center justify-center rounded-ds-btn bg-ds-primary px-5 py-3 text-sm font-bold text-white shadow-ds transition hover:opacity-95"
              >
                Cadastrar / entrar
              </Link>
              <Link
                to="/app/listing-generator"
                className="inline-flex items-center justify-center rounded-ds-btn border border-ds-border bg-ds-bg px-5 py-3 text-sm font-semibold text-ds-text shadow-ds"
              >
                Já tenho conta — abrir o gerador
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-ds-card border border-ds-border bg-ds-surface p-6 shadow-ds ring-1 ring-emerald-500/20">
            <div className="flex items-center gap-2 text-emerald-800">
              <Wand2 className="size-5" aria-hidden />
              <span className="text-xs font-bold uppercase tracking-wide">Plano Starter</span>
            </div>
            <p className="mt-3 text-3xl font-black tabular-nums text-ds-text">
              {starterLabel}
              <span className="ml-2 text-base font-semibold text-ds-muted">/ mês</span>
            </p>
            <p className="mt-2 text-sm font-semibold text-ds-text">Até {AI_LISTING_STARTER_MONTHLY_CAP} listagens geradas por mês.</p>
            <ul className="mt-4 space-y-2 text-sm text-ds-muted">
              <li className="flex gap-2">
                <FileSpreadsheet className="mt-0.5 size-4 shrink-0 text-ds-primary" aria-hidden />
                <span>Exportação Excel com todos os campos devolvidos pela IA.</span>
              </li>
              <li className="flex gap-2">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-ds-primary" aria-hidden />
                <span>Ideal para quem publica poucos SKUs novos ou revisões semanais.</span>
              </li>
            </ul>
          </div>

          <div className="rounded-ds-card border border-ds-border bg-ds-surface p-6 shadow-ds ring-1 ring-violet-500/25">
            <div className="flex items-center gap-2 text-violet-900">
              <Sparkles className="size-5" aria-hidden />
              <span className="text-xs font-bold uppercase tracking-wide">Plano Pro</span>
            </div>
            <p className="mt-3 text-3xl font-black tabular-nums text-ds-text">
              {proLabel}
              <span className="ml-2 text-base font-semibold text-ds-muted">/ mês</span>
            </p>
            <p className="mt-2 text-sm font-semibold text-ds-text">Até {AI_LISTING_PRO_MONTHLY_CAP} listagens geradas por mês.</p>
            <ul className="mt-4 space-y-2 text-sm text-ds-muted">
              <li className="flex gap-2">
                <FileSpreadsheet className="mt-0.5 size-4 shrink-0 text-violet-700" aria-hidden />
                <span>Mesmo fluxo de exportação e plataformas — mais volume para agências e catálogos maiores.</span>
              </li>
              <li className="flex gap-2">
                <Wand2 className="mt-0.5 size-4 shrink-0 text-violet-700" aria-hidden />
                <span>Um plano por suite; activar Pro desliga o Starter automaticamente (e vice-versa).</span>
              </li>
            </ul>
          </div>
        </section>

        <section className="mt-10 rounded-ds-card border border-ds-border bg-ds-surface p-6 shadow-ds sm:p-8">
          <h2 className="text-lg font-bold text-ds-text">Como contratar</h2>
          <ol className="mt-6 grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <li key={s.n} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-black text-teal-900 ring-1 ring-teal-200">
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
            <strong className="text-ds-text">Admin:</strong> em «Assin. Listagens IA» aparecem as suites com botões
            para activar ou revogar <em>Starter</em> e <em>Pro</em>. Os valores ({starterLabel} / {proLabel}) são a
            referência comercial; o portal regista apenas o estado do add-on.
          </p>
        </section>
      </div>
    </div>
  );
}
