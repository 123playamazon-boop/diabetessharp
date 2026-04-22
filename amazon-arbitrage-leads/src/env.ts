import fs from "node:fs";
import path from "node:path";

export type AppEnv = {
  keepaApiKey: string;
  domain: number;
  minMonthlySold: number;
  minNewOffersTotal: number;
  excludeAmazonBuyBox: boolean;
  keepaOffers: number;
};

function parseEnvFile(filePath: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return out;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    out[k] = v;
  }
  return out;
}

export function loadEnv(root = process.cwd()): AppEnv {
  const file = path.join(root, ".env");
  const fromFile = parseEnvFile(file);
  const pick = (k: string, def: string) => process.env[k] ?? fromFile[k] ?? def;
  const key = pick("KEEPA_API_KEY", "").trim();
  return {
    keepaApiKey: key,
    domain: Math.max(1, Number.parseInt(pick("KEEPA_DOMAIN", "1"), 10) || 1),
    minMonthlySold: Math.max(0, Number.parseInt(pick("MIN_MONTHLY_SOLD", "100"), 10) || 100),
    minNewOffersTotal: Math.max(1, Number.parseInt(pick("MIN_NEW_OFFERS_TOTAL", "4"), 10) || 4),
    excludeAmazonBuyBox: pick("EXCLUDE_AMAZON_BUYBOX", "1") === "1",
    keepaOffers: Math.min(100, Math.max(0, Number.parseInt(pick("KEEPA_OFFERS", "20"), 10) || 20)),
  };
}
