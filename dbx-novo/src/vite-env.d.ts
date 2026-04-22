/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base do backend (sem barra final). Se vazio em dev, usa `http://<hostname>:8787`. */
  readonly VITE_API_URL?: string;
  /** Base URL do backend que expõe POST /api/scrape (ex.: https://api.seudominio.com). Opcional em dev (usa o mesmo host). */
  readonly VITE_SCRAPE_API_URL?: string;
  /** Deve coincidir com ADMIN_API_TOKEN no servidor (consola admin). Em produção prefira não expor no bundle. */
  readonly VITE_ADMIN_API_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
