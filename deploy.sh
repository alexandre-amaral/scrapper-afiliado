#!/usr/bin/env bash
# ============================================================================
# deploy.sh — atualiza e sobe a pilha na VPS
#
#   bash deploy.sh            # atualiza o código e sobe
#   bash deploy.sh --logs     # o mesmo, e acompanha os logs no fim
#
# Existe para embutir o `--env-file .env.prod`, que o compose exige e é fácil
# de esquecer (sem ele o build falha reclamando de AGENT_TOKEN).
# ============================================================================

set -euo pipefail
cd "$(dirname "$0")"

if [ -t 1 ]; then
  BOLD=$'\033[1m'; GREEN=$'\033[32m'; RED=$'\033[31m'; RESET=$'\033[0m'
else
  BOLD=""; GREEN=""; RED=""; RESET=""
fi

step() { printf "\n%s▶ %s%s\n" "$BOLD" "$1" "$RESET"; }
ok()   { printf "  %s✓%s %s\n" "$GREEN" "$RESET" "$1"; }
fail() { printf "\n%s✗ %s%s\n\n" "$RED" "$1" "$RESET" >&2; exit 1; }

COMPOSE="docker compose --env-file .env.prod -f docker-compose.prod.yml"

[ -f .env.prod ] || fail "não encontrei o .env.prod.
  Ele guarda as senhas e não vai para o Git — veja deploy/hostinger.md."

# A senha do painel é o único campo que ninguém preenche automaticamente.
if ! grep -qE '^DASHBOARD_PASSWORD=.+' .env.prod; then
  fail "a senha do painel está vazia no .env.prod.
  Defina antes de subir, senão ninguém consegue entrar:
      nano .env.prod        (preencha DASHBOARD_PASSWORD=)"
fi

# Sem PUBLIC_URL o OAuth do ML cai em localhost e aparece no painel.
# Se faltar, deriva de DOMINIO (mesmo host do Caddy).
if ! grep -qE '^PUBLIC_URL=.+' .env.prod; then
  DOMINIO_VAL="$(grep -E '^DOMINIO=' .env.prod | cut -d= -f2- | tr -d '\r' || true)"
  if [ -n "${DOMINIO_VAL}" ]; then
    printf '\n# URL pública HTTPS (OAuth ML) — preenchida automaticamente pelo deploy.sh\nPUBLIC_URL=https://%s\n' "$DOMINIO_VAL" >> .env.prod
    ok "PUBLIC_URL=https://${DOMINIO_VAL} gravada no .env.prod"
  else
    fail "PUBLIC_URL está vazia e DOMINIO também. Defina DOMINIO=seudominio.com no .env.prod."
  fi
fi

step "Atualizando o código"
git pull --ff-only
ok "código atualizado"

step "Construindo as imagens (a primeira vez demora — baixa o Chromium)"
$COMPOSE build
ok "imagens prontas"

step "Subindo os serviços"
$COMPOSE up -d
ok "serviços no ar"

step "Aplicando migrações do banco"
$COMPOSE exec -T agent pnpm db:migrate
ok "banco atualizado"

step "Conferindo"
$COMPOSE ps

DOMINIO_ATUAL="$(grep -E '^DOMINIO=' .env.prod | cut -d= -f2-)"
cat <<EOF

${GREEN}${BOLD}✓ No ar.${RESET}  https://${DOMINIO_ATUAL}

Logs do agente:  $COMPOSE logs -f agent

EOF

if [ "${1:-}" = "--logs" ]; then
  $COMPOSE logs -f
fi
