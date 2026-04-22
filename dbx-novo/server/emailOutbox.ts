import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data", "email-outbox.json");

type OutEntry = {
  to: string;
  subject: string;
  text: string;
  meta?: Record<string, unknown>;
  queuedAtIso: string;
};

function readAll(): OutEntry[] {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const j = JSON.parse(raw) as unknown;
    return Array.isArray(j) ? (j as OutEntry[]) : [];
  } catch {
    return [];
  }
}

/** Demo: não envia e-mail real — grava fila e regista no log do servidor. */
export function queueDemoEmail(params: { to: string; subject: string; text: string; meta?: Record<string, unknown> }) {
  const list = readAll();
  const entry: OutEntry = {
    to: params.to,
    subject: params.subject,
    text: params.text,
    meta: params.meta,
    queuedAtIso: new Date().toISOString(),
  };
  list.push(entry);
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), "utf8");
  console.log(`[dbx-demo-email] para=${params.to} assunto=${params.subject}`);
}

export function clearEmailOutbox(): void {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, "[]", "utf8");
}
