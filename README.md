# ml-affiliate-agent

Agente que captura promoções no Mercado Livre (API oficial, scraping de
`/ofertas` e lista manual), gera links de afiliado vinculados à sua conta,
compõe mensagens de venda com um LLM (Gemini, BYOK — a chave é sua) e dispara
periodicamente em grupos de WhatsApp via Evolution API, com um dashboard
Next.js para configurar fontes, aprovar mensagens e acompanhar tudo. Monorepo
Node/TypeScript (pnpm + Turborepo), local-first: roda inteiro na sua máquina;
em produção o agente vai para uma VPS e o dashboard para a Vercel.

**Pipeline em uma linha:** coleta de ofertas → dedup/filtros/ranking → link de
afiliado → mensagem via Gemini → fila com cadência humana → grupos do WhatsApp.

Arquitetura completa e decisões de projeto: [ARQUITETURA.md](./ARQUITETURA.md).

## Pré-requisitos

- **Node 20+** (recomendado 22) — <https://nodejs.org>
- **pnpm** via corepack (vem com o Node): `corepack enable`
- **Docker** (opcional no local, só para subir a Evolution API):
  Docker Desktop no Windows/macOS, Docker Engine no Linux
- **openssl** para gerar tokens (nativo no macOS/Linux; no Windows use o
  Git Bash, que já o inclui, ou o WSL)

## Rodando local (passo a passo)

1. **Clone o repositório**

   ```bash
   git clone https://github.com/SEU_USUARIO/scrapper-afiliado.git
   cd scrapper-afiliado
   ```

2. **Instale as dependências**

   ```bash
   corepack enable   # uma vez por máquina; no Windows, rode o terminal como admin
   pnpm install
   ```

3. **Crie o `.env`**

   ```bash
   cp .env.example .env      # Windows (cmd): copy .env.example .env
   ```

   O `.env.example` documenta todas as variáveis.

4. **Gere os segredos** e cole no `.env` (`AGENT_TOKEN`,
   `SESSION_ENCRYPTION_KEY`, `EVOLUTION_API_KEY`):

   ```bash
   openssl rand -hex 32   # rode uma vez para cada variável
   ```

5. **Instale o Chromium do Playwright** (usado pelo scraper e pelo login no
   portal de afiliados):

   ```bash
   pnpm --filter @ml-agent/agent exec playwright install chromium
   ```

   No Linux, se faltarem libs de sistema, troque por
   `... playwright install --with-deps chromium` (pede sudo).

6. **Suba a Evolution API** (WhatsApp) com Docker:

   ```bash
   docker compose up -d evolution
   ```

   Localmente, exponha a porta dela para o agente: crie um
   `docker-compose.override.yml` com

   ```yaml
   services:
     evolution:
       ports:
         - "127.0.0.1:8080:8080"
   ```

   e mantenha `EVOLUTION_URL=http://localhost:8080` no `.env`. (Em produção a
   Evolution fica sem porta pública — veja o `docker-compose.yml`.)

7. **Crie o banco** (SQLite, arquivo local — zero setup):

   ```bash
   pnpm db:generate && pnpm db:migrate
   ```

8. **Suba tudo em modo dev** (agente + dashboard):

   ```bash
   pnpm dev
   ```

9. **Abra o dashboard**: <http://localhost:3000> (o agente fica em
   <http://localhost:3001>).

10. **Configure pelo dashboard**:
    - **WhatsApp**: página `/whatsapp` → escaneie o QR code com o número
      **dedicado** (nunca o seu pessoal — veja os avisos abaixo);
    - **Portal de afiliados**: inicie o login do portal do Mercado Livre e
      aprove o 2FA quando solicitado (a sessão fica criptografada em disco);
    - **Gemini**: cole sua chave (gere em <https://aistudio.google.com/apikey>)
      nas configurações — ou direto em `GOOGLE_GENERATIVE_AI_API_KEY` no `.env`.

    Comece pelo modo **lista manual + fila de aprovação**: cole URLs de
    produto e valide o pipeline de ponta a ponta antes de ligar as fontes
    automáticas.

## Deploy

### Dashboard → Vercel

1. Importe o repositório na Vercel com **Root Directory = `apps/dashboard`**.
2. Configure as variáveis de ambiente:
   - `AGENT_URL` — URL pública do agente (ex.: `https://agente.seudominio.com`);
   - `AGENT_TOKEN` — o mesmo valor do `.env` da VPS.
3. Deploy. O dashboard é stateless (sem banco próprio); tudo passa pela API do
   agente, então o free tier basta.

### Agente → VPS

O agente + Evolution rodam via Docker Compose numa VPS (ex.: Hostinger), com
Caddy na frente fazendo HTTPS. Guia completo em ~6 comandos:
[deploy/vps-setup.md](./deploy/vps-setup.md).

## Avisos importantes

- **Risco real de banimento do número de WhatsApp.** A Evolution API usa
  Baileys por baixo, um cliente não-oficial contra os Termos de Serviço do
  WhatsApp — e desde 2026 a Meta endureceu a detecção. Use um **número
  dedicado e descartável** (nunca o pessoal), aquecido com 1–2 semanas de uso
  manual antes de automatizar.
- **Cadência humana, sempre.** Poucas mensagens por dia por grupo, intervalos
  com jitter, horário comercial, nada de rajadas. Envie apenas para grupos
  **seus**, cuja audiência optou por receber ofertas — denúncias são o
  principal gatilho de ban. O agente pausa tudo ao primeiro sinal de
  desconexão/restrição.
- **A geração de link de afiliado usa um endpoint interno do portal** (não há
  API oficial) — área cinzenta nos termos do programa e sujeita a quebrar sem
  aviso. Volume baixo e comportamento de usuário normal mantêm o perfil
  discreto; o dashboard alerta quando a sessão expira ou o endpoint muda.
- **Plano B oficial:** um canal/grupo no Telegram via Bot API é 100% permitido
  e sem risco — o transporte é um adaptador, então adicionar Telegram depois
  custa pouco.
- **Dados sensíveis:** o SQLite guarda cookies de sessão do portal. Não
  commite `.env` nem `data/`, e criptografe qualquer backup antes de tirá-lo
  da máquina/VPS.
