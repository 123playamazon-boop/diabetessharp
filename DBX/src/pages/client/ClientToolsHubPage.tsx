import { Link } from "react-router-dom";
import { ClipboardList, FilePenLine, Layers, Radar, ShieldAlert, Wand2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { PageHeader } from "../../ui/PageHeader";
import { useI18n } from "../../i18n/context";
import { cn } from "../../lib/cn";

type ToolCard = { to: string; titleKey: string; descKey: string; icon: LucideIcon };

const TOOLS: ToolCard[] = [
  { to: "/app/product-hunter", titleKey: "client.tools.cardHunterTitle", descKey: "client.tools.cardHunterDesc", icon: Radar },
  { to: "/app/listing-generator", titleKey: "client.tools.cardGeneratorTitle", descKey: "client.tools.cardGeneratorDesc", icon: Wand2 },
  { to: "/app/improve-listing", titleKey: "client.tools.cardImproveTitle", descKey: "client.tools.cardImproveDesc", icon: FilePenLine },
  { to: "/app/listing-analysis", titleKey: "client.tools.cardAnalysisTitle", descKey: "client.tools.cardAnalysisDesc", icon: ClipboardList },
  { to: "/app/listing-compliance", titleKey: "client.tools.cardComplianceTitle", descKey: "client.tools.cardComplianceDesc", icon: ShieldAlert },
  { to: "/app/listing-multi-platform", titleKey: "client.tools.cardMultiTitle", descKey: "client.tools.cardMultiDesc", icon: Layers },
];

export function ClientToolsHubPage() {
  const { t } = useI18n();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader eyebrow={t("client.tools.eyebrow")} title={t("client.tools.title")} subtitle={t("client.tools.subtitle")} actions={<LanguageSwitcher />} />

      <p className="text-sm text-ds-muted">
        <Link to="/app/dashboard" className="font-semibold text-ds-primary underline-offset-2 hover:underline">
          {t("client.tools.backDashboard")}
        </Link>
      </p>

      <ul className="grid gap-4 sm:grid-cols-2">
        {TOOLS.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={cn(
                  "flex h-full flex-col gap-2 rounded-ds-card border border-ds-border bg-ds-surface p-5 shadow-ds transition",
                  "hover:border-ds-primary/40 hover:ring-1 hover:ring-ds-primary/20",
                )}
              >
                <span className="inline-flex size-10 items-center justify-center rounded-ds-btn bg-ds-bg ring-1 ring-ds-border">
                  <Icon className="size-5 text-ds-primary" aria-hidden />
                </span>
                <span className="text-base font-bold text-ds-text">{t(item.titleKey)}</span>
                <span className="text-sm leading-relaxed text-ds-muted">{t(item.descKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
