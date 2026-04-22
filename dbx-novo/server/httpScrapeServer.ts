import { createScrapeApiApp } from "./httpScrapeServerApp";
import { assertAuthEnvForProduction } from "./accessToken";
import { ASSISTED_PURCHASE_ADMIN_API_BASE } from "../shared/assistedPurchaseRoutes";

const port = Number(process.env.PORT || 8787);
const app = createScrapeApiApp();
assertAuthEnvForProduction();
app.listen(port, "0.0.0.0", () => {
  console.log(
    `[dbx-scrape-api] http://0.0.0.0:${port}  GET /health  POST /api/scrape  POST /api/admin/wallet/adjust  …/amazon-leads  …/reprice-pro  ${ASSISTED_PURCHASE_ADMIN_API_BASE}  PATCH ${ASSISTED_PURCHASE_ADMIN_API_BASE}/:id/checklist  …inventory  …/api/admin/wallet/ledger  …demo/full-reset`,
  );
});

