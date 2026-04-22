import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../i18n/context";
import { fetchGrowthLandingContent } from "../lib/growthProgramApi";

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(vars[k] ?? `{{${k}}}`));
}

/** `tl` = tradução i18n + overrides editáveis no admin (`growth.*` keys). */
export function useGrowthLandingStrings() {
  const { t } = useI18n();
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    void fetchGrowthLandingContent()
      .then((r) => setOverrides(r.overrides ?? {}))
      .catch(() => setOverrides({}));
  }, []);

  const tl = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const o = overrides[key];
      if (typeof o === "string" && o.trim()) return interpolate(o, vars);
      return t(key, vars);
    },
    [overrides, t],
  );

  return { tl };
}
