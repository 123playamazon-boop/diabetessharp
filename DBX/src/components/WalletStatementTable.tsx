import { Download } from "lucide-react";
import type { AppLocale } from "../i18n/catalog";
import { formatUsd } from "../lib/prepCenterPricing";
import type { WalletLedgerEntryDto } from "../lib/walletApi";

function formatLedgerDateTime(iso: string, locale: AppLocale): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  const tag = locale === "pt-BR" ? "pt-BR" : locale === "es" ? "es" : "en-US";
  return new Intl.DateTimeFormat(tag, { dateStyle: "short", timeStyle: "short" }).format(new Date(ms));
}

function escapeCsvCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function walletLedgerReasonKey(reason: string): string {
  const map: Record<string, string> = {
    card_sim_topup: "wallet.reason.cardSimTopup",
    shipment_fee: "wallet.reason.shipmentFee",
    shipment_fee_rollback: "wallet.reason.shipmentFeeRollback",
    customer_return_merchandise: "wallet.reason.customerReturnMerchandise",
    admin_console_credit: "wallet.reason.adminConsoleCredit",
    premium_subscription_activated: "wallet.reason.premiumActivated",
    premium_subscription_cancelled: "wallet.reason.premiumCancelled",
    amazon_leads_pro_activated: "wallet.reason.amazonLeadsProActivated",
    amazon_leads_pro_cancelled: "wallet.reason.amazonLeadsProCancelled",
    dbx_reprice_pro_activated: "wallet.reason.dbxRepriceProActivated",
    dbx_reprice_pro_cancelled: "wallet.reason.dbxRepriceProCancelled",
    vip_store_purchase: "wallet.reason.vipStorePurchase",
    vip_store_refund: "wallet.reason.vipStoreRefund",
    assisted_purchase: "wallet.reason.assisted_purchase",
    assisted_purchase_refund: "wallet.reason.assisted_purchase_refund",
    adjust: "wallet.reason.adjust",
  };
  return map[reason] ?? "wallet.reason.other";
}

function downloadCsv(filename: string, lines: string[]) {
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type WalletStatementTableProps = {
  entries: WalletLedgerEntryDto[];
  locale: AppLocale;
  /** i18n function */
  t: (key: string, vars?: Record<string, string | number>) => string;
  suiteLabel?: string;
  emptyLabel: string;
  csvFilename: string;
};

export function WalletStatementTable({ entries, locale, t, suiteLabel, emptyLabel, csvFilename }: WalletStatementTableProps) {
  const labelFor = (reason: string) => {
    const k = walletLedgerReasonKey(reason);
    const raw = t(k);
    return raw === k ? t("wallet.reason.other", { reason }) : raw;
  };

  const onExport = () => {
    const headers = [
      t("wallet.statement.colDate"),
      t("wallet.statement.colDescription"),
      t("wallet.statement.colReference"),
      t("wallet.statement.colDebit"),
      t("wallet.statement.colCredit"),
      t("wallet.statement.colBalance"),
    ];
    const lines = [headers.map(escapeCsvCell).join(",")];
    for (const row of [...entries].sort((a, b) => Date.parse(a.atIso) - Date.parse(b.atIso))) {
      const debit = row.deltaUsd < 0 ? formatUsd(-row.deltaUsd) : "";
      const credit = row.deltaUsd > 0 ? formatUsd(row.deltaUsd) : "";
      lines.push(
        [
          formatLedgerDateTime(row.atIso, locale),
          labelFor(row.reason),
          row.reference ?? "",
          debit,
          credit,
          formatUsd(row.balanceAfter),
        ]
          .map(escapeCsvCell)
          .join(","),
      );
    }
    downloadCsv(csvFilename, lines);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {suiteLabel ? (
          <p className="text-xs font-bold uppercase tracking-wide text-ds-muted">
            {t("wallet.statement.suiteLine", { suite: suiteLabel })}
          </p>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onExport}
          disabled={entries.length === 0}
          className="inline-flex items-center gap-2 rounded-ds-btn border border-ds-border bg-ds-surface px-3 py-2 text-xs font-bold uppercase tracking-wide text-ds-text shadow-ds transition hover:bg-ds-bg disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="size-4" aria-hidden />
          {t("wallet.statement.exportCsv")}
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-ds-card border border-ds-border bg-ds-surface px-4 py-8 text-center text-sm text-ds-muted">{emptyLabel}</p>
      ) : (
        <div className="overflow-x-auto rounded-ds-card border border-ds-border bg-ds-surface shadow-ds">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm text-ds-text">
            <thead className="border-b border-ds-border bg-ds-bg text-[11px] font-black uppercase tracking-wide text-ds-muted">
              <tr>
                <th className="px-3 py-3">{t("wallet.statement.colDate")}</th>
                <th className="px-3 py-3">{t("wallet.statement.colDescription")}</th>
                <th className="px-3 py-3">{t("wallet.statement.colReference")}</th>
                <th className="px-3 py-3 text-right tabular-nums">{t("wallet.statement.colDebit")}</th>
                <th className="px-3 py-3 text-right tabular-nums">{t("wallet.statement.colCredit")}</th>
                <th className="px-3 py-3 text-right tabular-nums">{t("wallet.statement.colBalance")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ds-border">
              {entries.map((row, idx) => {
                const debit = row.deltaUsd < 0 ? formatUsd(-row.deltaUsd) : "—";
                const credit = row.deltaUsd > 0 ? formatUsd(row.deltaUsd) : "—";
                return (
                  <tr key={`${row.atIso}-${row.reference ?? idx}`} className="hover:bg-ds-bg/60">
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-ds-muted">{formatLedgerDateTime(row.atIso, locale)}</td>
                    <td className="max-w-[280px] px-3 py-2.5 text-sm font-medium leading-snug">{labelFor(row.reason)}</td>
                    <td className="max-w-[140px] truncate px-3 py-2.5 font-mono text-xs text-ds-muted" title={row.reference}>
                      {row.reference ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-rose-700">{debit}</td>
                    <td className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-emerald-700">{credit}</td>
                    <td className="px-3 py-2.5 text-right text-sm font-bold tabular-nums text-ds-text">{formatUsd(row.balanceAfter)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
