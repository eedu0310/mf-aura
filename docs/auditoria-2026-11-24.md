# Auditoria do AURA — 24/11/2026

**Base:** o commit `72bf109` ("Usuários: editar dados da equipe e apagar cadastro de teste"), que é **exatamente a versão que está no ar** em crm.mflaser.com.br (`/api/versao` respondeu `72bf109796a5`). Tudo o que está nesta branch é diferença em cima dela — nada foi removido nem refeito do zero.

**Não foi tocado (a pedido):** nada do WhatsApp/Baileys — `src/lib/whatsapp/*`, `src/app/api/whatsapp/*`, a tela `/whatsapp` e o `instrumentation.ts` estão idênticos à versão no ar.

---

## O que MUDA para quem usa

| Onde | Antes | Depois |
|---|---|---|
| Menu do gestor (celular) | "Leads" aparecia duas vezes | Aparece uma vez |
| Vendedor com cadastro incompleto | Tela girando para sempre | Vai para o /onboarding completar |
| Falha ao ler o banco | Tela mostrava "nenhum cliente / nenhuma venda" | Faixa amarela: "Não consegui carregar… Tentar de novo" |
| AURA Coach e fechamento | Respondiam só com o núcleo do manual (a busca de trechos falhava sempre, em silêncio) | Voltam a receber os trechos do manual que têm a ver com a conversa |
| Gestor › Custo da IA | "Gasto do mês/hoje" contava só as últimas 1000 chamadas, no fuso do servidor | Soma tudo, no dia de Brasília |
| Saldo da IA | Somava só 1000 de 21 mil chamadas (o bloqueio nunca disparava) | Soma o gasto desde o primeiro depósito (05/11): **US$ 109,41** hoje |
| Preço por modelo | Sonnet 5 a 3/15 e escrita de cache a 2x | Sonnet 5 a 2/10 e escrita de cache a 1,25x (tabela atual da Anthropic) |
| Gestor › **Saúde do sistema** (nova, só mestres) | — | As 3 Sentinelas: operação, dados e segurança |
| Sino dos gestores mestres | — | Aviso das Sentinelas quando aparece problema novo |

## O que MUDA por trás (segurança)

| Brecha | Antes | Depois |
|---|---|---|
| Cargo "Diretor" | Não existe mais na empresa, mas o banco ainda dava a ele as 4 lojas **sem aprovação**, e o cadastro deixava qualquer conta nova escolher esse cargo | Sai do banco e do código. Só o **gestor mestre** vê as 4 lojas |
| Gestor não aprovado | Lia supervisões, metas e indicadores (em 3 tabelas, de todas as lojas) | Só depois de aprovado, e só da própria loja |
| `admin/definir-status-usuario` | Gestor de uma loja desativava o mestre ou gente de outra loja | Só a própria loja; mestre só por mestre; ninguém se desativa |
| `admin/criar-usuario` | Gestor criava gente em qualquer loja; senha com `Math.random` | Só na própria loja; senha com `randomBytes` |
| `gestor/config-avaliacao` | Gestor trocava o link do Google de outra loja (e via os pedidos das 4) | Só a própria loja; link precisa ser http(s) |
| Chat e atendimento do site | Gestor não aprovado trocava o WhatsApp do widget e apagava leads | Só gestor aprovado ou mestre |
| Instagram (`meta/live`) | Lia DMs de outra loja sabendo o id da conversa | Confere a loja |
| Upload por link (`site/upload`) | O servidor buscava qualquer endereço, inclusive internos | Só https público, sem redirecionamento, com limite de 15 MB |
| Transcrição de áudio | Sem limite | 25 MB e só formatos de áudio |
| Crons | 7 de 8 ficavam **abertos** se o CRON_SECRET sumisse | Todos fecham; todos gravam um diário de execução |

## Crons que se repetiam ou não protegiam

