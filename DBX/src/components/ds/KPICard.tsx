import { Link } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { useAnimatedCount } from "../../hooks/useAnimatedCount";
import { cn } from "../../lib/cn";

export type KPICardProps = {
  title: string;
  value: number;
  deltaLabel?: string;
  deltaTone?: "success" | "warning" | "danger" | "neutral";
  to?: string;
  icon: LucideIcon;
  sparkline: { v: number }[];
  variant?: "default" | "danger";
};

const deltaClass: Record<NonNullable<KPICardProps["deltaTone"]>, string> = {
  success: "bg-emerald-50 text-ds-success ring-emerald-100",
  warning: "bg-amber-50 text-ds-warning ring-amber-100",
  danger: "bg-red-50 text-ds-error ring-red-100",
  neutral: "bg-ds-bg text-ds-muted ring-ds-border",
};

export function KPICard({
  title,
  value,
  deltaLabel,
  deltaTone = "neutral",
  to,
  icon: Icon,
  sparkline,
  variant = "default",
}: KPICardProps) {
  const display = useAnimatedCount(value);
  const isDanger = variant === "danger";

  const body = (
    <motion.div
      role="group"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "relative flex h-full flex-col rounded-ds-card border border-ds-border bg-ds-surface p-4 shadow-ds transition hover:shadow-md",
        isDanger && "border-l-4 border-l-ds-error pl-[13px]",
      )}
    >
      {isDanger ? (
        <span className="absolute right-3 top-3 rounded-ds-btn bg-ds-error px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Urgente
        </span>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-9 items-center justify-center rounded-ds-btn bg-ds-bg text-ds-primary ring-1 ring-ds-border">
            <Icon className="size-4" aria-hidden />
          </span>
          <h3 className="text-sm font-semibold text-ds-muted">{title}</h3>
        </div>
        {deltaLabel ? (
          <span
            className={cn(
              "shrink-0 rounded-ds-btn px-2 py-0.5 text-xs font-semibold ring-1",
              deltaClass[deltaTone],
            )}
          >
            {deltaLabel}
          </span>
        ) : null}
      </div>

      <div className="mt-3 text-3xl font-bold tracking-tight text-ds-text tabular-nums">{display.toLocaleString()}</div>

      <div className="mt-3 h-12 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkline} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <Area
              type="monotone"
              dataKey="v"
              stroke="#6C5CE7"
              strokeWidth={2}
              fill="#6C5CE7"
              fillOpacity={0.08}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );

  if (to) {
    return (
      <Link to={to} className="block h-full rounded-ds-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary">
        {body}
      </Link>
    );
  }

  return body;
}
