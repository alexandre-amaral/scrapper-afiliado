#!/usr/bin/env bash
# ============================================================================
# start.sh — liga o agente e o dashboard (macOS / Linux)
#
#   bash start.sh
#
# Garante que o Docker/Evolution estejam de pé, sobe agente + dashboard e abre
# o navegador. Para desligar tudo: Ctrl+C nesta janela.
# ============================================================================

set -euo pipefail
cd "$(dirname "$0")"

if [ -t 1 ]; then
  BOLD=$'\033[1m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; RESET=$'\033[0m'
else
  BOLD=""; GREEN=""; YELLOW=""; RED=""; RESET=""
fi

fail() { printf "\n%s✗ %s%s\n\n" "$RED" "$1" "$RESET" >&2; exit 1; }

[ -f apps/agent/.env ] || fail "a configuração não existe — rode 'bash setup.sh' primeiro."
[ -d node_modules ] || fail "as dependências não foram instaladas — rode 'bash setup.sh' primeiro."

# O agente e o painel guardam o mesmo AGENT_TOKEN em arquivos separados.
# Se divergirem, o painel recebe 401 em tudo e a tela fica vazia sem
# explicação — checar aqui evita um diagnóstico impossível para o usuário.
read_env() {
  [ -f "$2" ] || return 0
  awk -v k="$1" 'BEGIN{FS="="} $1==k {sub(/^[^=]*=/,""); print; exit}' "$2"
}
if [ -f apps/dashboard/.env.local ]; then
  if [ "$(read_env AGENT_TOKEN apps/agent/.env)" != "$(read_env AGENT_TOKEN apps/dashboard/.env.local)" ]; then
    fail "a senha interna do agente e a do painel estão diferentes.
  Apague o arquivo apps/dashboard/.env.local e rode 'bash setup.sh' de novo."
  fi
else
  fail "a configuração do painel não existe — rode 'bash setup.sh' primeiro."
fi

# --- Docker / Evolution ----------------------------------------------------
if ! docker info >/dev/null 2>&1; then
  fail "O Docker não está rodando.
  Abra o Docker Desktop, espere o ícone ficar verde e rode 'bash start.sh' de novo."
fi

# Sobe a Evolution se ela não estiver de pé (idempotente).
if ! docker compose ps --status running evolution 2>/dev/null | grep -q evolution; then
  printf "%s▶ Ligando o serviço de WhatsApp...%s\n" "$BOLD" "$RESET"
  docker compose up -d evolution >/dev/null 2>&1 \
    || fail "não consegui subir a Evolution API."
fi

# --- Abre o navegador quando o dashboard responder -------------------------
# Roda em segundo plano: espera a porta 3000 atender e então abre o browser.
(
  for _ in $(seq 1 60); do
    if curl -s -o /dev/null -m 1 http://localhost:3000 2>/dev/null; then
      if command -v open >/dev/null 2>&1; then
        open http://localhost:3000            # macOS
      elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open http://localhost:3000 >/dev/null 2>&1   # Linux
      fi
      exit 0
    fi
    sleep 1
  done
) &

cat <<EOF

${GREEN}${BOLD}Ligando o agente...${RESET}

  Dashboard: ${BOLD}http://localhost:3000${RESET}  (abre sozinho em instantes)

  ${YELLOW}Deixe esta janela aberta enquanto estiver usando.${RESET}
  Para desligar tudo: pressione ${BOLD}Ctrl+C${RESET} aqui.

EOF

# turbo dev sobe agente (3001) e dashboard (3000) juntos, em primeiro plano.
exec pnpm dev
