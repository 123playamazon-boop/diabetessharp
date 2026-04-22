import type { Express, Request, Response } from "express";
import multer from "multer";
import { requireAdmin, requireUser, userSuite } from "./authMiddleware";
import {
  getEditionByDate,
  getLatestEdition,
  listEditionDatesDesc,
  listEditionsMetaDesc,
  upsertDailyEdition,
  type AmazonLeadsDailyEdition,
} from "./amazonLeadsDailyStore";
import { findBySuite } from "./clientRegistryStore";
import {
  coerceLeadRow,
  enrichLeadRowCalculations,
  fetchKeepaProducts,
  passesLeadRules,
  parseAsinsFromText,
  productToLeadRow,
  leadsRowsToCsv,
  type AmazonLeadTableRow,
  type LeadRules,
} from "./keepaAmazonLeads";
import {
  mergeKeepaRowWithSupplement,
  parseLeadSupplementCsv,
  parseLeadSupplementXlsxBuffer,
  supplementsToCanonicalCsv,
  type LeadSupplementFields,
} from "./spreadsheetCsv";

const MAX_ASINS = 150;
const BATCH = 100;
const DEFAULT_PUBLISH_CAP = 50;

const spreadsheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const n = file.originalname.toLowerCase();
    if (n.endsWith(".xlsx") || n.endsWith(".xls") || n.endsWith(".csv")) {
      cb(null, true);
      return;
    }
    cb(new Error("Formato não suportado. Use .xlsx, .xls ou .csv."));
  },
});

function editionForClientResponse(ed: AmazonLeadsDailyEdition | null): AmazonLeadsDailyEdition | null {
  if (!ed) return null;
  const rows = ed.rows.map(coerceLeadRow);
  return {
    ...ed,
    rows,
    rowCount: rows.length,
    csv: leadsRowsToCsv(rows, ed.editionDate),
  };
}

function readKeepaEnv(): {
  key: string;
  domain: number;
  offers: number;
  defaults: LeadRules;
} {
  const key = (process.env.KEEPA_API_KEY ?? "").trim();
  const domain = Math.max(1, Number.parseInt(process.env.KEEPA_DOMAIN ?? "1", 10) || 1);
  const offers = Math.min(100, Math.max(0, Number.parseInt(process.env.KEEPA_OFFERS ?? "20", 10) || 20));
  const defaults: LeadRules = {
    minMonthlySold: Math.max(0, Number.parseInt(process.env.MIN_MONTHLY_SOLD ?? "100", 10) || 100),
    minNewOffersTotal: Math.max(1, Number.parseInt(process.env.MIN_NEW_OFFERS_TOTAL ?? "4", 10) || 4),
    excludeAmazonBuyBox: (process.env.EXCLUDE_AMAZON_BUYBOX ?? "1") !== "0",
  };
  return { key, domain, offers, defaults };
}

async function runKeepaAnalyze(params: {
  asinsText: string;
  rules: LeadRules;
  key: string;
  domain: number;
  offers: number;
  maxAsins: number;
}): Promise<{
  asinsRequested: number;
  accepted: AmazonLeadTableRow[];
  rejected: { asin: string; reasons: string[] }[];
  tokensLeft?: number;
}> {
  const asins = parseAsinsFromText(params.asinsText, params.maxAsins);
  const accepted: AmazonLeadTableRow[] = [];
  const rejected: { asin: string; reasons: string[] }[] = [];
  let tokensLeft: number | undefined;

  for (let i = 0; i < asins.length; i += BATCH) {
    const chunk = asins.slice(i, i + BATCH);
    const resp = await fetchKeepaProducts({
      key: params.key,
      domain: params.domain,
      asins: chunk,
      stats: 90,
      offers: params.offers,
    });
    if (typeof resp.tokensLeft === "number") tokensLeft = resp.tokensLeft;
    const returned = new Set<string>();
    for (const p of resp.products ?? []) {
      const asin = typeof p.asin === "string" ? p.asin.toUpperCase() : "";
      if (!asin) continue;
      returned.add(asin);
      const { ok, reasons } = passesLeadRules(p, params.rules);
      if (!ok) {
        rejected.push({ asin, reasons });
        continue;
      }
      accepted.push(productToLeadRow(p, asin));
    }
    for (const a of chunk) {
      if (!returned.has(a)) rejected.push({ asin: a, reasons: ["Keepa não devolveu dados para este ASIN."] });
    }
  }

  return { asinsRequested: asins.length, accepted, rejected, tokensLeft };
}

