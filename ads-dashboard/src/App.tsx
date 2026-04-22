import { useMemo } from "react";
import { AccountsTable } from "./components/AccountsTable";
import { ComparisonSection } from "./components/ComparisonSection";
import { HeaderBar } from "./components/HeaderBar";
import { SummaryRow } from "./components/SummaryRow";
import { deriveAccount } from "./statusRules";
import { useDashboardData } from "./useDashboardData";

function brTitleParts(d: Date): { dateStr: string; timeStr: string } {
  const dateStr = d.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  });
  const timeStr = d.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return { dateStr, timeStr };
}

export default function App() {
  const { data, loading, error, reload } = useDashboardData();

  const derivedRows = useMemo(() => {
    if (!data) return [];
    const meta = { roasFloor: data.summary.metaRoas, cpaCeil: data.summary.metaCpa };
    const roasVals = data.accounts.map((a) => (a.gasto > 0 ? a.revenue / a.gasto : 0));
    const bestRoasToday = Math.max(0.01, ...roasVals);
    return data.accounts.map((a) => deriveAccount(a, meta, bestRoasToday));
  }, [data]);

  const updatedAt = data ? new Date(data.updatedAt) : new Date();
  const { dateStr, timeStr } = brTitleParts(updatedAt);

  return (
    <div className="app">
      <HeaderBar
        title={`Dashboard — ${dateStr} · ${timeStr} Brasil`}
        subtitle="Visão consolidada de contas — atualização periódica (configurável)"
        updatedAt={updatedAt}
        onRefresh={() => reload()}
        refreshing={loading && !!data}
      />

      {error ? (
        <div className="banner banner--error" role="alert">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="skeleton-page" aria-busy="true">
          <div className="skeleton skeleton--hero" />
          <div className="skeleton-row">
            <div className="skeleton skeleton--card" />
            <div className="skeleton skeleton--card" />
            <div className="skeleton skeleton--card" />
          </div>
        </div>
      ) : null}

      {data ? (
        <>
          <SummaryRow s={data.summary} timeLabel={`${timeStr}`} />
          <ComparisonSection days={data.comparison} />
          <AccountsTable rows={derivedRows} timeLabel={`${timeStr}`} />
        </>
      ) : null}

      <footer className="footer">
        Sem <code>VITE_API_URL</code> usa dados de exemplo. Defina <code>.env</code> com a tua API e{" "}
        <code>VITE_REFRESH_MS</code> (mín. 5000 ms) para polling.
      </footer>
    </div>
  );
}
