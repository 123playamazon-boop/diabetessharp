import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createScrapeApiApp } from "../httpScrapeServerApp";

const DEV_ADMIN_TOKEN = "dbx-local-admin-token-do-not-use-in-prod";

function addDaysYmdUtc(days: number): string {
  const d = new Date();
  const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const t = new Date(utc);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

/**
 * Simulação encadeada (um único `it`) da jornada cliente + admin sobre o mesmo estado de demo.
 * Inclui scrape, VIP, assistida, Growth, kits, pedido cliente, accept-production / notify-shipped, suporte (ticket + reply + fecho) e rotas admin.
 * Corre após `apiFlows.integration.test.ts` (ordem alfabética + fileParallelism: false).
 */
describe("Jornada cliente + admin (smoke encadeado)", () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevAdminToken = process.env.ADMIN_API_TOKEN;

  beforeAll(() => {
    process.env.NODE_ENV = "test";
    delete process.env.ADMIN_API_TOKEN;
  });

  afterAll(() => {
    process.env.NODE_ENV = prevNodeEnv;
    if (prevAdminToken === undefined) delete process.env.ADMIN_API_TOKEN;
    else process.env.ADMIN_API_TOKEN = prevAdminToken;
  });

  const app = createScrapeApiApp();

  it("full-reset → cliente (… + pedido + suporte) → admin (… + produção/envio + tickets)", async () => {
    const reset = await request(app)
      .post("/api/admin/demo/full-reset")
      .set("Authorization", `Bearer ${DEV_ADMIN_TOKEN}`)
      .send({ balanceUsd: 500, seedVipDemo: true })
      .expect(200);
    expect(reset.body?.ok).toBe(true);
    const suite = String(reset.body?.loginSuite ?? "10001");
    const demoPassword = String(reset.body?.loginPassword ?? "demo1234");

    const login = await request(app)
      .post("/api/client/login")
      .send({ email: "10001", password: demoPassword })
      .expect(200);
    const accessToken = login.body.accessToken as string;
    expect(typeof accessToken).toBe("string");

    const authClient = { Authorization: `Bearer ${accessToken}` };
    const authAdmin = { Authorization: `Bearer ${DEV_ADMIN_TOKEN}` };

    await request(app).get("/api/client/growth-program/landing-content").expect(200);

    await request(app)
      .post("/api/client/growth-program/conversion-event")
      .send({ placement: "journey_test", suite })
      .expect(200);

    const leadIntake = await request(app)
      .post("/api/client/growth-program/lead-intake")
      .send({
        fullName: "Journey Test",
        email: "journey-lead@test.demo",
        whatsapp: "+15551234567",
        businessModel: "online_arbitrage",
        monthlyRevenueBand: "5k_25k",
        productCountBand: "1_10",
        biggestChallenge: "Este é o maior desafio descrito com mais de trinta caracteres para o teste.",
        prepCenterUsage: "yes_active",
        investmentReadiness: "exploring",
      })
      .expect(200);
    expect(leadIntake.body?.ok).toBe(true);

    const me = await request(app).get("/api/client/me").set(authClient).expect(200);
    expect(me.body?.profile?.suite).toBe(suite);

    await request(app).post("/api/scrape").set(authClient).send({}).expect(400);

    const scrapeTry = await request(app)
      .post("/api/scrape")
      .set(authClient)
      .send({ url: "https://example.com/" });
    expect([200, 502]).toContain(scrapeTry.status);
    if (scrapeTry.status === 200) {
      expect(scrapeTry.body).toHaveProperty("supplier");
      expect(scrapeTry.body).toHaveProperty("sourceUrl");
    }

    const orders = await request(app).get("/api/client/orders").set(authClient).expect(200);
    expect(Array.isArray(orders.body?.orders)).toBe(true);

    const bundles = await request(app).get("/api/client/bundles").set(authClient).expect(200);
    expect(Array.isArray(bundles.body?.bundles)).toBe(true);

    const inv0 = await request(app).get("/api/client/inventory").set(authClient).expect(200);
    expect(inv0.body).toHaveProperty("additions");

    const invRowId = `JRNY-${Date.now()}`;
    const invPost = await request(app)
      .post("/api/client/inventory/additions")
      .set(authClient)
      .send({
        row: {
          id: invRowId,
          asin: "B0JRNY1",
          title: "Smoke journey SKU",
          qty: 2,
          kind: "cadastro_pendente",
          storageDays: 0,
          storageLimitDays: 30,
        },
      })
      .expect(200);
    const added = (invPost.body?.additions as { id: string; kind: string }[] | undefined)?.find((r) => r.id === invRowId);
    expect(added?.kind).toBe("cadastro_pendente");

    const walletAdj = await request(app)
      .post("/api/client/wallet/adjust")
      .set(authClient)
      .send({ deltaUsd: 7.5, reason: "journey_client_topup", reference: "jrny-client" })
      .expect(200);
    expect(typeof walletAdj.body?.balanceUsd).toBe("number");

    const ledgerClient = await request(app).get("/api/client/wallet/ledger").set(authClient).expect(200);
    expect(Array.isArray(ledgerClient.body?.entries)).toBe(true);
    expect(ledgerClient.body.entries.some((e: { reason?: string }) => e.reason === "journey_client_topup")).toBe(true);

    const apCreate = await request(app)
      .post("/api/client/assisted-purchases")
      .set(authClient)
      .send({
        productUrl: "https://example.com/",
        productTitle: "Produto journey assistida",
        quantity: 1,
        unitPriceUsd: 19.99,
        notes: "Notas longas para o teste de jornada: cor azul, tamanho M, observações de integração.",
        requiredDeliveryByDate: addDaysYmdUtc(14),
      })
      .expect(200);
    expect(apCreate.body?.ok).toBe(true);
    const apId = String(apCreate.body?.purchase?.id ?? "");
    expect(apId.length).toBeGreaterThan(3);

    const apListClient = await request(app).get("/api/client/assisted-purchases").set(authClient).expect(200);
    expect(Array.isArray(apListClient.body?.purchases)).toBe(true);

    const gSvc = await request(app)
      .post("/api/client/growth-program/service-request")
      .set(authClient)
      .send({ type: "other", body: "Pedido de serviço criado na jornada de integração automatizada." })
      .expect(200);
    expect(gSvc.body?.ok).toBe(true);

    const gDash = await request(app).get("/api/client/growth-program/dashboard").set(authClient).expect(200);
    expect(Array.isArray(gDash.body?.requests)).toBe(true);
    expect(gDash.body).toHaveProperty("summary");

    const gSub = await request(app).get("/api/client/growth-program/subscription-status").set(authClient).expect(200);
    expect(gSub.body).toHaveProperty("active");

    const adminClients = await request(app).get("/api/admin/clients").set(authAdmin).expect(200);
    expect(adminClients.body?.clients?.some((c: { suite?: string }) => c.suite === suite)).toBe(true);

    const adminLedger = await request(app)
      .get("/api/admin/wallet/ledger")
      .query({ suite })
      .set(authAdmin)
      .expect(200);
    expect(Array.isArray(adminLedger.body?.entries)).toBe(true);

    const adminWallet = await request(app)
      .post("/api/admin/wallet/adjust")
      .set(authAdmin)
      .send({ suite, deltaUsd: 3.25, reason: "journey_admin_credit", reference: "jrny-admin" })
      .expect(200);
    expect(typeof adminWallet.body?.balanceUsd).toBe("number");

    const apListAdmin = await request(app).get("/api/admin/assisted-purchases").set(authAdmin).expect(200);
    expect(apListAdmin.body?.purchases?.some((p: { id?: string }) => p.id === apId)).toBe(true);

    await request(app)
      .patch(`/api/admin/assisted-purchases/${encodeURIComponent(apId)}/checklist`)
      .set(authAdmin)
      .send({
        valueMatchesSupplierScreen: true,
        characteristicsMatchLink: true,
        shippingMatchesSupplier: false,
      })
      .expect(200);

    await request(app)
      .post(`/api/admin/assisted-purchases/${encodeURIComponent(apId)}/notify-client`)
      .set(authAdmin)
      .send({ type: "price_higher_than_declared" })
      .expect(200);

    const growthSnapshot = await request(app).get("/api/admin/growth-program/snapshot").set(authAdmin).expect(200);
    expect(growthSnapshot.body).toBeDefined();

    const growthLeads = await request(app).get("/api/admin/growth-program/lead-intakes").set(authAdmin).expect(200);
    expect(Array.isArray(growthLeads.body?.leads)).toBe(true);

    await request(app).get("/api/admin/amazon-leads/editions").set(authAdmin).expect(200);

    const vipStoreAdmin = await request(app).get("/api/admin/vip-store").set(authAdmin).expect(200);
    expect(vipStoreAdmin.body).toHaveProperty("products");

    const confirm = await request(app)
      .post(`/api/admin/inventory/additions/${encodeURIComponent(invRowId)}/confirm-receipt`)
      .set(authAdmin)
      .send({
        mode: "release",
        qtyReceived: 2,
        notifyClient: false,
        metadata: { tracking: "JRNYTRACK1", upc: "012345678905" },
      })
      .expect(200);
    const released = (confirm.body?.additions as { id: string; kind: string }[] | undefined)?.find((r) => r.id === invRowId);
    expect(released?.kind).toBe("novo");

    const invFinal = await request(app).get("/api/client/inventory").set(authClient).expect(200);
    const finalRow = (invFinal.body?.additions as { id: string; kind: string }[] | undefined)?.find((r) => r.id === invRowId);
    expect(finalRow?.kind).toBe("novo");

    const cat = await request(app).get("/api/client/vip-store/catalog").expect(200);
    const products = cat.body?.products as { id: string; stockQty: number }[] | undefined;
    const buyable = products?.find((p) => p.stockQty >= 1);
    if (buyable) {
      const chk = await request(app)
        .post("/api/client/vip-store/checkout")
        .set(authClient)
        .send({ lines: [{ productId: buyable.id, qty: 1 }] })
        .expect(200);
      expect(chk.body?.order?.id).toBeTruthy();
      expect(typeof chk.body?.balanceUsd).toBe("number");
    }

    const orderId = `JRNY-ORD-${Date.now()}`;
    const clientName =
      typeof me.body?.profile?.name === "string" && me.body.profile.name.trim()
        ? me.body.profile.name.trim()
        : "Journey Client";

    const orderPost = await request(app)
      .post("/api/client/orders")
      .set(authClient)
      .send({
        order: {
          id: orderId,
          status: "em_fila",
          service: "FBM",
          createdLabel: "JRNY",
          createdAtIso: new Date().toISOString(),
          suite,
          clientName,
        },
      })
      .expect(200);
    expect(orderPost.body?.order?.id).toBe(orderId);

    const ordersAfterCreate = await request(app).get("/api/client/orders").set(authClient).expect(200);
    expect(ordersAfterCreate.body?.orders?.some((o: { id?: string }) => o.id === orderId)).toBe(true);

    await request(app)
      .post("/api/admin/orders/accept-production")
      .set(authAdmin)
      .send({ orderId, suite, clientName, acceptedAtIso: new Date().toISOString() })
      .expect(200);

    const shipped = await request(app)
      .post("/api/admin/orders/notify-shipped")
      .set(authAdmin)
      .send({
        orderId,
        suite,
        clientName,
        service: "FBM",
        units: 1,
        productSummary: "Journey integration — smoke",
        trackingUrl: "https://example.com/track",
      })
      .expect(200);
    expect(typeof shipped.body?.to).toBe("string");

    const ticketRes = await request(app)
      .post("/api/client/support-ticket")
      .set(authClient)
      .send({
        subject: "Dúvida na jornada de teste",
        body: "Corpo do ticket com texto suficiente para validar o fluxo cliente → admin no smoke de integração.",
      })
      .expect(200);
    const ticketId = String(ticketRes.body?.ticket?.id ?? "");
    expect(ticketId.length).toBeGreaterThan(3);

    const adminTickets = await request(app).get("/api/admin/support-tickets").set(authAdmin).expect(200);
    expect(adminTickets.body?.tickets?.some((t: { id?: string }) => t.id === ticketId)).toBe(true);

    await request(app)
      .post(`/api/admin/support-tickets/${encodeURIComponent(ticketId)}/reply`)
      .set(authAdmin)
      .send({ text: "Resposta da equipa no teste de jornada automatizada." })
      .expect(200);

    await request(app)
      .patch(`/api/admin/support-tickets/${encodeURIComponent(ticketId)}`)
      .set(authAdmin)
      .send({ status: "closed" })
      .expect(200);

    const clientTickets = await request(app).get("/api/client/support-tickets").query({ suite }).expect(200);
    expect(clientTickets.body?.tickets?.some((t: { id?: string }) => t.id === ticketId)).toBe(true);

    const adminOrders = await request(app).get("/api/admin/client-orders").set(authAdmin).expect(200);
    expect(Array.isArray(adminOrders.body?.orders)).toBe(true);
    expect(adminOrders.body?.orders?.some((o: { id?: string }) => o.id === orderId)).toBe(true);
  });
});
