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
apt update && apt install -y git curl nginx ffmpeg tar
# Node 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs
useradd -m -s /bin/bash aura
mkdir -p /opt/aura && chown aura:aura /opt/aura
```

O `deploy.sh` também instala `ffmpeg` e `tar` sozinho se faltarem (sem o
ffmpeg, enviar áudio pelo WhatsApp dá "O servidor ainda não converte áudio").

## 2. Código

O código vai de um repositório **próprio da versão nova** (não o da AURA no
ar — o deploy automático acompanha o `origin` da pasta).

```bash
sudo -u aura git clone <repositorio-da-versao-nova> /opt/aura
```

Branch acompanhada pelo deploy automático: `main` (mude com `AURA_RAMO`).

## 3. Variáveis (`/opt/aura/.env.local`, dono `aura`, modo 600)

Copie da VPS atual **os nomes abaixo** (os valores são os mesmos, porque o
banco é o mesmo). Nunca mande esse arquivo por chat.

- Banco: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- IA: `ANTHROPIC_API_KEY` (ou `CLAUDE_API_KEY`), `OPENAI_API_KEY` (transcrição de áudio), opcionais `AURA_IA_MODEL`, `AURA_IA_MODEL_RAPIDO`, `WHATSAPP_IA_MODEL`
- Crons: `CRON_SECRET` (o mesmo do `/etc/cron.d/aura`)
- Site: `NEXT_PUBLIC_SITE_URL` (o domínio novo)
- Instagram/Meta: `META_APP_ID`, `META_APP_SECRET`, `META_LOGIN_CONFIG_ID`, `META_VERIFY_TOKEN` (e trocar a URL de retorno e do webhook no painel da Meta para o domínio novo)
- Backup: `AURA_PASTA_BACKUP` (opcional)

## 4. Serviço, nginx e crons

```bash
cp /opt/aura/deploy/aura.service /etc/systemd/system/aura.service
systemctl daemon-reload && systemctl enable aura
cp /opt/aura/deploy/nginx-aura.conf /etc/nginx/sites-available/aura   # ajuste o domínio
ln -s /etc/nginx/sites-available/aura /etc/nginx/sites-enabled/aura && nginx -t && systemctl reload nginx
```

**Não instale os crons ainda** (`deploy/aura-crons`): eles rodam a
supervisão, os agentes, os atendentes do Instagram e do site e os avisos.
Com as duas VPS ligadas, tudo sairia em dobro. Eles entram no passo 7.

Primeiro deploy (sem crons): `sudo bash /opt/aura/deploy/deploy.sh`

## 5. Testar antes da troca (a AURA no ar continua igual)

Entre pelo domínio novo e confira: Meu Dia, Relacionamentos, Pipeline,
Pós-venda, Marketing, Painel do Gestor → Agentes (escritório), tema claro e
escuro. **Não conecte o WhatsApp aqui ainda.**

Para ver o que os agentes fariam, sem gravar nada nem avisar ninguém:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" "http://127.0.0.1:3000/api/cron/agentes?simular=1" | head -c 4000
```

## 6. A troca (fora do horário das lojas)

1. **VPS antiga:** `systemctl stop aura` e tire os crons (`rm /etc/cron.d/aura`).
2. **Sessões do WhatsApp:** copie `/opt/aura/.whatsapp-sessions` da VPS antiga
   para a nova (`rsync -a` ou `scp -r`), ou restaure o pacote da noite
   (`aura-sessoes-AAAA-MM-DD.tar.gz` no bucket `backups` do Supabase).
   Assim a VPS nova sobe com as MESMAS conexões e todo o histórico, sem ler
   QR de novo. Dono: `chown -R aura:aura /opt/aura/.whatsapp-sessions`.
3. **VPS nova:** `systemctl restart aura` — o WhatsApp religa sozinho.
4. Aponte o domínio (DNS) para a VPS nova.

## 7. Ligar os crons na VPS nova

```bash
cp /opt/aura/deploy/aura-crons /etc/cron.d/aura
sed -i "s/SEU_CRON_SECRET/<o CRON_SECRET>/" /etc/cron.d/aura
chmod 644 /etc/cron.d/aura
```

A partir daí: agentes de 10 em 10 minutos, atendentes de 5 em 5, Sentinelas
às 7h30 e 13h30, backup às 22h, Guardião do conhecimento às 23h30, deploy
automático de 2 em 2 minutos.

## 8. Se algo der errado

Volte a VPS antiga: `systemctl start aura`, recoloque `/etc/cron.d/aura` e
aponte o DNS de volta. As sessões do WhatsApp copiadas continuam valendo lá
(desde que a VPS nova esteja parada).
