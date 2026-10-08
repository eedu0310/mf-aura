# Subir o AURA numa VPS

Escrito para uma VPS Ubuntu limpa. Do zero ao ar em cerca de meia hora.

## O que a VPS precisa ter

- Ubuntu 22.04 ou mais novo, 2 GB de RAM (o build do Next pede memória)
- Node 22 (`curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs`)
- nginx e certbot (`sudo apt install -y nginx certbot python3-certbot-nginx`)
- um domínio apontando para o IP da VPS (ex.: `crm.seudominio.com.br`)

## 1. Código e dependências

```bash
sudo adduser --system --group --home /opt/aura aura
sudo -u aura git clone <url-do-repositorio> /opt/aura
cd /opt/aura
sudo -u aura npm ci
```

## 2. Variáveis de ambiente

```bash
sudo -u aura cp .env.example .env.local
sudo -u aura nano .env.local      # preencha as quatro obrigatórias
sudo chmod 600 /opt/aura/.env.local
```

Gere o `CRON_SECRET` com `openssl rand -hex 32`.

## 3. Build

```bash
sudo -u aura npm run build
```

## 4. Serviço

```bash
sudo cp deploy/aura.service /etc/systemd/system/aura.service
sudo systemctl daemon-reload
sudo systemctl enable --now aura
sudo systemctl status aura        # tem que estar "active (running)"
```

## 5. nginx e HTTPS

```bash
sudo cp deploy/nginx-aura.conf /etc/nginx/sites-available/aura
sudo nano /etc/nginx/sites-available/aura     # troque o server_name
sudo ln -s /etc/nginx/sites-available/aura /etc/nginx/sites-enabled/aura
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d crm.seudominio.com.br
```

**O HTTPS não é opcional.** Sem ele o navegador bloqueia a geolocalização das
visitas, o microfone do relato por voz e a instalação do app no celular. Foi
exatamente por isso que nenhuma visita tinha coordenada até hoje.

## 6. Crons

**Isto é o passo que costuma ser esquecido.** O `vercel.json` do repositório
só funciona na Vercel; numa VPS ele é ignorado e **nada roda sozinho** — nem o
briefing das 7h, nem o repasse de lead parado, nem a supervisão da AURA.

```bash
sudo cp deploy/aura-crons /etc/cron.d/aura
sudo nano /etc/cron.d/aura        # cole o CRON_SECRET
sudo chmod 644 /etc/cron.d/aura
sudo systemctl restart cron
```

Confira o fuso da máquina, porque os horários do arquivo são de Brasília:

```bash
timedatectl
sudo timedatectl set-timezone America/Sao_Paulo
```

Teste um agora, sem esperar o horário:

```bash
curl -H "Authorization: Bearer SEU_CRON_SECRET" http://127.0.0.1:3000/api/cron/briefing-do-dia
```

## 6.1 Conferência das variáveis do navegador

O build PARA se faltar `NEXT_PUBLIC_SUPABASE_URL` ou
`NEXT_PUBLIC_SUPABASE_ANON_KEY` no `.env.local`. É de propósito.

Essas duas são assadas dentro do JavaScript do navegador na hora do build. Se
faltarem, o servidor sobe normal — ele lê o arquivo em tempo de execução — e só
o navegador fica sem: toda tela que grava direto do navegador quebra dizendo
que o banco não está configurado. Foi assim que o "Salvar compromisso" da
agenda ficou quebrado sem ninguém saber, porque o resto do sistema usa rotas de
servidor e continuou de pé.

Para ver quais variáveis o arquivo tem, sem expor nenhum valor:

```bash
grep -oE '^[A-Za-z0-9_]+' /opt/aura/.env.local | sort
```

A chave serve com qualquer um dos dois nomes, porque o Supabase renomeou "anon
key" para "publishable key" no painel:

```
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

## 7. Supabase: liberar o domínio novo

No painel do Supabase → **Authentication → URL Configuration**:

- **Site URL**: `https://crm.seudominio.com.br`
- **Redirect URLs**: acrescente `https://crm.seudominio.com.br/**`

Sem isso o "Esqueceu a senha?" manda o usuário para `localhost` e o link morre.

## 8. WhatsApp

Confira que o `.env.local` tem:

```
WHATSAPP_SESSION_DIR=/opt/aura/.whatsapp-sessions
```

**Não deixe isso apontando para `/tmp`.** A VPS limpa `/tmp` no reboot, e o
pareamento do WhatsApp iria junto — o QR teria que ser lido de novo a cada
reinício da máquina.

A sessão fica em `/opt/aura/.whatsapp-sessions`. Depois de subir, entre em
**/whatsapp** e leia o QR uma vez. A pasta sobrevive a `npm run build` e a
`systemctl restart` — só não apague ela, senão o QR precisa ser lido de novo.

É por causa dessa pasta e do processo que fica vivo escutando o WhatsApp que
este sistema não roda na Vercel.

## Atualizar depois

```bash
cd /opt/aura
sudo -u aura git pull
sudo -u aura npm ci
sudo -u aura npm run build
sudo systemctl restart aura
```

## Quando algo der errado

```bash
sudo journalctl -u aura -n 100 --no-pager    # log do sistema
tail -f /var/log/aura.log                    # log da aplicação
tail -f /var/log/aura-cron.log               # log dos crons
```

Serviço não sobe: quase sempre é `.env.local` com variável faltando ou o
build que não rodou. `sudo systemctl status aura` diz qual dos dois.
