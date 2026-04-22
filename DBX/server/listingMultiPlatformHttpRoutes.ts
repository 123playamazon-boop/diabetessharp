import type { Express, Request, Response } from "express";
import { requireUser } from "./authMiddleware";
import {
  LISTING_ADAPTER_PLATFORM_IDS,
  type AdaptedListingFields,
  type ListingAdapterPlatformId,
  type MultiPlatformAdapterResult,
  buildDemoMultiPlatformVersions,
} from "../shared/listingMultiPlatform";

const MAX_LISTING_TEXT = 48_000;

const ADAPTER_SYSTEM = `You are a senior US e-commerce copy chief for Direct Box USA.

The user pastes ONE product listing (title, bullets, and/or description may be mixed in one text block).

Output ONLY valid JSON with this exact shape:
{
  "summary": "one sentence in English about what you changed per channel",
  "versions": {
    "amazon_us": {
      "title": "string, Amazon US style: clear category + benefit + key qualifier; avoid prohibited health claims",
      "bulletPoints": ["5 strings", "Amazon-style scan lines", "often ALL-CAPS lead word or phrase then em dash detail", "buyer-first", "last bullet can be assurance/spec"],
      "description": "string, readable paragraphs; maintain facts from source; conversion-focused but policy-safe",
      "keywords": "comma-separated relevant search terms, English"
    },
    "walmart_us": {
      "title": "string, Walmart US: straightforward, value + specs tone",
      "bulletPoints": ["5 strings", "clear utility and specs", "less hype than TikTok", "family/shopping clarity"],
      "description": "string, practical paragraphs",
      "keywords": "comma-separated, English"
    },
    "tiktok_shop_us": {
      "title": "string, short punchy product title for TikTok Shop US",
      "hook": "string, scroll-stopping first line (separate from title)",
      "bulletPoints": ["3-4 strings", "very short", "mobile-first"],
      "description": "string, tight, social proof friendly without fake claims",
      "keywords": "comma-separated, English"
    },
    "shopify": {
      "title": "string, DTC headline (can be more emotional than Amazon)",
      "subheadline": "string, one line under headline",
      "callToAction": "string, button microcopy e.g. Add to cart",
      "bulletPoints": ["5 strings", "benefit-led", "brand voice"],
      "description": "string, story + details, still factual",
      "keywords": "comma-separated, English"
    }
  }
}

Rules:
- Preserve the SAME product facts, materials, sizes, inclusions, and limitations from the source. Do not invent certifications, awards, rankings, or medical outcomes.
- Each marketplace version should feel native to that platform while keeping the core message.
- English (US) for all fields.
- No markdown fences.`;

type AdapterBody = {
  listingText?: string;
};

function coerceAdaptedListing(o: unknown): AdaptedListingFields | null {
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  const title = typeof r.title === "string" ? r.title.trim() : "";
  const description = typeof r.description === "string" ? r.description.trim() : "";
  const bp = r.bulletPoints;
  if (!title || !description || !Array.isArray(bp)) return null;
  const bulletPoints = bp.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim());
  if (bulletPoints.length === 0) return null;
  const keywords = typeof r.keywords === "string" ? r.keywords.trim() : "";
  if (!keywords) return null;
  const hook = typeof r.hook === "string" ? r.hook.trim() : undefined;
  const subheadline = typeof r.subheadline === "string" ? r.subheadline.trim() : undefined;
  const callToAction = typeof r.callToAction === "string" ? r.callToAction.trim() : undefined;
  return {
    title: title.slice(0, 400),
    bulletPoints: bulletPoints.slice(0, 8),
    description: description.slice(0, 12_000),
    keywords: keywords.slice(0, 2000),
    ...(hook ? { hook: hook.slice(0, 240) } : {}),
    ...(subheadline ? { subheadline: subheadline.slice(0, 300) } : {}),
    ...(callToAction ? { callToAction: callToAction.slice(0, 120) } : {}),
  };
}

function parseAdapterJson(raw: string): MultiPlatformAdapterResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const root = parsed as Record<string, unknown>;
  const versionsRaw = root.versions;
  if (!versionsRaw || typeof versionsRaw !== "object") return null;
  const vr = versionsRaw as Record<string, unknown>;
  const versions = {} as Record<ListingAdapterPlatformId, AdaptedListingFields>;
  for (const id of LISTING_ADAPTER_PLATFORM_IDS) {
    const one = coerceAdaptedListing(vr[id]);
    if (!one) return null;
    if (id === "tiktok_shop_us" && !one.hook) return null;
    if (id === "shopify" && (!one.subheadline || !one.callToAction)) return null;
    versions[id] = one;
  }
  const summary = typeof root.summary === "string" ? root.summary.trim().slice(0, 500) : undefined;
  return { versions, summary: summary || undefined };
}

async function callOpenAiMultiPlatformAdapter(listingText: string): Promise<MultiPlatformAdapterResult | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const userPayload = {
    listingText: listingText.slice(0, 36_000),
    targets: LISTING_ADAPTER_PLATFORM_IDS,
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.45,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: ADAPTER_SYSTEM },
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
  return parseAdapterJson(raw);
}

export function registerListingMultiPlatformRoutes(app: Express): void {
  app.post("/api/client/listing-multi-platform", requireUser, async (req: Request, res: Response) => {
    const b = (req.body && typeof req.body === "object" ? req.body : {}) as AdapterBody;
    const listingText = typeof b.listingText === "string" ? b.listingText.trim() : "";
    if (!listingText) {
      res.status(400).json({ error: "Envie o texto da listagem (listingText)." });
      return;
    }
    if (listingText.length > MAX_LISTING_TEXT) {
      res.status(400).json({ error: "Texto demasiado longo." });
      return;
    }

    const runDemo = (): MultiPlatformAdapterResult => buildDemoMultiPlatformVersions(listingText);

    if (process.env.OPENAI_API_KEY?.trim()) {
      try {
        const ai = await callOpenAiMultiPlatformAdapter(listingText);
        if (ai) {
          res.json({ ok: true, mode: "live", adapter: ai });
          return;
        }
      } catch (e) {
        res.json({
          ok: true,
          mode: "demo",
          adapter: runDemo(),
          warn: e instanceof Error ? e.message.slice(0, 240) : "openai_error",
        });
        return;
      }
    }

    res.json({ ok: true, mode: "demo", adapter: runDemo() });
  });
}
