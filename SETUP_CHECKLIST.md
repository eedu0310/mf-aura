# ✅ Checklist de Configuração - WhatsApp + Agente Autônomo

## 📋 Antes de Começar

Certifique-se que você tem:
- [ ] Acesso ao Supabase (URL e chave de serviço)
- [ ] Chave válida da API Claude
- [ ] Projeto já rodando localmente (`npm run dev`)
- [ ] Node.js 18+ instalado
- [ ] `@anthropic-ai/sdk` instalado (`npm install @anthropic-ai/sdk`)

---

## 🔧 Passo 1: Verificar Variáveis de Ambiente

```bash
# Abra .env.local e verifique se tem:
cat .env.local | grep -E "CLAUDE_API_KEY|SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|CRON_SECRET"
```

**O que procurar:**
- ✅ `CLAUDE_API_KEY=sk-proj-...`
- ✅ `NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co`
- ✅ `SUPABASE_SERVICE_ROLE_KEY=eyJ...`
- ✅ `CRON_SECRET=aleatoriosecuro...` (gere com: `openssl rand -hex 32`)

---

## 🗄️ Passo 2: Aplicar Database Migration

### Opção A: Via Supabase Dashboard (Mais Fácil)

1. Abra https://app.supabase.com
2. Selecione seu projeto
3. Vá para **SQL Editor**
4. Clique em **New Query**
5. Copie o conteúdo de: `supabase/migration-017-agent-suggestions.sql`
6. Cole na query
7. Clique **Run**
8. Aguarde até ver "Success" ✅

### Opção B: Via Supabase CLI (Mais Profissional)

```bash
# Login no Supabase
supabase login

# Crie um branch para testar
supabase branches create agent-suggestions

# Aplique a migração
supabase db push

# Deploy para produção
supabase branches publish agent-suggestions
```

**Verificar se funcionou:**
```sql
-- No SQL Editor do Supabase, rode:
SELECT * FROM information_schema.tables 
WHERE table_name IN ('agent_suggestions', 'agent_auto_responses', 'agent_notifications')
ORDER BY table_name;

-- Deve retornar 3 linhas ✅
```

---

## 🧪 Passo 3: Testar Localmente

### 3.1 Instalar Dependências (se faltarem)

```bash
npm install @anthropic-ai/sdk
npm run build  # Compilar TypeScript
```

### 3.2 Testar WhatsApp Agent Localmente

```bash
# Terminal 1: Rodar o servidor
npm run dev

# Terminal 2: Testar o endpoint (sem usar cron, direto)
curl -X POST http://localhost:3000/api/cron/whatsapp-agent \
  -H "Authorization: Bearer seu-cron-secret-aqui" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Resultado esperado:**
```json
{
  "success": true,
  "totalVendors": 5,
  "sucessos": 5,
  "erros": 0,
  "totalSuggestions": 12,
  "timestamp": "2026-09-21T20:00:00Z"
}
```

### 3.3 Verificar Sugestões no Banco

```sql
-- No SQL Editor do Supabase:
SELECT id, type, title, confidence, status, created_at
FROM agent_suggestions
ORDER BY created_at DESC
LIMIT 5;
```

**Deve retornar sugestões recém criadas** ✅

---

## 🌐 Passo 4: Deploy para Vercel

### 4.1 Preparar Variáveis de Ambiente

```bash
# Adicione ao projeto Vercel via CLI:
vercel env add CLAUDE_API_KEY
vercel env add CRON_SECRET

# OU via Dashboard Vercel:
# Projeto > Settings > Environment Variables > Add
```

### 4.2 Deploy

```bash
# Se ainda não fez:
vercel link

# Deploy
vercel deploy

# Deploy para produção
vercel deploy --prod
```

### 4.3 Verificar Cron Jobs

```bash
# Listar crons
vercel cron list

# Deve mostrar:
# ✓ /api/cron/supervisao-aura - 0 12 * * *
# ✓ /api/cron/autonomous-agent - */30 * * * *
# ✓ /api/cron/whatsapp-agent - */5 * * * *
```

---

## 📊 Passo 5: Configurar Monitoramento

### 5.1 Logs em Tempo Real

```bash
# Ver logs do Vercel
vercel logs --follow

