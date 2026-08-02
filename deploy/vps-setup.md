# Setup da VPS (Hostinger) em ~6 comandos

Testado em Ubuntu 22.04/24.04. Pré-requisito: um registro DNS A
`agente.SEUDOMINIO.com` apontando para o IP da VPS (veja `deploy/Caddyfile`).

## 1. Instalar o Docker

```bash
curl -fsSL https://get.docker.com | sh
```

## 2. Clonar o repositório

```bash
git clone https://github.com/SEU_USUARIO/scrapper-afiliado.git && cd scrapper-afiliado
```

## 3. Configurar o `.env`

```bash
cp .env.example .env && nano .env
```

Preencha tudo (tokens com `openssl rand -hex 32`) e, **na VPS**, ajuste:

```dotenv
EVOLUTION_URL=http://evolution:8080
DATABASE_PATH=/app/data/agent.sqlite
```

> Se `EVOLUTION_URL` ficar como `http://localhost:8080` dentro do container
> do agente, o QR code **nunca** aparece — o agente não alcança a Evolution.
> Use sempre o hostname do serviço (`evolution`) na rede do compose.

## 4. Subir agente + Evolution

```bash
docker compose up -d --build
```

Depois aplique as migrações do banco (primeira vez e a cada atualização):

```bash
docker compose exec agent pnpm db:migrate
```

## 5. Caddy (HTTPS)

```bash
sudo apt install -y caddy && sudo cp deploy/Caddyfile /etc/caddy/Caddyfile && sudo nano /etc/caddy/Caddyfile && sudo systemctl reload caddy
```

(Troque `agente.SEUDOMINIO.com` pelo seu subdomínio ao editar.) Teste:
`curl https://agente.SEUDOMINIO.com/health`.

## 6. Backup diário do SQLite

```bash
mkdir -p ~/backups && ( crontab -l 2>/dev/null; echo '0 3 * * * cp /root/scrapper-afiliado/data/agent.sqlite /root/backups/agent-$(date +\%F).sqlite' ) | crontab -
```

Ajuste os caminhos se não estiver rodando como root.

> **Criptografe os backups.** O banco contém cookies de sessão do portal de
> afiliados e configurações sensíveis. Antes de copiar para fora da VPS, use
> por exemplo `gpg -c agent-2026-07-22.sqlite` — nunca suba o arquivo cru para
> um storage de terceiros. Para um snapshot consistente com o banco em uso,
> prefira `sqlite3 agent.sqlite ".backup backup.sqlite"` no lugar do `cp`.

## Pronto

Na Vercel, configure `AGENT_URL=https://agente.SEUDOMINIO.com` e `AGENT_TOKEN`
com o mesmo valor do `.env` da VPS. Logs: `docker compose logs -f agent`.
