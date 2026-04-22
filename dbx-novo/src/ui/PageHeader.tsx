import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">{eyebrow}</p>
        ) : null}
        <h1 className="mt-2 text-3xl font-bold uppercase tracking-wide text-ds-text">{title}</h1>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ds-muted normal-case">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
