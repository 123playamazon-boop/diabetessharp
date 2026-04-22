import type { StatusTone } from "../types";

const toneClass: Record<StatusTone, string> = {
  success: "badge--success",
  warning: "badge--warning",
  danger: "badge--danger",
  info: "badge--info",
  neutral: "badge--neutral",
};

export function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  return <span className={`badge ${toneClass[tone]}`}>{label}</span>;
}
