import http from "node:http";
import https from "node:https";
import type { IncomingHttpHeaders } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

function stripHopByHop(headers: IncomingHttpHeaders): http.OutgoingHttpHeaders {
  const out: http.OutgoingHttpHeaders = { ...headers };
  for (const k of [
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
  ]) {
    delete out[k];
    delete out[k.toUpperCase()];
  }
  return out;
}

/**
 * Proxy `/api` → Express com stream do corpo completo.
 * O proxy integrado do Vite falha com POST grandes (registo + base64) e devolve o index.html.
 */
export function dbxApiProxyPlugin(options?: { target?: string }): Plugin {
  const targetStr = options?.target ?? process.env.SCRAPE_API_URL ?? "http://127.0.0.1:8787";
  const target = new URL(targetStr);
  const port =
    target.port === ""
      ? target.protocol === "https:"
        ? 443
        : 80
      : Number(target.port);
  const hostHeader = target.port === "" ? target.hostname : `${target.hostname}:${target.port}`;
  const lib = target.protocol === "https:" ? https : http;

  const middleware = (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
    const path = req.url ?? "";
    /** Só `/api/...` ou `/api` (não `/api-test.html`, etc.) + `/health` no mesmo host do Vite. */
    const pathOnly = (path.split("?")[0] ?? path) || "/";
    const isApi =
      pathOnly === "/api" || pathOnly.startsWith("/api/") || pathOnly.startsWith("/api?");
    if (!isApi && pathOnly !== "/health") {
      next();
      return;
    }

    const opts: http.RequestOptions = {
      protocol: target.protocol,
      hostname: target.hostname,
      port,
      path,
      method: req.method,
      headers: { ...stripHopByHop(req.headers), host: hostHeader },
    };

    const pReq = lib.request(opts, (pRes) => {
      res.writeHead(pRes.statusCode ?? 502, stripHopByHop(pRes.headers));
      pRes.pipe(res);
    });
    pReq.on("error", () => {
      if (!res.headersSent) {
        res.statusCode = 502;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(
          JSON.stringify({
            error: `Sem ligação à API em ${target.origin}. Corra «npm run scrape-server» na pasta DBX_NOVO.`,
          }),
        );
      }
    });
    req.pipe(pReq);
  };

  return {
    name: "dbx-api-proxy-stream",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
