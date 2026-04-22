import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Megaphone, PackagePlus, Send, Wallet, Warehouse } from "lucide-react";
import { motion } from "framer-motion";
import { mockQuickActionCards } from "../../mock/dashboard";
import type { ClientQuickActionCounts } from "../../lib/clientDashboardMetrics";
import { cn } from "../../lib/cn";
import { useI18n } from "../../i18n/context";

type Tone = "violet" | "indigo" | "emerald" | "amber" | "sky";

type CardDef = {
  to: string;
  label: string;
  description: string;
  count: number;
  countLabel: string;
  icon: LucideIcon;
  tone: Tone;
};

const toneClass: Record<
  Tone,
  {
    card: string;
    borderHover: string;
    iconWrap: string;
    icon: string;
    badge: string;
    shadowHover: string;
  }
> = {
  violet: {
    card: "bg-ds-soft-violet border-ds-soft-violet-border",
    borderHover: "hover:border-ds-primary/35",
    iconWrap: "bg-white/75 ring-ds-soft-violet-border",
    icon: "text-ds-soft-violet-icon",
    badge: "bg-white/90 text-ds-soft-violet-icon ring-ds-soft-violet-border",
    shadowHover: "hover:shadow-[0_6px_16px_rgba(108,92,231,0.12)]",
  },
  indigo: {
    card: "bg-ds-soft-indigo border-ds-soft-indigo-border",
    borderHover: "hover:border-ds-soft-indigo-icon/25",
    iconWrap: "bg-white/75 ring-ds-soft-indigo-border",
    icon: "text-ds-soft-indigo-icon",
    badge: "bg-white/90 text-ds-soft-indigo-icon ring-ds-soft-indigo-border",
    shadowHover: "hover:shadow-[0_6px_16px_rgba(79,70,229,0.12)]",
  },
  emerald: {
    card: "bg-ds-soft-emerald border-ds-soft-emerald-border",
    borderHover: "hover:border-ds-success/30",
    iconWrap: "bg-white/75 ring-ds-soft-emerald-border",
    icon: "text-ds-soft-emerald-icon",
    badge: "bg-white/90 text-ds-soft-emerald-icon ring-ds-soft-emerald-border",
    shadowHover: "hover:shadow-[0_6px_16px_rgba(16,185,129,0.12)]",
  },
  amber: {
    card: "bg-ds-soft-amber border-ds-soft-amber-border",
    borderHover: "hover:border-ds-warning/35",
    iconWrap: "bg-white/80 ring-ds-soft-amber-border",
    icon: "text-ds-soft-amber-icon",
    badge: "bg-white/90 text-ds-soft-amber-icon ring-ds-soft-amber-border",
    shadowHover: "hover:shadow-[0_6px_16px_rgba(245,158,11,0.14)]",
  },
  sky: {
    card: "bg-ds-soft-sky border-ds-soft-sky-border",
    borderHover: "hover:border-ds-soft-sky-icon/28",
    iconWrap: "bg-white/75 ring-ds-soft-sky-border",
    icon: "text-ds-soft-sky-icon",
    badge: "bg-white/90 text-ds-soft-sky-icon ring-ds-soft-sky-border",
    shadowHover: "hover:shadow-[0_6px_16px_rgba(3,105,161,0.12)]",
  },
};

const defaultCounts: ClientQuickActionCounts = {
  registerDrafts: mockQuickActionCards.productDrafts,
  shipmentsQueue: mockQuickActionCards.shipmentsQueue,
  activeSkus: mockQuickActionCards.activeSkus,
  announcementsUnread: mockQuickActionCards.announcementsUnread,
  financePending: mockQuickActionCards.financePending,
};

function buildCards(
  counts: ClientQuickActionCounts,
  t: (k: string) => string,
): CardDef[] {
  return [
    {
      to: "/app/cadastro-produto",
      label: t("client.quick.registerLabel"),
      description: t("client.quick.registerDesc"),
      count: counts.registerDrafts,
      countLabel: t("client.quick.registerBadge"),
      icon: PackagePlus,
      tone: "violet",
    },
    {
      to: "/app/pedidos/criar",
      label: t("client.quick.shipLabel"),
      description: t("client.quick.shipDesc"),
      count: counts.shipmentsQueue,
      countLabel: t("client.quick.shipBadge"),
      icon: Send,
      tone: "indigo",
    },
    {
      to: "/app/estoque",
      label: t("client.quick.stockLabel"),
      description: t("client.quick.stockDesc"),
      count: counts.activeSkus,
      countLabel: t("client.quick.stockBadge"),
      icon: Warehouse,
      tone: "emerald",
    },
    {
      to: "/app/grupo-vip",
      label: t("client.quick.vipLabel"),
      description: t("client.quick.vipDesc"),
      count: counts.announcementsUnread,
      countLabel: t("client.quick.vipBadge"),
      icon: Megaphone,
      tone: "amber",
    },
    {
      to: "/app/financial",
      label: t("client.quick.finLabel"),
      description: t("client.quick.finDesc"),
      count: counts.financePending,
      countLabel: t("client.quick.finBadge"),
      icon: Wallet,
      tone: "sky",
    },
  ];
}

export type QuickActionCardsProps = {
  counts?: Partial<ClientQuickActionCounts>;
};

export function QuickActionCards({ counts }: QuickActionCardsProps) {
  const { t } = useI18n();
  const merged = { ...defaultCounts, ...counts };
  const cards = buildCards(merged, t);
  return (
    <div className="space-y-3 pt-1">
      <h3 className="text-xs font-bold uppercase tracking-wide text-ds-text">{t("client.quick.section")}</h3>
      <ul
        className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5"
        aria-label="Atalhos operacionais"
      >
        {cards.map((c, index) => {
          const Icon = c.icon;
          const t = toneClass[c.tone];
          return (
            <li key={c.to} className="min-w-0">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: index * 0.04 }}
              >
                <Link
                  to={c.to}
                  className={cn(
                    "group flex h-full min-h-[132px] flex-col rounded-ds-card border p-4 shadow-ds transition",
                    t.card,
                    "hover:-translate-y-0.5",
                    t.borderHover,
                    t.shadowHover,
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary",
                  )}
                  aria-label={`${c.label}. ${c.count} ${c.countLabel}. ${c.description}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        "inline-flex size-12 shrink-0 items-center justify-center rounded-ds-card ring-1 transition",
                        t.iconWrap,
                        "group-hover:ring-ds-border/80",
                      )}
                      aria-hidden
                    >
                      <Icon className={cn("size-6", t.icon)} strokeWidth={2} />
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ring-1",
                        t.badge,
                      )}
                    >
                      {c.count}
                    </span>
                  </div>
                  <p className="mt-3 text-xs font-bold uppercase leading-snug tracking-wide text-ds-text">{c.label}</p>
                  <p className="mt-1 line-clamp-2 flex-1 text-[11px] font-medium uppercase leading-relaxed tracking-wide text-ds-muted">
                    {c.description}
                  </p>
                  <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-ds-muted">{c.countLabel}</p>
                </Link>
              </motion.div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
