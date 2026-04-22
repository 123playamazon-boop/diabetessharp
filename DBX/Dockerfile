# API de scraping (Express). Imagem inclui dependências do monorepo; podes slimar depois com build dedicado.
FROM node:22-alpine
WORKDIR /app

RUN apk add --no-cache wget

COPY package.json package-lock.json ./
RUN npm ci

COPY server ./server

ENV PORT=8787
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8787/health > /dev/null || exit 1

CMD ["npx", "tsx", "server/httpScrapeServer.ts"]
