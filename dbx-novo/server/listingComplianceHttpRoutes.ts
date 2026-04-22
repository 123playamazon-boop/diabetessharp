import type { Express, Request, Response } from "express";
import { requireUser } from "./authMiddleware";
import { fetchListingUrlPlainText } from "./listingUrlFetch";
import type { ListingComplianceResult, ListingComplianceViolation } from "../shared/listingCompliance";
import { isValidHttpListingUrl } from "../shared/listingUrlInput";

const MAX_LISTING_TEXT = 48_000;

const COMPLIANCE_CHECKER_SYSTEM = `You are an Amazon US listing compliance reviewer for Direct Box USA (not legal counsel).

You receive raw listing text (may include title, bullets, description mixed together).

Identify risky words or PHRASES that commonly violate or trigger scrutiny under Amazon seller and product listing policies, including:
- Health / disease / drug claims (cures, treats, FDA-style approvals you cannot prove)
- Misleading claims (#1 best seller without proof, "guaranteed" results, miracle outcomes)
- Restricted or sensitive wording (pesticide/medical device implications, false urgency, fake scarcity)
- Competitor brand names or trademark misuse as keywords
- Environmental claims without substantiation ("eco-certified" if not documented)

Output ONLY valid JSON:
{
  "violations": [
    {
      "phrase": "exact or close phrase from the listing that is problematic",
      "risk": "1-3 sentences: which Amazon policy concern or buyer-misleading issue applies",
      "replacement": "short compliant alternative wording (do not invent product facts)",
      "severity": "high" | "medium" | "low"
    }
  ],
  "summary": "optional one sentence overview; use empty string if none"
}

Rules:
- Quote only phrases that actually appear (or trivial normalizations like spacing/case).
- If the text is largely compliant, return an empty violations array and a brief positive summary.
- Do not flag generic marketing like "high quality" unless combined with a prohibited claim.
- No markdown fences.`;

type ComplianceBody = {
  listingText?: string;
  listingUrl?: string;
};

type HeuristicRule = {
  id: string;
  re: RegExp;
  risk: string;
  replacement: string;
  severity: ListingComplianceViolation["severity"];
};

