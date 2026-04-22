import {
  ASSISTED_PURCHASE_ADMIN_API_BASE,
} from "../shared/assistedPurchaseRoutes";

/** Texto extra no JSON 404 de `/api/*` quando o URL sugere API desatualizada. */
export function apiNotFoundStaleHint(originalUrl: string): string {
  if (originalUrl.includes("reprice-pro")) {
    return " Confirme «npm run scrape-server» em DBX (porta 8787). Teste: curl -sS -X POST http://127.0.0.1:8787/api/admin/clients/10001/reprice-pro -H 'Content-Type: application/json' -d '{\"active\":true}' (JSON «ok», não 404 genérico).";
  }
  if (originalUrl.includes("amazon-leads")) {
    return " Confirme «npm run scrape-server» em DBX. Teste: curl -sS http://127.0.0.1:8787/api/admin/amazon-leads/editions (JSON com «editions», não 404 genérico).";
  }
  if (originalUrl.includes("assisted-purchases")) {
    return ` Confirme «npm run scrape-server» na pasta DBX (porta 8787). curl -sS http://127.0.0.1:8787/health deve mostrar «assistedPurchases»:true. Depois: curl -sS -X PATCH http://127.0.0.1:8787${ASSISTED_PURCHASE_ADMIN_API_BASE}/AP-TEST/checklist -H 'Content-Type: application/json' -d '{}' → 404 «Pedido não encontrado» (rota OK).`;
  }
  if (originalUrl.includes("/api/admin/wallet/adjust")) {
    return " Esta rota existe no código actual; 404 aqui quase sempre significa processo antigo na 8787. Pare o servidor (ou «node scripts/kill-port.mjs 8787») e volte a «npm run dev» / «npm run scrape-server». Se usar Docker, faça rebuild da imagem.";
  }
  return "";
}
