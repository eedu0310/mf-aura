# Subir a versão nova da AURA numa VPS nova

Este guia leva a versão nova (Aura - codex) para uma VPS nova **sem
derrubar a AURA que está no ar** até a hora da troca.

> **Regra de ouro:** as duas VPS nunca rodam o WhatsApp ao mesmo tempo.
> Se rodarem, as duas analisam as mesmas conversas: IA em dobro e gravação
> em dobro no banco (que é o MESMO nas duas). O mesmo vale para os crons.

## 0. O que já está pronto no banco

O banco Supabase é o mesmo da AURA no ar. Já estão aplicadas:

| Migração | O que faz |
|---|---|
| 105 | Auditoria: sem "Diretor", gestor de loja só na sua loja, Sentinelas |
| 106, 107 | Do outro chat: Instagram e chat do site |
| 108 | Manutenções do pós-venda (limpeza anual) |
| 109 | Correções do pente fino |
| 110 | Equipe de agentes, escritório e histórico do conhecimento |

Falta aplicar a **111** (`supabase/migrations/111_gatilho_de_metas.sql`):
conserta o gatilho que hoje faz falhar qualquer alteração de meta. Precisa de
autorização do dono.

## 1. Preparar a VPS (uma vez)

Ubuntu/Debian, como root:

```bash
apt update && apt install -y git curl nginx ffmpeg tar certbot python3-certbot-nginx
# Node 22 LTS (o Next 16 pede Node 20.9 ou mais novo)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs
# Fuso de Brasília: os horários do deploy/aura-crons são os da máquina, e VPS
# nova nasce em UTC — sem isto o briefing das 7h sai às 4h.
timedatectl set-timezone America/Sao_Paulo
useradd -m -s /bin/bash aura
mkdir -p /opt/aura && chown aura:aura /opt/aura
# Firewall: só SSH e o nginx. O app escuta só em 127.0.0.1:3000.
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable
```

O `deploy.sh` também instala `ffmpeg` e `tar` sozinho se faltarem (sem o
ffmpeg, enviar áudio pelo WhatsApp dá "O servidor ainda não converte áudio").

**Memória:** o build usa até 3 GB (`--max-old-space-size=3072`). Em VPS com
menos de 4 GB de RAM, crie um swap de 2 GB antes do primeiro deploy, senão o
kernel mata o build:

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

**Build:** o `deploy.sh` roda `next build --webpack`. O `npm run build` do
package.json usa o Turbopack (padrão do Next 16), que estourou a memória da
VPS e se engasga com o Baileys — não use o `npm run build` no servidor.

## 2. Código

O código vai de um repositório **próprio da versão nova** (não o da AURA no
ar — o deploy automático acompanha o `origin` da pasta).

```bash
sudo -u aura git clone <repositorio-da-versao-nova> /opt/aura
```

Branch acompanhada pelo deploy automático: `main` (mude com `AURA_RAMO`).
Repositório privado: o `git fetch` do deploy automático roda como `aura`, sem
ninguém para digitar senha — use uma deploy key (só leitura) no
`/home/aura/.ssh` e clone pelo endereço `git@github.com:...`.

## 3. Variáveis (`/opt/aura/.env.local`, dono `aura`, modo 600)

Copie da VPS atual **os nomes abaixo** (os valores são os mesmos, porque o
banco é o mesmo). Nunca mande esse arquivo por chat.

- Banco: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ou `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), `SUPABASE_SERVICE_ROLE_KEY`
- IA: `ANTHROPIC_API_KEY` (ou `CLAUDE_API_KEY`), `OPENAI_API_KEY` (transcrição de áudio), opcionais `AURA_IA_MODEL`, `AURA_IA_MODEL_RAPIDO`, `WHATSAPP_IA_MODEL`, `AURA_DEBOUNCE_ANALISE_MS`
- Crons: `CRON_SECRET` (o mesmo do `/etc/cron.d/aura`; gere com `openssl rand -hex 32` se for trocar)
- Site: `NEXT_PUBLIC_SITE_URL` (o domínio novo, com `https://`)
- Instagram/Meta: `META_APP_ID`, `META_APP_SECRET`, `META_LOGIN_CONFIG_ID`, `META_VERIFY_TOKEN`; opcionais `META_API_VERSAO`, `META_API_BASE`
- WhatsApp Cloud API antiga (só se a VPS atual tiver): `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_NUMEROS`
- Backup: `AURA_PASTA_BACKUP` (opcional; padrão `/opt/aura/.backups`)

O `.env.local` precisa existir **antes** do primeiro deploy: as variáveis
`NEXT_PUBLIC_*` são assadas no JavaScript na hora do build (sem elas o build
para de propósito). Trocou alguma `NEXT_PUBLIC_*`? Rode o deploy de novo.