# Filtrar apenas WhatsApp agent
vercel logs | grep whatsapp-agent
```

### 5.2 Alertas (Opcional)

Adicione ao seu Slack/Discord para notificações:

```bash
# Via Vercel Dashboard > Integrations > Add
# Buscar por "Slack" ou "Discord"
```

### 5.3 Monitorar Custos Claude

Vá para: https://console.anthropic.com > Usage

**Esperado para iniciar:**
- ~0.01-0.05 USD/dia (com 50 mensagens/dia)
- Aumenta com volume de mensagens

---

## ✨ Passo 6: Testar Interface

### 6.1 Acessar WhatsApp Page

1. Abra http://localhost:3000/vendedor/whatsapp
2. Selecione uma conversa
3. Abaixo do chat, deve aparecer a seção **"💡 Sugestões do Agente"**

### 6.2 Disparar Sugestões Manualmente

Para ver sugestões aparecerem:

```bash
# Terminal 1: Servidor rodando
npm run dev

# Terminal 2: Simular cron (em dev)
curl -X POST http://localhost:3000/api/cron/whatsapp-agent \
  -H "Authorization: Bearer seu-cron-secret" \
  -H "Content-Type: application/json"
```

**Resultado no browser:**
- Página auto-refresh mostra novas sugestões em tempo real 🎉
- Pode clicar em "Aplicar" ou "Descartar"

---

## 🚨 Troubleshooting

### Problema: "No suggestions appear"

**Debug:**
```bash
# 1. Verifique se há mensagens não processadas
curl "http://localhost:3000/api/debug/messages?vendor_id=abc123"

# 2. Verifique logs
vercel logs --follow

# 3. Verifique se a migração foi aplicada
psql $DATABASE_URL -c "SELECT * FROM agent_suggestions LIMIT 1;"
```

### Problema: "401 Unauthorized"

**Debug:**
```bash
# Verifique se CRON_SECRET está correto
echo $CRON_SECRET

# Tente com echo
curl -X POST http://localhost:3000/api/cron/whatsapp-agent \
  -H "Authorization: Bearer $CRON_SECRET" \
  -v  # -v para verbose
```

### Problema: "Claude API Error"

**Debug:**
```bash
# Verifique chave
echo $CLAUDE_API_KEY | head -c 20  # Deve começar com sk-proj

# Verifique no dashboard
# https://console.anthropic.com > API Usage
```

---

## 🎯 Após Tudo Funcionar

### Otimizações Recomendadas

1. **Aumentar Frequência** (se tiver budget):
   ```json
   // vercel.json
   "schedule": "*/2 * * * *"  // A cada 2 minutos
   ```

2. **Adicionar Batching** em `whatsapp-suggestion-agent.ts`:
   ```ts
   // Processar 5 mensagens em 1 chamada Claude
   const limit = 5;  // ao invés de 10
   ```

3. **Cache de Contexto** (reduz custos 30%):
   - Implementar cache de últimas conversas
   - Reusar contexto para múltiplas análises

4. **Analytics Dashboard**:
   - Track de sugestões aplicadas
   - Taxa de conversão
   - ROI do agente

---

## 📞 Contato / Suporte

| Problema | Onde Procurar |
|----------|---------------|
| Erro no Supabase | Dashboard > Logs |
| Erro no Claude | Console > Claude API Status |
| Erro no Vercel | Vercel Dashboard > Logs |
| Erro Local | npm run dev output |
| Erro RLS | Supabase > Auth > Policies |

---

## ✅ Checklist Final

- [ ] Variáveis de ambiente OK
- [ ] Migration aplicada
- [ ] Tabelas criadas no banco
- [ ] Testes locais passaram
- [ ] Deploy para Vercel feito
- [ ] Cron jobs visíveis
- [ ] Interface mostra sugestões
- [ ] Logs em tempo real OK
- [ ] Monitoramento configurado

**Quando TUDO estiver checked:**
🎉 Implementação Completa e Funcional!

---

**Última atualização**: 2026-09-21  
**Tempo estimado de setup**: 30-60 minutos
