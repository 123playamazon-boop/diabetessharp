export type ListingComplianceSeverity = "high" | "medium" | "low";

/** Um trecho ou padrão problemático na listagem. */
export type ListingComplianceViolation = {
  /** Texto exacto ou frase detectada (pode ser o match da expressão). */
  phrase: string;
  /** Por que viola política Amazon / é enganoso / linguagem restrita. */
  risk: string;
  /** Redacção sugerida (curta, segura). */
  replacement: string;
  severity: ListingComplianceSeverity;
};

export type ListingComplianceResult = {
  violations: ListingComplianceViolation[];
  /** Uma linha opcional quando não há violações ou como resumo. */
  summary?: string;
};
