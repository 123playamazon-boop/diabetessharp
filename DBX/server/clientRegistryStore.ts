import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ClientOnboardingQuiz,
  ClientRegisterPayload,
  ClientVerificationStatus,
} from "../src/types";
import { hashPassword, verifyPassword } from "./passwordHash";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data", "clients.json");

export type RegistryClient = {
  suite: string;
  name: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  balanceUsd: number;
  planLabel: string;
  /** Assinatura premium (admin pode ativar / revogar na consola). */
  premiumActive: boolean;
  /** Direct Leads Pro — lista diária Amazon curada (admin; cobrança à parte, ex. US$ 49,99/mês). */
  amazonLeadsProActive: boolean;
  /** DBX Reprice — repricing / margem Amazon (admin; add-on mensal, ex. US$ 49,99/mês). */
  repriceProActive: boolean;
  /** AI Listing — plano Starter (até 20 listagens/mês; admin). */
  aiListingStarterActive: boolean;
  /** AI Listing — plano Pro (até 100 listagens/mês; admin). */
  aiListingProActive: boolean;
  createdAtIso: string;
  active: boolean;
  tier: string;
  proofOfAddressDataUrl: string;
  idDocumentDataUrl: string;
  verificationStatus: ClientVerificationStatus;
  onboardingQuiz: ClientOnboardingQuiz;
  /** Hash scrypt (nunca exposto na API pública). Contas antigas podem não ter. */
  passwordHash?: string;
};

type Snapshot = { clients: RegistryClient[] };

function emptySnapshot(): Snapshot {
  return { clients: [] };
}

/** Migra registos antigos (street / stateUs / zipUs) para o formato universal. */
function normalizeClient(r: Record<string, unknown>): RegistryClient | null {
  if (typeof r.suite !== "string" || typeof r.name !== "string") return null;
  const email = typeof r.email === "string" ? r.email : `${r.suite}@legacy.demo`;
  const quizRaw = r.onboardingQuiz;
  let onboardingQuiz: ClientOnboardingQuiz = {
    productCategories: "",
    monthlyVolumeBand: "",
    supplierRegion: "usa",
    businessModel: "private_label",
  };
  if (quizRaw && typeof quizRaw === "object") {
    const q = quizRaw as Record<string, unknown>;
    if (typeof q.productCategories === "string") onboardingQuiz.productCategories = q.productCategories;
    if (typeof q.monthlyVolumeBand === "string") onboardingQuiz.monthlyVolumeBand = q.monthlyVolumeBand;
    if (q.supplierRegion === "usa" || q.supplierRegion === "international") {
      onboardingQuiz.supplierRegion = q.supplierRegion;
    }
    if (
      q.businessModel === "dropshipping" ||
      q.businessModel === "online_arbitrage" ||
      q.businessModel === "private_label"
    ) {
      onboardingQuiz.businessModel = q.businessModel;
    }
  }
  const vs: ClientVerificationStatus =
    r.verificationStatus === "approved" || r.verificationStatus === "pending_review" ? r.verificationStatus : "approved";

  const addressLine1 =
    typeof r.addressLine1 === "string"
      ? r.addressLine1
      : typeof r.street === "string"
        ? r.street
        : "";
  const addressLine2 = typeof r.addressLine2 === "string" ? r.addressLine2 : "";
  const city = typeof r.city === "string" ? r.city : "";
  const region =
    typeof r.region === "string" ? r.region : typeof r.stateUs === "string" ? r.stateUs : "";
  const postalCode =
    typeof r.postalCode === "string" ? r.postalCode : typeof r.zipUs === "string" ? r.zipUs : "";
  let country = typeof r.country === "string" ? r.country.trim() : "";
  if (!country && typeof r.stateUs === "string" && /^[A-Za-z]{2}$/.test(r.stateUs) && typeof r.zipUs === "string") {
    const z = r.zipUs.trim();
    if (/^\d{5}(-\d{4})?$/.test(z)) country = "United States";
  }

  return {
    suite: r.suite,
    name: r.name,
    email,
    phone: typeof r.phone === "string" ? r.phone : "",
    addressLine1,
    addressLine2,
    city,
    region,
    postalCode,
    country,
    balanceUsd: typeof r.balanceUsd === "number" ? r.balanceUsd : 0,
    planLabel: typeof r.planLabel === "string" ? r.planLabel : "Conta",
    premiumActive: r.premiumActive === true,
    amazonLeadsProActive: r.amazonLeadsProActive === true,
    repriceProActive: r.repriceProActive === true,
    aiListingStarterActive: r.aiListingStarterActive === true,
    aiListingProActive: r.aiListingProActive === true,
    createdAtIso: typeof r.createdAtIso === "string" ? r.createdAtIso : new Date().toISOString(),
    active: typeof r.active === "boolean" ? r.active : true,
    tier: typeof r.tier === "string" ? r.tier : "Starter",
    proofOfAddressDataUrl: typeof r.proofOfAddressDataUrl === "string" ? r.proofOfAddressDataUrl : "",
    idDocumentDataUrl: typeof r.idDocumentDataUrl === "string" ? r.idDocumentDataUrl : "",
    verificationStatus: vs,
    onboardingQuiz,
    passwordHash: typeof r.passwordHash === "string" && r.passwordHash.length > 0 ? r.passwordHash : undefined,
  };
}

