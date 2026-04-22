import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data", "wallet-ledger.json");

export type WalletLedgerEntry = {
  atIso: string;
  suite: string;
  deltaUsd: number;
  balanceAfter: number;
  reason: string;
  reference?: string;
};

export function readWalletLedger(): WalletLedgerEntry[] {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const j = JSON.parse(raw) as unknown;
    return Array.isArray(j) ? (j as WalletLedgerEntry[]) : [];
  } catch {
    return [];
  }
}

export function appendWalletLedger(entry: Omit<WalletLedgerEntry, "atIso"> & { atIso?: string }): WalletLedgerEntry {
  const full: WalletLedgerEntry = {
    ...entry,
    atIso: entry.atIso ?? new Date().toISOString(),
  };
  const list = readWalletLedger();
  list.push(full);
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), "utf8");
  console.log(`[dbx-wallet] suite=${full.suite} delta=${full.deltaUsd} balance=${full.balanceAfter} ${full.reason}`);
  return full;
}

export function clearWalletLedger(): void {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, "[]", "utf8");
}