- **briefing-do-dia:** o filtro "já mandei hoje" usava uma coluna que não existe (`created_at` em vez de `criada_em`) — nunca impediu o briefing repetido. Corrigido.
- **cobrar-metas:** o "hoje" começava às 21h do dia anterior. Corrigido.
- **supervisao-aura:** pulava ninguém (nem desativados) e podia gerar duas supervisões no mesmo dia. Agora uma por pessoa por dia, só ativos.
- **gerar-relatorios:** num sábado dia 1, o semanal rodava duas vezes; uma loja com erro derrubava o mensal das outras. Corrigido.

## Operação

- `supabase/esquema.sql` + `supabase/migracoes-aplicadas/`: **o esquema real do banco** (113 migrações), exportado com `scripts/exportar-esquema.mjs`. O `schema.sql` antigo ficou marcado como histórico.
- `deploy/deploy.sh`: confere que a **versão nova** respondeu (antes aceitava a página de login, mesmo com o build antigo de pé) e roda `npm ci` sempre que o `node_modules` não bate com o package-lock.
- `deploy/aura-crons`: Sentinelas às 7h30 e 13h30; o log dos crons não cresce mais para sempre.
- Backup lê as tabelas em ordem (antes podia repetir ou pular linhas).

---

## As Sentinelas (agentes dentro do AURA)

Rodam sozinhas, sem IA (custo zero), e só avisam o que for novo.

- **Operação:** cada cron rodou no prazo? O backup de hoje está na nuvem? A IA está falhando? O saldo da IA está acabando ou o gasto disparou?
- **Dados:** lead esperando há mais de 24 h, negócio aberto que sumiu do pipeline (etapa fora do funil), contato com categoria que o app não conhece, usuário ativo com cadastro pela metade.
- **Segurança:** tabela sem RLS, tabela aberta a qualquer logado, gestor mestre novo desde a última checagem, conta com cargo que não existe, gestor esperando aprovação, login novo sem perfil, CRON_SECRET fraco.

Primeira rodada (só leitura, contra o banco real, em 24/11): saldo da IA, 8 contatos com categoria "Cliente" (a migração 105 corrige) e 5 logins sem perfil.

---

## O banco: migração 105

`supabase/migrations/105_auditoria_cargos_e_sentinelas.sql` — **ainda não aplicada**. O código desta branch funciona sem ela (cai em leituras mais lentas e as Sentinelas avisam que ela falta), mas as correções de permissão do banco só valem depois de aplicada.

O que ela faz: cadastro só aceita os cargos da tela; tira o Diretor das funções de acesso; reescreve 17 regras de RLS; corrige o gatilho que criava contato com categoria "Cliente"; cria a soma do gasto da IA no banco; cria as tabelas das Sentinelas.

**Ninguém perde acesso:** não há nenhum Diretor e os 4 gestores ativos são mestres aprovados.

---

## O que NÃO foi feito (fica para depois)

- **WhatsApp** (a pedido): a análise da AURA só volta depois de um deploy quando alguém abre a tela do WhatsApp; a tabela `whatsapp_contactos` (710 contatos) é legível por qualquer logado; o webhook do WhatsApp oficial não confere assinatura (inativo hoje).
- Limpeza: ~50 componentes e arquivos sem uso e dependências sem uso (`puppeteer`, `canvas`, `chart.js`, `axios`…).
- Atividades limitadas a 50 (vendedor) / 400 (gestor) no carregamento.
- Telas de relatório duplicadas (`/relatorio`, `/relatorios`, `/relatorios-avancados`).
- Menu do celular sem Instagram e AURA Coach.

## Como foi conferido

- `tsc --noEmit`: sem erro novo (o único erro é do `node_modules` desatualizado no PC de desenvolvimento).
- `eslint src`: 0 erros (os mesmos 22 avisos de antes).
- Os 13 testes `*.teste.ts`: 13 passam (antes 12 — o do menu do gestor falhava).
- Sentinelas rodadas em modo leitura contra o banco real.
