import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createScrapeApiApp } from "../httpScrapeServerApp";

const DEV_ADMIN_TOKEN = "dbx-local-admin-token-do-not-use-in-prod";

describe("httpScrapeServer API flows (integration)", () => {
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

  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health").expect(200);
    expect(res.body).toMatchObject({ ok: true, service: "dbx-scrape-api" });
  });

  it("GET /api/client/me without auth → 401", async () => {
    const res = await request(app).get("/api/client/me").expect(401);
    expect(typeof res.body?.error).toBe("string");
  });

  it("GET /api/admin/clients without auth → 401", async () => {
    await request(app).get("/api/admin/clients").expect(401);
  });

  it("POST /api/admin/demo/full-reset without auth → 401", async () => {
    await request(app).post("/api/admin/demo/full-reset").send({}).expect(401);
  });

  it("POST /api/client/login with bad password → 401", async () => {
    await request(app)
      .post("/api/client/login")
      .send({ email: "10001", password: "definitely-wrong-password" })
      .expect(401);
  });

  it("POST /api/scrape without auth → 401", async () => {
    await request(app).post("/api/scrape").send({ url: "https://example.com" }).expect(401);
  });

  it("GET /api/admin/clients with wrong admin token → 403", async () => {
    await request(app)
      .get("/api/admin/clients")
      .set("Authorization", "Bearer not-the-real-admin-token")
      .expect(403);
  });

  it("GET /api/admin/growth-program/subscriptions without auth → 401", async () => {
    await request(app).get("/api/admin/growth-program/subscriptions").expect(401);
  });

  it("GET /api/admin/growth-program/subscriptions with admin → 200", async () => {
    const res = await request(app)
      .get("/api/admin/growth-program/subscriptions")
      .set("Authorization", `Bearer ${DEV_ADMIN_TOKEN}`)
      .expect(200);
    expect(Array.isArray(res.body?.subscriptions)).toBe(true);
  });

  it("PATCH /api/admin/growth-program/subscriptions/x without auth → 401", async () => {
    await request(app)
      .patch("/api/admin/growth-program/subscriptions/sub-test-missing")
      .send({ status: "paused" })
      .expect(401);
  });

  it("GET /api/admin/amazon-leads/editions without auth → 401", async () => {
    await request(app).get("/api/admin/amazon-leads/editions").expect(401);
  });

  it("PATCH /api/admin/vip-store/orders/fake-id without auth → 401", async () => {
    await request(app).patch("/api/admin/vip-store/orders/fake-id").send({ status: "entregue" }).expect(401);
  });

  it("GET /api/client/growth-program/landing-content (public) → 200", async () => {
    const res = await request(app).get("/api/client/growth-program/landing-content").expect(200);
    expect(res.body).toHaveProperty("overrides");
  });

  it("GET /api/client/vip-store/catalog → 200", async () => {
    const res = await request(app).get("/api/client/vip-store/catalog").expect(200);
    expect(res.body).toHaveProperty("products");
    expect(res.body).toHaveProperty("feePct");
  });

  it("GET /api/client/vip/catalog (alias) → 200 and matches store catalog shape", async () => {
    const [a, b] = await Promise.all([
      request(app).get("/api/client/vip-store/catalog").expect(200),
      request(app).get("/api/client/vip/catalog").expect(200),
    ]);
    expect(a.body).toEqual(b.body);
  });

  describe("after demo full-reset + client login", () => {
    let accessToken: string;

    beforeAll(async () => {
      const reset = await request(app)
        .post("/api/admin/demo/full-reset")
        .set("Authorization", `Bearer ${DEV_ADMIN_TOKEN}`)
        .send({})
        .expect(200);
      expect(reset.body?.ok).toBe(true);

      const login = await request(app)
        .post("/api/client/login")
        .send({ email: "10001", password: reset.body.loginPassword ?? "demo1234" })
        .expect(200);
      accessToken = login.body.accessToken;
      expect(typeof accessToken).toBe("string");
      expect(accessToken.length).toBeGreaterThan(20);
    });

    it("GET /api/client/me with JWT → 200", async () => {
      const res = await request(app)
        .get("/api/client/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      expect(res.body?.profile?.suite).toBe("10001");
    });

    it("GET /api/client/orders with JWT (no suite query) → 200", async () => {
      const res = await request(app)
        .get("/api/client/orders")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      expect(Array.isArray(res.body?.orders)).toBe(true);
    });

    it("GET /api/admin/clients with client JWT → 403", async () => {
      await request(app)
        .get("/api/admin/clients")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(403);
    });

    it("GET /api/admin/clients with admin token → 200", async () => {
      const res = await request(app)
        .get("/api/admin/clients")
        .set("Authorization", `Bearer ${DEV_ADMIN_TOKEN}`)
        .expect(200);
      expect(res.body?.clients?.length).toBeGreaterThanOrEqual(1);
    });

    it("POST /api/admin/wallet/adjust without auth → 401", async () => {
      await request(app)
        .post("/api/admin/wallet/adjust")
        .send({ suite: "10001", deltaUsd: 1, reason: "test" })
        .expect(401);
    });

    it("POST /api/admin/wallet/adjust with admin token → 200", async () => {
      const res = await request(app)
        .post("/api/admin/wallet/adjust")
        .set("Authorization", `Bearer ${DEV_ADMIN_TOKEN}`)
        .send({ suite: "10001", deltaUsd: 12.34, reason: "integration_credit", reference: "itest-1" })
        .expect(200);
      expect(typeof res.body?.balanceUsd).toBe("number");
      expect(res.body.balanceUsd).toBeGreaterThanOrEqual(12.34);
    });

    it("GET /api/client/vip-announcements with JWT → 200", async () => {
      const res = await request(app)
        .get("/api/client/vip-announcements")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      expect(Array.isArray(res.body?.announcements)).toBe(true);
    });

    it("GET /api/client/vip-store/orders with JWT → 200", async () => {
      const res = await request(app)
        .get("/api/client/vip-store/orders")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      expect(Array.isArray(res.body?.orders)).toBe(true);
    });

    it("GET /api/client/growth-program/subscription-status with JWT → 200", async () => {
      const res = await request(app)
        .get("/api/client/growth-program/subscription-status")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      expect(res.body).toHaveProperty("active");
    });

    it("POST /api/client/listing-generator with JWT → 200 (demo or live)", async () => {
      const res = await request(app)
        .post("/api/client/listing-generator")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          productName: "Test thermal bottle",
          platform: "amazon_us",
          mainBenefit: "Keeps drinks cold 24h",
          productDifferentiation: "Leak-proof cap vs generic bottles",
          targetAudience: "US commuters",
          brandOwner: true,
          internationalProduct: false,
        })
        .expect(200);
      expect(res.body?.ok).toBe(true);
      expect(res.body?.listing?.title?.length).toBeGreaterThan(5);
      expect(Array.isArray(res.body?.listing?.bulletPoints)).toBe(true);
      expect(res.body?.listing?.bulletPoints?.length).toBeGreaterThanOrEqual(5);
      expect(typeof res.body?.listing?.description).toBe("string");
      expect(typeof res.body?.listing?.keywords).toBe("string");
    });

    it("POST /api/client/listing-analysis without text → 400", async () => {
      const res = await request(app)
        .post("/api/client/listing-analysis")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ platform: "amazon_us", title: "", bullets: "", description: "" })
        .expect(400);
      expect(typeof res.body?.error).toBe("string");
    });

    it("POST /api/client/listing-analysis → 200 demo with scores and suggestions", async () => {
      const prevKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      try {
        const res = await request(app)
          .post("/api/client/listing-analysis")
          .set("Authorization", `Bearer ${accessToken}`)
          .send({
            platform: "amazon_us",
            title: "Insulated water bottle 750 ml — keeps drinks cold 24 hours",
            bullets: "STAYS COLD — double-wall vacuum\nLEAK-RESISTANT — twist cap with silicone seal\nFITS CUP HOLDERS — slim 7cm diameter",
            description: "Take it on commutes and gym sessions. Hand wash recommended. BPA-free stainless steel.",
          })
          .expect(200);
        expect(res.body?.ok).toBe(true);
        expect(res.body?.mode).toBe("demo");
        const a = res.body?.analysis;
        expect(typeof a?.seoScore).toBe("number");
        expect(typeof a?.conversionScore).toBe("number");
        expect(typeof a?.complianceScore).toBe("number");
        expect(a.seoScore).toBeGreaterThanOrEqual(0);
        expect(a.seoScore).toBeLessThanOrEqual(10);
        expect(Array.isArray(a?.suggestions)).toBe(true);
        expect(a.suggestions.length).toBeGreaterThanOrEqual(3);
        expect(Array.isArray(a?.weakAreas)).toBe(true);
      } finally {
        if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
        else process.env.OPENAI_API_KEY = prevKey;
      }
    });

    it("POST /api/client/product-hunter without budget → 400", async () => {
      const res = await request(app)
        .post("/api/client/product-hunter")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ budget: "", marketplace: "amazon_us", experienceLevel: "intermediate" })
        .expect(400);
      expect(typeof res.body?.error).toBe("string");
    });

    it("POST /api/client/growth-program/strategy-ai without question → 400", async () => {
      const res = await request(app)
        .post("/api/client/growth-program/strategy-ai")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ mode: "growth_strategy", question: "" })
        .expect(400);
      expect(typeof res.body?.error).toBe("string");
    });

    it("POST /api/client/growth-program/strategy-ai → 200 demo (sales_consultant)", async () => {
      const prevKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      try {
        const res = await request(app)
          .post("/api/client/growth-program/strategy-ai")
          .set("Authorization", `Bearer ${accessToken}`)
          .send({
            mode: "sales_consultant",
            question: "Margins feel tight after fee increases — should I raise prices or cut ad spend first?",
            context: "Amazon US private label, ~$50k/mo",
          })
          .expect(200);
        expect(res.body?.ok).toBe(true);
        expect(res.body?.mode).toBe("demo");
        expect(res.body?.aiMode).toBe("sales_consultant");
        const r = res.body?.result;
        expect(typeof r?.diagnosis).toBe("string");
        expect(typeof r?.marketReality).toBe("string");
        expect(Array.isArray(r?.actionSteps)).toBe(true);
        expect(r.actionSteps.length).toBeGreaterThanOrEqual(3);
        expect(typeof r?.executiveMemo).toBe("string");
      } finally {
        if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
        else process.env.OPENAI_API_KEY = prevKey;
      }
    });

    it("POST /api/client/product-hunter → 200 demo with ranked products", async () => {
      const prevKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      try {
        const res = await request(app)
          .post("/api/client/product-hunter")
          .set("Authorization", `Bearer ${accessToken}`)
          .send({
            budget: "$4k first PO, FBA preferred",
            marketplace: "amazon_us",
            experienceLevel: "beginner",
          })
          .expect(200);
        expect(res.body?.ok).toBe(true);
        expect(res.body?.mode).toBe("demo");
        const h = res.body?.hunter;
        expect(Array.isArray(h?.products)).toBe(true);
        expect(h.products.length).toBeGreaterThanOrEqual(4);
        const scores: number[] = h.products.map((p: { opportunityScore?: number }) => Number(p?.opportunityScore));
        for (let i = 0; i < scores.length - 1; i += 1) {
          expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
        }
        const p0 = h.products[0];
        expect(typeof p0?.idea).toBe("string");
        expect(["high", "medium", "low"]).toContain(p0?.demandLevel);
        expect(["high", "medium", "low"]).toContain(p0?.competitionLevel);
        expect(typeof p0?.estimatedProfitMargin).toBe("string");
        expect(typeof p0?.bestMarketplace).toBe("string");
        expect(typeof p0?.logisticsFeasibility).toBe("string");
        expect(typeof p0?.whyTrending).toBe("string");
        expect(typeof p0?.sellingStrategy).toBe("string");
      } finally {
        if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
        else process.env.OPENAI_API_KEY = prevKey;
      }
    });

    it("POST /api/client/product-hunter com locale=es devolve resumo em espanhol (demo)", async () => {
      const prevKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      try {
        const res = await request(app)
          .post("/api/client/product-hunter")
          .set("Authorization", `Bearer ${accessToken}`)
          .send({
            budget: "$4k first PO",
            marketplace: "amazon_us",
            experienceLevel: "beginner",
            locale: "es",
          })
          .expect(200);
        expect(res.body?.mode).toBe("demo");
        expect(String(res.body?.hunter?.summary)).toContain("Modo demo");
        expect(String(res.body?.hunter?.summary)).toContain("presupuesto");
      } finally {
        if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
        else process.env.OPENAI_API_KEY = prevKey;
      }
    });

    it("POST /api/client/listing-compliance without listingText → 400", async () => {
      const res = await request(app)
        .post("/api/client/listing-compliance")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ listingText: "" })
        .expect(400);
      expect(typeof res.body?.error).toBe("string");
    });

    it("POST /api/client/listing-compliance → 200 demo with violations shape", async () => {
      const prevKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      try {
        const res = await request(app)
          .post("/api/client/listing-compliance")
          .set("Authorization", `Bearer ${accessToken}`)
          .send({
            listingText:
              "Our #1 best seller miracle cream cures diabetes overnight. FDA approved. Kills 99.9% of viruses. Limited time only today!",
          })
          .expect(200);
        expect(res.body?.ok).toBe(true);
        expect(res.body?.mode).toBe("demo");
        const c = res.body?.compliance;
        expect(Array.isArray(c?.violations)).toBe(true);
        expect(c.violations.length).toBeGreaterThan(0);
        const v0 = c.violations[0];
        expect(typeof v0?.phrase).toBe("string");
        expect(typeof v0?.risk).toBe("string");
        expect(typeof v0?.replacement).toBe("string");
        expect(["high", "medium", "low"]).toContain(v0?.severity);
      } finally {
        if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
        else process.env.OPENAI_API_KEY = prevKey;
      }
    });

    it("POST /api/client/listing-multi-platform without listingText → 400", async () => {
      const res = await request(app)
        .post("/api/client/listing-multi-platform")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ listingText: "" })
        .expect(400);
      expect(typeof res.body?.error).toBe("string");
    });

    it("POST /api/client/listing-analysis with invalid listingUrl → 400", async () => {
      const res = await request(app)
        .post("/api/client/listing-analysis")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ platform: "amazon_us", listingUrl: "ftp://invalid" })
        .expect(400);
      expect(typeof res.body?.error).toBe("string");
    });

    it("POST /api/client/listing-compliance with invalid listingUrl → 400", async () => {
      const res = await request(app)
        .post("/api/client/listing-compliance")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ listingUrl: "not-a-url" })
        .expect(400);
      expect(typeof res.body?.error).toBe("string");
    });

    it("POST /api/client/listing-multi-platform → 200 demo with four platform versions", async () => {
      const prevKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      try {
        const res = await request(app)
          .post("/api/client/listing-multi-platform")
          .set("Authorization", `Bearer ${accessToken}`)
          .send({
            listingText:
              "Insulated water bottle 750 ml\n• Keeps drinks cold 24h\n• Leak-resistant cap\n• Fits cup holders\nDouble-wall stainless steel for commuters and gym.",
          })
          .expect(200);
        expect(res.body?.ok).toBe(true);
        expect(res.body?.mode).toBe("demo");
        const a = res.body?.adapter;
        const v = a?.versions;
        expect(v?.amazon_us?.title).toBeTruthy();
        expect(Array.isArray(v?.amazon_us?.bulletPoints)).toBe(true);
        expect(v?.amazon_us?.bulletPoints?.length).toBe(5);
        expect(v?.walmart_us?.description).toBeTruthy();
        expect(v?.tiktok_shop_us?.hook).toBeTruthy();
        expect(v?.shopify?.subheadline).toBeTruthy();
        expect(v?.shopify?.callToAction).toBeTruthy();
      } finally {
        if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
        else process.env.OPENAI_API_KEY = prevKey;
      }
    });

    it("POST /api/client/listing-generator improve_pasted with short paste → 400", async () => {
      const res = await request(app)
        .post("/api/client/listing-generator")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          platform: "amazon_us",
          operation: "improve_pasted",
          listingTitle: "x",
          listingBullets: "",
          listingDescription: "",
        })
        .expect(400);
      expect(typeof res.body?.error).toBe("string");
    });

    it("POST /api/client/listing-generator improve_pasted → 200 demo, full listing shape", async () => {
      const prevKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      try {
        const res = await request(app)
          .post("/api/client/listing-generator")
          .set("Authorization", `Bearer ${accessToken}`)
          .send({
            platform: "amazon_us",
            operation: "improve_pasted",
            listingTitle: "Insulated bottle 750 ml — keeps drinks cold 24h (BPA-free stainless)",
            listingBullets: "STAYS COLD — double-wall vacuum\nLEAK-RESISTANT — twist cap\nFITS CUP HOLDERS — slim profile",
            listingDescription:
              "Take it on commutes. Hand wash recommended. Do not microwave. Our #1 best bottle cures thirst instantly!!!",
            existingListing: "Soften health claims; keep dishwasher-safe only if true.",
          })
          .expect(200);
        expect(res.body?.ok).toBe(true);
        expect(res.body?.mode).toBe("demo");
        expect(res.body?.listingOperation).toBe("improve_pasted");
        expect(res.body?.listing?.title).toMatch(/^↻ /);
        expect(res.body?.listing?.bulletPoints?.length).toBe(5);
        expect(typeof res.body?.listing?.description).toBe("string");
        expect(typeof res.body?.listing?.keywords).toBe("string");
      } finally {
        if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
        else process.env.OPENAI_API_KEY = prevKey;
      }
    });

    it("POST /api/client/listing-generator without context → 400", async () => {
      const res = await request(app)
        .post("/api/client/listing-generator")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ platform: "shopify" })
        .expect(400);
      expect(typeof res.body?.error).toBe("string");
    });

    it("POST /api/client/listing-generator improve_existing without valid URL → 400", async () => {
      const res = await request(app)
        .post("/api/client/listing-generator")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          platform: "amazon_us",
          operation: "improve_existing",
          productUrl: "not-a-url",
          existingListing: "optional notes only",
        })
        .expect(400);
      expect(typeof res.body?.error).toBe("string");
    });

    it("POST /api/client/listing-generator improve_existing → 200 demo, listingOperation echo", async () => {
      const prevKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      try {
        const res = await request(app)
          .post("/api/client/listing-generator")
          .set("Authorization", `Bearer ${accessToken}`)
          .send({
            platform: "amazon_us",
            operation: "improve_existing",
            productUrl: "https://example.com/product/mug-demo",
            existingListing: "Optional: 12oz ceramic mug; keep dishwasher-safe claim if on page.",
          })
          .expect(200);
        expect(res.body?.ok).toBe(true);
        expect(res.body?.mode).toBe("demo");
        expect(res.body?.listingOperation).toBe("improve_existing");
        expect(res.body?.listing?.title).toMatch(/^↻ /);
        expect(res.body?.listing?.bulletPoints?.length).toBe(5);
        expect(String(res.body?.listing?.description)).toMatch(/improve listing|melhorar anúncio/i);
      } finally {
        if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
        else process.env.OPENAI_API_KEY = prevKey;
      }
    });

    it("POST /api/client/listing-generator Walmart USA → 5 bullets, no hype template (demo)", async () => {
      const res = await request(app)
        .post("/api/client/listing-generator")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          productName: "Cordless vacuum compact",
          platform: "walmart_us",
          mainBenefit: "Easier quick cleanups after meals",
          productDifferentiation: "Lighter body than full-size vacuums",
          targetAudience: "Busy households",
          brandOwner: true,
          internationalProduct: false,
        })
        .expect(200);
      expect(res.body?.ok).toBe(true);
      expect(res.body?.listing?.bulletPoints?.length).toBe(5);
      expect(typeof res.body?.listing?.title).toBe("string");
      expect(res.body?.listing?.title.length).toBeLessThanOrEqual(175);
      expect(typeof res.body?.listing?.description).toBe("string");
    });

    it("POST /api/client/listing-generator Shopify → headline, subheadline, CTA, 5 bullets (demo)", async () => {
      const prevKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      try {
        const res = await request(app)
          .post("/api/client/listing-generator")
          .set("Authorization", `Bearer ${accessToken}`)
          .send({
            productName: "Ceramic pour-over dripper",
            platform: "shopify",
            mainBenefit: "Cleaner cups with less bitterness for your morning ritual",
            productDifferentiation: "Thinner walls for stable heat vs chunky ceramic drippers",
            targetAudience: "Home baristas upgrading from automatic machines",
            brandOwner: true,
            internationalProduct: false,
          })
          .expect(200);
        expect(res.body?.ok).toBe(true);
        expect(res.body?.mode).toBe("demo");
        expect(res.body?.listing?.bulletPoints?.length).toBe(5);
        expect(res.body?.listing?.title?.length).toBeLessThanOrEqual(90);
        expect(typeof res.body?.listing?.subheadline).toBe("string");
        expect((res.body?.listing?.subheadline as string).length).toBeGreaterThan(15);
        expect(typeof res.body?.listing?.callToAction).toBe("string");
        expect(res.body?.listing?.callToAction).toMatch(/add to cart/i);
      } finally {
        if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
        else process.env.OPENAI_API_KEY = prevKey;
      }
    });

    it("POST /api/client/listing-generator TikTok Shop → hook + 3–5 bullets (demo)", async () => {
      const res = await request(app)
        .post("/api/client/listing-generator")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          productName: "LED desk lamp",
          platform: "tiktok_shop_us",
          mainBenefit: "Reduces eye strain for late-night work",
          productDifferentiation: "Dimming presets vs basic lamps",
          targetAudience: "Gen Z creators",
          brandOwner: false,
          internationalProduct: false,
        })
        .expect(200);
      expect(res.body?.ok).toBe(true);
      expect(typeof res.body?.listing?.hook).toBe("string");
      expect(res.body?.listing?.hook.length).toBeGreaterThan(10);
      const n = res.body?.listing?.bulletPoints?.length;
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(5);
    });

    it("POST /api/client/listing-generator Mercado Livre Intl → PT sections, disclaimer, envio internacional (demo)", async () => {
      const prevKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      try {
        const res = await request(app)
          .post("/api/client/listing-generator")
          .set("Authorization", `Bearer ${accessToken}`)
          .send({
            productName: "Fone Bluetooth com cancelamento de ruído",
            platform: "mercado_livre_intl",
            mainBenefit: "Áudio nítido para chamadas e música no dia a dia",
            productDifferentiation: "Bateria de longa duração vs modelos básicos",
            targetAudience: "Quem trabalha remoto e precisa de foco",
            brandOwner: false,
            internationalProduct: true,
          })
          .expect(200);
        expect(res.body?.ok).toBe(true);
        expect(res.body?.mode).toBe("demo");
        expect(res.body?.listing?.bulletPoints?.length).toBe(5);
        expect(res.body?.listing?.title?.length).toBeLessThanOrEqual(200);
        const desc: string = res.body?.listing?.description ?? "";
        expect(desc).toMatch(/Introdução/i);
        expect(desc).toMatch(/Benefícios/i);
        expect(desc).toMatch(/Detalhes técnicos/i);
        expect(desc).toMatch(/Aviso importante/i);
        expect(desc).toMatch(/Produto importado dos Estados Unidos/i);
        expect(desc).toMatch(/Não somos fabricantes nem representantes oficiais da marca no Brasil/i);
        expect(desc).toMatch(/garantia, quando aplicável/i);
        expect(desc).toMatch(/Receita Federal/i);
        expect(desc).toMatch(/dados fornecidos pelo fabricante/i);
        expect(desc).toMatch(/Nota de reforço — envio e tributos/i);
      } finally {
        if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
        else process.env.OPENAI_API_KEY = prevKey;
      }
    });

    it("POST /api/client/listing-generator Mercado Livre Intl → titular + internacional: envio internacional + reforço, sem aviso de revenda (demo)", async () => {
      const prevKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      try {
        const res = await request(app)
          .post("/api/client/listing-generator")
          .set("Authorization", `Bearer ${accessToken}`)
          .send({
            productName: "Kit skincare vitamina C",
            platform: "mercado_livre_intl",
            mainBenefit: "Rotina mais luminosa com textura leve",
            productDifferentiation: "Estabilização da fórmula vs séruns oxidáveis comuns",
            targetAudience: "Adultos com rotina de cuidados diários",
            brandOwner: true,
            internationalProduct: true,
          })
          .expect(200);
        expect(res.body?.mode).toBe("demo");
        const desc: string = res.body?.listing?.description ?? "";
        expect(desc).toMatch(/Envio internacional/i);
        expect(desc).toMatch(/Nota de reforço — envio e tributos/i);
        expect(desc).not.toMatch(/Aviso importante/i);
      } finally {
        if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
        else process.env.OPENAI_API_KEY = prevKey;
      }
    });

    it("POST /api/client/listing-generator Mercado Livre Intl → disclaimer sem parágrafo de envio internacional quando não é produto internacional (demo)", async () => {
      const prevKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      try {
        const res = await request(app)
          .post("/api/client/listing-generator")
          .set("Authorization", `Bearer ${accessToken}`)
          .send({
            productName: "Garrafa térmica inox 500ml",
            platform: "mercado_livre_intl",
            mainBenefit: "Mantém temperatura por horas no dia a dia",
            productDifferentiation: "Tampa com vedação reforçada vs modelos básicos",
            targetAudience: "Quem leva café ou água para o trabalho",
            brandOwner: false,
            internationalProduct: false,
          })
          .expect(200);
        expect(res.body?.mode).toBe("demo");
        const desc: string = res.body?.listing?.description ?? "";
        expect(desc).toMatch(/Aviso importante/i);
        expect(desc).toMatch(/Produto importado dos Estados Unidos/i);
        expect(desc).not.toMatch(/logística internacional/i);
        expect(desc).not.toMatch(/Nota de reforço — envio e tributos/i);
      } finally {
        if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
        else process.env.OPENAI_API_KEY = prevKey;
      }
    });
  });

  it("POST demo/full-reset with emptyClients → emptyRegistry e lista de clientes vazia", async () => {
    const wipe = await request(app)
      .post("/api/admin/demo/full-reset")
      .set("Authorization", `Bearer ${DEV_ADMIN_TOKEN}`)
      .send({ emptyClients: true })
      .expect(200);
    expect(wipe.body?.ok).toBe(true);
    expect(wipe.body?.emptyRegistry).toBe(true);
    const list = await request(app).get("/api/admin/clients").set("Authorization", `Bearer ${DEV_ADMIN_TOKEN}`).expect(200);
    expect(list.body?.clients ?? []).toEqual([]);
    await request(app)
      .post("/api/admin/demo/full-reset")
      .set("Authorization", `Bearer ${DEV_ADMIN_TOKEN}`)
      .send({})
      .expect(200);
  });
});
