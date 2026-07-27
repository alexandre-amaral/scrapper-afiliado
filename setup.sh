#!/usr/bin/env bash
# ============================================================================
# setup.sh — instalação em um comando (macOS / Linux)
#
#   bash setup.sh
#
# Faz tudo o que o README pede, na ordem certa, sem o usuário decidir nada:
# checa pré-requisitos, gera os segredos, cria o .env, instala dependências,
# baixa o Chromium, sobe a Evolution e cria o banco.
#
# É seguro rodar de novo: nada que já exista é sobrescrito (o .env é
# preservado, e os segredos só são gerados na primeira vez).
# ============================================================================

set -euo pipefail
cd "$(dirname "$0")"

# --- Aparência -------------------------------------------------------------
if [ -t 1 ]; then
  BOLD=$'\033[1m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; DIM=$'\033[2m'; RESET=$'\033[0m'
else
  BOLD=""; GREEN=""; YELLOW=""; RED=""; DIM=""; RESET=""
fi

step()  { printf "\n%s▶ %s%s\n" "$BOLD" "$1" "$RESET"; }
ok()    { printf "  %s✓%s %s\n" "$GREEN" "$RESET" "$1"; }
warn()  { printf "  %s!%s %s\n" "$YELLOW" "$RESET" "$1"; }
fail()  { printf "\n%s✗ %s%s\n\n" "$RED" "$1" "$RESET" >&2; exit 1; }

printf "\n%s=== Agente de Afiliados — instalação ===%s\n" "$BOLD" "$RESET"

# --- 1. Pré-requisitos -----------------------------------------------------
step "Verificando o que já está instalado"

if ! command -v node >/dev/null 2>&1; then
  fail "Node.js não encontrado.
  Instale a versão LTS em https://nodejs.org (botão da esquerda),
  feche este terminal, abra outro e rode 'bash setup.sh' de novo."
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  fail "Node.js $(node -v) é antigo demais (precisa ser 20 ou maior).
  Atualize em https://nodejs.org e rode 'bash setup.sh' de novo."
fi
ok "Node.js $(node -v)"

if ! command -v docker >/dev/null 2>&1; then
  fail "Docker não encontrado.
  Instale o Docker Desktop em https://www.docker.com/products/docker-desktop
  ABRA o Docker Desktop e espere ficar verde, depois rode 'bash setup.sh' de novo."
fi

if ! docker info >/dev/null 2>&1; then
  fail "O Docker está instalado mas não está rodando.
  Abra o Docker Desktop, espere o ícone ficar verde ('Engine running')
  e rode 'bash setup.sh' de novo."
fi
ok "Docker rodando"

# corepack acompanha o Node e habilita o pnpm sem instalação separada.
if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || fail "não consegui habilitar o pnpm (corepack enable).
  No Linux, tente: sudo corepack enable"
fi
corepack prepare pnpm@11.16.0 --activate >/dev/null 2>&1 || true
ok "pnpm $(pnpm -v 2>/dev/null || echo 'pronto')"

# --- 2. Arquivos de configuração -------------------------------------------
# São DOIS arquivos: o agente lê apps/agent/.env; o dashboard lê
# apps/dashboard/.env.local. O AGENT_TOKEN precisa ser IDÊNTICO nos dois —
# se divergir, o dashboard leva 401 em toda requisição ao agente.
step "Configurando os arquivos de segredos"

# Gera 64 caracteres hex. Usa openssl quando existe; senão, cai no Node
# (sempre disponível aqui), o que evita depender do Git Bash no Windows.
gen_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))'
  fi
}

# Lê o valor de uma chave num arquivo de env (vazio se não existir).
read_env() {
  [ -f "$2" ] || return 0
  awk -v k="$1" 'BEGIN{FS="="} $1==k {sub(/^[^=]*=/,""); print; exit}' "$2"
}

AGENT_ENV="apps/agent/.env"
DASH_ENV="apps/dashboard/.env.local"

if [ -f "$AGENT_ENV" ]; then
  ok "configuração do agente já existe — preservada"
  AGENT_TOKEN_VALUE="$(read_env AGENT_TOKEN "$AGENT_ENV")"
else
  cp .env.example "$AGENT_ENV"
  # Substitui os três placeholders por segredos reais.
  # Usa arquivo temporário porque o -i do sed difere entre macOS e Linux.
  for var in AGENT_TOKEN SESSION_ENCRYPTION_KEY EVOLUTION_API_KEY; do
    secret="$(gen_secret)"
    awk -v k="$var" -v v="$secret" \
      'BEGIN{FS=OFS="="} $1==k {print k "=" v; next} {print}' "$AGENT_ENV" > "$AGENT_ENV.tmp"
    mv "$AGENT_ENV.tmp" "$AGENT_ENV"
  done
  AGENT_TOKEN_VALUE="$(read_env AGENT_TOKEN "$AGENT_ENV")"
  ok "configuração do agente criada com segredos aleatórios"
fi

if [ -f "$DASH_ENV" ]; then
  ok "configuração do painel já existe — preservada"
else
  printf 'AGENT_URL=http://localhost:3001\nAGENT_TOKEN=%s\n' "$AGENT_TOKEN_VALUE" > "$DASH_ENV"
  ok "configuração do painel criada (token sincronizado com o agente)"
fi

warn "A chave da Gemini e a etiqueta de afiliado são preenchidas"
warn "pelo painel depois — sem precisar mexer em arquivo."

# --- 3. Dependências -------------------------------------------------------
step "Instalando dependências (pode levar alguns minutos)"
pnpm install --silent || fail "falha no 'pnpm install'. Verifique sua conexão e tente de novo."
ok "dependências instaladas"

step "Baixando o navegador usado pelo agente (Chromium)"
pnpm --filter @ml-agent/agent exec playwright install chromium >/dev/null 2>&1 \
  || warn "não consegui baixar o Chromium agora — o agente sobe assim mesmo,
    mas o login do portal de afiliados vai falhar. Rode depois:
    pnpm --filter @ml-agent/agent exec playwright install chromium"
ok "navegador pronto"

# --- 4. Evolution API (WhatsApp) -------------------------------------------
step "Subindo o serviço de WhatsApp (Evolution API)"

# Localmente a Evolution precisa de porta exposta no loopback para o agente
# alcançá-la; o compose principal não a expõe (correto para produção).
if [ ! -f docker-compose.override.yml ]; then
  cat > docker-compose.override.yml <<'YAML'
# Gerado pelo setup.sh — expõe a Evolution só para esta máquina (127.0.0.1),
# necessário rodando local. Não commite este arquivo.
services:
  evolution:
    ports:
      - "127.0.0.1:8080:8080"
YAML
  ok "configuração local da Evolution criada"
fi

docker compose up -d evolution >/dev/null 2>&1 \
  || fail "não consegui subir a Evolution API.
  Confirme que o Docker Desktop está aberto e rode 'bash setup.sh' de novo."
ok "Evolution API no ar"

# --- 5. Banco de dados -----------------------------------------------------
step "Criando o banco de dados"
pnpm db:generate >/dev/null 2>&1 || true
pnpm db:migrate  >/dev/null 2>&1 || fail "falha ao criar o banco de dados (pnpm db:migrate)."
ok "banco pronto"

# --- Fim -------------------------------------------------------------------
cat <<EOF

${GREEN}${BOLD}✓ Instalação concluída.${RESET}

Agora rode:

    ${BOLD}bash start.sh${RESET}

O dashboard abre sozinho no navegador (http://localhost:3000).
O passo a passo do que configurar lá está no ${BOLD}docs/guia-de-uso.md${RESET}.

EOF
