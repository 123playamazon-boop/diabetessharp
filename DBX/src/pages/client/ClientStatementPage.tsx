import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { WalletStatementTable } from "../../components/WalletStatementTable";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { useClientProfile } from "../../context/ClientProfileContext";
import { useI18n } from "../../i18n/context";
import { fetchWalletLedger, type WalletLedgerEntryDto } from "../../lib/walletApi";
import { PageHeader } from "../../ui/PageHeader";

function ymdForFilename(): string {
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}`;
}

export function ClientStatementPage() {
  const { t, locale } = useI18n();
  const { profile } = useClientProfile();
  const [entries, setEntries] = useState<WalletLedgerEntryDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchWalletLedger(profile.suite);
    setLoading(false);
    if (!r.ok) {
      toast.error(r.error);
      setEntries([]);
      return;
    }
    setEntries(r.entries);
  }, [profile.suite]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        eyebrow={t("client.statement.eyebrow")}
        title={t("client.statement.title")}
        subtitle={t("client.statement.subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LanguageSwitcher />
            <button
              type="button"
              disabled={loading}
              onClick={() => void load()}
              className="rounded-ds-btn border border-ds-border bg-ds-surface px-4 py-2.5 text-xs font-black uppercase tracking-wide text-ds-text shadow-ds transition hover:bg-ds-bg disabled:opacity-50"
            >
              {t("client.statement.refresh")}
            </button>
            <Link
              to="/app/financial"
              className="inline-flex items-center justify-center rounded-ds-btn border border-ds-border bg-ds-bg px-4 py-2.5 text-xs font-black uppercase tracking-wide text-ds-text shadow-ds transition hover:bg-white"
            >
              {t("client.statement.backFinancial")}
            </Link>
            <Link
              to="/app/taxas"
              className="inline-flex items-center justify-center rounded-ds-btn border border-ds-border bg-ds-surface px-4 py-2.5 text-xs font-black uppercase tracking-wide text-ds-primary shadow-ds transition hover:bg-ds-bg"
            >
              {t("client.statement.linkFees")}
            </Link>
          </div>
        }
      />

      {loading ? (
        <p className="text-sm text-ds-muted" aria-live="polite">
          {t("client.statement.loading")}
        </p>
      ) : (
        <WalletStatementTable
          entries={entries}
          locale={locale}
          t={t}
          suiteLabel={profile.suite}
          emptyLabel={t("client.statement.empty")}
          csvFilename={`extrato-${profile.suite}-${ymdForFilename()}.csv`}
        />
      )}

      <p className="text-center text-xs leading-relaxed text-ds-muted">{t("client.statement.footerHint")}</p>
    </div>
  );
}
