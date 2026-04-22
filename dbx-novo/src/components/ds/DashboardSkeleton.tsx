export function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Carregando painel">
      <div className="h-16 rounded-ds-card bg-ds-border/60" />
      <div className="space-y-2">
        <div className="h-6 w-48 rounded bg-ds-border/60" />
        <div className="h-4 w-full max-w-md rounded bg-ds-border/40" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="h-36 rounded-ds-card bg-ds-border/60" />
        <div className="h-36 rounded-ds-card bg-ds-border/60" />
        <div className="h-36 rounded-ds-card bg-ds-border/60" />
        <div className="h-36 rounded-ds-card bg-ds-border/60" />
      </div>
      <div className="space-y-3 pt-1">
        <div className="h-4 w-32 rounded bg-ds-border/50" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[132px] rounded-ds-card bg-ds-border/60" />
          ))}
        </div>
      </div>
      <div className="h-24 rounded-ds-card bg-ds-border/60" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-96 rounded-ds-card bg-ds-border/60 lg:col-span-2" />
        <div className="h-96 rounded-ds-card bg-ds-border/60" />
      </div>
    </div>
  );
}
