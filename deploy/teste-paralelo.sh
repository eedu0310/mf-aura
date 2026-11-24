#!/usr/bin/env bash
#
# Sobe uma CÓPIA DE TESTE do AURA ao lado da que está no ar, sem mexer nela.
#
#   sudo bash /opt/aura/deploy/teste-paralelo.sh auditoria-2026-11-24
#
# A cópia de teste:
#   - fica em /opt/aura-teste, na porta 3001, com o serviço "aura-teste";
#   - usa o MESMO banco (o .env.local de produção é copiado) — tudo o que
#     alguém gravar nela vai para os dados reais;
#   - NÃO instala crons (os crons continuam só na produção);
#   - NÃO leva a pasta de sessões do WhatsApp: a cópia não se conecta ao
#     WhatsApp de ninguém. NÃO abra a tela /whatsapp na cópia de teste nem
#     leia QR por ela — isso desconectaria o celular da produção;
#   - não fica aberta na internet: acesse por túnel SSH (instrução no fim).
#
# Para desligar e apagar a cópia de teste:
#   sudo systemctl disable --now aura-teste && sudo rm -rf /opt/aura-teste /etc/systemd/system/aura-teste.service
set -euo pipefail

BRANCH="${1:?Informe a branch. Ex.: sudo bash $0 auditoria-2026-11-24}"
PRODUCAO=/opt/aura
PASTA=/opt/aura-teste
USUARIO=aura
SERVICO=aura-teste
PORTA=3001

# O build é o que mais come memória. Nesta VPS de 3,8 GB a produção usa uma
# parte; se sobrar pouco, o kernel mata um processo — e pode ser a produção.
DISPONIVEL_MB=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
if [ "$DISPONIVEL_MB" -lt 2300 ]; then
  echo "Só há ${DISPONIVEL_MB} MB livres. O build precisa de ~2 GB e poderia derrubar a produção."
  echo "Rode fora do horário de uso ou aumente a memória/swap da VPS."
  exit 1
fi

echo "== 1/5 código da branch $BRANCH"
ORIGEM=$(sudo -u "$USUARIO" git -C "$PRODUCAO" remote get-url origin)
if [ -d "$PASTA/.git" ]; then
  sudo -u "$USUARIO" git -C "$PASTA" fetch origin "$BRANCH"
  sudo -u "$USUARIO" git -C "$PASTA" checkout -B "$BRANCH" "origin/$BRANCH"
else
  install -d -o "$USUARIO" -g "$USUARIO" "$PASTA"
  sudo -u "$USUARIO" git clone --branch "$BRANCH" "$ORIGEM" "$PASTA"
fi
echo "   $(sudo -u "$USUARIO" git -C "$PASTA" log -1 --oneline)"

echo "== 2/5 configuração (copiada da produção, sem o WhatsApp)"
install -m 600 -o "$USUARIO" -g "$USUARIO" "$PRODUCAO/.env.local" "$PASTA/.env.local"

echo "== 3/5 dependências"
sudo -u "$USUARIO" bash -c "cd '$PASTA' && npm ci"

echo "== 4/5 build (webpack, teto de 2 GB)"
sudo -u "$USUARIO" bash -c "cd '$PASTA' && NODE_OPTIONS=--max-old-space-size=2048 npx next build --webpack"

echo "== 5/5 serviço $SERVICO na porta $PORTA"
cat > "/etc/systemd/system/$SERVICO.service" <<UNIT
[Unit]
Description=AURA - copia de teste ($BRANCH)
After=network.target

[Service]
Type=simple
User=$USUARIO
WorkingDirectory=$PASTA
Environment=NODE_ENV=production
Environment=PORT=$PORTA
EnvironmentFile=$PASTA/.env.local
ExecStart=/usr/bin/npx next start -p $PORTA -H 127.0.0.1
Restart=on-failure
RestartSec=5
StandardOutput=append:/var/log/aura-teste.log
StandardError=append:/var/log/aura-teste.log

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now "$SERVICO"
systemctl restart "$SERVICO"

for i in $(seq 1 15); do
  sleep 2
  NO_AR=$(curl -s -m 5 "http://127.0.0.1:$PORTA/api/versao" | sed -n 's/.*"versao":"\([^"]*\)".*/\1/p' || true)
  if [ -n "$NO_AR" ]; then
    echo
    echo "   Cópia de teste no ar: versão $NO_AR (produção segue intocada na porta 3000)."
    echo
    echo "   Para abrir no seu computador, num PowerShell:"
    echo "     ssh -L 3001:127.0.0.1:3001 SEU_USUARIO@IP_DA_VPS"
    echo "   e deixe a janela aberta. Depois abra no navegador: http://localhost:3001"
    exit 0
  fi
done
echo "   A cópia de teste não respondeu. Veja: tail -n 50 /var/log/aura-teste.log"
exit 1
