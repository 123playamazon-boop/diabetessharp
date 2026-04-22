/** Decodifica entidades HTML comuns (ex.: `&#x27;` → `'`). Só browser. */
export function decodeHtmlEntities(text: string): string {
  if (typeof document === "undefined") return text;
  if (!text.includes("&") && !text.includes("&#")) return text;
  const el = document.createElement("textarea");
  el.innerHTML = text;
  return el.value;
}
