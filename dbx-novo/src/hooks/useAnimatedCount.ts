import { useEffect, useState } from "react";

/** Contagem animada de 0 até `target` (ou nova meta) com easing suave. */
export function useAnimatedCount(target: number, durationMs = 900) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    setValue(0);
    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) * (1 - t);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}
