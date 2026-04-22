export function PlaceholderPage({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Module</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">
          {subtitle ??
            "This section is wired next — navigation and permissions stay consistent with the new shell."}
        </p>
      </div>
      <div className="rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm">
        <p className="text-sm leading-relaxed text-zinc-600">
          You’re in the new <span className="font-semibold text-zinc-900">DBX NOVO</span> experience. When we connect the
          API, this page becomes real workflows without changing the overall layout.
        </p>
      </div>
    </div>
  );
}
