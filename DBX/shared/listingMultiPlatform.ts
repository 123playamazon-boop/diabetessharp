/** Targets for the multi-platform listing adapter (US-focused channels). */
export const LISTING_ADAPTER_PLATFORM_IDS = ["amazon_us", "walmart_us", "tiktok_shop_us", "shopify"] as const;

export type ListingAdapterPlatformId = (typeof LISTING_ADAPTER_PLATFORM_IDS)[number];

export function isListingAdapterPlatformId(v: string): v is ListingAdapterPlatformId {
  return (LISTING_ADAPTER_PLATFORM_IDS as readonly string[]).includes(v);
}

/** One adapted listing; fields mirror the AI listing generator where relevant. */
export type AdaptedListingFields = {
  title: string;
  bulletPoints: string[];
  description: string;
  keywords: string;
  hook?: string;
  subheadline?: string;
  callToAction?: string;
};

export type MultiPlatformAdapterResult = {
  versions: Record<ListingAdapterPlatformId, AdaptedListingFields>;
  summary?: string;
};

function toTitleCaseWords(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => {
      if (!w) return w;
      const lower = w.toLowerCase();
      const small = new Set(["and", "or", "for", "the", "a", "an", "of", "in", "to", "with", "ml", "oz"]);
      if (small.has(lower) && w === lower) return lower;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

function clampText(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function buildKeywords(title: string, bullets: string[], description: string): string {
  const blob = `${title} ${bullets.join(" ")} ${description}`.toLowerCase();
  const words = blob
    .split(/[^a-z0-9à-ÿ]+/i)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && w.length < 24);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= 28) break;
  }
  return out.join(", ");
}

/** Best-effort split of a pasted blob into title / bullets / body. */
export function parseUnifiedListingText(raw: string): { title: string; bulletPoints: string[]; description: string } {
  const t = raw.trim();
  if (!t) {
    return {
      title: "Your product",
      bulletPoints: [
        "Premium materials chosen for everyday durability",
        "Thoughtful design details shoppers notice quickly",
        "Clear specs so buyers know it fits their routine",
      ],
      description: "Paste a full listing (title, bullets, description). The adapter keeps the same facts while changing tone and structure per channel.",
    };
  }

  const lines = t.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const title = lines[0] ?? "Product";
  const rest = lines.slice(1);
  if (rest.length === 0) {
    return {
      title,
      bulletPoints: [
        `${clampText(title, 80)} — built for dependable daily use.`,
        "Check size, fit, and compatibility on the PDP before you buy.",
        "Packaging and minor details may vary by batch; core specs stay consistent.",
      ],
      description: clampText(
        `${title}. Use the bullet points above as a quick scan; add materials, dimensions, care, and what is in the box when you paste a richer draft.`,
        1200,
      ),
    };
  }

  const bulletPrefix = /^[•\-\*·◦]\s*|^\d+[.)]\s*/;
  let splitAt = rest.length;
  for (let j = 0; j < rest.length; j++) {
    if (rest[j]!.length > 200) {
      splitAt = j;
      break;
    }
  }
  if (splitAt === rest.length && rest.length > 1) {
    const maxB = Math.min(6, rest.length);
    splitAt = maxB;
  }

  const bulletBlock = rest.slice(0, splitAt);
  const descBlock = rest.slice(splitAt);

  let bulletPoints = bulletBlock.map((l) => l.replace(bulletPrefix, "").trim()).filter((l) => l.length > 0);

  if (bulletPoints.length === 0) {
    bulletPoints = bulletBlock.length > 0 ? bulletBlock.slice(0, 5) : [rest[0] ?? "Key benefit one", rest[1] ?? "Key benefit two"].filter(Boolean);
  }

  let description = descBlock.join("\n\n").trim();
  if (!description) description = rest.join("\n\n").trim() || title;

  bulletPoints = bulletPoints.slice(0, 8);
  return { title, bulletPoints, description: clampText(description, 8000) };
}

function padBulletsTo(bullets: string[], n: number, filler: string): string[] {
  const out = bullets.slice(0, n);
  while (out.length < n) out.push(filler);
  return out;
}

