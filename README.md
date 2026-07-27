# 🤖 Agente de Afiliados — Mercado Livre → WhatsApp

Captura promoções no Mercado Livre, gera **links de afiliado** vinculados à sua
conta, escreve a mensagem de venda com IA e posta nos seus **grupos de
WhatsApp** — com cadência humana e um painel web para controlar tudo.

<p align="center">
  <img alt="Node" src="https://img.shields.io/badge/Node-20%2B-3c873a">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.8-3178c6">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-000000">
  <img alt="SQLite" src="https://img.shields.io/badge/SQLite-Drizzle-003b57">
  <img alt="Local-first" src="https://img.shields.io/badge/local--first-sim-16a34a">
</p>

```
promoções → filtros + IA → link de afiliado → mensagem → fila → grupos
```

---

## 🚀 Começando

> ### 👉 **É a primeira vez? Vá direto para o [Guia de instalação](docs/instalacao.md).**
>
> Passo a passo com prints do que clicar, escrito para quem **não programa**.
> Do zero ao agente funcionando em ~30 minutos.

Se você já instalou:

| Quero… | Faça |
|---|---|
| **Ligar o agente** | Dois cliques em `start.cmd` (Windows) ou `bash start.sh` |
| **Aprender a usar o painel** | [Guia de uso](docs/guia-de-uso.md) |
| **Resolver um problema** | [Quando algo dá errado](docs/guia-de-uso.md#6-quando-algo-dá-errado) |
| **Entender como funciona por dentro** | [Arquitetura](docs/arquitetura.md) |

---

## 📚 Documentação

| Documento | Para quem | Conteúdo |
|---|---|---|
| **[Instalação](docs/instalacao.md)** | Quem vai usar | Instalar Node e Docker, baixar o projeto, rodar o instalador |
| **[Guia de uso](docs/guia-de-uso.md)** | Quem vai usar | Conectar WhatsApp e conta de afiliado, operar o dia a dia, regras anti-ban, solução de problemas |
| **[Arquitetura](docs/arquitetura.md)** | Quem vai mexer no código | Decisões de projeto, componentes, riscos, roadmap |

---

## ✨ O que ele faz

- **Coleta de três fontes** — API oficial do Mercado Livre, scraping da página
  de ofertas e uma lista manual de URLs coladas no painel.
- **Filtra e ranqueia** — desconto mínimo, faixa de preço, bloqueio de
  vendedores, sem repetir o mesmo produto; a IA escolhe as melhores ofertas.
- **Gera o link de afiliado** — vinculado à sua etiqueta, para a comissão ser
  sua, com renovação automática de sessão.
- **Escreve a mensagem** — Gemini compõe o texto de venda; se a IA falhar, um
  modelo determinístico assume e o disparo nunca trava.
- **Posta com cadência humana** — uma mensagem por vez, intervalos com
  variação aleatória, só na janela de horário que você definir.
- **Pausa sozinho no primeiro sinal de risco** — se o WhatsApp cair ou
  responder de forma suspeita, tudo para até você revisar.
- **Painel web completo** — diagnóstico do que falta configurar, fila de
  aprovação, QR code do WhatsApp, grupos, filtros e credenciais.

---

## 🧩 Como está montado

```
┌─────────────┐        REST + token        ┌──────────────┐
│  Dashboard  │ ─────────────────────────► │    Agente    │
│  Next.js    │                            │   Fastify    │
│  :3000      │ ◄───────────────────────── │   :3001      │
└─────────────┘                            └──────┬───────┘
                                                  │
                              ┌───────────────────┼───────────────────┐
                              ▼                   ▼                   ▼
                        ┌──────────┐      ┌──────────────┐    ┌─────────────┐
                        │  SQLite  │      │ Evolution API│    │ Mercado     │
                        │ (Drizzle)│      │  (WhatsApp)  │    │ Livre + IA  │
                        └──────────┘      └──────────────┘    └─────────────┘
```

| Pasta | O que é |
|---|---|
| `apps/agent` | Servidor Fastify + agendador. Fala com ML, IA e WhatsApp |
| `apps/dashboard` | Painel Next.js (App Router). Stateless — tudo passa pelo agente |
| `packages/core` | Tipos, schemas Zod e configuração compartilhada |
| `packages/db` | Schema Drizzle e migrações do SQLite |
| `docs` | Documentação |

**Stack:** TypeScript · pnpm + Turborepo · Fastify · Next.js 15 · Drizzle +
SQLite · Playwright · Vercel AI SDK (Gemini, BYOK) · Evolution API · Docker

---

## ⚠️ Avisos importantes

> **Risco real de banimento do número de WhatsApp.** A Evolution API usa
> Baileys, um cliente não-oficial contra os Termos de Serviço do WhatsApp — e
> desde 2026 a Meta endureceu a detecção. Use um **número dedicado e
> descartável**, nunca o pessoal, aquecido por 1–2 semanas de uso manual.

- **Cadência humana, sempre.** Poucas mensagens por dia por grupo, intervalos
  com variação, horário comercial, nada de rajadas. Envie apenas para grupos
  **seus**, cuja audiência optou por receber ofertas — denúncias são o
  principal gatilho de banimento.
- **A geração de link usa um endpoint interno do portal** (não existe API
  oficial). É área cinzenta nos termos do programa e pode quebrar sem aviso.
- **Plano B oficial:** um canal no Telegram via Bot API é 100% permitido. O
  transporte é um adaptador, então adicionar Telegram depois custa pouco.
- **Dados sensíveis:** o SQLite guarda cookies de sessão do portal. Nunca
  commite `.env` nem `data/`, e criptografe backups antes de tirá-los da
  máquina.

---

## 🛠️ Desenvolvimento

<details>
<summary>Instalação manual, sem os scripts (clique para expandir)</summary>

**Pré-requisitos:** Node 20+, pnpm via corepack, Docker (para a Evolution),
openssl.

```bash
corepack enable
pnpm install

# Configuração: DOIS arquivos, com o mesmo AGENT_TOKEN nos dois
cp .env.example apps/agent/.env
cp apps/dashboard/.env.example apps/dashboard/.env.local
openssl rand -hex 32   # rode para AGENT_TOKEN, SESSION_ENCRYPTION_KEY e EVOLUTION_API_KEY

pnpm --filter @ml-agent/agent exec playwright install chromium
docker compose up -d evolution      # exponha 127.0.0.1:8080 via override local
pnpm db:generate && pnpm db:migrate
pnpm dev                            # agente :3001 + dashboard :3000
```

</details>

<details>
<summary>Comandos úteis</summary>

| Comando | O que faz |
|---|---|
| `pnpm dev` | Sobe agente e dashboard em modo watch |
| `pnpm build` | Build de produção de todos os pacotes |
| `pnpm typecheck` | Verificação de tipos no monorepo |
| `pnpm db:generate` | Gera migração a partir do schema Drizzle |
| `pnpm db:migrate` | Aplica as migrações no SQLite |

</details>

<details>
<summary>Deploy (agente em servidor)</summary>

O dashboard é stateless e vai para a Vercel sem esforço (`AGENT_URL` +
`AGENT_TOKEN`). O **agente não roda em serverless** — precisa de processo
permanente para o socket do WhatsApp, cron e SQLite em disco. Use uma VPS ou
máquina sempre ligada; veja [deploy/vps-setup.md](deploy/vps-setup.md).

⚠️ Em servidor headless, o login do portal de afiliados (que abre um Chromium
**visível**) exige `xvfb` ou um fluxo alternativo de cookies.

</details>

---

<p align="center">
  <sub>Uso pessoal. Respeite os termos de serviço das plataformas envolvidas.</sub>
</p>