```bash
chown aura:aura /opt/aura/.env.local && chmod 600 /opt/aura/.env.local
```

As URLs de retorno e do webhook no painel da Meta só mudam para o domínio
novo **na troca** (passo 6): o webhook só aponta para um lugar, e trocar
antes tira as mensagens do Instagram da AURA que está no ar.

## 4. Serviço, nginx e crons

```bash
cp /opt/aura/deploy/aura.service /etc/systemd/system/aura.service
systemctl daemon-reload && systemctl enable aura
cp /opt/aura/deploy/nginx-aura.conf /etc/nginx/sites-available/aura   # ajuste o domínio
ln -s /etc/nginx/sites-available/aura /etc/nginx/sites-enabled/aura && nginx -t && systemctl reload nginx
# HTTPS (com o DNS do domínio novo já apontando para esta VPS):
certbot --nginx -d <dominio-novo>
```

**Não instale os crons ainda** (`deploy/aura-crons`): eles rodam a
supervisão, os agentes, os atendentes do Instagram e do site e os avisos.
Com as duas VPS ligadas, tudo sairia em dobro. Eles entram no passo 7.
O `deploy.sh` respeita isso: numa máquina sem `/etc/cron.d/aura` ele não
instala crons (só atualiza os que já existem).

Primeiro deploy (sem crons): `sudo bash /opt/aura/deploy/deploy.sh` — ele
termina conferindo `/api/versao`; "Deploy ok" quer dizer que o commit no ar é
o que acabou de ser construído.

## 5. Testar antes da troca (a AURA no ar continua igual)

Entre pelo domínio novo e confira: Meu Dia, Relacionamentos, Pipeline,
Pós-venda, Marketing, Painel do Gestor → Agentes (escritório), tema claro e
escuro. **Não conecte o WhatsApp aqui ainda.**

Para ver o que os agentes fariam, sem gravar nada nem avisar ninguém:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" "http://127.0.0.1:3000/api/cron/agentes?simular=1" | head -c 4000
```

## 6. A troca (fora do horário das lojas)

1. **VPS antiga:** `systemctl disable --now aura` e tire os crons
   (`rm /etc/cron.d/aura`). O `disable` importa: só com `stop`, um reboot
   da VPS antiga religaria o WhatsApp com as MESMAS sessões da nova.
2. **Sessões do WhatsApp:** copie `/opt/aura/.whatsapp-sessions` da VPS antiga
   para a nova (`rsync -a` ou `scp -r`), ou restaure o pacote da noite
   (`aura-sessoes-AAAA-MM-DD.tar.gz` no bucket `backups` do Supabase).
   Assim a VPS nova sobe com as MESMAS conexões e todo o histórico, sem ler
   QR de novo. Dono: `chown -R aura:aura /opt/aura/.whatsapp-sessions`.
3. **VPS nova:** `systemctl restart aura` — o WhatsApp religa sozinho.
4. Aponte o domínio (DNS) para a VPS nova.
5. **Painel da Meta:** troque a URL de retorno do login e a do webhook
   (`https://<dominio-novo>/api/meta/webhook`) para o domínio novo.

## 7. Ligar os crons na VPS nova

```bash
cp /opt/aura/deploy/aura-crons /etc/cron.d/aura
sed -i "s/SEU_CRON_SECRET/<o CRON_SECRET>/" /etc/cron.d/aura
chmod 644 /etc/cron.d/aura
```

(Ou, no lugar dos três comandos: `sudo INSTALAR_CRONS=1 bash /opt/aura/deploy/deploy.sh`,
que lê o `CRON_SECRET` do `.env.local`.)

A partir daí: agentes de 10 em 10 minutos, atendentes de 5 em 5, Sentinelas
às 7h30 e 13h30, backup às 22h, Guardião do conhecimento às 23h30, deploy
automático de 2 em 2 minutos. Logs: `/var/log/aura-cron.log`,
`/var/log/aura-deploy.log` e `/var/log/aura.log` (zerados no domingo se
passarem de 50 MB). No dia seguinte, Gestor › Saúde do sistema não pode
mostrar nenhum "Cron parado".

## 8. Se algo der errado

Primeiro pare a VPS nova: `systemctl disable --now aura` e `rm /etc/cron.d/aura`.
Depois volte a antiga: `systemctl enable --now aura`, recoloque
`/etc/cron.d/aura`, aponte o DNS e as URLs da Meta de volta. As sessões do
WhatsApp copiadas continuam valendo lá (desde que a VPS nova esteja parada).
