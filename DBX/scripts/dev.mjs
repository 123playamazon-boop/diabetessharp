#!/usr/bin/env node
/**
 * Arranque API + Vite a partir da raiz do projeto, sem propagar `npm_config_devdir`
 * (variável que o Cursor injeta e que dispara aviso «Unknown env config devdir» no npm).
 */
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

delete process.env.npm_config_devdir;
delete process.env.NPM_CONFIG_devdir;

spawnSync(process.execPath, [path.join(root, "scripts/kill-port.mjs"), "8787"], {
  stdio: "inherit",
  cwd: root,
});

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(
  npx,
  ["concurrently", "-k", "-n", "api,web", "-c", "blue,green", "npm run scrape-server", "vite"],
  {
    stdio: "inherit",
    env: { ...process.env },
    shell: process.platform === "win32",
  },
);

child.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