export function registerAmazonLeadsRoutes(app: Express): void {
  /** Lista curada é publicada pelo admin; análise ad-hoc no portal do cliente está desligada (poupança de tokens Keepa). */
  app.post("/api/client/amazon-leads/analyze", (_req: Request, res: Response) => {
    res.status(403).json({
      error:
        "Análise manual por ASIN está desligada. A equipa Direct Box publica a edição diária (Keepa + critérios) — active a assinatura Direct Leads Pro e abra «Leads Amazon» para ver a lista.",
    });
  });

  app.get("/api/client/amazon-leads/daily", requireUser, (req: Request, res: Response) => {
    const suite = userSuite(req);
    const editionDateQ = typeof req.query.editionDate === "string" ? req.query.editionDate.trim() : "";
    const client = findBySuite(suite);
    if (!client) {
      res.status(404).json({ error: "Suite não encontrada." });
      return;
    }
    const subscribed = client.amazonLeadsProActive === true;
    if (!subscribed) {
      res.json({
        subscribed: false,
        edition: null,
        recentEditionDates: [] as string[],
        priceUsdMonthly: 49.99,
        disclaimer:
          "Direct Leads Pro: lista diária curada pela equipa (até 50 ASINs por edição, seg.–sex.). Contacte a equipa ou active a assinatura na consola admin (demo).",
      });
      return;
    }
    const rawEdition =
      editionDateQ && /^\d{4}-\d{2}-\d{2}$/.test(editionDateQ)
        ? getEditionByDate(editionDateQ) ?? getLatestEdition()
        : getLatestEdition();
    const edition = editionForClientResponse(rawEdition);
    res.json({
      subscribed: true,
      edition,
      recentEditionDates: listEditionDatesDesc(14),
      priceUsdMonthly: 49.99,
      disclaimer:
        "Dados Keepa na data de publicação; monthlySold pode estar vazio em alguns ASINs. Lucro e ROI aparecem quando «$ Produto» (loja) estiver preenchido — cálculo estimado (Amazon − loja), sem taxas FBA/FBM.",
    });
  });

  app.get("/api/admin/amazon-leads/editions", requireAdmin, (_req: Request, res: Response) => {
    res.json({ editions: listEditionsMetaDesc() });
  });

  /**
   * Converte Excel (.xlsx / .xls) ou CSV em texto CSV canónico (cabeçalhos normalizados).
   * O admin pode depois editar e publicar com o mesmo fluxo JSON.
   */
  app.post(
    "/api/admin/amazon-leads/spreadsheet-upload",
    requireAdmin,
    (req: Request, res: Response, next) => {
      spreadsheetUpload.single("file")(req, res, (err: unknown) => {
        if (err) {
          const code = typeof err === "object" && err && "code" in err ? String((err as { code?: string }).code) : "";
          const msg = err instanceof Error ? err.message : "Erro ao receber ficheiro.";
          const status = code === "LIMIT_FILE_SIZE" ? 413 : 400;
          res.status(status).json({ error: msg });
          return;
        }
        next();
      });
    },
    (req: Request, res: Response) => {
      const f = req.file;
      if (!f?.buffer?.length) {
        res.status(400).json({ error: "Envie o campo «file» (multipart/form-data)." });
        return;
      }
      const name = f.originalname.toLowerCase();
      if (name.endsWith(".csv")) {
        const parsed = parseLeadSupplementCsv(f.buffer.toString("utf8"));
        if (!parsed.ok) {
          res.status(400).json({ error: parsed.error });
          return;
        }
        res.json({
          ok: true,
          sheetName: "csv",
          spreadsheetCsv: supplementsToCanonicalCsv(parsed.data),
          rowCount: parsed.data.asinOrder.length,
          warnings: parsed.data.errors.length ? parsed.data.errors : undefined,
        });
        return;
      }
      const x = parseLeadSupplementXlsxBuffer(f.buffer);
      if (!x.ok) {
        res.status(400).json({ error: x.error });
        return;
      }
      res.json({
        ok: true,
        sheetName: x.value.sheetName,
        spreadsheetCsv: x.value.canonicalCsv,
        rowCount: x.value.data.asinOrder.length,
        warnings: x.value.data.errors.length ? x.value.data.errors : undefined,
      });
    },
  );

  app.post("/api/admin/amazon-leads/publish", requireAdmin, async (req: Request, res: Response) => {
    const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const text = typeof b.asinsText === "string" ? b.asinsText : "";
    const { key, domain, offers, defaults } = readKeepaEnv();
    if (!key) {
      res.status(503).json({
        error:
          "API Keepa não configurada. Defina KEEPA_API_KEY no .env da API e reinicie o Express.",
      });
      return;
    }

    const rules: LeadRules = {
      minMonthlySold:
        typeof b.minMonthlySold === "number" && Number.isFinite(b.minMonthlySold)
          ? Math.max(0, Math.floor(b.minMonthlySold))
          : defaults.minMonthlySold,
      minNewOffersTotal:
        typeof b.minNewOffersTotal === "number" && Number.isFinite(b.minNewOffersTotal)
          ? Math.max(1, Math.floor(b.minNewOffersTotal))
          : defaults.minNewOffersTotal,
      excludeAmazonBuyBox:
        typeof b.excludeAmazonBuyBox === "boolean" ? b.excludeAmazonBuyBox : defaults.excludeAmazonBuyBox,
    };

    const editionDateRaw = typeof b.editionDate === "string" ? b.editionDate.trim() : "";
    const editionDate =
      editionDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(editionDateRaw)
        ? editionDateRaw
        : new Date().toISOString().slice(0, 10);

    const maxPublish =
      typeof b.maxPublish === "number" && Number.isFinite(b.maxPublish)
        ? Math.max(1, Math.min(100, Math.floor(b.maxPublish)))
        : DEFAULT_PUBLISH_CAP;

    const pipelineNote = typeof b.pipelineNote === "string" ? b.pipelineNote.trim().slice(0, 500) : "";
    const spreadsheetCsv = typeof b.spreadsheetCsv === "string" ? b.spreadsheetCsv : "";

    if (!text.trim() && !spreadsheetCsv.trim()) {
      res.status(400).json({
        error:
          "Cole ASINs (texto) e/ou um CSV exportado do Excel (coluna «asin») — pelo menos um dos dois.",
      });
      return;
    }

    let asinsTextForKeepa = text.trim();
    const supplementByAsin = new Map<string, LeadSupplementFields>();
    let spreadsheetWarnings: string[] = [];
    if (spreadsheetCsv.trim()) {
      const parsed = parseLeadSupplementCsv(spreadsheetCsv);
      if (!parsed.ok) {
        res.status(400).json({ error: parsed.error });
        return;
      }
      spreadsheetWarnings = parsed.data.errors;
      for (const [asin, fields] of parsed.data.byAsin) {
        supplementByAsin.set(asin, fields);
      }
      const fromCsvLine = parsed.data.asinOrder.join("\n");
      if (!asinsTextForKeepa) {
        asinsTextForKeepa = fromCsvLine;
      } else {
        const merged = [
          ...new Set([
            ...parseAsinsFromText(fromCsvLine, MAX_ASINS),
            ...parseAsinsFromText(asinsTextForKeepa, MAX_ASINS),
          ]),
        ];
        asinsTextForKeepa = merged.join("\n");
      }
    }

    try {
      const { asinsRequested, accepted, rejected, tokensLeft } = await runKeepaAnalyze({
        asinsText: asinsTextForKeepa,
        rules,
        key,
        domain,
        offers,
        maxAsins: MAX_ASINS,
      });
      const publishedRows = accepted.slice(0, maxPublish).map((r) =>
        enrichLeadRowCalculations(mergeKeepaRowWithSupplement(r, supplementByAsin.get(r.asin.toUpperCase()))),
      );
      const csv = leadsRowsToCsv(publishedRows, editionDate);
      const edition = {
        editionDate,
        publishedAtIso: new Date().toISOString(),
        rowCount: publishedRows.length,
        rows: publishedRows,
        csv,
        pipelineNote: pipelineNote || undefined,
        rulesSnapshot: rules,
        asinsRequested,
        rejectedCount: rejected.length,
      };
      upsertDailyEdition(edition);
      res.json({
        ok: true,
        edition,
        tokensLeft,
        rejectedPreview: rejected.slice(0, 40),
        rejectedTotal: rejected.length,
        spreadsheetWarnings: spreadsheetWarnings.length ? spreadsheetWarnings : undefined,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro Keepa.";
      res.status(502).json({ error: msg });
    }
  });
}
