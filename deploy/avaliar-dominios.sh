#!/usr/bin/env bash
#
# Endereços avaliar.<loja> para o link de avaliação (27/11/2026: "precisamos
# mascarar o domínio crm.mflaser"). Roda dentro do deploy.sh, como root.
#
# Para cada endereço de deploy/dominios-avaliacao.txt que JÁ aponta para esta
# VPS (mesmo IP de crm.mflaser.com.br):
#   1. tira (ou amplia) um certificado HTTPS só para eles: "aura-avaliar";
#   2. escreve /etc/nginx/sites-available/aura-avaliar, que entrega SÓ as
#      páginas de avaliação (/av/, /avaliar/ e os arquivos delas). O resto do
#      CRM não abre por esses endereços: avaliar.aegaquecimento.com.br/login
#      responde 404.
#   3. confere com nginx -t antes de recarregar; se falhar, volta o anterior.
#
# Nunca derruba o deploy: qualquer falha vira AVISO no log e o CRM segue.
# A configuração do crm.mflaser.com.br não é tocada.
set -uo pipefail

PASTA=/opt/aura
LISTA="$PASTA/deploy/dominios-avaliacao.txt"
CONF=/etc/nginx/sites-available/aura-avaliar
ATIVO=/etc/nginx/sites-enabled/aura-avaliar
CERT_NOME=aura-avaliar
CERT_DIR="/etc/letsencrypt/live/$CERT_NOME"
HOST_CRM=crm.mflaser.com.br

command -v nginx >/dev/null 2>&1 || { echo "   nginx não encontrado: nada feito"; exit 0; }
[ -f "$LISTA" ] || exit 0

ip_de() { getent ahostsv4 "$1" 2>/dev/null | awk 'NR==1 {print $1}'; }
IP_CRM=$(ip_de "$HOST_CRM")
[ -n "$IP_CRM" ] || { echo "   AVISO: não consegui resolver $HOST_CRM"; exit 0; }

prontos=()
while IFS= read -r linha || [ -n "$linha" ]; do
  d=$(printf '%s' "${linha%%#*}" | tr -d '[:space:]' | tr 'A-Z' 'a-z')
  [ -z "$d" ] && continue
  if ! printf '%s' "$d" | grep -Eq '^[a-z0-9-]+(\.[a-z0-9-]+)+$'; then
    echo "   AVISO: endereço inválido ignorado: $d"; continue
  fi
  ip=$(ip_de "$d")
  if [ "$ip" = "$IP_CRM" ]; then
    prontos+=("$d")
  else
    echo "   $d ainda não aponta para esta VPS (DNS: ${ip:-sem registro})"
  fi
done < "$LISTA"

if [ ${#prontos[@]} -eq 0 ]; then
  echo "   nenhum endereço de avaliação apontado ainda"
  exit 0
fi
NOMES="${prontos[*]}"
echo "   apontados: $NOMES"

# ---------------------------------------------------------- certificado
precisa_cert=0
if [ ! -f "$CERT_DIR/fullchain.pem" ]; then
  precisa_cert=1
elif command -v openssl >/dev/null 2>&1; then
  tem=$(openssl x509 -in "$CERT_DIR/fullchain.pem" -noout -text 2>/dev/null | grep -o 'DNS:[^,]*' | sed 's/DNS://' | tr -d ' ')
  for d in "${prontos[@]}"; do
    printf '%s\n' "$tem" | grep -qx "$d" || precisa_cert=1
  done
fi
if [ "$precisa_cert" = "1" ]; then
  if command -v certbot >/dev/null 2>&1; then
    args=()
    for d in "${prontos[@]}"; do args+=(-d "$d"); done
    # certonly: o certbot NÃO reescreve arquivo nenhum do nginx (o deste
    # script é gerado de novo a cada deploy e apagaria a edição dele).
    # Sem --agree-tos: usa a conta que o servidor já tem (a do crm e da
    # assinatura); se não houver, só avisa.
    if certbot certonly --nginx --non-interactive --expand --cert-name "$CERT_NOME" --deploy-hook "systemctl reload nginx" "${args[@]}" >/tmp/aura-avaliar-certbot.log 2>&1; then
      echo "   certificado $CERT_NOME: ok"
    else
      echo "   AVISO: certbot falhou (veja /tmp/aura-avaliar-certbot.log); os endereços ficam sem HTTPS por enquanto"
    fi
  else
    echo "   AVISO: certbot não instalado; os endereços ficam sem HTTPS"
  fi
fi

# ---------------------------------------------------------- nginx
TMP=$(mktemp)
{
  echo "# Gerado por deploy/avaliar-dominios.sh a cada deploy. Não editar à mão."
  echo "server {"
  echo "    listen 80;"
  echo "    server_name $NOMES;"
  echo "    location / { return 301 https://\$host\$request_uri; }"
  echo "}"
  if [ -f "$CERT_DIR/fullchain.pem" ] && [ -f "$CERT_DIR/privkey.pem" ]; then
    echo "server {"
    echo "    listen 443 ssl;"
    echo "    server_name $NOMES;"
    echo "    ssl_certificate $CERT_DIR/fullchain.pem;"
    echo "    ssl_certificate_key $CERT_DIR/privkey.pem;"
    [ -f /etc/letsencrypt/options-ssl-nginx.conf ] && echo "    include /etc/letsencrypt/options-ssl-nginx.conf;"
    [ -f /etc/letsencrypt/ssl-dhparams.pem ] && echo "    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;"
    echo "    # Só as páginas de avaliação e os arquivos que elas carregam."
    echo "    location ~ ^/(av|avaliar|_next)/ {"
    echo "        proxy_pass http://127.0.0.1:3000;"
    echo "        proxy_http_version 1.1;"
    echo "        proxy_set_header Host \$host;"
    echo "        proxy_set_header X-Real-IP \$remote_addr;"
    echo "        proxy_set_header X-Forwarded-For \$remote_addr;"
    echo "        proxy_set_header X-Forwarded-Proto \$scheme;"
    echo "    }"
    echo "    location = /favicon.ico { proxy_pass http://127.0.0.1:3000; }"
    echo "    location / { return 404; }"
    echo "}"
  fi
} > "$TMP"

if [ -f "$CONF" ] && cmp -s "$TMP" "$CONF" && [ -L "$ATIVO" ]; then
  echo "   nginx dos endereços de avaliação: sem mudança"
  rm -f "$TMP"
  exit 0
fi

ANTES=$(mktemp)
tinha_antes=0
if [ -f "$CONF" ]; then cp "$CONF" "$ANTES"; tinha_antes=1; fi
install -m 644 -o root -g root "$TMP" "$CONF"
ln -sf "$CONF" "$ATIVO"
if nginx -t >/tmp/aura-avaliar-nginx.log 2>&1; then
  systemctl reload nginx && echo "   nginx dos endereços de avaliação: atualizado"
else
  echo "   AVISO: nginx -t recusou a configuração nova (veja /tmp/aura-avaliar-nginx.log); voltando a anterior"
  if [ "$tinha_antes" = "1" ]; then
    install -m 644 -o root -g root "$ANTES" "$CONF"
  else
    rm -f "$ATIVO" "$CONF"
  fi
  nginx -t >/dev/null 2>&1 && systemctl reload nginx
fi
rm -f "$TMP" "$ANTES"
exit 0
