# DBX Novo (prep center)

Cliente + consola admin em **React + Vite**, API Express (`scrape-server`) na porta **8787**, front na **5173** (ou porta seguinte se 5173 estiver ocupada).

Este projeto vive em **`diabetes-neurosharp/dbx-novo`**. Use só esta pasta para desenvolver e evitar versões antigas do API noutros diretórios.

## Arranque

Na raiz do monorepo:

```bash
cd /Users/brunosilva/Desktop/diabetes-neurosharp
npm run dbx:dev
```

Ou só dentro desta pasta:

```bash
cd dbx-novo
npm install
npm run dev
```

Isto sobe **Vite + API** em paralelo (`concurrently`). Só API:

```bash
npm run scrape-server
```

Variáveis: copie `.env.example` para `.env` se precisar de overrides.

## Links de teste (local)

Substitua a porta do front se o terminal mostrar outra (ex.: 5174).

| O quê | URL |
| --- | --- |
| API saúde | [http://127.0.0.1:8787/health](http://127.0.0.1:8787/health) |
| Landing | [http://127.0.0.1:5173/](http://127.0.0.1:5173/) |
| Landing DBX Reprice | [http://127.0.0.1:5173/dbx-reprice](http://127.0.0.1:5173/dbx-reprice) |
| Direct Leads Pro (pública) | [http://127.0.0.1:5173/direct-leads-pro](http://127.0.0.1:5173/direct-leads-pro) |
| Consola admin (início) | [http://127.0.0.1:5173/admin](http://127.0.0.1:5173/admin) |
| Admin — assinaturas Reprice | [http://127.0.0.1:5173/admin/assinaturas-reprice-pro](http://127.0.0.1:5173/admin/assinaturas-reprice-pro) |
| Portal — entrar | [http://127.0.0.1:5173/app/entrar](http://127.0.0.1:5173/app/entrar) |
| Portal — módulo Reprice (com login) | [http://127.0.0.1:5173/app/reprice/painel](http://127.0.0.1:5173/app/reprice/painel) |

## Build

```bash
npm run build
```

## Dados locais

Ficheiros JSON em `server/data/` são ignorados pelo Git na raiz do monorepo (demo). Na primeira execução o servidor cria o que faltar.
