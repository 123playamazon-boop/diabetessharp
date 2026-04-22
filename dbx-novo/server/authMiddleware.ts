import type { NextFunction, Request, Response } from "express";
import { getExpectedAdminApiToken, timingSafeTokenEquals, verifyUserAccessToken } from "./accessToken";

function readBearer(req: Request): string | undefined {
  const raw = req.headers.authorization;
  if (!raw || typeof raw !== "string") return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return m?.[1]?.trim() || undefined;
}

/** Suite do cliente autenticado (só válido após `requireUser`). */
export function userSuite(req: Request): string {
  const a = req.dbxAuth;
  if (!a || a.type !== "user") {
    throw new Error("userSuite: requireUser em falta na rota.");
  }
  return a.suite;
}

export function requireUser(req: Request, res: Response, next: NextFunction): void {
  const token = readBearer(req);
  const payload = verifyUserAccessToken(token);
  if (!payload) {
    res.setHeader("WWW-Authenticate", 'Bearer realm="dbx-client", error="invalid_token"');
    res.status(401).json({ error: "Autenticação necessária. Inicie sessão novamente." });
    return;
  }
  req.dbxAuth = { type: "user", suite: payload.suite, email: payload.email ?? "" };
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = readBearer(req);
  if (!token) {
    res.setHeader("WWW-Authenticate", 'Bearer realm="dbx-admin"');
    res.status(401).json({ error: "Autenticação de administrador necessária." });
    return;
  }
  const expected = getExpectedAdminApiToken();
  if (!expected) {
    res.status(503).json({ error: "ADMIN_API_TOKEN não configurado no servidor." });
    return;
  }
  if (!timingSafeTokenEquals(token, expected)) {
    res.status(403).json({ error: "Acesso de administrador negado." });
    return;
  }
  req.dbxAuth = { type: "admin" };
  next();
}