/** Deterministic English demo when OpenAI is unavailable. */
export function buildDemoMultiPlatformVersions(listingText: string): MultiPlatformAdapterResult {
  const parsed = parseUnifiedListingText(listingText);
  const kw = buildKeywords(parsed.title, parsed.bulletPoints, parsed.description);
  const descShort = clampText(parsed.description, 720);
  const firstBenefit = parsed.bulletPoints[0] ?? parsed.title;
  const secondBenefit = parsed.bulletPoints[1] ?? firstBenefit;

  const amazonBullets = padBulletsTo(
    parsed.bulletPoints.slice(0, 5).map((b) => {
      const line = b.replace(/\s+/g, " ").trim();
      const head = line.split(/[.!?–—]/)[0]?.trim() || line;
      const caps = head
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 4)
        .map((w) => w.toUpperCase())
        .join(" ");
      const tail = line.length > head.length ? line.slice(head.length).replace(/^[.!?–—\s]+/, "").trim() : line;
      return clampText(tail ? `${caps} — ${tail}` : `${caps} — ${line}`, 500);
    }),
    5,
    "DETAILS YOU CAN TRUST — Confirm materials, dimensions, and what is in the box on the PDP and packaging.",
  );

  const walmartBullets = padBulletsTo(
    parsed.bulletPoints.slice(0, 5).map((b) => {
      const line = clampText(b.replace(/\s+/g, " ").trim(), 500);
      return line.match(/^[A-Za-z]/) ? line : `What you get: ${line}`;
    }),
    5,
    "Everyday use: practical design with clear specs—verify fit and compatibility before purchase.",
  );

  const tiktokBullets = parsed.bulletPoints.slice(0, 4).map((b) => clampText(b.replace(/\s+/g, " ").trim(), 88));
  while (tiktokBullets.length < 3) tiktokBullets.push("Fast read: why people tap buy on this SKU.");

  const shopifyBullets = padBulletsTo(
    parsed.bulletPoints.slice(0, 5).map((b) => clampText(b.replace(/\s+/g, " ").trim(), 220)),
    5,
    "Why it earns a spot in your cart: clear payoff, honest details, easy care.",
  );

  const amazon_us: AdaptedListingFields = {
    title: clampText(toTitleCaseWords(parsed.title), 200),
    bulletPoints: amazonBullets,
    description: `${descShort}\n\nWhy shoppers choose it: scan-first bullets above, then read for nuance. Add size charts, materials, and compliance notes where your catalog requires them.`,
    keywords: kw,
  };

  const walmart_us: AdaptedListingFields = {
    title: clampText(`${parsed.title} — Value for busy households`, 200),
    bulletPoints: walmartBullets,
    description: `${descShort}\n\nWalmart shoppers compare fast: lead with what is in the box, who it is for, and any warranty or return notes your brand supports.`,
    keywords: kw,
  };

  const hook = clampText(`POV: you finally found ${firstBenefit.split(/[.!?]/)[0]?.trim() || "the upgrade you keep reordering"}.`, 100);

  const tiktok_shop_us: AdaptedListingFields = {
    title: clampText(`${parsed.title.split(/\s+/).slice(0, 8).join(" ")} | Ships fast`, 90),
    hook,
    bulletPoints: tiktokBullets,
    description: clampText(`${hook}\n\n${descShort}\n\nTap buy if this matches your routine—double-check size and color on the PDP.`, 1200),
    keywords: kw,
  };

  const shopifyTitle = clampText(toTitleCaseWords(parsed.title), 90);
  const sub = clampText(secondBenefit.replace(/\s+/g, " ").trim(), 120);

  const shopify: AdaptedListingFields = {
    title: shopifyTitle,
    subheadline: sub,
    callToAction: "Add to cart",
    bulletPoints: shopifyBullets,
    description: `${shopifyTitle}.\n\n${sub}\n\n${descShort}\n\nTell the story: who it is for, what changes day one, and how it fits the rest of your lineup. Keep claims factual and match your storefront policy pages.`,
    keywords: kw,
  };

  return {
    versions: { amazon_us, walmart_us, tiktok_shop_us, shopify },
    summary:
      "Demo mode: English adaptations using your pasted structure. With OpenAI enabled, copy is rewritten per channel while preserving the same core claims.",
  };
}
