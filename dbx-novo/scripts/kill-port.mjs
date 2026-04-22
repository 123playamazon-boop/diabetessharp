#!/usr/bin/env node
/**
 * Liberta uma porta TCP (SIGKILL nos PIDs que escutam nela).
 * Usado pelo `predev` em vez de `lsof | xargs kill` (evita erros com lista vazia).
 */
import { execSync } from "node:child_process";

const port = process.argv[2]?.trim() || "8787";
if (!/^\d+$/.test(port)) {
  console.error("Uso: node scripts/kill-port.mjs <porta>");
  process.exit(1);
}

let out = "";
try {
  out = execSync(`lsof -ti :${port}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
} catch {
  process.exit(0);
}

const pids = out
  .split(/\s+/)
  .map((s) => s.trim())
  .filter(Boolean);

for (const pid of pids) {
  const n = Number.parseInt(pid, 10);
  if (!Number.isFinite(n) || n <= 0) continue;
  try {
    process.kill(n, "SIGKILL");
    console.log(`[kill-port] ${port}: encerrado PID ${n}`);
  } catch {
    /* processo já terminou */
  }
}
