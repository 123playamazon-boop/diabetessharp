function formatBrasilia(d: Date): string {
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatPdt(d: Date): string {
  return d.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function HeaderBar({
  title,
  subtitle,
  updatedAt,
  onRefresh,
  refreshing,
}: {
  title: string;
  subtitle?: string;
  updatedAt: Date;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const br = formatBrasilia(updatedAt);
  const pdt = formatPdt(updatedAt);

  return (
    <header className="header">
      <div>
        <h1 className="header__title">{title}</h1>
        {subtitle ? <p className="header__sub">{subtitle}</p> : null}
        <p className="header__meta">
          Brasil: {br} · PDT: {pdt} — início do pico US
        </p>
      </div>
      <div className="header__actions">
        <span className="header__sync">
          Atualizado:{" "}
          {updatedAt.toLocaleTimeString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
        <button type="button" className="btn" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? "A atualizar…" : "Atualizar agora"}
        </button>
      </div>
    </header>
  );
}
