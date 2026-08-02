# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é

Agente que coleta promoções do Mercado Livre, gera links de afiliado, escreve a
mensagem de venda com LLM e posta em grupos de WhatsApp — com dashboard web de
controle. Monorepo pnpm + Turborepo, TypeScript ESM em tudo.

**Código, comentários, mensagens de erro e UI são em português.** Mantenha esse
padrão em qualquer contribuição — as mensagens de erro são lidas pelo operador
final, que não é técnico.

## Comandos

```bash
pnpm dev            # sobe agente (:3001) e dashboard (:3000) em watch — turbo
pnpm build          # build de todos os pacotes (respeita dependências)
pnpm typecheck      # tsc --noEmit no monorepo — é a única verificação automatizada
pnpm db:generate    # gera migração a partir de packages/db/src/schema.ts
pnpm db:migrate     # aplica as migrações no SQLite

# um pacote só
pnpm --filter @ml-agent/agent dev
pnpm --filter @ml-agent/dashboard build
pnpm --filter @ml-agent/agent exec playwright install chromium
```

Não há suíte de testes. `pnpm typecheck` é o portão de qualidade — rode antes de
concluir qualquer mudança. `typecheck` depende de `^build`, então os pacotes
`core`/`db` precisam estar compilados (o turbo cuida disso).

Para o ciclo local completo, `bash setup.sh` (macOS/Linux) ou `setup.cmd`
(Windows) instala tudo, gera segredos e cria os `.env`; `start.sh`/`start.cmd`
sobem Docker + `pnpm dev`.

## Configuração: dois arquivos .env

Esta é a fonte nº 1 de confusão no projeto:

- `apps/agent/.env` — copiado de `.env.example` na raiz. Tudo do agente.
- `apps/dashboard/.env.local` — só `AGENT_URL` e `AGENT_TOKEN`.

O `AGENT_TOKEN` precisa ser **idêntico** nos dois; se divergir, o dashboard toma
401 em tudo e as telas ficam vazias sem explicação. `start.sh`/`start.cmd`
checam isso antes de subir. Um `.env` na raiz não é lido por ninguém.

O `apps/dashboard/.env.example` versionado tem `AGENT_URL=http://localhost:3001`,
e o valor que o `setup.sh` grava também é `:3001`.

## Arquitetura

### Fluxo do pipeline

`apps/agent/src/pipeline.ts` é o coração. Sequência de `runCollection()`:

```
fontes (ml-api, scraper) → dedupFilterInsert → rankOffers (LLM)
  → generateAffiliateLink → composeMessage (LLM) → 1 linha em `messages` por grupo habilitado
```

`dispatchDueMessages()` roda separado, em loop auto-agendado, e envia **no máximo
uma mensagem por tick** — a cadência humana vem do intervalo + jitter do
scheduler, nunca de lotes. Não mude isso para envio em lote: é a mitigação
central anti-ban.

`processManualUrls()` usa o mesmo funil, mas pula dedup e filtros — colar a URL
no dashboard já é curadoria humana.

Toda etapa que pode falhar isoladamente é envolvida em try/catch e registrada na
tabela `runs`. Falha de LLM no ranking cai em ordenação por desconto; falha do
compositor cai em `fallbackTemplate()`. O disparo nunca fica refém do LLM.

### resolveEnv — armadilha importante

`ctx.env` (carregado no boot pelo `loadAgentEnv`) **não é o env efetivo**.
Credenciais sensíveis (chave Gemini, tag de afiliado, OAuth do ML) ficam
criptografadas com AES-256-GCM na tabela `settings` do SQLite, gravadas pelo
dashboard, e são sobrepostas em runtime por `resolveEnv(db, env)`
(`apps/agent/src/secrets.ts`).

Sempre chame `resolveEnv(db, ctx.env)` antes de qualquer código que consuma
credenciais. Usar `ctx.env` direto perde silenciosamente a `ML_AFFILIATE_TAG` e a
chave da Gemini — o bug não aparece no typecheck, só em produção sem comissão.

### Dashboard é um proxy REST stateless

`apps/dashboard` **não tem banco nem acesso ao Drizzle**. Toda leitura e escrita
passa por `lib/agent-api.ts` (`agentFetch` / `tryAgent`) contra a API do agente,
sempre no servidor — o `AGENT_TOKEN` nunca chega ao client.

Consequência prática: para expor um dado novo na tela, crie primeiro o endpoint
em `apps/agent/src/api/server.ts`, depois consuma numa Server Action de
`app/actions.ts`. As páginas usam `export const dynamic = "force-dynamic"` e
`revalidatePath()` após mutação.

