import { Link } from "react-router-dom";
import { PageHeader } from "../../ui/PageHeader";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { useI18n } from "../../i18n/context";

export function ClientFeesHelpPage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        eyebrow={t("client.fees.eyebrow")}
        title={t("client.fees.title")}
        subtitle={t("client.fees.subtitle")}
        actions={<LanguageSwitcher />}
      />

      <div className="space-y-4 rounded-ds-card border border-ds-border bg-ds-surface p-5 text-sm leading-relaxed text-ds-text shadow-ds">
        <p>{t("client.fees.p1")}</p>
        <p>{t("client.fees.p2")}</p>
        <ul className="list-disc space-y-2 pl-5 text-ds-muted">
          <li>{t("client.fees.bullet1")}</li>
          <li>{t("client.fees.bullet2")}</li>
          <li>{t("client.fees.bullet3")}</li>
        </ul>
        <p className="text-ds-muted">{t("client.fees.p3")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          to="/app/financial"
          className="inline-flex rounded-ds-btn border border-ds-border bg-ds-bg px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-ds-text shadow-ds hover:bg-white"
        >
          {t("client.fees.backFinancial")}
        </Link>
        <Link
          to="/app/extrato"
          className="inline-flex rounded-ds-btn bg-ds-primary px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow-ds hover:opacity-95"
        >
          {t("client.fees.openStatement")}
        </Link>
      </div>
    </div>
  );
}
