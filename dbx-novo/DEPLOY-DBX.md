# DBX — repositório novo no GitHub + Vercel (separado dos outros)

Daqui não dá para abrir a tua conta GitHub/Vercel sem login válido. No teu Mac, corre primeiro:

```bash
gh auth login -h github.com
vercel login
```

## 1) Repositório GitHub só com esta pasta (`dbx-novo`)

**Opção A — recomendada (manténs o monorepo local, pushes só DBX para um remote novo):**

Na raiz do monorepo (`diabetes-neurosharp`), com Git limpo:

```bash
git subtree split -P dbx-novo -b dbx-only
```

No GitHub: **New repository** → nome por exemplo `DBX` (privado ou público), **sem** README/licença (repo vazio).

Depois (substitui `USER`):

```bash
git remote add dbx-github https://github.com/USER/DBX.git
git push dbx-github dbx-only:main
```

Opcional: apagar o branch local `dbx-only` depois do push.

**Opção B — cópia física** (se preferires não usar `subtree`): copia a pasta `dbx-novo` para um sítio novo, `git init`, commit, `gh repo create DBX --private --source=. --push`.

## 2) Vercel como produto novo «DBX»

1. [Vercel Dashboard](https://vercel.com/dashboard) → **Add New…** → **Project**.
2. **Import** o repositório `DBX` (o que acabaste de criar).
3. **Root Directory**: `.` (se o repo contém só o conteúdo de `dbx-novo`).
4. Framework: Vite (o `vercel.json` já define `build` / `dist`).
5. **Nome do projeto** na Vercel: escolhe por exemplo `dbx` ou `dbx-portal` — fica à parte dos outros produtos.

## 3) Variáveis de ambiente (obrigatório em produção)

O front em produção **não** usa o proxy do Vite. Define no Vercel (em **Settings → Environment Variables**, para **Production** e **Preview**):

| Nome | Quando |
|------|--------|
| `VITE_API_URL` | URL absoluta do teu servidor Node (Express), **sem** barra final, ex. `https://api-dbx.teudominio.com`. O browser chama `/api/...` contra esta base. |

Variáveis `VITE_*` entram no **build** — depois de alterar, faz **Redeploy**.

O servidor (`npm run scrape-server` / `httpScrapeServer`) tem de estar noutro host (Railway, Render, VPS, etc.) com o mesmo `.env` de produção que já usas para JWT, admin token, etc.

## 4) Primeiro deploy

```bash
cd /caminho/para/dbx-novo
vercel --name dbx
```

Ou só liga o repo na dashboard (import Git) — o Vercel usa o `vercel.json` desta pasta.

---

Resumo: **login** (`gh` + `vercel`) → **repo vazio `DBX`** → **`git subtree split` + push** → **import no Vercel** → **`VITE_API_URL`** + API noutro serviço.
