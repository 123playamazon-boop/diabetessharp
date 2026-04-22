import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type UserAccessTokenPayload = {
  v: 1;
  role: "user";
  suite: string;
  email?: string;
  iat: number;
  exp: number;
};

const DEV_JWT_SECRET = "__dbx_dev_jwt_secret_min_32_chars__";
const DEFAULT_DEV_ADMIN_TOKEN = "dbx-local-admin-token-do-not-use-in-prod";

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function getJwtSecret(): string {
  const s = (process.env.AUTH_JWT_SECRET ?? "").trim();
  if (s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_JWT_SECRET em falta ou demasiado curto (mínimo 32 caracteres) em produção.");
  }
  return DEV_JWT_SECRET;
}

function expiresSeconds(): number {
  const d = Number(process.env.AUTH_JWT_EXPIRES_DAYS ?? "7");
  if (!Number.isFinite(d) || d <= 0) return 7 * 86400;
  return Math.floor(d * 86400);
}

export function signUserAccessToken(args: { suite: string; email?: string }): string {
  const secret = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  const payload: UserAccessTokenPayload = {
    v: 1,
    role: "user",
    suite: args.suite.trim(),
    email: typeof args.email === "string" ? args.email.trim() : undefined,
    iat: now,
    exp: now + expiresSeconds(),
  };
  const header = { alg: "HS256", typ: "dbx" };
  const h = b64url(Buffer.from(JSON.stringify(header), "utf8"));
  const p = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = createHmac("sha256", secret).update(`${h}.${p}`).digest();
  return `${h}.${p}.${b64url(sig)}`;
}

export function verifyUserAccessToken(token: string | undefined): UserAccessTokenPayload | null {
  if (!token?.trim()) return null;
  const parts = token.trim().split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  if (!h || !p || !s) return null;
  let secret: string;
  try {
    secret = getJwtSecret();
  } catch {
    return null;
  }
  const expected = createHmac("sha256", secret).update(`${h}.${p}`).digest();
  let sigBuf: Buffer;
  try {
    sigBuf = Buffer.from(s, "base64url");
  } catch {
    return null;
  }
  if (sigBuf.length !== expected.length || !timingSafeEqual(sigBuf, expected)) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  const o = payload as Record<string, unknown>;
  if (o.v !== 1 || o.role !== "user" || typeof o.suite !== "string" || !o.suite.trim()) return null;
  const exp = Number(o.exp);
  const iat = Number(o.iat);
  if (!Number.isFinite(exp) || !Number.isFinite(iat)) return null;
  if (exp < Math.floor(Date.now() / 1000)) return null;
  return {
    v: 1,
    role: "user",
    suite: String(o.suite).trim(),
    email: typeof o.email === "string" ? o.email : undefined,
    iat,
    exp,
  };
}

/** Hash fixo para comparar segredos com comprimentos diferentes sem vazar o comprimento. */
function hashToken(s: string): Buffer {
  return createHash("sha256").update(s, "utf8").digest();
}

export function timingSafeTokenEquals(a: string, b: string): boolean {
  const ah = hashToken(a);
  const bh = hashToken(b);
  return ah.length === bh.length && timingSafeEqual(ah, bh);
}

export function getExpectedAdminApiToken(): string {
  const fromEnv = (process.env.ADMIN_API_TOKEN ?? "").trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    return "";
  }
  return DEFAULT_DEV_ADMIN_TOKEN;
}

export function assertAuthEnvForProduction(): void {
  if (process.env.NODE_ENV !== "production") return;
  getJwtSecret();
  const admin = (process.env.ADMIN_API_TOKEN ?? "").trim();
  if (!admin || admin.length < 16) {
    throw new Error("ADMIN_API_TOKEN em falta ou demasiado curto (mínimo 16 caracteres) em produção.");
  }
}
