import { AlertTriangle, Wallet } from "lucide-react";
import { Link } from "react-router-dom";

type Props = {
  issuesCount: number;
  balanceUsd: number;
  lowBalanceThresholdUsd?: number;
};

export function AlertBanner({ issuesCount, balanceUsd, lowBalanceThresholdUsd = 25 }: Props) {
  const lowBalance = balanceUsd < lowBalanceThresholdUsd;
  const hasIssues = issuesCount > 0;

  if (!hasIssues && !lowBalance) return null;

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-ds-card border border-amber-200/80 bg-amber-50 px-4 py-3 shadow-ds sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        {hasIssues ? (
          <div className="flex min-w-0 items-start gap-2 text-sm text-ds-text">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-ds-warning" aria-hidden />
            <p className="min-w-0 leading-snug">
              <span className="font-semibold">{issuesCount} problema(s)</span> exigem ação — conferência, foto ou
              divergência de recebimento.
            </p>
          </div>
        ) : null}
        {lowBalance ? (
          <div className="flex min-w-0 items-start gap-2 text-sm text-ds-text sm:border-l sm:border-amber-200/80 sm:pl-4">
            <Wallet className="mt-0.5 size-5 shrink-0 text-ds-warning" aria-hidden />
            <p className="min-w-0 leading-snug">
              <span className="font-semibold">Saldo baixo</span> (US$ {balanceUsd.toFixed(2)}). Evite fila pausada por
              pagamento.
            </p>
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {hasIssues ? (
          <Link
            to="/app/estoque"
            className="inline-flex items-center justify-center rounded-ds-btn bg-white px-3 py-2 text-sm font-semibold text-ds-text shadow-ds ring-1 ring-ds-border transition hover:bg-ds-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
          >
            Ver problemas
          </Link>
        ) : null}
        {lowBalance ? (
          <Link
            to="/app/financial"
            className="inline-flex items-center justify-center rounded-ds-btn bg-white px-3 py-2 text-sm font-semibold text-ds-text shadow-ds ring-1 ring-ds-border transition hover:bg-ds-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
          >
            Adicionar crédito
          </Link>
        ) : null}
      </div>
    </div>
  );
}
