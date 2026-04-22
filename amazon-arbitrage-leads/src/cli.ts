#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "./env.js";
import { passesLeadRules } from "./filters.js";
import { fileURLToPath } from "node:url";
import { leadsToCsv } from "./csv.js";
import { fetchKeepaProducts } from "./keepa.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function readAsins(file: string): string[] {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const dry = process.argv.includes("--dry-run");
  const env = loadEnv(ROOT);
  if (!dry && !env.keepaApiKey) {
    console.error("Defina KEEPA_API_KEY no ficheiro .env (veja .env.example).");
    process.exit(1);
  }

  const asinFile = path.join(ROOT, "input-asins.txt");
  const asins = readAsins(asinFile);
  if (!asins.length) {
    console.error(`Coloque um ASIN por linha em ${asinFile} (exemplo em input-asins.example.txt).`);
    process.exit(1);
  }

  const rules = {
    minMonthlySold: env.minMonthlySold,
    minNewOffersTotal: env.minNewOffersTotal,
    excludeAmazonBuyBox: env.excludeAmazonBuyBox,
  };

  const date = new Date().toISOString().slice(0, 10);
  const passed: { date: string; asin: string; p: Record<string, unknown> }[] = [];
  const batches = chunk(asins, 100);

  for (const batch of batches) {
    if (dry) {
      console.log(`[dry-run] Lote ${batch.length} ASINs — não chama API.`);
      for (const asin of batch) {
        passed.push({ date, asin, p: { title: `(dry) ${asin}`, asin } });
      }
      continue;
    }
    const res = await fetchKeepaProducts({
      key: env.keepaApiKey,
      domain: env.domain,
      asins: batch,
      stats: 90,
      offers: env.keepaOffers,
    });
    if (typeof res.tokensLeft === "number") {
      console.log(`Keepa tokens restantes: ${res.tokensLeft}`);
    }
    for (const p of res.products ?? []) {
      const asin = typeof p.asin === "string" ? p.asin : "";
      if (!asin) continue;
      const { ok, reasons } = passesLeadRules(p, rules);
      if (!ok) {
        console.log(`SKIP ${asin}: ${reasons.join("; ")}`);
        continue;
      }
      console.log(`OK   ${asin}`);
      passed.push({ date, asin, p });
    }
  }

  const outDir = path.join(ROOT, "out");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `leads-${date}.csv`);
  const body = leadsToCsv(passed);
  fs.writeFileSync(outFile, body, "utf8");
  console.log(`Escrito: ${outFile} (${passed.length} linhas).`);
}

void main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
