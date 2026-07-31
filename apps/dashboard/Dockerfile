# syntax=docker/dockerfile:1
# ============================================================================
# apps/dashboard/Dockerfile — imagem do painel (Next.js 15, standalone)
#
# Build sempre a partir da RAIZ do monorepo (o compose já faz isso):
#   docker build -f apps/dashboard/Dockerfile .
#
# O painel não importa @ml-agent/core nem @ml-agent/db — ele redeclara os tipos
# que consome em lib/agent-api.ts. Por isso o build não precisa dos packages,
# só do próprio app.
# ============================================================================

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

# ----------------------------------------------------------------------------
# build: instala dependências e compila o Next em modo standalone
# ----------------------------------------------------------------------------
FROM base AS build

# 1) Manifests primeiro — mantém a camada do install em cache enquanto o
#    lockfile não mudar.
COPY pnpm-lock.yaml* pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/dashboard/package.json apps/dashboard/
RUN pnpm install --frozen-lockfile --filter @ml-agent/dashboard...

# 2) Código-fonte e build
COPY apps/dashboard apps/dashboard
# Next precisa das variáveis em build-time apenas se elas forem NEXT_PUBLIC_*;
# aqui todas são server-side, então o build roda sem segredo nenhum.
RUN pnpm --filter @ml-agent/dashboard build

# ----------------------------------------------------------------------------
# runtime: só o bundle standalone
# ----------------------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

WORKDIR /app

# O standalone é gerado DENTRO do app (apps/dashboard/.next/standalone), não na
# raiz do monorepo — mas seu conteúdo preserva a estrutura de diretórios do
# workspace, e por isso o server.js acaba em apps/dashboard/server.js aqui.
COPY --from=build --chown=node:node /app/apps/dashboard/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=build --chown=node:node /app/apps/dashboard/public ./apps/dashboard/public

USER node
EXPOSE 3000
CMD ["node", "apps/dashboard/server.js"]
