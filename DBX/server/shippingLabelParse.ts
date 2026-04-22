import { createRequire } from "node:module";
import { detectTrackingWithFilenameHint, type ShippingTrackingMatch } from "../src/lib/shippingTrackingDetect";

/** Entrada interna do pacote — evita `index.js`, que em ESM corre código de teste e falha com ENOENT. */
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
  data: Buffer,
  options?: unknown,
) => Promise<{ text?: string }>;

export type ParseLabelResponse = {
  ok: true;
  textLength: number;
  match: ShippingTrackingMatch | null;
};

export async function parseShippingLabelPdfDataUrl(
  dataUrl: string,
  fileName?: string | null,
): Promise<ParseLabelResponse | { ok: false; error: string }> {
  const trimmed = dataUrl.trim();
  if (!trimmed.startsWith("data:application/pdf")) {
    return { ok: false, error: "Só PDF (data:application/pdf;base64,...) é suportado para leitura automática." };
  }
  const comma = trimmed.indexOf(",");
  if (comma < 0) return { ok: false, error: "Data URL inválida." };
  const b64 = trimmed.slice(comma + 1).replace(/\s/g, "");
  let buf: Buffer;
  try {
    buf = Buffer.from(b64, "base64");
  } catch {
    return { ok: false, error: "Base64 inválido." };
  }
  if (buf.length < 40) return { ok: false, error: "PDF demasiado pequeno." };

  let text = "";
  try {
    const out = await pdfParse(buf);
    text = typeof out.text === "string" ? out.text : "";
  } catch {
    return { ok: false, error: "Não foi possível ler o PDF (ficheiro corrompido ou imagem escaneada sem texto)." };
  }

  const match = detectTrackingWithFilenameHint(text, fileName);
  return { ok: true, textLength: text.length, match };
}