Em páginas, prefira `tryAgent<T>()` a `agentFetch<T>()`: devolve um resultado
discriminado (`{ok:false, error}`) para renderizar um aviso amigável em vez de
estourar a tela com erro 500.

### Autenticação da API do agente

Hook global `onRequest` exige `Authorization: Bearer <AGENT_TOKEN>`. As únicas
rotas públicas estão em `isPublicRoute()`: `GET /health`,
`POST /webhook/evolution` e o par OAuth `GET /oauth/start` + `/oauth/callback`
(acessados pelo navegador no redirect do ML, então não podem exigir token).
Ao adicionar rota nova, ela é privada por padrão — o que geralmente é o correto.

### Settings vs. secrets

Ambos vivem na mesma tabela k/v `settings`, em chaves diferentes:

- chave `agent` — `AgentSettings` em JSON claro, via `settings.ts`
  (`getSettings`/`patchSettings`, merge profundo + validação Zod, nunca lança).
- chave `secrets` — blob AES-256-GCM, via `secrets.ts`.

`getSettings()` sempre devolve defaults válidos mesmo com a linha ausente ou
corrompida. Os campos sensíveis nunca voltam em claro ao dashboard:
`getCredentialsStatus()` os transforma em booleano "configurado?".

### Pausa automática anti-ban

Dois caminhos setam `paused: true` sozinhos:

1. `dispatchDueMessages()` quando o erro de envio bate em `looksLikeDisconnection()`;
2. o webhook da Evolution ao reportar estado de desconexão/logout/ban.

Com `paused`, coleta e disparo são pulados. O `PausedBanner` aparece em todas as
páginas e só o operador retoma. Preserve esse comportamento.

### Link de afiliado — duas camadas

Não existe API oficial de geração de link. `affiliate/linkbuilder.ts` replica por
HTTP o endpoint interno `createLink` do portal, usando os cookies da sessão
logada (persistidos criptografados em `<dir do DATABASE_PATH>/affiliate-session.enc`).
Quando expira, lança `SessionExpiredError` e o pipeline tenta **uma vez**
`tryRefreshSessionHeadless()`; falhando, interrompe a etapa no ciclo.

O login interativo (`POST /affiliate/connect`) abre um Chromium **visível** via
Playwright para o operador fazer login + 2FA — só funciona em máquina com sessão
gráfica, não em VPS headless. Em VPS, o fluxo principal é
`POST /affiliate/session`: o operador loga no Chrome dele, exporta cookies
(Cookie-Editor) e cola no dashboard.

### Camadas trocáveis por design

- `WhatsAppSender` (`packages/core/src/types.ts`) — interface do transporte;
  `EvolutionSender` é a única implementação. Telegram é o plano B documentado.
- `llm/provider.ts` — todo modelo passa por `getModel(env)`, com a chave sempre
  vinda do env validado, nunca do ambiente implícito do SDK (BYOK).

Mudanças nessas fronteiras devem manter o contrato.

## Convenções

- `packages/core` é a fonte da verdade dos tipos e schemas Zod compartilhados;
  `packages/db` traz o schema Drizzle e o tipo `Db`. O dashboard **não** importa
  esses pacotes — ele redeclara os tipos que consome em `lib/agent-api.ts`.
- ESM real: `"type": "module"` + `moduleResolution: NodeNext`. Imports relativos
  no agente e nos packages precisam da extensão `.js` (`./settings.js`), mesmo
  apontando para `.ts`.
- `tsconfig.base.json` liga `strict` + `noUncheckedIndexedAccess` +
  `verbatimModuleSyntax`. Indexação de array devolve `T | undefined`; daí o `!`
  frequente após `db...returning()`.
- Timestamps são `text` ISO 8601 em todo o SQLite, nunca inteiros.
- Entradas numéricas vindas de formulário são presas no intervalo válido
  (`Math.min/max`) em vez de rejeitadas com 400 — o operador não sabe o que fazer
  com um erro de validação.
- Nunca commite `.env`, `data/` ou `*.sqlite` (cookies de sessão do portal vivem
  ali). Já cobertos pelo `.gitignore`.

## Contexto de operação

O sistema é **single-tenant**: as credenciais são de um operador único e não
técnico, em Windows. Não há coluna de `userId` nem multi-instância — não
introduza multi-tenancy sem que seja pedido.

Toda operação precisa ser possível pela UI, sem terminal. `GET /diagnostics`
centraliza os pré-requisitos de operação (WhatsApp, sessão de afiliado, etiqueta,
Gemini, grupos, pausa), e cada item traz `action` + `href` dizendo o que clicar.
Ao adicionar um pré-requisito novo ao pipeline, adicione o check correspondente.
