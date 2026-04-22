import { useEffect, useState } from "react";

export type BriefProgressPhase = 0 | 1 | 2 | 3 | 4;

/**
 * Mensagens de progresso baseadas só no tempo decorrido (sem polling real).
 * Fases alinhadas ao copy pedido: 0–10s, 10–30s, 30–50s, 50–60s, 60s+.
 */
export function useBriefGenerationProgress(active: boolean): { phase: BriefProgressPhase; elapsedSec: number; barPct: number } {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!active) {
      setElapsedMs(0);
      return;
    }
    const t0 = Date.now();
    const id = window.setInterval(() => setElapsedMs(Date.now() - t0), 200);
    return () => window.clearInterval(id);
  }, [active]);

  const elapsedSec = active ? elapsedMs / 1000 : 0;
  let phase: BriefProgressPhase = 0;
  if (elapsedSec >= 60) phase = 4;
  else if (elapsedSec >= 50) phase = 3;
  else if (elapsedSec >= 30) phase = 2;
  else if (elapsedSec >= 10) phase = 1;

  const barPct = active ? Math.min(94, 6 + elapsedSec * 1.35 + (phase >= 3 ? 4 : 0)) : 0;

  return { phase, elapsedSec: Math.floor(elapsedSec), barPct };
}