function loadSnapshot(): Snapshot {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return emptySnapshot();
    const o = j as Record<string, unknown>;
    const clients: RegistryClient[] = [];
    if (Array.isArray(o.clients)) {
      for (const x of o.clients) {
        if (!x || typeof x !== "object") continue;
        const c = normalizeClient(x as Record<string, unknown>);
        if (c) clients.push(c);
      }
    }
    return { clients };
  } catch {
    return emptySnapshot();
  }
}

function persist(s: Snapshot): void {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(s, null, 0), "utf8");
}

function nextSuite(s: Snapshot): string {
  const maxNum = s.clients.reduce((acc, c) => {
    const m = /^(\d{4,6})$/.exec(c.suite.trim());
    if (m) return Math.max(acc, Number(m[1]));
    return acc;
  }, 10000);
  return String(maxNum + 1);
}

export function registerClientFull(payload: ClientRegisterPayload): RegistryClient {
  const n = payload.name.trim();
  if (n.length < 2) throw new Error("Indique o nome da conta ou empresa (mín. 2 caracteres).");
  const email = payload.email.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Indique um email válido.");
  const phoneDigits = payload.phone.replace(/\D/g, "");
  if (phoneDigits.length < 8) throw new Error("Indique um telefone válido (mín. 8 dígitos).");
  const addressLine1 = payload.addressLine1.trim();
  const addressLine2 = payload.addressLine2.trim();
  const city = payload.city.trim();
  const region = payload.region.trim();
  const postalCode = payload.postalCode.trim();
  const country = payload.country.trim();
  if (addressLine1.length < 4) throw new Error("Indique a morada — linha 1 (rua, número, edifício…).");
  if (city.length < 2) throw new Error("Indique a cidade ou localidade.");
  if (country.length < 2) throw new Error("Indique o país.");
  if (region.length < 2 && postalCode.length < 2) {
    throw new Error("Indique pelo menos o código postal ou a região (estado, província, condado…).");
  }
  if (!payload.proofOfAddressDataUrl?.trim().startsWith("data:")) {
    throw new Error("Envie o comprovante de endereço (imagem ou PDF).");
  }
  if (!payload.idDocumentDataUrl?.trim().startsWith("data:")) {
    throw new Error("Envie a foto do documento (RG, carta de condução ou passaporte).");
  }
  const q = payload.onboardingQuiz;
  if (!q.productCategories?.trim()) throw new Error("Descreva os tipos de produto que planeia enviar.");
  if (!q.monthlyVolumeBand) throw new Error("Indique a faixa de volume mensal.");
  const rawPw = typeof payload.password === "string" ? payload.password : "";
  if (rawPw.trim().length < 8) throw new Error("Defina uma senha com pelo menos 8 caracteres.");

  const s = loadSnapshot();
  const emailLower = email.toLowerCase();
  if (s.clients.some((c) => c.email.trim().toLowerCase() === emailLower)) {
    throw new Error("Já existe uma conta com este e-mail.");
  }
  const suite = nextSuite(s);
  const row: RegistryClient = {
    suite,
    name: n,
    email,
    phone: payload.phone.trim(),
    addressLine1,
    addressLine2,
    city,
    region,
    postalCode,
    country,
    balanceUsd: 0,
    planLabel: "Conta nova",
    premiumActive: false,
    amazonLeadsProActive: false,
    repriceProActive: false,
    aiListingStarterActive: false,
    aiListingProActive: false,
    createdAtIso: new Date().toISOString(),
    active: true,
    tier: "Starter",
    proofOfAddressDataUrl: payload.proofOfAddressDataUrl.trim(),
    idDocumentDataUrl: payload.idDocumentDataUrl.trim(),
    verificationStatus: "pending_review",
    onboardingQuiz: {
      productCategories: q.productCategories.trim(),
      monthlyVolumeBand: q.monthlyVolumeBand,
      supplierRegion: q.supplierRegion,
      businessModel: q.businessModel,
    },
    passwordHash: hashPassword(rawPw),
  };
  s.clients = [row, ...s.clients.filter((c) => c.suite !== suite)];
  persist(s);
  return row;
}

