import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    /** Preenchido pelo middleware RBAC: cliente autenticado (suite) ou consola admin. */
    dbxAuth?: { type: "user"; suite: string; email: string } | { type: "admin" };
  }
}
