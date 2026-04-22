# Lista de leads Amazon US (arbitragem) — filtros + CSV

Objetivo: gerar uma **planilha no estilo Direct Box** (colunas de produto, ASIN, preço Amazon, EMS/vendas mensais, ofertas, BSR, etc.) a partir de uma **lista de ASINs**, aplicando regras:

- **Vendas mínimas**: `monthlySold` da Keepa ≥ valor configurável (padrão **100**/mês).  
  Nota Keepa: nem todos os ASINs têm `monthlySold` preenchido — esses são **excluídos** se não atingirem o mínimo.
- **“Não private label” (proxy operacional)**: soma de ofertas **New FBA + New FBM** elegíveis ao buy box (`buyBoxEligibleOfferCounts[0]+[1]`) ≥ **4** (configurável).  
  Isto **não** deteta marca registada; só força listagens com mais vendedores em condição nova.
- **Amazon fora do buy box**: exclui se o último `buyBoxSellerIdHistory` for o vendedor retail US da Amazon (`ATVPDKIKX0DER`).

## Porque não é “scraper” do site Amazon

Raspagem massiva de **amazon.com** viola os termos da Amazon, quebra com facilidade e **não** dá dados fiáveis de vendas/ofertas.  
Este pacote usa a **API Keepa** (serviço pago com dados agregados), que é o caminho usual em ferramentas profissionais.

## O que falta para ser “automático como o print”

1. **Descoberta de ASINs** em massa por categoria — a Keepa tem *Product Finder* / queries avançadas (tokens). Aqui o fluxo assume que já tens **candidatos** (export de outra ferramenta, lista interna, etc.) em `input-asins.txt`.
2. **Preço da tua loja / URL da loja** — não existem na API Keepa; preenche manualmente ou liga a outro scraper **do site do fornecedor** (não da Amazon).
3. **Net profit / ROI** — depende do teu custo + taxas; o CSV deixa colunas para preencheres ou para uma folha Excel com fórmulas.

## Uso rápido

```bash
cd amazon-arbitrage-leads
cp .env.example .env
# edita .env — KEEPA_API_KEY obrigatório
cp input-asins.example.txt input-asins.txt
# edita input-asins.txt com ASINs reais
npm install
npm run run
```

Saída: `out/leads-AAAA-MM-DD.csv`

Teste sem API:

```bash
npm run dry
```

## Atualização diária

No servidor ou no teu PC (cron / Task Scheduler / GitHub Actions):

```bash
cd /caminho/diabetes-neurosharp/amazon-arbitrage-leads && npm run run
```

Garante que `input-asins.txt` é regenerado pelo teu pipeline (ou mantém uma lista mestra). Para **listas por data** como no print (“Listas anteriores”), basta arquivar cada `out/leads-*.csv` por data.

## Ajuste fino

- `MIN_MONTHLY_SOLD`, `MIN_NEW_OFFERS_TOTAL`, `EXCLUDE_AMAZON_BUYBOX`, `KEEPA_OFFERS` no `.env`.
- Se `buyBoxSellerIdHistory` vier vazio, reduz `KEEPA_OFFERS` ou consulta a doc Keepa sobre consumo de tokens vs. campos devolvidos.

## Imagens

Se `imagesCSV` existir no JSON Keepa, a coluna **FOTO** leva URL `m.media-amazon.com`; caso contrário fica vazio.