export function listClients(): RegistryClient[] {
  return loadSnapshot().clients;
}

/** Substitui toda a lista (demo / reset). */
export function replaceAllClients(clients: RegistryClient[]): void {
  persist({ clients });
}

/**
 * Ajusta saldo (demo): `deltaUsd` positivo = crédito; negativo = débito.
 * Devolve erro se o débito deixar saldo negativo.
 */
export function applyWalletDelta(
  suite: string,
  deltaUsd: number,
): { ok: true; balanceUsd: number } | { ok: false; error: string } {
  const s = loadSnapshot();
  const i = s.clients.findIndex((c) => c.suite === suite.trim());
  if (i < 0) return { ok: false, error: "Suite não encontrada." };
  const cur = Number(s.clients[i]!.balanceUsd) || 0;
  const next = Math.round((cur + deltaUsd) * 100) / 100;
  if (next < -0.0001) return { ok: false, error: "Saldo insuficiente para este valor." };
  const capped = Math.max(0, next);
  s.clients[i] = { ...s.clients[i]!, balanceUsd: capped };
  persist(s);
  return { ok: true, balanceUsd: capped };
}

export function findBySuite(suite: string): RegistryClient | undefined {
  const q = suite.trim();
  return loadSnapshot().clients.find((c) => c.suite === q);
}

export function findClientByEmail(email: string): RegistryClient | undefined {
  const q = email.trim().toLowerCase();
  if (!q) return undefined;
  return loadSnapshot().clients.find((c) => c.email.trim().toLowerCase() === q);
}

export type ClientLoginFailureReason = "not_found" | "password" | "no_password";

/** Login do portal: e-mail + senha (a suite continua no perfil após autenticar). */
export function tryClientLogin(
  email: string,
  password: string,
): { ok: true; client: RegistryClient } | { ok: false; reason: ClientLoginFailureReason } {
  const c = findClientByEmail(email);
  if (!c) return { ok: false, reason: "not_found" };
  if (!c.passwordHash) return { ok: false, reason: "no_password" };
  if (!verifyPassword(password, c.passwordHash)) return { ok: false, reason: "password" };
  return { ok: true, client: c };
}

