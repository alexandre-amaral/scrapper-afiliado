# syntax=docker/dockerfile:1
# ============================================================================
# apps/agent/Dockerfile — imagem do agente (Fastify + jobs + Playwright)
#
# Build sempre a partir da RAIZ do monorepo (o compose já faz isso):
#   docker build -f apps/agent/Dockerfile .
# ============================================================================

# ----------------------------------------------------------------------------
# base: Node 22 + pnpm via corepack
# ----------------------------------------------------------------------------
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

# ----------------------------------------------------------------------------
# build: instala as dependências do workspace e compila core, db e agent
# ----------------------------------------------------------------------------
FROM base AS build
# O download dos browsers acontece só no estágio de runtime
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# 1) Só os manifests primeiro — assim a camada do `pnpm install` fica em cache
#    enquanto o lockfile/package.json não mudarem.
COPY pnpm-lock.yaml* pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/agent/package.json apps/agent/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile

# 2) Código-fonte e build (turbo resolve a ordem core -> db -> agent)
COPY apps/agent apps/agent
COPY packages/core packages/core
COPY packages/db packages/db
RUN pnpm turbo run build --filter=@ml-agent/agent...

# Nota: as devDependencies NÃO são removidas de propósito — o drizzle-kit
# (devDependency de packages/db) é necessário dentro do container para aplicar
# migrações na VPS (`docker compose exec agent pnpm db:migrate`). O custo é uma
# imagem maior; se um dia as migrações rodarem no boot do agente, dá para
# adicionar aqui um `pnpm install --prod --frozen-lockfile --ignore-scripts`.

# ----------------------------------------------------------------------------
# runtime: node:22-slim + `playwright install --with-deps chromium`
#
# Por que NÃO usar a imagem mcr.microsoft.com/playwright:
#   1. ABI nativa: better-sqlite3 baixa um binário pré-compilado para a versão
#      exata do Node do estágio de build (Node 22). A imagem da Microsoft traz
#      o Node dela própria — se a versão divergir, o binário nativo quebra em
#      runtime. Usando node:22-slim nos dois estágios, build e runtime são
#      sempre idênticos.
#   2. Versão do browser: `npx playwright install` baixa exatamente a revisão
#      de Chromium que o pacote `playwright` do package.json espera; a imagem
#      da Microsoft fixa browser + Node por tag e pode divergir silenciosamente
#      do lockfile a cada bump de dependência.
#
# ATENÇÃO: mantenha a versão fixada abaixo em sincronia com a dependência
# "playwright" de apps/agent/package.json (hoje ^1.52.0). Fixar a versão aqui
# (em vez de usar o node_modules copiado) mantém esta camada — ~300 MB de
# browser + libs de sistema — em cache entre rebuilds do código.
# ----------------------------------------------------------------------------
FROM node:22-slim AS runtime
ENV NODE_ENV=production \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN corepack enable

# Chromium + dependências de sistema, num caminho legível por qualquer usuário
RUN npx -y playwright@1.52.0 install --with-deps chromium \
    && chmod -R a+rX /ms-playwright \
    && rm -rf /var/lib/apt/lists/* /root/.npm /root/.cache

WORKDIR /app
COPY --from=build --chown=node:node /app /app

# /app/data guarda o SQLite e a sessão do portal — monte um volume aqui.
# O usuário `node` (uid 1000) precisa conseguir escrever no diretório do host.
RUN mkdir -p /app/data && chown node:node /app/data
VOLUME /app/data

USER node
EXPOSE 3001
# cwd = /app, então DATABASE_PATH=./data/agent.sqlite resolve para /app/data
CMD ["node", "apps/agent/dist/index.js"]
