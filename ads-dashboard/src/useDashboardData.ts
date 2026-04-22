import { useCallback, useEffect, useState } from "react";
import { fetchDashboard } from "./api";
import type { DashboardPayload } from "./types";

function parseRefreshMs(): number {
  const raw = import.meta.env.VITE_REFRESH_MS;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 5000 ? n : 120_000;
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    fetchDashboard()
      .then((p) => {
        setData(p);
        setError(null);
      })
      .catch((e: Error) => setError(e.message || "Erro ao carregar"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const ms = parseRefreshMs();
    const id = window.setInterval(() => {
      fetchDashboard()
        .then((p) => {
          setData(p);
          setError(null);
        })
        .catch(() => {});
    }, ms);
    return () => window.clearInterval(id);
  }, []);

  return { data, loading, error, reload };
}
