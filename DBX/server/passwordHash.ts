import crypto from "node:crypto";

const PREFIX = "scrypt1";
const KEYLEN = 32;
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(plain, salt, KEYLEN, SCRYPT_OPTS);
  return `${PREFIX}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string | undefined): boolean {
  if (!stored || typeof stored !== "string" || !stored.startsWith(`${PREFIX}$`)) return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || !parts[1] || !parts[2]) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[1], "hex");
    expected = Buffer.from(parts[2], "hex");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length !== KEYLEN) return false;
  let actual: Buffer;
  try {
    actual = crypto.scryptSync(plain, salt, KEYLEN, SCRYPT_OPTS);
  } catch {
    return false;
  }
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}
