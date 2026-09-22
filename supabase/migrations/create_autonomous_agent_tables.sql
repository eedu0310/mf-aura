-- Tabela: aura_agent_logs
CREATE TABLE IF NOT EXISTS aura_agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL,
  tipo_acao VARCHAR(100) NOT NULL,
  parametros JSONB NOT NULL,
  resultado JSONB,
  sucesso BOOLEAN NOT NULL DEFAULT false,
  erro TEXT,
  criado_em TIMESTAMP DEFAULT NOW(),
  criado_por VARCHAR(50) DEFAULT 'autonomous_agent'
);

CREATE INDEX IF NOT EXISTS idx_agent_logs_user ON aura_agent_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_empresa ON aura_agent_logs(empresa_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_tipo ON aura_agent_logs(tipo_acao);
CREATE INDEX IF NOT EXISTS idx_agent_logs_data ON aura_agent_logs(criado_em);

-- Tabela: acoes_pendentes_aprovacao
CREATE TABLE IF NOT EXISTS acoes_pendentes_aprovacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL,
  tipo_acao VARCHAR(100) NOT NULL,
  descricao TEXT,
  parametros JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente',
  criado_em TIMESTAMP DEFAULT NOW(),
  aprovado_em TIMESTAMP,
  aprovado_por UUID REFERENCES auth.users(id),
  motivo_rejeicao TEXT
);

CREATE INDEX IF NOT EXISTS idx_acoes_user ON acoes_pendentes_aprovacao(user_id);
CREATE INDEX IF NOT EXISTS idx_acoes_status ON acoes_pendentes_aprovacao(status);

-- Tabela: mensagens_whatsapp
CREATE TABLE IF NOT EXISTS mensagens_whatsapp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero_destino VARCHAR(20) NOT NULL,
  mensagem TEXT NOT NULL,
  template_id VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'pendente',
  enviado_em TIMESTAMP,
  erro TEXT,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_user ON mensagens_whatsapp(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_status ON mensagens_whatsapp(status);

-- Tabela: emails_enviados
CREATE TABLE IF NOT EXISTS emails_enviados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  destinatario VARCHAR(255) NOT NULL,
  assunto VARCHAR(255) NOT NULL,
  corpo_html TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente',
  enviado_em TIMESTAMP,
  erro TEXT,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_user ON emails_enviados(user_id);
CREATE INDEX IF NOT EXISTS idx_email_status ON emails_enviados(status);