/** Portal antigo: suite + campo «nome» (podia ser o nome da conta ou o e-mail). */
export function tryClientLoginBySuiteAndNameOrEmail(
  suite: string,
  nameOrEmail: string,
  password: string,
):
  | { ok: true; client: RegistryClient }
  | { ok: false; reason: ClientLoginFailureReason | "name_mismatch" } {
  const c = findBySuite(suite);
  if (!c) return { ok: false, reason: "not_found" };
  if (!c.passwordHash) return { ok: false, reason: "no_password" };
  const q = nameOrEmail.trim().toLowerCase();
  const okId =
    c.name.trim().toLowerCase() === q ||
    c.email.trim().toLowerCase() === q;
  if (!okId) return { ok: false, reason: "name_mismatch" };
  if (!verifyPassword(password, c.passwordHash)) return { ok: false, reason: "password" };
  return { ok: true, client: c };
}

/** Só número da suite + senha (útil quando o utilizador cola a suite no campo de e-mail). */
export function tryClientLoginBySuitePassword(
  suite: string,
  password: string,
): { ok: true; client: RegistryClient } | { ok: false; reason: ClientLoginFailureReason } {
  const c = findBySuite(suite);
  if (!c) return { ok: false, reason: "not_found" };
  if (!c.passwordHash) return { ok: false, reason: "no_password" };
  if (!verifyPassword(password, c.passwordHash)) return { ok: false, reason: "password" };
  return { ok: true, client: c };
}

export function setClientPasswordBySuite(
  suite: string,
  plainPassword: string,
): { ok: true; client: RegistryClient } | { ok: false; error: string } {
  const pw = plainPassword.trim();
  if (pw.length < 8) return { ok: false, error: "Senha deve ter pelo menos 8 caracteres." };
  const s = loadSnapshot();
  const i = s.clients.findIndex((c) => c.suite.trim() === suite.trim());
  if (i < 0) return { ok: false, error: "Suite não encontrada." };
  const next = { ...s.clients[i]!, passwordHash: hashPassword(pw) };
  s.clients[i] = next;
  persist(s);
  return { ok: true, client: next };
}

export function approveClientSuite(suite: string): RegistryClient | null {
  const s = loadSnapshot();
  const i = s.clients.findIndex((c) => c.suite === suite.trim());
  if (i < 0) return null;
  s.clients[i] = {
    ...s.clients[i],
    verificationStatus: "approved",
    active: true,
  };
  persist(s);
  return s.clients[i];
}

export function setClientPremiumActive(suite: string, active: boolean): RegistryClient | null {
  const s = loadSnapshot();
  const i = s.clients.findIndex((c) => c.suite === suite.trim());
  if (i < 0) return null;
  s.clients[i] = { ...s.clients[i], premiumActive: Boolean(active) };
  persist(s);
  return s.clients[i];
}

export function setClientAmazonLeadsProActive(suite: string, active: boolean): RegistryClient | null {
  const s = loadSnapshot();
  const i = s.clients.findIndex((c) => c.suite === suite.trim());
  if (i < 0) return null;
  s.clients[i] = { ...s.clients[i], amazonLeadsProActive: Boolean(active) };
  persist(s);
  return s.clients[i];
}

export function setClientRepriceProActive(suite: string, active: boolean): RegistryClient | null {
  const s = loadSnapshot();
  const i = s.clients.findIndex((c) => c.suite === suite.trim());
  if (i < 0) return null;
  s.clients[i] = { ...s.clients[i], repriceProActive: Boolean(active) };
  persist(s);
  return s.clients[i];
}

export function setClientAiListingStarterActive(suite: string, active: boolean): RegistryClient | null {
  const s = loadSnapshot();
  const i = s.clients.findIndex((c) => c.suite === suite.trim());
  if (i < 0) return null;
  const cur = s.clients[i]!;
  s.clients[i] = {
    ...cur,
    aiListingStarterActive: Boolean(active),
    aiListingProActive: active ? false : cur.aiListingProActive,
  };
  persist(s);
  return s.clients[i];
}

