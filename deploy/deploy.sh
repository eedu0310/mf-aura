#!/usr/bin/env bash
#
# Deploy do AURA em um comando, na VPS:
#
#   sudo bash /opt/aura/deploy/deploy.sh
#
# Faz, nesta ordem, parando no primeiro erro:
#   1. git pull (como o usuário aura, dono da pasta)
#   2. npm ci se o package-lock mudou, senão pula
#   3. npm run build
#   4. atualiza /etc/cron.d/aura se deploy/aura-crons mudou (mantém o CRON_SECRET)
#   5. systemctl restart aura
#   6. confere que o site responde
#
# Por quê: o deploy em seis passos colados no terminal travou três vezes em
# duas semanas (log colado na sessão errada, build rodando como root, cron
# duplicado). Um script só tem um jeito de ser executado.
set -euo pipefail

PASTA=/opt/aura
USUARIO=aura
SERVICO=aura
CRON_DESTINO=/etc/cron.d/aura
URL_VERSAO=http://127.0.0.1:3000/api/versao

cd "$PASTA"

echo "== 1/6 git pull"
ANTES=$(sudo -u "$USUARIO" git rev-parse HEAD)
sudo -u "$USUARIO" git pull --ff-only
DEPOIS=$(sudo -u "$USUARIO" git rev-parse HEAD)
if [ "$ANTES" = "$DEPOIS" ]; then
  echo "   nada novo no GitHub (continua, para o caso de .env ou cron terem mudado)"
else
  echo "   $ANTES -> $DEPOIS"
  sudo -u "$USUARIO" git --no-pager log --oneline "$ANTES..$DEPOIS" | sed 's/^/   /'
fi

echo "== 2/6 dependências"
# Compara o package-lock com o que foi instalado da última vez, não só com o
# pull de agora. Antes, um deploy que falhava DEPOIS do pull (build quebrado,
# por exemplo) deixava o lock novo no disco e o node_modules velho; o deploy
# seguinte não via mudança no lock e pulava o npm ci para sempre.
MARCA_LOCK="$PASTA/node_modules/.aura-lock.sha256"
LOCK_AGORA=$(sha256sum "$PASTA/package-lock.json" | cut -d' ' -f1)
if [ ! -f "$MARCA_LOCK" ] || [ "$(cat "$MARCA_LOCK")" != "$LOCK_AGORA" ]; then
  sudo -u "$USUARIO" npm ci
  echo "$LOCK_AGORA" | sudo -u "$USUARIO" tee "$MARCA_LOCK" > /dev/null
else
  echo "   node_modules já está no package-lock atual; npm ci pulado"
fi

echo "== 3/6 build"
# Build antigo feito como root deixa .next com dono root, e o usuário aura
# não consegue sobrescrever (EACCES no unlink). Devolve a pasta ao dono certo.
for pasta in .next node_modules .backups; do
  [ -d "$PASTA/$pasta" ] && chown -R "$USUARIO:$USUARIO" "$PASTA/$pasta"
done
# Build com webpack e teto de memória. O Turbopack (padrão do Next 16) passou
# de 3,6 GB e foi morto pelo kernel nesta VPS de 3,8 GB em 26/10/2026, e o
# build morto apaga o .next: o site fica sem estilo até um build passar.
# O webpack fica abaixo de 2 GB com o mesmo código.
sudo -u "$USUARIO" env NODE_OPTIONS=--max-old-space-size=3072 npx next build --webpack

echo "== 4/6 crons"
if [ -f "$CRON_DESTINO" ]; then
  SEGREDO=$(grep -m1 '^CRON_SECRET=' "$CRON_DESTINO" | cut -d= -f2-)
else
  SEGREDO=$(grep -m1 '^CRON_SECRET=' "$PASTA/.env.local" | cut -d= -f2- | tr -d '"')
fi
if [ -z "$SEGREDO" ] || [ "$SEGREDO" = "SEU_CRON_SECRET" ]; then
  echo "   AVISO: CRON_SECRET não encontrado; /etc/cron.d/aura não foi tocado"
else
  TMP=$(mktemp)
  sed "s|^CRON_SECRET=.*|CRON_SECRET=$SEGREDO|" "$PASTA/deploy/aura-crons" > "$TMP"
  if [ -f "$CRON_DESTINO" ] && cmp -s "$TMP" "$CRON_DESTINO"; then
    echo "   sem mudança"
  else
    install -m 644 -o root -g root "$TMP" "$CRON_DESTINO"
    systemctl restart cron
    echo "   /etc/cron.d/aura atualizado"
  fi
  rm -f "$TMP"
fi

echo "== 5/6 reiniciar o serviço"
systemctl restart "$SERVICO"

echo "== 6/6 conferir"
# Pergunta ao app QUAL versão está no ar (/api/versao devolve o commit do
# build). Antes bastava a home responder 307 — e o proxy devolve 307 até com
# o app meio quebrado, ou com o build ANTIGO ainda de pé. Agora o deploy só
# passa quando o commit que está respondendo é o que acabou de ser construído.
ESPERADA=$(sudo -u "$USUARIO" git rev-parse --short=12 HEAD)
for i in $(seq 1 15); do
  sleep 2
  NO_AR=$(curl -s -m 5 "$URL_VERSAO" | sed -n 's/.*"versao":"\([^"]*\)".*/\1/p' || true)
  if [ "$NO_AR" = "$ESPERADA" ]; then
    echo "   no ar: $NO_AR. Deploy ok."
    exit 0
  fi
done
echo "   esperava a versão $ESPERADA e o site respondeu '${NO_AR:-nada}' em 30 s."
echo "   Veja: journalctl -u $SERVICO -n 50 --no-pager"
exit 1
