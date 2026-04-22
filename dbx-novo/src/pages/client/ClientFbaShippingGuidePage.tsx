import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

function Section({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds">
      <p className="text-xs font-bold uppercase tracking-wide text-ds-primary">{kicker}</p>
      <h2 className="mt-1 text-lg font-bold text-ds-text">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-ds-muted">{children}</div>
    </section>
  );
}

export function ClientFbaShippingGuidePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <div>
        <Link
          to="/app/pedidos/criar"
          className="inline-flex items-center gap-1 text-sm font-semibold text-ds-muted transition hover:text-ds-primary"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Voltar a criar envio
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-ds-text sm:text-3xl">
          Como enviar os seus produtos para a Amazon FBA com a Direct Box USA
        </h1>
        <p className="mt-2 text-sm text-ds-muted">
          Guia prático passo a passo para o envio correto aos centros logísticos da Amazon nos Estados Unidos.
        </p>
      </div>

      <Section kicker="Etapa 1" title="Crie o seu pedido na plataforma">
        <ul className="list-inside list-disc space-y-1">
          <li>Aceda à conta e registe um novo envio.</li>
          <li>Vá em <strong className="text-ds-text">Produtos / Estoque</strong>.</li>
          <li>Clique em <strong className="text-ds-text">Criar pedido</strong> (ou fluxo equivalente de envio).</li>
          <li>Indique os produtos que serão enviados para o nosso armazém.</li>
        </ul>
        <p className="rounded-ds-btn border border-ds-soft-sky-border bg-ds-soft-sky/50 px-3 py-2 text-xs text-ds-text">
          Isso permite que a equipe identifique e processe os itens corretamente assim que chegarem.
        </p>
      </Section>

      <Section kicker="Etapa 2" title="Envie os produtos para o nosso endereço">
        <ul className="list-inside list-disc space-y-1">
          <li>Após criar o pedido, realize a compra com os fornecedores.</li>
          <li>Utilize o endereço da sua <strong className="text-ds-text">suíte</strong> fornecido pela Direct Box USA.</li>
        </ul>
        <p className="text-xs">
          Os produtos serão recebidos, conferidos e armazenados com segurança.
        </p>
      </Section>

      <Section kicker="Etapa 3" title="Envie as etiquetas dos produtos (FNSKU)">
        <ul className="list-inside list-disc space-y-1">
          <li>Quando os produtos estiverem a caminho ou já entregues, aceda ao envio no sistema.</li>
          <li>Faça <strong className="text-ds-text">upload das etiquetas FNSKU</strong> (código de barras da Amazon).</li>
        </ul>
        <p className="text-xs text-ds-text">
          A equipe aplica corretamente em cada unidade.{" "}
          <strong>Todos os produtos precisam de FNSKU</strong> para serem aceites pela Amazon.
        </p>
      </Section>

      <Section kicker="Etapa 4" title="Preparação e embalagem">
        <p>Após receção, o prep realiza:</p>
        <ul className="list-inside list-disc space-y-1">
          <li>Conferência dos itens</li>
          <li>Etiquetagem (FNSKU)</li>
          <li>Embalagem profissional (prep FBA)</li>
          <li>Organização em caixas master</li>
        </ul>
        <p className="text-xs">Tudo alinhado com os padrões exigidos pela Amazon.</p>
      </Section>

      <Section kicker="Etapa 5" title="Informações da caixa master">
        <p>Depois da preparação, você receberá:</p>
        <ul className="list-inside list-disc space-y-1">
          <li>Peso da caixa</li>
          <li>Dimensões (altura, largura e comprimento)</li>
          <li>Quantidade de unidades por caixa</li>
        </ul>
        <p className="text-xs text-ds-text">
          Com estes dados poderá criar o envio no <strong>Seller Central</strong> (Send to Amazon).
        </p>
      </Section>

      <Section kicker="Etapa 6" title="Crie o envio no Seller Central">
        <p className="text-ds-text">
          Amazon Seller Central → <strong>Send to Amazon</strong>
        </p>
        <ul className="list-inside list-disc space-y-1">
          <li>Indique as quantidades</li>
          <li>Insira os dados das caixas (fornecidos por nós)</li>
          <li>Escolha o tipo de envio (SPD ou LTL)</li>
        </ul>
      </Section>

      <Section kicker="Etapa 7" title="Envie as etiquetas de envio (caixa master)">
        <p>Após finalizar o envio na Amazon, envie-nos:</p>
        <ul className="list-inside list-disc space-y-1">
          <li>
            <strong className="text-ds-text">Etiquetas das caixas</strong> (Box Labels — Amazon)
          </li>
          <li>
            <strong className="text-ds-text">Etiqueta da transportadora</strong> (UPS / FedEx)
          </li>
        </ul>
        <p className="rounded-ds-btn border border-ds-warning/30 bg-ds-soft-amber/40 px-3 py-2 text-xs text-ds-soft-amber-icon">
          No portal Direct Box USA, use o fluxo <strong className="text-ds-text">«Completar etiquetas da caixa»</strong> no
          pedido FBA, depois de ter as duas etiquetas prontas.
        </p>
      </Section>

      <Section kicker="Etapa 8" title="Envio para a Amazon">
        <ul className="list-inside list-disc space-y-1">
          <li>Colagem nas caixas</li>
          <li>Agendamento da coleta</li>
          <li>Envio para o centro logístico da Amazon</li>
        </ul>
        <p className="text-xs">Acompanhamento no painel do cliente.</p>
      </Section>

      <Section kicker="Etapa 9" title="Acompanhe o envio">
        <ul className="list-inside list-disc space-y-1">
          <li>Estado do pedido</li>
          <li>Rastreamento</li>
          <li>Confirmação de entrega na Amazon</li>
        </ul>
      </Section>

      <section className="rounded-ds-card border border-ds-border bg-ds-bg p-5 shadow-ds">
        <h2 className="text-lg font-bold text-ds-text">Dicas importantes</h2>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ds-muted">
          <li>Todos os produtos devem ter FNSKU.</li>
          <li>Evite misturar produtos sem identificação.</li>
          <li>Revise sempre as quantidades antes de criar o envio na Amazon.</li>
          <li>Envie as etiquetas da caixa a tempo para evitar atrasos.</li>
        </ul>
        <p className="mt-4 text-sm font-medium text-ds-text">
          Quanto mais rápido você enviar as etiquetas da caixa após receber peso e medidas, mais rápido os produtos ficam
          disponíveis para venda na Amazon.
        </p>
      </section>

      <p className="text-center text-sm font-semibold text-ds-text">
        Seguindo este processo, a operação fica alinhada com os padrões da Amazon. A equipe Direct Box USA apoia em cada
        etapa.
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        <Link
          to="/app/pedidos/criar"
          className="rounded-ds-btn bg-cta-gradient px-5 py-2.5 text-sm font-bold text-white shadow-ds focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
        >
          Criar envio FBA
        </Link>
        <Link
          to="/app/pedidos"
          className="rounded-ds-btn border border-ds-border bg-ds-surface px-5 py-2.5 text-sm font-semibold text-ds-text shadow-ds"
        >
          Ver pedidos
        </Link>
      </div>
    </div>
  );
}