export function setClientAiListingProActive(suite: string, active: boolean): RegistryClient | null {
  const s = loadSnapshot();
  const i = s.clients.findIndex((c) => c.suite === suite.trim());
  if (i < 0) return null;
  const cur = s.clients[i]!;
  s.clients[i] = {
    ...cur,
    aiListingProActive: Boolean(active),
    aiListingStarterActive: active ? false : cur.aiListingStarterActive,
  };
  persist(s);
  return s.clients[i];
}

/** Remove um registo de cliente (demo / consola). */
export function removeClientBySuite(suite: string): boolean {
  const q = suite.trim();
  if (!q) return false;
  const s = loadSnapshot();
  const next = s.clients.filter((c) => c.suite.trim() !== q);
  if (next.length === s.clients.length) return false;
  persist({ clients: next });
  return true;
}

export type RegistryClientPatch = Partial<
  Pick<
    RegistryClient,
    | "name"
    | "email"
    | "phone"
    | "addressLine1"
    | "addressLine2"
    | "city"
    | "region"
    | "postalCode"
    | "country"
    | "tier"
    | "active"
  >
>;

/** Atualiza campos administrativos; só aplica chaves presentes em «patch». */
export function patchClientBySuite(suite: string, patch: RegistryClientPatch): RegistryClient | null {
  const q = suite.trim();
  if (!q) return null;
  const s = loadSnapshot();
  const i = s.clients.findIndex((c) => c.suite.trim() === q);
  if (i < 0) return null;
  const cur = s.clients[i]!;
  let next: RegistryClient = { ...cur };
  if (patch.name !== undefined) {
    const v = patch.name.trim();
    if (!v) return null;
    next.name = v;
  }
  if (patch.email !== undefined) {
    const v = patch.email.trim();
    if (!v) return null;
    next.email = v;
  }
  if (patch.phone !== undefined) next.phone = patch.phone.trim();
  if (patch.addressLine1 !== undefined) next.addressLine1 = patch.addressLine1.trim();
  if (patch.addressLine2 !== undefined) next.addressLine2 = patch.addressLine2.trim();
  if (patch.city !== undefined) next.city = patch.city.trim();
  if (patch.region !== undefined) next.region = patch.region.trim();
  if (patch.postalCode !== undefined) next.postalCode = patch.postalCode.trim();
  if (patch.country !== undefined) next.country = patch.country.trim();
  if (patch.tier !== undefined) next.tier = patch.tier.trim() || next.tier;
  if (patch.active === true || patch.active === false) next.active = patch.active;
  s.clients[i] = next;
  persist(s);
  return next;
}

/** Perfil sem ficheiros base64 (para o browser). */
export function toPublicProfile(c: RegistryClient): {
  suite: string;
  name: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  balanceUsd: number;
  planLabel: string;
  premiumActive: boolean;
  amazonLeadsProActive: boolean;
  repriceProActive: boolean;
  aiListingStarterActive: boolean;
  aiListingProActive: boolean;
  verificationStatus: ClientVerificationStatus;
  onboardingQuiz: ClientOnboardingQuiz;
} {
  return {
    suite: c.suite,
    name: c.name,
    email: c.email,
    phone: c.phone,
    addressLine1: c.addressLine1,
    addressLine2: c.addressLine2,
    city: c.city,
    region: c.region,
    postalCode: c.postalCode,
    country: c.country,
    balanceUsd: c.balanceUsd,
    planLabel: c.planLabel,
    premiumActive: c.premiumActive === true,
    amazonLeadsProActive: c.amazonLeadsProActive === true,
    repriceProActive: c.repriceProActive === true,
    aiListingStarterActive: c.aiListingStarterActive === true,
    aiListingProActive: c.aiListingProActive === true,
    verificationStatus: c.verificationStatus,
    onboardingQuiz: c.onboardingQuiz,
  };
}
