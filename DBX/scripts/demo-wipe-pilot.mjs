#!/usr/bin/env node
/**
 * Zera dados no servidor (clientes, pedidos, inventário, growth, leads Amazon, VIP, etc.)
 * e deixa `clients.json` vazio para registos reais (`POST /api/client/register`).
 *
 * Uso: `npm run demo:wipe-pilot` (API em SCRAPE_URL, default http://127.0.0.1:8787)
 */
const base = (process.env.SCRAPE_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const token =
  (process.env.ADMIN_API_TOKEN ?? "").trim() || "dbx-local-admin-token-do-not-use-in-prod";

const res = await fetch(`${base}/api/admin/demo/full-reset`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ emptyClients: true }),
});
const text = await res.text();
let body;
try {
  body = JSON.parse(text);
} catch {
  body = text;
}
console.log(`HTTP ${res.status}`);
console.log(body);
