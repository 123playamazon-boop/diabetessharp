import type { Express, Request, Response } from "express";
import { requireUser } from "./authMiddleware";
import { GROWTH_PROGRAM_CLIENT_API_BASE } from "../shared/growthProgramRoutes";
import {
  type GrowthStrategyAiMode,
  type GrowthStrategyAiResult,
  buildDemoGrowthStrategyAi,
  isGrowthStrategyAiMode,
} from "../shared/growthStrategyAi";

const MAX_QUESTION = 6000;
const MAX_CONTEXT = 2000;

const GROWTH_STRATEGY_SYSTEM = `You are Growth Strategy AI inside Direct Box USA (DBX) — a senior US e-commerce growth strategist (Amazon-first; aware of Walmart, TikTok Shop, Shopify DTC, eBay).

You are NOT a generic chatbot. You do NOT give vague encouragement, bullet clichés, or "it depends" without stakes. You write like a top operator preparing a strategic memo.

For each user question (and optional short business context), output ONLY valid JSON with this exact shape:
{
  "diagnosis": "string — the real underlying problem behind what they asked (2–5 sentences)",
  "marketReality": "string — why outcomes look this way in US marketplaces / current economics (2–6 sentences)",
  "actionSteps": ["string", ...],
  "scalingStrategy": "string — scaling playbook when relevant; use empty string \"\" if not applicable",
  "executiveMemo": "string — 2–4 tight paragraphs; analytical, direct, business-focused; no markdown; no filler"
}

Rules:
- actionSteps: 5 to 8 items, each a concrete execution step (verbs first), ordered by priority.
- Tie advice to profit, capital efficiency, listing quality, inventory, fees, and execution cadence where relevant.
- No disclaimers like "as an AI". No "great question". No ChatGPT-style throat-clearing.
- If the question is thin, infer the likely seller stage and still deliver a sharp diagnosis—state assumptions briefly inside diagnosis.
- English for all string values.`;

const SALES_CONSULTANT_SYSTEM = `You are Sales Consultant AI inside Direct Box USA (DBX).

Identity: a high-ticket US e-commerce advisor — the tone and density of someone who has operated at serious scale (7–8+ figure thinking) on US marketplaces. This is NOT a chatbot, NOT customer support, and NOT therapy. Single-shot strategic output only.

Behavior on every question:
1) Diagnose the REAL problem behind the question (what they are actually optimizing—or avoiding).
2) Explain market reality: why the US channel behaves this way (fees, competition, inventory, ads, conversion, capital).
3) Give actionable steps: what to do this week and next; money and execution first.
4) If scaling is relevant, spell out a scaling discipline (when to add SKUs, spend, or channels)—otherwise set scalingStrategy to "".

Tone: expert consultant — confident, direct, occasionally blunt. Focus on money, growth, and execution. Zero generic AI platitudes. No "I'd be happy to help". No markdown fences.

Output ONLY valid JSON:
{
  "diagnosis": "string",
  "marketReality": "string",
  "actionSteps": ["string", ...],
  "scalingStrategy": "string or empty",
  "executiveMemo": "string — 2–5 paragraphs; operator voice; no markdown"
}

Rules:
- actionSteps: 5 to 8 items, imperative and specific.
- English only for all values.
- Be specific enough that a serious seller could act Monday morning.`;

function parseGrowthStrategyAiJson(raw: string): GrowthStrategyAiResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const diagnosis = typeof o.diagnosis === "string" ? o.diagnosis.trim() : "";
  const marketReality = typeof o.marketReality === "string" ? o.marketReality.trim() : "";
  const executiveMemo = typeof o.executiveMemo === "string" ? o.executiveMemo.trim() : "";
  const scalingRaw = typeof o.scalingStrategy === "string" ? o.scalingStrategy.trim() : "";
  const steps = o.actionSteps;
  if (!diagnosis || !marketReality || !executiveMemo) return null;
  if (!Array.isArray(steps)) return null;
  const actionSteps = steps
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 12);
  if (actionSteps.length < 3) return null;
  return {
    diagnosis: diagnosis.slice(0, 4000),
    marketReality: marketReality.slice(0, 4000),
    actionSteps: actionSteps.map((s) => s.slice(0, 800)),
    scalingStrategy: scalingRaw.slice(0, 4000),
    executiveMemo: executiveMemo.slice(0, 12000),
  };
}

async function callOpenAiGrowthStrategy(
  mode: GrowthStrategyAiMode,
  question: string,
  context: string | undefined,
): Promise<GrowthStrategyAiResult | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const system = mode === "sales_consultant" ? SALES_CONSULTANT_SYSTEM : GROWTH_STRATEGY_SYSTEM;
  const userPayload = {
    mode,
    question,
    context: context || undefined,
    instruction: "Respond once with the JSON object only. No preamble.",
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: mode === "sales_consultant" ? 0.42 : 0.35,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
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
  return parseGrowthStrategyAiJson(raw);
}

type StrategyBody = {
  mode?: string;
  question?: string;
  context?: string;
};

export function registerGrowthStrategyAiRoutes(app: Express): void {
  const path = `${GROWTH_PROGRAM_CLIENT_API_BASE}/strategy-ai`;

  app.post(path, requireUser, async (req: Request, res: Response) => {
    const b = (req.body && typeof req.body === "object" ? req.body : {}) as StrategyBody;
    const modeRaw = typeof b.mode === "string" ? b.mode.trim() : "";
    const question = typeof b.question === "string" ? b.question.trim() : "";
    const context = typeof b.context === "string" ? b.context.trim() : undefined;

    if (!isGrowthStrategyAiMode(modeRaw)) {
      res.status(400).json({ error: "Modo inválido.", validModes: ["growth_strategy", "sales_consultant"] });
      return;
    }
    const mode = modeRaw as GrowthStrategyAiMode;

    if (!question) {
      res.status(400).json({ error: "Indique a pergunta (question)." });
      return;
    }
    if (question.length > MAX_QUESTION) {
      res.status(400).json({ error: "Pergunta demasiado longa." });
      return;
    }
    if (context && context.length > MAX_CONTEXT) {
      res.status(400).json({ error: "Contexto demasiado longo." });
      return;
    }

    const runDemo = (): GrowthStrategyAiResult => buildDemoGrowthStrategyAi(mode, question, context);

    if (process.env.OPENAI_API_KEY?.trim()) {
      try {
        const ai = await callOpenAiGrowthStrategy(mode, question, context);
        if (ai) {
          res.json({ ok: true, mode: "live", aiMode: mode, result: ai });
          return;
        }
      } catch (e) {
        res.json({
          ok: true,
          mode: "demo",
          aiMode: mode,
          result: runDemo(),
          warn: e instanceof Error ? e.message.slice(0, 240) : "openai_error",
        });
        return;
      }
    }

    res.json({ ok: true, mode: "demo", aiMode: mode, result: runDemo() });
  });
}
