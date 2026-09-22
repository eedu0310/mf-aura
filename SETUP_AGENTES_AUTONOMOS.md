# 🤖 Setup - Agentes Autônomos IA AURA

Este guia passo a passo vai ajudá-lo a ativar os Agentes Autônomos no AURA CRM.

## ✅ STATUS ATUAL

- [x] Fase 1: Claude API Migration
- [x] Fase 2: Autonomous Execution
- [x] Fase 3: Communication Tools (estrutura)
- [x] Fase 4: Approval & Logging System
- [x] Vercel Cron Configuration
- [x] SQL Migrations

## 🚀 PRÓXIMOS PASSOS

### 1. Obter Chave do Anthropic

1. Acesse: https://console.anthropic.com
2. Crie uma conta ou faça login
3. Vá para "API Keys"
4. Crie uma nova chave
5. Copie a chave (será invisível depois)

### 2. Configurar .env.local

Abra `C:\Users\pedid\Downloads\aura-sales-os padrão\.env.local` e adicione:

```env
ANTHROPIC_API_KEY=sk-ant-[sua chave aqui]
CRON_SECRET=[gere uma string aleatória com: openssl rand -hex 32]
```

**Importante**: Nunca compartilhe suas chaves! Elas estão em `.env.local` que deve estar em `.gitignore`.

### 3. Criar Tabelas no Supabase

Execute o SQL em `supabase/migrations/create_autonomous_agent_tables.sql`:

1. Abra Supabase Dashboard: https://app.supabase.com
2. Selecione seu projeto
3. Vá para SQL Editor
4. Crie uma nova query
5. Cole o conteúdo do arquivo SQL
6. Execute (Run)

**Tabelas criadas:**
- `aura_agent_logs` - Logs de todas as ações
- `acoes_pendentes_aprovacao` - Ações aguardando aprovação
- `mensagens_whatsapp` - Fila de mensagens
- `emails_enviados` - Registro de emails

### 4. Testar Localmente

```bash
# Terminal: navigate para a pasta
cd "C:\Users\pedid\Downloads\aura-sales-os padrão"

# Instalar dependências (já feito)
npm install

# Rodar em desenvolvimento
npm run dev

# Acessar: http://localhost:3000
```

**Teste 1 - Claude Connection:**
```bash
curl -X POST http://localhost:3000/api/coach \
  -H "Content-Type: application/json" \
  -d '{"mensagens":[{"role":"user","content":"teste"}]}'
```

**Teste 2 - Autonomous Agent:**
```bash
curl -X POST http://localhost:3000/api/aura/autonomous-agent \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "[seu_user_id]",
    "empresa": "[sua_empresa_id]",
    "dataAtual": "2026-09-21T14:00:00Z"
  }'
```

### 5. Verificar Logs

Após os testes, acesse Supabase SQL Editor e execute:

```sql
SELECT * FROM aura_agent_logs ORDER BY criado_em DESC LIMIT 10;
```

Você deve ver os logs das ações executadas.

### 6. Deploy para Produção

1. Commit suas mudanças:
```bash
git add .
git commit -m "feat: autonomous agents implementation"
git push
```

2. No Vercel Dashboard:
   - Adicionar Environment Variables:
     - `ANTHROPIC_API_KEY` (sua chave)
     - `CRON_SECRET` (seu secret)
   - Redeploy

3. Verificar Crons:
   - Vá para Vercel Dashboard → Crons
   - Você deve ver `/api/cron/autonomous-agent` agendado

## 📊 ARQUIVOS CRIADOS

| Arquivo | Descrição |
|---------|-----------|
| `src/lib/claude-client.ts` | Cliente Anthropic singleton |
| `src/lib/approval-system.ts` | Matriz de aprovações |
| `src/lib/agent-logger.ts` | Sistema de logging |
| `src/app/api/aura/autonomous-agent/route.ts` | Agente autônomo |
| `src/app/api/cron/autonomous-agent/route.ts` | Trigger do cron |
| `src/app/(vendedor)/aprovacoes-pendentes/page.tsx` | Dashboard de aprovações |
| `supabase/migrations/create_autonomous_agent_tables.sql` | Tabelas Supabase |
| `vercel.json` | Configuração atualizada |

## 🔍 TROUBLESHOOTING

**Erro: "ANTHROPIC_API_KEY is not set"**
- [ ] Verificar `.env.local` tem a chave
- [ ] Reiniciar `npm run dev`
- [ ] Verificar se a chave começa com `sk-ant-`

**Erro: "Supabase credentials not configured"**
- [ ] Verificar `.env.local` tem `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Testar conexão: `curl -H "Authorization: Bearer $SUPABASE_ANON_KEY" https://$SUPABASE_URL/rest/v1/vendedores`

**Cron job não executa**
- [ ] Verificar `vercel.json` está correto
- [ ] Fazer redeploy
- [ ] Verificar logs no Vercel Dashboard → Integrations → Crons

**Tabelas não existem no Supabase**
- [ ] Re-executar o SQL migration
- [ ] Verificar que o SQL rodou sem erros
- [ ] Recarregar a página

## 📝 PRÓXIMAS MELHORIAS

- [ ] Integração real com Twilio para WhatsApp
- [ ] Integração com SendGrid para emails
- [ ] Dashboard de analytics dos agentes
- [ ] Machine learning para priorização automática
- [ ] Integrações com CRMs externos

## 📞 SUPORTE

Para dúvidas ou problemas:
1. Verificar logs em Supabase SQL Editor
2. Revisar console do navegador (F12)
3. Verificar Vercel Logs se for em produção

---

**Última atualização:** 2026-09-21
**Status:** ✅ Pronto para testes

