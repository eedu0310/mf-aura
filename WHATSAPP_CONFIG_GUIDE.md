# Guia Completo de Configuração do Módulo WhatsApp - AURA CRM

## 📋 Índice
1. [Status Atual](#status-atual)
2. [Pré-requisitos](#pré-requisitos)
3. [Instalação](#instalação)
4. [Configuração com Twilio](#configuração-com-twilio)
5. [Configuração com Baileys](#configuração-com-baileys)
6. [Testes](#testes)
7. [Troubleshooting](#troubleshooting)

---

## Status Atual

### ✅ Concluído
- [x] Interface Frontend (UI/UX melhorada)
- [x] Estrutura de componentes React
- [x] Integração com Supabase (preparada)
- [x] Sistema de mensagens mock
- [x] Indicadores de status
- [x] Error handling básico

### ⏳ Em Progresso
- [ ] Integração com Twilio
- [ ] Integração com Baileys
- [ ] Webhook receiver
- [ ] Processamento de mensagens IA
- [ ] Testes automatizados

### ❌ Pendente
- [ ] Deploy em produção
- [ ] Monitoramento
- [ ] Documentação de usuário

---

## Pré-requisitos

### Node.js e npm
```bash
node -v  # v18.0.0 ou superior
npm -v   # v9.0.0 ou superior
```

### Dependências Instaladas
- ✅ `@supabase/supabase-js`
- ✅ `lucide-react`
- ✅ `next`
- ✅ `react`
- ✅ `typescript`

### Opcional (para Twilio ou Baileys)
- `twilio` - Para integração com Twilio
- `whatsapp-web.js` ou `Baileys` - Para WhatsApp Web automation

---

## Instalação

### 1. Instalar Dependências do Projeto
```bash
cd "aura-sales-os padrão"
npm install
```

### 2. Verificar Estrutura
```bash
# Verificar se o arquivo da página existe
ls -la src/app/\(vendedor\)/whatsapp/page.tsx

# Verificar se o serviço WhatsApp existe
ls -la src/lib/whatsapp/whatsapp-service.ts
```

### 3. Configurar Variáveis de Ambiente
```bash
# Copiar template
cp .env.local.example .env.local

# Abrir arquivo e adicionar configurações
code .env.local  # ou seu editor favorito
```

---

## Configuração com Twilio (RECOMENDADO)

### Passo 1: Criar Conta Twilio
1. Acesse https://www.twilio.com
2. Clique em "Sign Up" ou "Get Started Free"
3. Preencha os dados de registro
4. Confirme o e-mail

### Passo 2: Obter Credenciais
1. Acesse https://console.twilio.com
2. Na dashboard, procure por:
   - **Account SID**: Copie este valor
   - **Auth Token**: Copie este valor
3. Anote o número de telefone do WhatsApp da Twilio

### Passo 3: Configurar .env.local
```env
# Twilio WhatsApp Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+55XXXXXXXXXX
WHATSAPP_VERIFY_TOKEN=seu_token_secreto_aleatorio
WHATSAPP_MODE=twilio
```

### Passo 4: Testar Conexão
```bash
npm run dev

# Abrir em outro terminal
curl -X POST http://localhost:3000/api/whatsapp/test \
  -H "Content-Type: application/json" \
  -d '{"message": "Teste"}'
```

---

## Configuração com Baileys (Alternativa)

### Passo 1: Instalar Dependências
```bash
npm install whatsapp-web.js
# ou
npm install Baileys
```

### Passo 2: Configurar .env.local
```env
# Baileys Configuration (WhatsApp Web Automation)
BAILEYS_SESSION_DIR=./sessions
BAILEYS_BROWSER_PATH=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe
# No Linux:
# BAILEYS_BROWSER_PATH=/usr/bin/google-chrome
# No macOS:
# BAILEYS_BROWSER_PATH=/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome

WHATSAPP_MODE=baileys
```

### Passo 3: Primeira Execução
```bash
npm run dev

# Na primeira execução:
# 1. Um QR Code será exibido
# 2. Escaneie com seu telefone WhatsApp
# 3. A sessão será salva em ./sessions
```

---

## Estrutura de Arquivos

```
src/
├── app/
│   └── (vendedor)/
│       └── whatsapp/
│           └── page.tsx           # ✅ UI Principal (Melhorada)
├── api/
│   └── whatsapp/
│       ├── webhook/
│       │   └── route.ts           # POST /api/whatsapp/webhook
│       ├── send/
│       │   └── route.ts           # POST /api/whatsapp/send
│       └── test/
│           └── route.ts           # POST /api/whatsapp/test
├── lib/
│   └── whatsapp/
│       ├── whatsapp-service.ts    # ✅ Serviço WhatsApp
│       ├── twilio-client.ts       # ⏳ Cliente Twilio
│       └── baileys-client.ts      # ⏳ Cliente Baileys
└── types/
    └── whatsapp.ts               # ⏳ Tipos TypeScript

supabase/
└── migrations/
    └── whatsapp_tables.sql       # ✅ Tabelas de banco de dados
```

---

## Banco de Dados - Tabelas Necessárias

### whatsapp_conversas
```sql
CREATE TABLE whatsapp_conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  telefone VARCHAR(20) NOT NULL,
  nome_cliente VARCHAR(255),
  status VARCHAR(50) DEFAULT 'ativa',
  ultima_mensagem TEXT,
  timestamp TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### whatsapp_mensagens
```sql
CREATE TABLE whatsapp_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID REFERENCES whatsapp_conversas(id),
  texto TEXT NOT NULL,
  remetente VARCHAR(20),
  status VARCHAR(50) DEFAULT 'enviado',
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Testes

### Teste de Conexão Básica
```bash
# Terminal 1: Iniciar servidor
npm run dev

# Terminal 2: Testar API
curl http://localhost:3000/api/whatsapp/webhook/verify \
  -X GET \
  -H "hub.challenge=test"
```

### Teste de Envio de Mensagem
```bash
curl -X POST http://localhost:3000/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "(54) 99999-1234",
    "message": "Olá! Teste de mensagem"
  }'
```

### Teste do Frontend
```bash
# Abrir navegador
http://localhost:3000/vendedor/whatsapp

# Observar:
# ✅ Carregamento de conversas
# ✅ Envio de mensagens
# ✅ Atualização de UI
# ✅ Indicadores de status
```

---

## API Endpoints

### POST /api/whatsapp/webhook
Recebe mensagens entrantes do WhatsApp

**Request:**
```json
{
  "From": "whatsapp:+5554999991234",
  "Body": "Olá, preciso de ajuda",
  "MessageSid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "uuid"
}
```

### POST /api/whatsapp/send
Envia mensagem para cliente

**Request:**
```json
{
  "phone": "+5554999991234",
  "message": "Olá! Bem-vindo à AURA",
  "conversationId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "messageSid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

---

## Troubleshooting

### Erro: "Module not found: Can't resolve 'date-fns'"
**Solução:** Remover import de `date-fns`. Usar `new Date()` nativo.
```javascript
// ❌ Errado
import { format } from "date-fns";

// ✅ Correto
const time = new Date().toLocaleTimeString("pt-BR");
```

### Erro: "Twilio credentials not configured"
**Solução:** Verificar .env.local
```bash
# Confirmar que as variáveis estão no .env.local
grep TWILIO .env.local

# Se não existirem, adicionar:
echo "TWILIO_ACCOUNT_SID=ACxxxxxxxx" >> .env.local
echo "TWILIO_AUTH_TOKEN=xxxxxxxx" >> .env.local
```

### Erro: "Cannot GET /api/whatsapp/webhook"
**Solução:** Verificar se o arquivo route.ts existe e está correto
```bash
# Verificar arquivo
cat src/app/api/whatsapp/webhook/route.ts | head -20
```

### Webhook não está recebendo mensagens
**Solução:**
1. Verificar se a URL é acessível externamente
2. Usar ngrok para expor localhost:
```bash
ngrok http 3000
# Usar URL fornecida como webhook URL no Twilio
```

---

## Checklist de Implementação

- [ ] Variáveis de ambiente configuradas
- [ ] Credenciais do Twilio/Baileys ativas
- [ ] Banco de dados com tabelas criadas
- [ ] API endpoints testados
- [ ] Frontend UI carregando
- [ ] Envio de mensagens funcionando
- [ ] Recebimento de mensagens funcionando
- [ ] Integração com IA testada
- [ ] Testes automatizados passando
- [ ] Documentação atualizada
- [ ] Deploy em staging realizado
- [ ] Testes de carga concluídos

---

## Próximos Passos

1. **Configurar credenciais** (Twilio ou Baileys)
2. **Testar API endpoints**
3. **Implementar webhook receiver**
4. **Integrar com processamento IA**
5. **Adicionar testes automatizados**
6. **Publicar em staging**

---

## Contato e Suporte

Para questões técnicas:
- Documentação Twilio: https://www.twilio.com/docs/whatsapp
- Documentação Baileys: https://github.com/WhiskeySockets/Baileys
- Supabase Docs: https://supabase.com/docs

---

**Última atualização:** 21 de Setembro de 2026
**Status:** Pronto para configuração de credenciais
