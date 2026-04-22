# Prompt para o Claude (ou outro assistente) — deploy DBX isolado

Copia **tudo** entre as linhas `<<<INÍCIO DO PROMPT` e `FIM DO PROMPT>>>` e cola noutra conversa com o Claude.

---

<<<INÍCIO DO PROMPT

## Contexto

Trabalho num monorepo Git chamado `diabetes-neurosharp`. O produto **DBX** é **apenas** a subpasta `dbx-novo/` (React + Vite no front; API em Node/Express na pasta `server/`). O front em desenvolvimento usa o proxy do Vite (`dbxApiProxyPlugin.ts`) para encaminhar `/api` para o Express na porta **8787**. Em **produção no static hosting** (ex.: Vercel), esse proxy **não existe**: o browser precisa de uma URL absoluta do backend via variável de ambiente **`VITE_API_URL`** (ver `src/lib/apiUrl.ts`).

Já existem no projeto:
- `dbx-novo/vercel.json` — build `npm run build`, output `dist`, rewrites SPA, nome sugerido `dbx`.
- `dbx-novo/DEPLOY-DBX.md` — passos de Git subtree + Vercel + env.
- `dbx-novo/.env.example` — documentação de variáveis (inclui `VITE_API_URL`).

Objetivo: **não misturar** com outros produtos no GitHub nem na Vercel — criar um **repositório GitHub novo** (ex.: nome `DBX` ou `dbx-portal`) que contenha **só o conteúdo equivalente a `dbx-novo/`**, e um **projeto Vercel novo** dedicado a este front, com nome claro tipo `dbx` ou `dbx-web`.

## Caminhos absolutos no disco do dono do projeto (macOS)

- Monorepo: `/Users/brunosilva/Desktop/diabetes-neurosharp/`
- App DBX: `/Users/brunosilva/Desktop/diabetes-neurosharp/dbx-novo/`

Ficheiros-chave para o dev ler antes de agir:
- `/Users/brunosilva/Desktop/diabetes-neurosharp/dbx-novo/DEPLOY-DBX.md`
- `/Users/brunosilva/Desktop/diabetes-neurosharp/dbx-novo/vercel.json`
- `/Users/brunosilva/Desktop/diabetes-neurosharp/dbx-novo/package.json`
- `/Users/brunosilva/Desktop/diabetes-neurosharp/dbx-novo/.env.example`

Entrada do servidor local/produção do API:
- `/Users/brunosilva/Desktop/diabetes-neurosharp/dbx-novo/server/httpScrapeServer.ts` (script npm `scrape-server`)

## O que quero que faças (tarefas)

1. **Confirmar pré-requisitos** com o utilizador se necessário: `gh auth login` (GitHub CLI) e `vercel login` válidos; acesso ao repositório remoto onde vai existir o repo novo.

2. **Repositório GitHub isolado** com histórico ou conteúdo **apenas** da pasta `dbx-novo`:
   - Opção preferida documentada em `DEPLOY-DBX.md`: a partir da raiz do monorepo, `git subtree split -P dbx-novo -b dbx-only`, criar repo vazio no GitHub (sem README inicial se for para evitar conflito no primeiro push), adicionar `remote` e fazer push do branch resultante para `main` (ou `master`, conforme o repo novo).
   - Alternativa aceitável: cópia limpa de `dbx-novo` para uma pasta nova, `git init`, primeiro commit, push para repo novo — desde que **não** leve pastas irmãs (`newsbreak-dashboard`, etc.).

3. **Não commitar segredos**: garantir que `.env` real **não** entra no Git; só `.env.example` e documentação.

4. **Vercel**: criar **novo** projeto ligado ao repo novo; root do projeto = raiz do repo se o repo for só o conteúdo de `dbx-novo`. Configurar variáveis de **build**:
   - `VITE_API_URL` = URL pública **HTTPS** do backend Express já em produção (sem barra final), onde as rotas `/api/...` respondem.
   - Se o admin precisar de token embutido no build (não ideal mas existe no código), rever `VITE_ADMIN_API_TOKEN` em `src/lib/authHeaders.ts` / `.env.example` — preferir não expor em produção pública.

5. **Backend**: explicar claramente ao utilizador que o **Express não roda dentro do static da Vercel** com esta arquitetura atual; o backend tem de estar noutro serviço (Railway, Render, Fly.io, VPS, Docker, etc.) com as mesmas variáveis de servidor que o `.env.example` do `dbx-novo` descreve (`AUTH_JWT_SECRET`, `ADMIN_API_TOKEN`, etc.). O front na Vercel só precisa de alcançar esse host via `VITE_API_URL` e CORS no Express tem de permitir o domínio Vercel.

6. **CORS**: se o API estiver noutro domínio, verificar no código do Express (`server/`) que o origin do front Vercel está permitido; se não, indicar o ficheiro a alterar e a alteração mínima.

7. **Validação pós-deploy**: após o primeiro deploy, listar os URLs (ex.: `https://<projeto>.vercel.app`), e um checklist curto: abrir login, uma rota `/api/health` ou equivalente se existir, confirmar que pedidos XHR vão para `VITE_API_URL` e não devolvem HTML do index por engano.

8. **Problemas comuns**: se o inventário ou login falhar, lembrar que o GET `/api/client/inventory` precisa de header `Authorization` — já corrigido em `src/lib/clientInventoryStorage.ts` no código atual; garantir que o build na Vercel é o mais recente.

## Restrições

- Não renomear o produto nem apagar dados de `server/data/` no repositório de trabalho local sem autorização explícita do dono.
- Não misturar este deploy com outros projetos Vercel existentes na conta: **novo** projeto, **novo** repo (ou remote dedicado).
- Manter o nome do projeto legível como DBX para a equipa.

## Entrega esperada

Resumo em português para o dono do projeto com: (1) URL do repositório GitHub, (2) URL do site na Vercel, (3) lista de variáveis configuradas (sem valores secretos), (4) onde está hospedado o API e o URL usado em `VITE_API_URL`, (5) próximos passos se algo falhar (CORS, 401, env em build).

FIM DO PROMPT>>>

---

Se o Claude não tiver acesso ao teu disco, anexa a pasta `dbx-novo` ou o zip do projeto e indica o caminho equivalente no computador de quem executa os comandos.
