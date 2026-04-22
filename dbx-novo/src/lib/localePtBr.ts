/** Locale e formatação consistentes em português do Brasil (interface). */
export const PT_BR = "pt-BR" as const;

export function formatDateTimeShortPtBr(date: Date = new Date()): string {
  return date.toLocaleString(PT_BR, { dateStyle: "short", timeStyle: "short" });
}
