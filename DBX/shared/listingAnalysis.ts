import type { ListingPlatformId } from "./listingGenerator";

export type ListingAnalysisWeakSeverity = "high" | "medium" | "low";

/** Área da listagem onde o analisador encontrou fraqueza ou risco. */
export type ListingAnalysisWeakArea = {
  /** Ex.: «Título», «Bullets», «Descrição», «Conformidade». */
  label: string;
  /** O que está fraco ou arriscado, em linguagem concreta. */
  detail: string;
  severity: ListingAnalysisWeakSeverity;
};

export type ListingAnalysisResult = {
  seoScore: number;
  conversionScore: number;
  complianceScore: number;
  suggestions: string[];
  weakAreas: ListingAnalysisWeakArea[];
};

export type ListingAnalysisPayload = {
  platform: ListingPlatformId;
  title: string;
  bullets: string;
  description: string;
};
