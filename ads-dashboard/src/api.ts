import type { DashboardPayload } from "./types";
import { getMockDashboard } from "./mockData";

const API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";

export async function fetchDashboard(signal?: AbortSignal): Promise<DashboardPayload> {
  if (!API) {
    await new Promise((r) => setTimeout(r, 180));
    return getMockDashboard();
  }

  const res = await fetch(`${API}/dashboard`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<DashboardPayload>;
}
