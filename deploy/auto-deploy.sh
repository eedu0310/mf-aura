#!/usr/bin/env bash
#
# Deploy automático: roda pelo cron de 2 em 2 minutos (deploy/aura-crons).
#
# Se o GitHub tem commit novo na main, roda o deploy.sh. Se o build ou o
# serviço falhar, volta para o commit que estava no ar, reconstrói e anota o
# commit ruim para não tentar de novo em loop — o próximo commit na main é
# tentado normalmente.
#
# Log: /var/log/aura-deploy.log   ·   rodar na mão: sudo bash deploy/auto-deploy.sh
set -uo pipefail

PASTA=/opt/aura
USUARIO=aura
LOG=/var/log/aura-deploy.log
RUIM="$PASTA/.deploy-falhou"

cd "$PASTA" || exit 0
exec 9>/var/lock/aura-deploy.lock
flock -n 9 || exit 0   # já tem um deploy rodando

sudo -u "$USUARIO" git fetch -q origin main 2>>"$LOG" || exit 0
NO_AR=$(sudo -u "$USUARIO" git rev-parse HEAD)
NOVO=$(sudo -u "$USUARIO" git rev-parse origin/main)
[ "$NO_AR" = "$NOVO" ] && exit 0
[ -f "$RUIM" ] && [ "$(cat "$RUIM")" = "$NOVO" ] && exit 0

{
  echo
  echo "=== $(date '+%d/%m/%Y %H:%M:%S') deploy automático: ${NO_AR:0:7} -> ${NOVO:0:7}"
  if bash "$PASTA/deploy/deploy.sh"; then
    rm -f "$RUIM"
    echo "=== ok"
  else
    echo "=== FALHOU em ${NOVO:0:7}; voltando para ${NO_AR:0:7}"
    echo "$NOVO" > "$RUIM"
    sudo -u "$USUARIO" git reset -q --hard "$NO_AR"
    SEM_PULL=1 bash "$PASTA/deploy/deploy.sh" && echo "=== de volta em ${NO_AR:0:7}"
  fi
} >>"$LOG" 2>&1