const HEURISTIC_RULES: HeuristicRule[] = [
  {
    id: "cure",
    re: /\b(cures?|curing|cura|curam|trata\s+a\s+doen[cç]a|treats?\s+(?:the\s+)?(?:disease|cancer|diabetes|covid))\b/gi,
    risk: "Amazon restringe alegações de saúde e doença. Listagens não podem sugerir que o produto cura ou trata condições médicas sem autorização e prova adequadas.",
    replacement: "Use linguagem de uso ou conforto sem referência a doença, p. ex.: «concebido para apoiar o seu ritmo diário» ou «consulte um profissional de saúde para questões médicas».",
    severity: "high",
  },
  {
    id: "fda",
    re: /\b(fda\s+approved|fda\s+cleared|aprovado\s+pela\s+fda|aprovado\s+fda)\b/gi,
    risk: "Alegações de aprovação FDA são altamente reguladas; na maioria dos produtos de consumo não pode declarar aprovação FDA sem ser factual e documentado.",
    replacement: "Remova a referência FDA ou substitua por factos verificáveis do fabricante (ex.: «materiais listados pelo fornecedor como…») apenas se tiver documentação.",
    severity: "high",
  },
  {
    id: "miracle",
    re: /\b(miracle|milagre|100%\s+effective|100%\s+eficaz|guaranteed\s+cure|garantido\s+que\s+cura)\b/gi,
    risk: "Resultados garantidos ou «milagre» são considerados enganosos e violam políticas de alegações de produto na Amazon.",
    replacement: "Prefira «ajuda a», «concebido para», «pode contribuir para», sem prometer resultado único ou cura.",
    severity: "high",
  },
  {
    id: "best1",
    re: /\b(#\s*1\s+bestseller|#1\s+best\s+seller|n[ºo]\.?\s*1\s+no\s+mundo|best\s+seller\s+of\s+all\s+time|o\s+melhor\s+do\s+mundo)\b/gi,
    risk: "Superlativos de ranking (#1, best seller mundial) exigem prova verificável na listagem; sem isso, a Amazon pode remover o anúncio ou restringir a conta.",
    replacement: "Substitua por benefício mensurável ou prova social genérica: «bem avaliado por compradores» só se tiver dados reais; caso contrário, «popular entre quem procura X».",
    severity: "medium",
  },
  {
    id: "pesticide",
    re: /\b(kills\s+99\.9%\s+of\s+(?:all\s+)?(?:bacteria|germs|viruses)|mata\s+99[,.]9%\s+dos?\s+bac(?:terios|érios)|desinfetante\s+hospitalar)\b/gi,
    risk: "Alegações de eliminação de germes/bactérias/virus podem enquadrar o produto em requisitos de pesticida/dispositivo antimicrobiano nos EUA.",
    replacement: "Limite a linguagem a limpeza ou higiene do quotidiano sem percentagens de morte de patogénios, salvo com registos e etiquetas conformes.",
    severity: "high",
  },
  {
    id: "false_urgency",
    re: /\b(limited\s+time\s+only\s+today|últimas\s+unidades\s+hoje|only\s+\d+\s+left\s+at\s+this\s+price|preço\s+válido\s+só\s+nesta\s+hora)\b/gi,
    risk: "Urgência ou stock falso é enganoso e viola políticas de conduta comercial; na Amazon o preço e disponibilidade são geridos pelo sistema de oferta.",
    replacement: "Remova urgência inventada; se houver promoção real, use datas factuais ou remova a frase.",
    severity: "medium",
  },
  {
    id: "weight_loss",
    re: /\b(loses\s+\d+\s*(?:lbs?|kg)|perde\s+\d+\s*(?:kg|lb)|lose\s+weight\s+fast|emagre[cç]a\s+rápido)\b/gi,
    risk: "Alegações de perda de peso quantificada ou rápida são área sensível (suplementos/beleza) e frequentemente requerem substantiation e categorias corretas.",
    replacement: "Foque em estilo de vida ou apoio a rotinas alimentares sem prometer perda de peso específica.",
    severity: "medium",
  },
  {
    id: "anti_inflammatory_unsub",
    re: /\b(anti-inflammatory|antiinflammatory|anti-inflamatório)\s+(?:properties|effect|effects|action)\b/gi,
    risk: "Alegações anti-inflamatórias ou medicamentosas podem classificar o produto como droga ou dispositivo médico não autorizado.",
    replacement: "Use descrição sensorial ou de conforto sem efeito fisiológico clínico, p. ex.: «textura suave na pele».",
    severity: "high",
  },
  {
    id: "eco_unsub",
    re: /\b(100%\s+carbon\s+neutral|carbon\s+neutral\s+certified|100%\s+reciclável\s+certificado|eco-certified)\b/gi,
    risk: "Alegações ambientais certificadas sem documentação podem violar guias FTC Green Guides e políticas Amazon sobre alegações sustentáveis.",
    replacement: "Use «materiais reciclados quando indicado pelo fornecedor» ou remova a certificação até ter prova.",
    severity: "low",
  },
];

function heuristicComplianceCheck(text: string): ListingComplianceResult {
  const violations: ListingComplianceViolation[] = [];
  const seen = new Set<string>();

  for (const rule of HEURISTIC_RULES) {
    let m: RegExpExecArray | null;
    const re = new RegExp(rule.re.source, rule.re.flags);
    while ((m = re.exec(text)) !== null) {
      const phrase = m[0].trim();
      if (phrase.length < 2) continue;
      const key = `${rule.id}:${phrase.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      violations.push({
        phrase,
        risk: rule.risk,
        replacement: rule.replacement,
        severity: rule.severity,
      });
      if (violations.length >= 24) break;
    }
    if (violations.length >= 24) break;
  }

  const summary =
    violations.length === 0
      ? "Nenhum padrão de alto risco detectado pela verificação local. Com OPENAI_API_KEY, a revisão inclui contexto mais fino; revise sempre as políticas Amazon actualizadas."
      : `Encontrada(s) ${violations.length} ocorrência(s) com padrões frequentemente sancionados ou enganosos. Corrija antes de publicar e valide na Seller Central.`;

  return { violations, summary };
}

function parseComplianceJson(raw: string): ListingComplianceResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const arr = o.violations;
  const violations: ListingComplianceViolation[] = [];
  if (Array.isArray(arr)) {
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const v = item as Record<string, unknown>;
      const phrase = typeof v.phrase === "string" ? v.phrase.trim() : "";
      const risk = typeof v.risk === "string" ? v.risk.trim() : "";
      const replacement = typeof v.replacement === "string" ? v.replacement.trim() : "";
      const sev = v.severity === "high" || v.severity === "medium" || v.severity === "low" ? v.severity : "medium";
      if (phrase && risk && replacement) violations.push({ phrase, risk, replacement, severity: sev });
    }
  }
  const summary = typeof o.summary === "string" ? o.summary.trim() : undefined;
  return { violations: violations.slice(0, 30), summary: summary || undefined };
}

async function callOpenAiComplianceCheck(listingText: string): Promise<ListingComplianceResult | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const userPayload = {
    focus: "Amazon US seller and listing policies; also flag clearly misleading claims that would fail on major marketplaces",
    listingText: listingText.slice(0, 36_000),
    schema: {
      violations: "array of { phrase, risk, replacement, severity }",
      summary: "string, optional",
    },
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.25,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: COMPLIANCE_CHECKER_SYSTEM },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenAI HTTP ${res.status}: ${errText.slice(0, 400)}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) return null;
  return parseComplianceJson(raw);
}

export function registerListingComplianceRoutes(app: Express): void {
  app.post("/api/client/listing-compliance", requireUser, async (req: Request, res: Response) => {
    const b = (req.body && typeof req.body === "object" ? req.body : {}) as ComplianceBody;
    let listingText = typeof b.listingText === "string" ? b.listingText.trim() : "";
    const listingUrl = typeof b.listingUrl === "string" ? b.listingUrl.trim() : "";
    if (listingUrl) {
      if (!isValidHttpListingUrl(listingUrl)) {
        res.status(400).json({ error: "URL inválida (http/https, 12–2048 caracteres)." });
        return;
      }
      const fetched = await fetchListingUrlPlainText(listingUrl);
      if (!fetched.ok) {
        res.status(400).json({ error: fetched.error });
        return;
      }
      listingText = fetched.text.trim();
    }
    if (!listingText) {
      res.status(400).json({ error: "Envie o texto da listagem (listingText) ou uma URL (listingUrl)." });
      return;
    }
    if (listingText.length > MAX_LISTING_TEXT) {
      res.status(400).json({ error: "Texto demasiado longo." });
      return;
    }

    const runDemo = (): ListingComplianceResult => heuristicComplianceCheck(listingText);

    if (process.env.OPENAI_API_KEY?.trim()) {
      try {
        const ai = await callOpenAiComplianceCheck(listingText);
        if (ai) {
          res.json({ ok: true, mode: "live", compliance: ai });
          return;
        }
      } catch (e) {
        res.json({
          ok: true,
          mode: "demo",
          compliance: runDemo(),
          warn: e instanceof Error ? e.message.slice(0, 240) : "openai_error",
        });
        return;
      }
    }

    res.json({ ok: true, mode: "demo", compliance: runDemo() });
  });
}
