#!/usr/bin/env bash
#
# Deploy do AURA em um comando, na VPS:
#
#   sudo bash /opt/aura/deploy/deploy.sh
#
# Faz, nesta ordem, parando no primeiro erro:
#   1. git pull (como o usuário aura, dono da pasta)
#   2. npm ci se o package-lock mudou, senão pula
#   3. build (next build --webpack; o `npm run build` usa o Turbopack)
#   4. atualiza /etc/cron.d/aura se deploy/aura-crons mudou (mantém o CRON_SECRET);
#      numa máquina sem crons NÃO instala nada (só com INSTALAR_CRONS=1)
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
# SEM_PULL=1: reconstrói o que está na pasta (o auto-deploy usa para voltar
# ao commit anterior quando um build falha).
if [ "${SEM_PULL:-0}" = "1" ]; then
  echo "   SEM_PULL: reconstruindo $(sudo -u "$USUARIO" git rev-parse --short HEAD)"
else
  sudo -u "$USUARIO" git pull --ff-only
fi
DEPOIS=$(sudo -u "$USUARIO" git rev-parse HEAD)
if [ "$ANTES" = "$DEPOIS" ]; then
  echo "   nada novo no GitHub (continua, para o caso de .env ou cron terem mudado)"
else
  echo "   $ANTES -> $DEPOIS"
  sudo -u "$USUARIO" git --no-pager log --oneline "$ANTES..$DEPOIS" | sed 's/^/   /'
fi

# Programas do sistema que a AURA usa fora do Node:
#   ffmpeg  converte o áudio gravado no navegador em nota de voz do WhatsApp,
#           os áudios recebidos para o navegador tocar e as mídias do Instagram.
#           Sem ele, enviar áudio dá "O servidor ainda não converte áudio".
#   tar     empacota as sessões do WhatsApp no backup noturno.
# Instala só o que falta (numa VPS nova, o primeiro deploy já deixa pronto).
# A lista de pacotes de uma VPS recém-criada costuma vir vazia: sem o
# apt-get update antes, o install responde "Unable to locate package".
LISTA_APT_ATUALIZADA=0
for PROGRAMA in ffmpeg tar; do
  if ! command -v "$PROGRAMA" >/dev/null 2>&1; then
    echo "== instalando $PROGRAMA (faltava no servidor)"
    if command -v apt-get >/dev/null 2>&1; then
      if [ "$LISTA_APT_ATUALIZADA" = "0" ]; then
        DEBIAN_FRONTEND=noninteractive apt-get update -qq >/dev/null || true
        LISTA_APT_ATUALIZADA=1
      fi
      DEBIAN_FRONTEND=noninteractive apt-get install -y "$PROGRAMA" >/dev/null \
        || echo "   AVISO: não consegui instalar $PROGRAMA; rode: sudo apt install -y $PROGRAMA"
    else
      echo "   AVISO: sem apt-get; instale $PROGRAMA na mão."
    fi
  fi
done

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
# Só ATUALIZA crons que já existem. Numa VPS nova o deploy instalava o
# /etc/cron.d/aura sozinho (lendo o CRON_SECRET do .env.local) já no primeiro
# deploy — e aí a VPS nova rodava supervisão, agentes, atendentes, avisos e
# o deploy automático junto com a VPS antiga, contra o MESMO banco: tudo em
# dobro (docs/vps-nova.md, regra de ouro). Ligar os crons numa máquina é
# decisão de gente (passo 7 do guia) ou INSTALAR_CRONS=1 de propósito.
# O `|| true` nos grep: sem a linha, o grep sai com 1 e o `set -e` matava o
# deploy inteiro aqui, depois do build, sem reiniciar o serviço.
SEGREDO=""
if [ -f "$CRON_DESTINO" ]; then
  SEGREDO=$(grep -m1 '^CRON_SECRET=' "$CRON_DESTINO" | cut -d= -f2- || true)
elif [ "${INSTALAR_CRONS:-0}" = "1" ]; then
  SEGREDO=$(grep -m1 '^CRON_SECRET=' "$PASTA/.env.local" | cut -d= -f2- | tr -d "\"'" || true)
fi
if [ ! -f "$CRON_DESTINO" ] && [ "${INSTALAR_CRONS:-0}" != "1" ]; then
  echo "   crons ainda não instalados nesta máquina: nada feito (docs/vps-nova.md, passo 7)"
elif [ -z "$SEGREDO" ] || [ "$SEGREDO" = "SEU_CRON_SECRET" ]; then
  echo "   AVISO: CRON_SECRET não encontrado; /etc/cron.d/aura não foi tocado"
else
  TMP=$(mktemp)
  # Escapa o que o sed entende como comando na substituição (& | \).
  SEGREDO_SED=$(printf '%s' "$SEGREDO" | sed 's/[&|\\]/\\&/g')
  sed "s|^CRON_SECRET=.*|CRON_SECRET=$SEGREDO_SED|" "$PASTA/deploy/aura-crons" > "$TMP"
  if [ -f "$CRON_DESTINO" ] && cmp -s "$TMP" "$CRON_DESTINO"; then
    echo "   sem mudança"
  else
    install -m 644 -o root -g root "$TMP" "$CRON_DESTINO"
    systemctl restart cron
    echo "   /etc/cron.d/aura atualizado"
  fi
  rm -f "$TMP"
fi

echo "== endereços de avaliação das lojas"
# avaliar.<loja> → só as páginas de avaliação (deploy/avaliar-dominios.sh).
# Nunca derruba o deploy: o script só avisa quando algo falha.
bash "$PASTA/deploy/avaliar-dominios.sh" || echo "   AVISO: avaliar-dominios.sh falhou; o CRM segue normal"

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
