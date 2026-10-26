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
URL_SAUDE=http://127.0.0.1:3000/

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
if [ "$ANTES" != "$DEPOIS" ] && sudo -u "$USUARIO" git diff --name-only "$ANTES" "$DEPOIS" | grep -q '^package-lock.json$'; then
  sudo -u "$USUARIO" npm ci
else
  echo "   package-lock.json não mudou; npm ci pulado"
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
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 2
  CODIGO=$(curl -s -o /dev/null -w '%{http_code}' "$URL_SAUDE" || true)
  if [ "$CODIGO" = "200" ] || [ "$CODIGO" = "307" ] || [ "$CODIGO" = "302" ]; then
    echo "   site respondeu $CODIGO. Deploy ok: $(sudo -u "$USUARIO" git rev-parse --short HEAD)"
    exit 0
  fi
done
echo "   o site não respondeu em 20 s. Veja: journalctl -u $SERVICO -n 50 --no-pager"
exit 1
