-- Esquema público do AURA gerado em 2026-11-24 16:50:17.956258+00

create type public.origem_lead as enum ('loja', 'mf', 'marketing', 'proprio', 'indicacao');

create table if not exists public.acoes_pendentes_aprovacao (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  empresa_id uuid not null,
  tipo_acao character varying(100) not null,
  descricao text,
  parametros jsonb not null,
  status character varying(20) not null default 'pendente'::character varying,
  criado_em timestamp without time zone default now(),
  aprovado_em timestamp without time zone,
  aprovado_por uuid,
  motivo_rejeicao text
);

create table if not exists public.agent_auto_responses (
  id uuid not null default gen_random_uuid(),
  vendor_id uuid not null,
  related_message_id uuid not null,
  proposed_message text not null,
  reasoning text,
  is_approved boolean default false,
  is_sent boolean default false,
  created_at timestamp with time zone default now()
);

create table if not exists public.agent_notifications (
  id uuid not null default gen_random_uuid(),
  vendor_id uuid not null,
  type text not null,
  title text not null,
  message text,
  related_suggestion_id uuid,
  is_read boolean default false,
  created_at timestamp with time zone default now()
);

create table if not exists public.agent_suggestions (
  id uuid not null default gen_random_uuid(),
  vendor_id uuid not null,
  conversation_id uuid not null,
  related_message_id uuid,
  type text not null,
  title text not null,
  description text not null,
  suggested_action text not null,
  confidence numeric not null,
  status text not null default 'pending'::text,
  claude_message_id text,
  processing_time_ms integer,
  created_at timestamp with time zone not null default now(),
  viewed_at timestamp with time zone,
  applied_at timestamp with time zone,
  dismissed_at timestamp with time zone
);

create table if not exists public.atividades (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  empresa text not null,
  tipo text not null,
  titulo text not null,
  contexto text,
  created_at timestamp with time zone not null default now(),
  observacao text,
  relacionamento_id uuid,
  cliente_nome text,
  cliente_telefone text,
  cliente_email text,
  cliente_categoria text,
  subtipo text,
  resultado text,
  objetivo text,
  proximo_passo text,
  ocorrida_em timestamp with time zone not null default now(),
  proximo_contato_em timestamp with time zone,
  latitude double precision,
  longitude double precision,
  precisao_metros double precision,
  endereco text,
  localizacao_capturada_em timestamp with time zone,
  origem_dispositivo text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone not null default now(),
  origem text,
  origem_lead origem_lead,
  campanha_id uuid
);

create table if not exists public.aura_agent_logs (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  empresa_id uuid not null,
  tipo_acao character varying(100) not null,
  parametros jsonb not null,
  resultado jsonb,
  sucesso boolean not null default false,
  erro text,
  criado_em timestamp without time zone default now(),
  criado_por character varying(50) default 'autonomous_agent'::character varying
);

create table if not exists public.aura_aprendizado (
  id uuid not null default gen_random_uuid(),
  empresa text not null,
  canal text not null default 'whatsapp'::text,
  tipo text not null,
  gatilho text not null,
  resposta text not null,
  chave text not null,
  vezes_visto integer not null default 1,
  vezes_fechou integer not null default 0,
  status text not null default 'sugerido'::text,
  revisado_por uuid,
  revisado_em timestamp with time zone,
  fonte text,
  criado_em timestamp with time zone not null default now(),
  atualizado_em timestamp with time zone not null default now(),
  vezes_perdeu integer not null default 0,
  aprovado_auto boolean not null default false
);

create table if not exists public.aura_aprendizado_origem (
  id uuid not null default gen_random_uuid(),
  aprendizado_id uuid not null,
  empresa text not null,
  owner_id uuid,
  chat_jid text,
  oportunidade_id uuid,
  relacionamento_id uuid,
  resultado text,
  resolvido_em timestamp with time zone,
  criado_em timestamp with time zone not null default now()
);

create table if not exists public.aura_cobrancas (
  id uuid not null default gen_random_uuid(),
  vendedor_id uuid not null,
  empresa text,
  dia date not null,
  itens jsonb not null default '[]'::jsonb,
  contexto text,
  resposta jsonb,
  respondida_em timestamp with time zone,
  criada_em timestamp with time zone not null default now()
);

create table if not exists public.aura_feedback_fechamento (
  id uuid not null default gen_random_uuid(),
  empresa text not null,
  vendedor_id uuid not null,
  oportunidade_id uuid,
  relacionamento_id uuid,
  cliente text,
  resultado text not null,
  valor numeric,
  origem_lead origem_lead,
  resumo text not null,
  acertos text[] not null default '{}'::text[],
  erros text[] not null default '{}'::text[],
  etapas_puladas text[] not null default '{}'::text[],
  ponto_fraco text,
  motivo_informado text,
  criado_em timestamp with time zone not null default now()
);

create table if not exists public.aura_materiais (
  id uuid not null default gen_random_uuid(),
  empresa text not null,
  titulo text not null,
  descricao text,
  arquivo_nome text,
  tipo text,
  bytes integer,
  texto text not null,
  caracteres integer default length(texto),
  ativo boolean not null default true,
  criado_por uuid,
  criado_em timestamp with time zone not null default now(),
  atualizado_em timestamp with time zone not null default now()
);

create table if not exists public.aura_material_trechos (
  id uuid not null default gen_random_uuid(),
  material_id uuid not null,
  empresa text not null,
  ordem integer not null,
  origem text not null,
  texto text not null,
  busca tsvector default to_tsvector('portuguese'::regconfig, ((COALESCE(origem, ''::text) || ' '::text) || COALESCE(texto, ''::text))),
  criado_em timestamp with time zone not null default now(),
  nucleo boolean not null default false
);

create table if not exists public.aura_recomendacoes (
  id uuid not null default gen_random_uuid(),
  supervisao_id uuid not null,
  vendedor_id uuid not null,
  empresa text not null,
  titulo text not null,
  descricao text not null,
  prioridade text not null default 'media'::text,
  origem text not null default 'regra'::text,
  status text not null default 'pendente'::text,
  entidade_tipo text,
  entidade_id uuid,
  prazo date,
  concluida_em timestamp with time zone,
  criado_em timestamp with time zone not null default now()
);

create table if not exists public.aura_sugestoes_resultado (
  id uuid not null default gen_random_uuid(),
  empresa text not null,
  owner_id uuid not null,
  chat_jid text not null,
  sugestao text not null,
  enviado text,
  similaridade numeric,
  uso text not null,
  enviado_em timestamp with time zone not null default now(),
  cliente_respondeu boolean,
  resposta_cliente text,
  respondeu_em timestamp with time zone,
  criado_em timestamp with time zone not null default now()
);

create table if not exists public.aura_supervisoes (
  id uuid not null default gen_random_uuid(),
  vendedor_id uuid not null,
  empresa text not null,
  janela_inicio timestamp with time zone not null,
  janela_fim timestamp with time zone not null,
  score integer not null default 0,
  resumo text not null default ''::text,
  riscos jsonb not null default '[]'::jsonb,
  criado_em timestamp with time zone not null default now()
);

create table if not exists public.campanhas_marketing (
  id uuid not null default gen_random_uuid(),
  empresa text not null,
  nome text not null,
  canal text not null,
  status text not null default 'planejada'::text,
  data_inicio date,
  data_fim date,
  orcamento numeric,
  leads_gerados integer not null default 0,
  observacoes text,
  criado_por uuid not null,
  created_at timestamp with time zone not null default now(),
  chave_externa text
);

create table if not exists public.coach_conversas (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  titulo text not null default 'Nova conversa'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.coach_mensagens (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  autor text not null,
  texto text not null,
  created_at timestamp with time zone not null default now(),
  conversa_id uuid
);

create table if not exists public.compromisso_mensal_campos (
  id uuid not null default gen_random_uuid(),
  chave text not null,
  rotulo text not null,
  ajuda text,
  tipo text not null default 'numero'::text,
  ordem integer not null default 0,
  ativo boolean not null default true,
  criado_em timestamp with time zone not null default now()
);

create table if not exists public.compromissos (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  titulo text not null,
  subtitulo text,
  tipo text not null default 'Outro'::text,
  relacionamento_nome text,
  data date not null,
  hora text,
  concluido boolean not null default false,
  created_at timestamp with time zone not null default now(),
  empresa text,
  duracao_minutos integer not null default 60,
  local text,
  observacao text,
  relacionamento_id uuid,
  atualizado_em timestamp with time zone not null default now()
);

create table if not exists public.compromissos_mensais (
  id uuid not null default gen_random_uuid(),
  vendedor_id uuid not null,
  empresa text not null,
  mes text not null,
  meta_faturamento numeric not null default 0,
  meta_clientes_novos integer not null default 0,
  meta_arquitetos integer not null default 0,
  meta_construtoras integer not null default 0,
  meta_obras integer not null default 0,
  meta_ligacoes integer not null default 0,
  meta_visitas integer not null default 0,
  objetivo_pessoal text,
  status text not null default 'rascunho'::text,
  feedback_gestor text,
  aprovado_por uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  data_envio timestamp with time zone default now(),
  notificacao_visualizada boolean default false,
  extras jsonb not null default '{}'::jsonb
);

create table if not exists public.config_atendimento (
  empresa text not null,
  estados_presenciais text[] not null default ARRAY['RS'::text],
  texto_presencial text,
  texto_remoto text,
  atualizado_em timestamp with time zone not null default now(),
  atualizado_por uuid,
  envio_automatico boolean not null default false,
  texto_automatico text,
  auto_hora_inicio smallint,
  auto_hora_fim smallint
);

create table if not exists public.config_avaliacao (
  empresa text not null,
  link_google text,
  link_instagram text,
  link_facebook text,
  mensagem_padrao text default 'Oi {cliente}! Foi um prazer te atender. Se puder deixar sua avaliação, ajuda muito a gente: {link}'::text,
  atualizado_em timestamp with time zone not null default now(),
  mensagem_redes text
);

create table if not exists public.config_distribuicao_leads (
  empresa text not null,
  tempo_resposta_sdr_minutos integer not null default 15,
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.emails_enviados (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  destinatario character varying(255) not null,
  assunto character varying(255) not null,
  corpo_html text,
  status character varying(20) not null default 'pendente'::character varying,
  enviado_em timestamp without time zone,
  erro text,
  criado_em timestamp without time zone default now()
);

create table if not exists public.etapas_funil (
  id uuid not null default gen_random_uuid(),
  empresa text not null,
  nome text not null,
  ordem integer not null,
  tipo text not null default 'aberta'::text,
  conta_no_pipeline boolean not null default false,
  probabilidade text,
  cor text,
  ativa boolean not null default true,
  criado_em timestamp with time zone not null default now(),
  atualizado_em timestamp with time zone not null default now(),
  chave text
);

create table if not exists public.ia_config (
  id boolean not null default true,
  preco_entrada_usd numeric(10,4) not null default 2,
  preco_saida_usd numeric(10,4) not null default 10,
  alerta_saldo_usd numeric(10,2) not null default 10,
  bloquear_sem_saldo boolean not null default false,
  atualizado_em timestamp with time zone not null default now()
);

create table if not exists public.ia_creditos (
  id uuid not null default gen_random_uuid(),
  valor_usd numeric(12,2) not null,
  descricao text,
  criado_por uuid,
  criado_em timestamp with time zone not null default now()
);

create table if not exists public.ia_falhas (
  id uuid not null default gen_random_uuid(),
  funcao text not null,
  usuario_id uuid,
  empresa text,
  mensagem text not null,
  detalhe jsonb,
  criado_em timestamp with time zone not null default now()
);

create table if not exists public.ia_uso (
  id uuid not null default gen_random_uuid(),
  empresa text,
  usuario_id uuid,
  funcao text not null,
  modelo text not null,
  tokens_entrada integer not null default 0,
  tokens_saida integer not null default 0,
  custo_usd numeric(12,6) not null default 0,
  criado_em timestamp with time zone not null default now(),
  tokens_entrada_crua bigint not null default 0,
  tokens_cache_escrita bigint not null default 0,
  tokens_cache_leitura bigint not null default 0
);

create table if not exists public.indicadores_semanais (
  id uuid not null default gen_random_uuid(),
  vendedor_id uuid not null,
  empresa text not null,
  mes text not null,
  semana integer not null,
  metrica text not null,
  valor numeric not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.leads_recebidos (
  id uuid not null default gen_random_uuid(),
  empresa text not null,
  nome text,
  telefone text not null,
  mensagem_inicial text,
  origem text not null default 'WhatsApp'::text,
  relacionamento_id uuid,
  status text not null default 'aguardando_sdr'::text,
  sdr_id uuid,
  vendedor_id uuid,
  prazo_resposta timestamp with time zone,
  respondido_em timestamp with time zone,
  respondido_por uuid,
  created_at timestamp with time zone not null default now(),
  classificacao text,
  urgencia text,
  resumo_ia text,
  gestor_notificado boolean default false,
  motivo_perda text,
  respostas_qualificacao jsonb,
  qualificacao_concluida boolean default false,
  updated_at timestamp without time zone default now(),
  email text,
  email_normalizado text,
  natureza text,
  motivo_natureza text,
  descartado_em timestamp with time zone,
  descartado_por uuid
);

create table if not exists public.links_uteis (
  id uuid not null default gen_random_uuid(),
  empresa text not null,
  titulo text not null,
  url text not null,
  categoria text,
  created_at timestamp with time zone not null default now(),
  mensagem_whatsapp text,
  ordem integer not null default 0
);

create table if not exists public.mensagens_whatsapp (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  numero_destino character varying(20) not null,
  mensagem text not null,
  template_id character varying(100),
  status character varying(20) not null default 'pendente'::character varying,
  enviado_em timestamp without time zone,
  erro text,
  criado_em timestamp without time zone default now()
);

create table if not exists public.meta_comentarios (
  id uuid not null default gen_random_uuid(),
  empresa text not null,
  conta_id uuid,
  comentario_id text not null,
  post_id text,
  post_url text,
  autor_usuario text,
  texto text,
  respondido boolean not null default false,
  oculto boolean not null default false,
  criado_em timestamp with time zone not null default now()
);

create table if not exists public.meta_contas (
  id uuid not null default gen_random_uuid(),
  empresa text not null,
  ig_user_id text,
  nome_usuario text,
  token text,
  token_expira_em timestamp with time zone,
  conectado_em timestamp with time zone,
  conectado_por uuid,
  ativo boolean not null default true
);

create table if not exists public.meta_conversas (
  id uuid not null default gen_random_uuid(),
  empresa text not null,
  conta_id uuid,
  ig_thread_id text not null,
  cliente_ig_id text,
  cliente_nome text,
  cliente_usuario text,
  cliente_foto text,
  ultima_mensagem text,
  ultima_em timestamp with time zone,
  nao_lidas integer not null default 0,
  responde_ate timestamp with time zone,
  owner_id uuid,
  relacionamento_id uuid,
  ignorado boolean not null default false,
  criado_em timestamp with time zone not null default now()
);

create table if not exists public.meta_mensagens (
  id uuid not null default gen_random_uuid(),
  conversa_id uuid not null,
  mid text,
  de_mim boolean not null default false,
  texto text,
  tipo text not null default 'text'::text,
  midia_url text,
  criado_em timestamp with time zone not null default now()
);

create table if not exists public.metas (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  mes text not null,
  valor_meta numeric not null,
  created_at timestamp with time zone not null default now(),
  empresa text,
  ano integer,
  tipo_periodo text not null default 'mensal'::text,
  periodo_inicio date,
  periodo_fim date,
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.metas_atividade (
  id uuid not null default gen_random_uuid(),
  vendedor_id uuid not null,
  empresa text not null,
  categoria text not null,
  periodo text not null,
  quantidade integer not null,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.metas_indicadores (
  id uuid not null default gen_random_uuid(),
  vendedor_id uuid not null,
  empresa text not null,
  mes text not null,
  metrica text not null,
  meta numeric not null default 0
);

create table if not exists public.motivos_perda (
  id uuid not null default gen_random_uuid(),
  motivo text not null,
  descricao text,
  created_at timestamp without time zone default now()
);

create table if not exists public.niveis_performance (
  id uuid not null default gen_random_uuid(),
  empresa text not null,
  ordem integer not null,
  nome text not null,
  meta_valor numeric not null,
  premio text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.notificacoes (
  id uuid not null default gen_random_uuid(),
  vendedor_id uuid not null,
  titulo text not null,
  mensagem text not null,
  tipo text not null,
  lida boolean default false,
  acao_url text,
  criada_em timestamp without time zone default now(),
  lida_em timestamp without time zone
);

create table if not exists public.oportunidades (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  empresa text not null,
  cliente text not null,
  produto text default 'Não especificado'::text,
  valor numeric not null,
  etapa text not null default 'Prospecção'::text,
  probabilidade text not null default 'Média'::text,
  dias_parado integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  motivo_perda text,
  relacionamento_id uuid,
  descricao_perda text,
  data_perda timestamp without time zone,
  descricao text,
  orcamento_path text,
  orcamento_nome text,
  origem_lead origem_lead,
  campanha_id uuid,
  parceiro_id uuid,
  percentual_parceiro numeric(5,2) not null default 50
);

create table if not exists public.orcamentos_anexos (
  id uuid not null default gen_random_uuid(),
  oportunidade_id uuid not null,
  relacionamento_id uuid,
  empresa text not null,
  owner_id uuid not null,
  nome text not null,
  path text not null,
  bytes bigint,
  versao integer not null default 1,
  observacao text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.pedidos_avaliacao (
  id uuid not null default gen_random_uuid(),
  venda_id uuid,
  vendedor_id uuid,
  empresa text not null,
  cliente text,
  telefone text,
  token uuid not null default gen_random_uuid(),
  canal text not null default 'google'::text,
  enviado_em timestamp with time zone,
  aberto_em timestamp with time zone,
  confirmado_em timestamp with time zone,
  confirmado_por uuid,
  criado_em timestamp with time zone not null default now()
);

create table if not exists public.perguntas_frequentes (
  id uuid not null default gen_random_uuid(),
  empresa text not null,
  pergunta text not null,
  resposta text not null,
  link text,
  ordem integer not null default 0,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.perguntas_qualificacao (
  id uuid not null default gen_random_uuid(),
  empresa text not null,
  pergunta text not null,
  tipo text not null,
  ativa boolean default true,
  created_at timestamp without time zone default now(),
  updated_at timestamp without time zone default now()
);

create table if not exists public.planilha_leads_indicadores (
  id uuid not null default gen_random_uuid(),
  usuario_id uuid not null,
  usuario_nome text,
  indicador text not null,
  semana1 integer default 0,
  semana2 integer default 0,
  semana3 integer default 0,
  semana4 integer default 0,
  tipo text,
  mes integer not null,
  ano integer not null,
  data_preenchimento timestamp without time zone default now(),
  data_atualizacao timestamp without time zone default now(),
  created_at timestamp without time zone default now(),
  semana5 numeric not null default 0,
  total numeric not null default 0
);

create table if not exists public.planilha_linhas (
  id uuid not null default gen_random_uuid(),
  empresa text not null,
  titulo text not null,
  ordem integer not null default 0,
  ativo boolean not null default true,
  criado_por uuid,
  criado_em timestamp with time zone not null default now()
);

create table if not exists public.playbook (
  empresa text not null,
  conteudo text not null default ''::text,
  updated_at timestamp with time zone not null default now(),
  vector_store_id text
);

create table if not exists public.pontuacao_regras (
  id uuid not null default gen_random_uuid(),
  empresa text not null,
  mes text not null default 'padrao'::text,
  tipo text not null,
  chave text not null,
  pontos numeric not null default 0,
  criado_em timestamp with time zone not null default now()
);

create table if not exists public.pos_venda_notas (
  id uuid not null default gen_random_uuid(),
  pos_venda_id uuid not null,
  autor_nome text,
  texto text not null,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.pos_vendas (
  id uuid not null default gen_random_uuid(),
  venda_id uuid,
  empresa text not null,
  status text not null default 'aguardando_instalacao'::text,
  data_agendamento date,
  hora_agendamento text,
  observacao text,
  reclamacao text,
  reclamacao_resolvida boolean not null default false,
  avaliou_loja boolean not null default false,
  nota_avaliacao integer,
  comentario_avaliacao text,
  updated_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  token_avaliacao uuid not null default gen_random_uuid(),
  oportunidade_id uuid,
  relacionamento_id uuid,
  vendedor_id uuid,
  responsavel_id uuid,
  cliente text,
  telefone text,
  email text,
  produto text,
  valor_fechado numeric(14,2) not null default 0,
  instalacao_agendada_em timestamp with time zone,
  instalacao_realizada_em timestamp with time zone,
  endereco_instalacao text,
  observacao_instalacao text,
  possui_reclamacao boolean not null default false,
  reclamacao_aberta_em timestamp with time zone,
  reclamacao_resolvida_em timestamp with time zone,
  pos_venda_realizado_em timestamp with time zone,
  avaliacao_nota smallint,
  avaliacao_comentario text,
  origem text not null default 'venda'::text
);

create table if not exists public.postagens_marketing (
  id uuid not null default gen_random_uuid(),
  empresa text not null,
  titulo text not null,
  descricao text,
  data_planejada date not null,
  data_publicacao date,
  link_drive text,
  status text not null default 'planejado'::text,
  feedback_gestor text,
  criado_por uuid not null,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.premios (
  id uuid not null default gen_random_uuid(),
  empresa text not null,
  escopo text not null,
  periodo text not null,
  descricao text not null,
  vencedor_id uuid,
  pontos_na_apuracao numeric,
  entregue boolean not null default false,
  definido_por uuid,
  criado_em timestamp with time zone not null default now()
);

create table if not exists public.profiles (
  id uuid not null,
  nome text not null,
  empresa text not null,
  cargo text not null default 'Vendedor'::text,
  created_at timestamp with time zone not null default now(),
  ativo boolean not null default true,
  agenda_token uuid default gen_random_uuid(),
  telefone text,
  gestor_mestre boolean not null default false,
  gestor_aprovado boolean not null default false,
  aprovado_por uuid,
  aprovado_em timestamp with time zone,
  permissoes jsonb not null default '{}'::jsonb,
  excluido_em timestamp with time zone,
  excluido_por uuid,
  excluido_motivo text,
  foto_url text
);

create table if not exists public.ranking_config (
  id boolean not null default true,
  bonus_crm_minimo integer not null default 80,
  bonus_descricao text default 'Bônus mensal da equipe'::text,
  mf_no_ranking_do_grupo boolean not null default false,
  atualizado_em timestamp with time zone not null default now()
);

create table if not exists public.ranking_criterios (
  id uuid not null default gen_random_uuid(),
  medida text not null,
  titulo text not null,
  descricao text,
  peso numeric not null default 1,
  meta_mes numeric not null default 1,
  categoria_alvo text,
  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_em timestamp with time zone not null default now()
);

create table if not exists public.relacionamentos (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  empresa text not null,
  nome text not null,
  categoria text not null,
  cidade text,
  telefone text,
  instagram text,
  influencia smallint,
  potencial smallint,
  indice_relacionamento smallint,
  status_selo text,
  temperatura text not null default 'ativo'::text,
  ultimo_contato text default 'hoje'::text,
  proximo_contato text default 'a definir'::text,
  obras_indicadas integer not null default 0,
  valor_gerado numeric not null default 0,
  observacao text default ''::text,
  status_relacionamento text,
  created_at timestamp with time zone not null default now(),
  tags text[] not null default '{}'::text[],
  empresa_cliente text,
  email text,
  estado text,
  telefone_normalizado text,
  email_normalizado text,
  ultimo_contato_em timestamp with time zone,
  proximo_contato_em timestamp with time zone,
  updated_at timestamp with time zone not null default now(),
  origem text,
  origem_lead origem_lead,
  campanha_id uuid,
  parceiro_id uuid,
  parceria_em timestamp with time zone,
  parceria_motivo text,
  percentual_parceiro numeric(5,2) not null default 50,
  endereco text,
  responsavel text
);

create table if not exists public.relatorios_periodicos (
  id uuid not null default gen_random_uuid(),
  empresa text not null,
  vendedor_id uuid,
  tipo text not null,
  periodo_inicio date not null,
  periodo_fim date not null,
  conteudo text not null,
  dados_json jsonb,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.site_chat_config (
  empresa text not null,
  ativo boolean not null default true,
  saudacao text not null default 'Olá! Sou o seu ajudante pessoal da MF. Escreva sempre que tiver dúvidas.'::text,
  atendente_padrao_id uuid,
  cor text not null default '#CD1C1B'::text,
  atalhos jsonb not null default '[]'::jsonb,
  whatsapp text,
  horario jsonb not null default '{}'::jsonb,
  mensagem_fora_horario text not null default 'Agora estamos fora do horário de atendimento. Deixe a sua mensagem que a equipe responde assim que voltar.'::text,
  updated_at timestamp with time zone not null default now(),
  ia_ativa boolean not null default true,
  ia_sem_ninguem boolean not null default false,
  logo_url text
);

create table if not exists public.site_conversas (
  id uuid not null default gen_random_uuid(),
  empresa text not null default 'MF International'::text,
  envio_id uuid,
  lead_id uuid,
  token_hash text not null,
  nome text,
  telefone text,
  email text,
  cidade text,
  status text not null default 'aberta'::text,
  atendente_id uuid,
  nao_lidas integer not null default 0,
  ultima_mensagem text,
  ultima_em timestamp with time zone not null default now(),
  visitante_visto_em timestamp with time zone,
  origem_url text,
  ip_hash text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.site_envios (
  id uuid not null default gen_random_uuid(),
  empresa text not null,
  formulario_id uuid,
  pagina_id uuid,
  dados jsonb not null default '{}'::jsonb,
  nome text,
  telefone text,
  email text,
  cidade text,
  perfil text,
  origem_url text,
  utm jsonb,
  lead_id uuid,
  transferido_para text,
  transferido_em timestamp with time zone,
  transferido_por uuid,
  ip_hash text,
  created_at timestamp with time zone not null default now(),
  destino text not null default 'lead'::text,
  etapa text not null default 'novo'::text,
  responsavel_id uuid,
  nota text
);

create table if not exists public.site_formularios (
  id uuid not null default gen_random_uuid(),
  empresa text not null default 'MF International'::text,
  nome text not null,
  slug text not null,
  titulo text,
  descricao text,
  campos jsonb not null default '[]'::jsonb,
  botao_texto text not null default 'Enviar'::text,
  mensagem_sucesso text not null default 'Recebemos seus dados! Em breve a nossa equipe entra em contato.'::text,
  material_nome text,
  material_url text,
  cor text not null default '#CD1C1B'::text,
  ativo boolean not null default true,
  criado_por uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  destino text not null default 'lead'::text,
  imagem_fundo text
);

create table if not exists public.site_mensagens (
  id uuid not null default gen_random_uuid(),
  conversa_id uuid not null,
  autor text not null,
  autor_id uuid,
  autor_nome text,
  texto text not null default ''::text,
  created_at timestamp with time zone not null default now(),
  anexo_url text,
  anexo_tipo text,
  anexo_nome text,
  anexo_tamanho integer
);

create table if not exists public.site_paginas (
  id uuid not null default gen_random_uuid(),
  empresa text not null default 'MF International'::text,
  titulo text not null,
  slug text not null,
  blocos jsonb not null default '[]'::jsonb,
  formulario_id uuid,
  cor text not null default '#CD1C1B'::text,
  tema text not null default 'escuro'::text,
  seo_titulo text,
  seo_descricao text,
  publicada boolean not null default false,
  criado_por uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.site_presenca (
  profile_id uuid not null,
  empresa text not null default 'MF International'::text,
  disponivel boolean not null default true,
  visto_em timestamp with time zone not null default now()
);

create table if not exists public.tarefas (
  id uuid not null default gen_random_uuid(),
  vendedor_id uuid not null,
  titulo text not null,
  descricao text,
  concluida boolean default false,
  prioridade text default 'media'::text,
  criada_em timestamp without time zone default now(),
  updated_at timestamp without time zone default now(),
  origem text not null default 'vendedor'::text
);

create table if not exists public.transferencias_carteira (
  id uuid not null default gen_random_uuid(),
  empresa text not null,
  usuario_origem_id uuid not null,
  usuario_destino_id uuid not null,
  criado_por uuid not null,
  motivo text,
  relacionamentos_transferidos integer not null default 0,
  oportunidades_transferidas integer not null default 0,
  desativou_origem boolean not null default false,
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.treinamento_progresso (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  treinamento_id uuid not null,
  concluido boolean not null default false,
  concluido_em timestamp with time zone
);

create table if not exists public.treinamentos (
  id uuid not null default gen_random_uuid(),
  empresa text not null,
  titulo text not null,
  descricao text,
  categoria text,
  link text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.vendas (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  empresa text not null,
  cliente text not null,
  produto text default 'Não especificado'::text,
  valor numeric not null,
  forma_pagamento text,
  origem text,
  data date not null default CURRENT_DATE,
  created_at timestamp with time zone not null default now(),
  orcamento_path text,
  orcamento_nome text,
  descricao text,
  loja text,
  status text,
  relacionamento_id uuid,
  oportunidade_id uuid,
  valor_original numeric(14,2),
  valor_fechado numeric(14,2),
  desconto_valor numeric(14,2) not null default 0,
  desconto_percentual numeric(7,4) not null default 0,
  quantidade_parcelas integer not null default 1,
  valor_parcela numeric(14,2),
  entrada_valor numeric(14,2) not null default 0,
  taxa_financeira numeric(7,4) not null default 0,
  comissao_base numeric(14,2),
  comissao_percentual numeric(7,4),
  comissao_valor numeric(14,2),
  indicador_id uuid,
  updated_at timestamp with time zone not null default now(),
  origem_lead origem_lead,
  campanha_id uuid,
  parceiro_id uuid,
  percentual_parceiro numeric(5,2) not null default 0
);

create table if not exists public.whatsapp_auth_state (
  id text not null,
  valor jsonb not null,
  atualizado_em timestamp with time zone not null default now()
);

create table if not exists public.whatsapp_contactos (
  id uuid not null default gen_random_uuid(),
  phone_number_id text not null,
  telefone text not null,
  nome text,
  avatar_url text,
  tipo text not null default 'contacto'::text,
  actualizado_em timestamp with time zone not null default now()
);

create table if not exists public.whatsapp_conversas (
  id uuid not null default gen_random_uuid(),
  empresa text not null,
  phone_number_id text not null,
  telefone text not null,
  nome_cliente text,
  lead_id uuid,
  atendente_id uuid,
  status text not null default 'aguardando_aceite'::text,
  ia_ativa boolean not null default false,
  ultima_mensagem_em timestamp with time zone,
  ultima_mensagem_preview text,
  created_at timestamp with time zone not null default now(),
  avatar_url text,
  nao_lidas integer not null default 0,
  arquivada boolean not null default false,
  fixada boolean not null default false,
  silenciada boolean not null default false,
  presenca text,
  ultima_presenca_em timestamp with time zone,
  lead_sugerido boolean not null default false,
  confianca_lead numeric,
  motivo_sugestao text
);

create table if not exists public.whatsapp_ia_leads (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  empresa text,
  chat_jid text not null,
  telefone text,
  nome text,
  relacionamento_id uuid,
  oportunidade_id uuid,
  etapa text,
  ignorado boolean not null default false,
  resumo text,
  proxima_acao text,
  dicas jsonb not null default '[]'::jsonb,
  alertas jsonb not null default '[]'::jsonb,
  historico jsonb not null default '[]'::jsonb,
  interesse text,
  valor_estimado numeric,
  ultimo_msg_id text,
  ultima_analise_em timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  lead_sugerido boolean not null default false,
  confianca_lead numeric,
  motivo_sugestao text,
  natureza text,
  categoria text,
  motivo_natureza text,
  classificado_em timestamp with time zone,
  classificado_por uuid,
  categoria_sugerida text,
  auto_enviado_em timestamp with time zone,
  auto_texto text,
  parceiro_id uuid,
  anuncio_titulo text,
  anuncio_id text,
  anuncio_url text,
  anuncio_plataforma text,
  anuncio_clique_id text,
  anuncio_em timestamp with time zone,
  campanha_id uuid,
  carteira_relacionamento_id uuid,
  carteira_em timestamp with time zone,
  pergunta_lead_em timestamp with time zone
);

create table if not exists public.whatsapp_mensagens (
  id uuid not null default gen_random_uuid(),
  conversa_id uuid not null,
  phone_number_id text not null,
  whatsapp_message_id text,
  remetente text not null,
  texto text not null,
  enviado_por uuid,
  lida boolean not null default false,
  created_at timestamp with time zone not null default now(),
  tipo text not null default 'text'::text,
  media_url text,
  thumbnail_url text,
  quoted_message_id uuid,
  reacao text,
  editada_em timestamp with time zone,
  apagada_em timestamp with time zone,
  agent_processed boolean default false,
  vendor_id uuid
);

create table if not exists public.whatsapp_status (
  id integer not null default 1,
  conectado boolean not null default false,
  numero text,
  qr_code text,
  ultimo_erro text,
  atualizado_em timestamp with time zone not null default now()
);

create table if not exists public.whatsapp_transcricoes (
  msg_id text not null,
  owner_id uuid,
  empresa text,
  chat_jid text,
  texto text not null,
  bytes integer,
  criado_em timestamp with time zone not null default now()
);

alter table public.acoes_pendentes_aprovacao add constraint acoes_pendentes_aprovacao_pkey PRIMARY KEY (id);
alter table public.agent_auto_responses add constraint agent_auto_responses_pkey PRIMARY KEY (id);
alter table public.agent_notifications add constraint agent_notifications_pkey PRIMARY KEY (id);
alter table public.agent_suggestions add constraint agent_suggestions_pkey PRIMARY KEY (id);
alter table public.atividades add constraint atividades_pkey PRIMARY KEY (id);
alter table public.aura_agent_logs add constraint aura_agent_logs_pkey PRIMARY KEY (id);
alter table public.aura_aprendizado add constraint aura_aprendizado_pkey PRIMARY KEY (id);
alter table public.aura_aprendizado_origem add constraint aura_aprendizado_origem_pkey PRIMARY KEY (id);
alter table public.aura_cobrancas add constraint aura_cobrancas_pkey PRIMARY KEY (id);
alter table public.aura_feedback_fechamento add constraint aura_feedback_fechamento_pkey PRIMARY KEY (id);
alter table public.aura_materiais add constraint aura_materiais_pkey PRIMARY KEY (id);
alter table public.aura_material_trechos add constraint aura_material_trechos_pkey PRIMARY KEY (id);
alter table public.aura_recomendacoes add constraint aura_recomendacoes_pkey PRIMARY KEY (id);
alter table public.aura_sugestoes_resultado add constraint aura_sugestoes_resultado_pkey PRIMARY KEY (id);
alter table public.aura_supervisoes add constraint aura_supervisoes_pkey PRIMARY KEY (id);
alter table public.campanhas_marketing add constraint campanhas_marketing_pkey PRIMARY KEY (id);
alter table public.coach_conversas add constraint coach_conversas_pkey PRIMARY KEY (id);
alter table public.coach_mensagens add constraint coach_mensagens_pkey PRIMARY KEY (id);
alter table public.compromisso_mensal_campos add constraint compromisso_mensal_campos_pkey PRIMARY KEY (id);
alter table public.compromissos add constraint compromissos_pkey PRIMARY KEY (id);
alter table public.compromissos_mensais add constraint compromissos_mensais_pkey PRIMARY KEY (id);
alter table public.config_atendimento add constraint config_atendimento_pkey PRIMARY KEY (empresa);
alter table public.config_avaliacao add constraint config_avaliacao_pkey PRIMARY KEY (empresa);
alter table public.config_distribuicao_leads add constraint config_distribuicao_leads_pkey PRIMARY KEY (empresa);
alter table public.emails_enviados add constraint emails_enviados_pkey PRIMARY KEY (id);
alter table public.etapas_funil add constraint etapas_funil_pkey PRIMARY KEY (id);
alter table public.ia_config add constraint ia_config_pkey PRIMARY KEY (id);
alter table public.ia_creditos add constraint ia_creditos_pkey PRIMARY KEY (id);
alter table public.ia_falhas add constraint ia_falhas_pkey PRIMARY KEY (id);
alter table public.ia_uso add constraint ia_uso_pkey PRIMARY KEY (id);
alter table public.indicadores_semanais add constraint indicadores_semanais_pkey PRIMARY KEY (id);
alter table public.leads_recebidos add constraint leads_recebidos_pkey PRIMARY KEY (id);
alter table public.links_uteis add constraint links_uteis_pkey PRIMARY KEY (id);
alter table public.mensagens_whatsapp add constraint mensagens_whatsapp_pkey PRIMARY KEY (id);
alter table public.meta_comentarios add constraint meta_comentarios_pkey PRIMARY KEY (id);
alter table public.meta_contas add constraint meta_contas_pkey PRIMARY KEY (id);
alter table public.meta_conversas add constraint meta_conversas_pkey PRIMARY KEY (id);
alter table public.meta_mensagens add constraint meta_mensagens_pkey PRIMARY KEY (id);
alter table public.metas add constraint metas_pkey PRIMARY KEY (id);
alter table public.metas_atividade add constraint metas_atividade_pkey PRIMARY KEY (id);
alter table public.metas_indicadores add constraint metas_indicadores_pkey PRIMARY KEY (id);
alter table public.motivos_perda add constraint motivos_perda_pkey PRIMARY KEY (id);
alter table public.niveis_performance add constraint niveis_performance_pkey PRIMARY KEY (id);
alter table public.notificacoes add constraint notificacoes_pkey PRIMARY KEY (id);
alter table public.oportunidades add constraint oportunidades_pkey PRIMARY KEY (id);
alter table public.orcamentos_anexos add constraint orcamentos_anexos_pkey PRIMARY KEY (id);
alter table public.pedidos_avaliacao add constraint pedidos_avaliacao_pkey PRIMARY KEY (id);
alter table public.perguntas_frequentes add constraint perguntas_frequentes_pkey PRIMARY KEY (id);
alter table public.perguntas_qualificacao add constraint perguntas_qualificacao_pkey PRIMARY KEY (id);
alter table public.planilha_leads_indicadores add constraint planilha_leads_indicadores_pkey PRIMARY KEY (id);
alter table public.planilha_linhas add constraint planilha_linhas_pkey PRIMARY KEY (id);
alter table public.playbook add constraint playbook_pkey PRIMARY KEY (empresa);
alter table public.pontuacao_regras add constraint pontuacao_regras_pkey PRIMARY KEY (id);
alter table public.pos_venda_notas add constraint pos_venda_notas_pkey PRIMARY KEY (id);
alter table public.pos_vendas add constraint pos_vendas_pkey PRIMARY KEY (id);
alter table public.postagens_marketing add constraint postagens_marketing_pkey PRIMARY KEY (id);
alter table public.premios add constraint premios_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.ranking_config add constraint ranking_config_pkey PRIMARY KEY (id);
alter table public.ranking_criterios add constraint ranking_criterios_pkey PRIMARY KEY (id);
alter table public.relacionamentos add constraint relacionamentos_pkey PRIMARY KEY (id);
alter table public.relatorios_periodicos add constraint relatorios_periodicos_pkey PRIMARY KEY (id);
alter table public.site_chat_config add constraint site_chat_config_pkey PRIMARY KEY (empresa);
alter table public.site_conversas add constraint site_conversas_pkey PRIMARY KEY (id);
alter table public.site_envios add constraint site_envios_pkey PRIMARY KEY (id);
alter table public.site_formularios add constraint site_formularios_pkey PRIMARY KEY (id);
alter table public.site_mensagens add constraint site_mensagens_pkey PRIMARY KEY (id);
alter table public.site_paginas add constraint site_paginas_pkey PRIMARY KEY (id);
alter table public.site_presenca add constraint site_presenca_pkey PRIMARY KEY (profile_id);
alter table public.tarefas add constraint tarefas_pkey PRIMARY KEY (id);
alter table public.transferencias_carteira add constraint transferencias_carteira_pkey PRIMARY KEY (id);
alter table public.treinamento_progresso add constraint treinamento_progresso_pkey PRIMARY KEY (id);
alter table public.treinamentos add constraint treinamentos_pkey PRIMARY KEY (id);
alter table public.vendas add constraint vendas_pkey PRIMARY KEY (id);
alter table public.whatsapp_auth_state add constraint whatsapp_auth_state_pkey PRIMARY KEY (id);
alter table public.whatsapp_contactos add constraint whatsapp_contactos_pkey PRIMARY KEY (id);
alter table public.whatsapp_conversas add constraint whatsapp_conversas_pkey PRIMARY KEY (id);
alter table public.whatsapp_ia_leads add constraint whatsapp_ia_leads_pkey PRIMARY KEY (id);
alter table public.whatsapp_mensagens add constraint whatsapp_mensagens_pkey PRIMARY KEY (id);
alter table public.whatsapp_status add constraint whatsapp_status_pkey PRIMARY KEY (id);
alter table public.whatsapp_transcricoes add constraint whatsapp_transcricoes_pkey PRIMARY KEY (msg_id);
alter table public.agent_suggestions add constraint agent_suggestions_related_message_id_type_key UNIQUE (related_message_id, type);
alter table public.aura_aprendizado_origem add constraint aura_aprendizado_origem_aprendizado_id_owner_id_chat_jid_key UNIQUE (aprendizado_id, owner_id, chat_jid);
alter table public.aura_cobrancas add constraint aura_cobrancas_vendedor_id_dia_key UNIQUE (vendedor_id, dia);
alter table public.compromisso_mensal_campos add constraint compromisso_mensal_campos_chave_key UNIQUE (chave);
alter table public.compromissos_mensais add constraint compromissos_mensais_vendedor_id_mes_key UNIQUE (vendedor_id, mes);
alter table public.etapas_funil add constraint etapas_funil_empresa_nome_key UNIQUE (empresa, nome);
alter table public.indicadores_semanais add constraint indicadores_semanais_vendedor_id_mes_semana_metrica_key UNIQUE (vendedor_id, mes, semana, metrica);
alter table public.meta_comentarios add constraint meta_comentarios_comentario_id_key UNIQUE (comentario_id);
alter table public.meta_contas add constraint meta_contas_empresa_key UNIQUE (empresa);
alter table public.meta_conversas add constraint meta_conversas_conta_id_ig_thread_id_key UNIQUE (conta_id, ig_thread_id);
alter table public.meta_mensagens add constraint meta_mensagens_mid_key UNIQUE (mid);
alter table public.metas add constraint metas_owner_id_mes_key UNIQUE (owner_id, mes);
alter table public.metas_atividade add constraint metas_atividade_vendedor_id_categoria_periodo_key UNIQUE (vendedor_id, categoria, periodo);
alter table public.metas_indicadores add constraint metas_indicadores_vendedor_id_mes_metrica_key UNIQUE (vendedor_id, mes, metrica);
alter table public.motivos_perda add constraint motivos_perda_motivo_key UNIQUE (motivo);
alter table public.pedidos_avaliacao add constraint pedidos_avaliacao_token_key UNIQUE (token);
alter table public.planilha_leads_indicadores add constraint planilha_leads_indicadores_usuario_id_indicador_mes_ano_key UNIQUE (usuario_id, indicador, mes, ano);
alter table public.planilha_linhas add constraint planilha_linhas_empresa_titulo_key UNIQUE (empresa, titulo);
alter table public.pos_vendas add constraint pos_vendas_token_avaliacao_key UNIQUE (token_avaliacao);
alter table public.pos_vendas add constraint pos_vendas_venda_id_key UNIQUE (venda_id);
alter table public.site_formularios add constraint site_formularios_slug_key UNIQUE (slug);
alter table public.site_paginas add constraint site_paginas_slug_key UNIQUE (slug);
alter table public.treinamento_progresso add constraint treinamento_progresso_owner_id_treinamento_id_key UNIQUE (owner_id, treinamento_id);
alter table public.whatsapp_contactos add constraint whatsapp_contactos_phone_number_id_telefone_key UNIQUE (phone_number_id, telefone);
alter table public.whatsapp_conversas add constraint whatsapp_conversas_phone_number_id_telefone_key UNIQUE (phone_number_id, telefone);
alter table public.whatsapp_ia_leads add constraint whatsapp_ia_leads_owner_id_chat_jid_key UNIQUE (owner_id, chat_jid);
alter table public.whatsapp_mensagens add constraint whatsapp_mensagens_whatsapp_message_id_key UNIQUE (whatsapp_message_id);
alter table public.agent_suggestions add constraint agent_suggestions_confidence_check CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric)));
alter table public.agent_suggestions add constraint agent_suggestions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'viewed'::text, 'applied'::text, 'dismissed'::text])));
alter table public.agent_suggestions add constraint agent_suggestions_type_check CHECK ((type = ANY (ARRAY['opportunity'::text, 'follow_up'::text, 'objection_handling'::text, 'negotiation'::text, 'upsell'::text, 'retention'::text])));
alter table public.atividades add constraint atividades_latitude_check CHECK (((latitude IS NULL) OR ((latitude >= ('-90'::integer)::double precision) AND (latitude <= (90)::double precision))));
alter table public.atividades add constraint atividades_longitude_check CHECK (((longitude IS NULL) OR ((longitude >= ('-180'::integer)::double precision) AND (longitude <= (180)::double precision))));
alter table public.atividades add constraint atividades_precisao_check CHECK (((precisao_metros IS NULL) OR (precisao_metros >= (0)::double precision)));
alter table public.aura_aprendizado add constraint aura_aprendizado_canal_check CHECK ((canal = ANY (ARRAY['whatsapp'::text, 'instagram'::text, 'manual'::text])));
alter table public.aura_aprendizado add constraint aura_aprendizado_status_check CHECK ((status = ANY (ARRAY['sugerido'::text, 'aprovado'::text, 'recusado'::text])));
alter table public.aura_aprendizado add constraint aura_aprendizado_tipo_check CHECK ((tipo = ANY (ARRAY['objecao'::text, 'pergunta'::text, 'abordagem'::text])));
alter table public.aura_aprendizado_origem add constraint aura_aprendizado_origem_resultado_check CHECK ((resultado = ANY (ARRAY['fechado'::text, 'perdido'::text])));
alter table public.aura_feedback_fechamento add constraint aura_feedback_fechamento_resultado_check CHECK ((resultado = ANY (ARRAY['fechado'::text, 'perdido'::text])));
alter table public.aura_recomendacoes add constraint aura_recomendacoes_prioridade_check CHECK ((prioridade = ANY (ARRAY['urgente'::text, 'alta'::text, 'media'::text, 'baixa'::text])));
alter table public.aura_recomendacoes add constraint aura_recomendacoes_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'concluida'::text, 'dispensada'::text])));
alter table public.aura_sugestoes_resultado add constraint aura_sugestoes_resultado_uso_check CHECK ((uso = ANY (ARRAY['usou'::text, 'adaptou'::text, 'ignorou'::text, 'automatica'::text])));
alter table public.aura_supervisoes add constraint aura_supervisoes_score_check CHECK (((score >= 0) AND (score <= 100)));
alter table public.campanhas_marketing add constraint campanhas_marketing_status_check CHECK ((status = ANY (ARRAY['planejada'::text, 'ativa'::text, 'pausada'::text, 'encerrada'::text])));
alter table public.coach_mensagens add constraint coach_mensagens_autor_check CHECK ((autor = ANY (ARRAY['usuario'::text, 'aura'::text])));
alter table public.compromisso_mensal_campos add constraint compromisso_mensal_campos_tipo_check CHECK ((tipo = ANY (ARRAY['numero'::text, 'moeda'::text, 'texto'::text])));
alter table public.compromissos add constraint compromissos_tipo_check CHECK ((tipo = ANY (ARRAY['Visita'::text, 'Reunião'::text, 'Follow-up'::text, 'Ligação'::text, 'Outro'::text])));
alter table public.compromissos_mensais add constraint compromissos_mensais_status_check CHECK ((status = ANY (ARRAY['rascunho'::text, 'pendente_aprovacao'::text, 'aprovado'::text, 'ajuste_solicitado'::text, 'rejeitado'::text])));
alter table public.etapas_funil add constraint etapas_funil_probabilidade_check CHECK ((probabilidade = ANY (ARRAY['Baixa'::text, 'Média'::text, 'Alta'::text])));
alter table public.etapas_funil add constraint etapas_funil_tipo_check CHECK ((tipo = ANY (ARRAY['aberta'::text, 'ganho'::text, 'perda'::text, 'posvenda'::text])));
alter table public.ia_config add constraint ia_config_id_check CHECK (id);
alter table public.indicadores_semanais add constraint indicadores_semanais_metrica_check CHECK ((metrica = ANY (ARRAY['leads_loja'::text, 'leads_mf'::text, 'leads_marketing'::text, 'faturamento_loja'::text, 'faturamento_mf'::text, 'faturamento_marketing'::text, 'vendas_loja'::text, 'vendas_mf'::text, 'vendas_marketing'::text])));
alter table public.indicadores_semanais add constraint indicadores_semanais_semana_check CHECK (((semana >= 1) AND (semana <= 5)));
alter table public.leads_recebidos add constraint leads_recebidos_natureza_valida CHECK (((natureza IS NULL) OR (natureza = ANY (ARRAY['lead'::text, 'nao_lead'::text, 'cliente'::text]))));
alter table public.leads_recebidos add constraint leads_recebidos_status_check CHECK ((status = ANY (ARRAY['aguardando_sdr'::text, 'atribuido_sdr'::text, 'respondido'::text, 'repassado_vendedor'::text, 'perdido'::text, 'lead_frio'::text])));
alter table public.metas add constraint metas_tipo_periodo_check CHECK ((tipo_periodo = ANY (ARRAY['mensal'::text, 'anual'::text])));
alter table public.metas_atividade add constraint metas_atividade_categoria_check CHECK ((categoria = ANY (ARRAY['Cliente Final'::text, 'Arquiteto'::text, 'Construtora'::text, 'Obra'::text, 'Consultor'::text, 'Revendedor'::text, 'Engenheiro'::text, 'Designer de Interiores'::text])));
alter table public.metas_atividade add constraint metas_atividade_periodo_check CHECK ((periodo = ANY (ARRAY['semanal'::text, 'mensal'::text])));
alter table public.metas_indicadores add constraint metas_indicadores_metrica_check CHECK ((metrica = ANY (ARRAY['prospeccao_total'::text, 'leads_loja'::text, 'leads_mf'::text, 'leads_marketing'::text, 'leads_proprio'::text, 'leads_indicacao'::text, 'faturamento_loja'::text, 'faturamento_mf'::text, 'faturamento_marketing'::text, 'faturamento_proprio'::text, 'faturamento_indicacao'::text, 'vendas_loja'::text, 'vendas_mf'::text, 'vendas_marketing'::text, 'vendas_proprio'::text, 'vendas_indicacao'::text])));
alter table public.oportunidades add constraint oportunidades_percentual_parceiro_faixa CHECK (((percentual_parceiro >= (0)::numeric) AND (percentual_parceiro <= (100)::numeric)));
alter table public.oportunidades add constraint oportunidades_probabilidade_check CHECK ((probabilidade = ANY (ARRAY['Baixa'::text, 'Média'::text, 'Alta'::text])));
alter table public.pedidos_avaliacao add constraint pedidos_avaliacao_canal_check CHECK ((canal = ANY (ARRAY['google'::text, 'instagram'::text, 'facebook'::text])));
alter table public.planilha_leads_indicadores add constraint planilha_leads_indicadores_tipo_check CHECK ((tipo = ANY (ARRAY['Avg'::text, 'Total'::text])));
alter table public.pontuacao_regras add constraint pontuacao_regras_pontos_check CHECK ((pontos >= (0)::numeric));
alter table public.pontuacao_regras add constraint pontuacao_regras_tipo_check CHECK ((tipo = ANY (ARRAY['atividade'::text, 'etapa'::text])));
alter table public.pos_vendas add constraint pos_vendas_avaliacao_check CHECK (((avaliacao_nota IS NULL) OR ((avaliacao_nota >= 1) AND (avaliacao_nota <= 5))));
alter table public.pos_vendas add constraint pos_vendas_nota_avaliacao_check CHECK (((nota_avaliacao >= 1) AND (nota_avaliacao <= 5)));
alter table public.pos_vendas add constraint pos_vendas_origem_check CHECK ((origem = ANY (ARRAY['venda'::text, 'cliente_antigo'::text])));
alter table public.pos_vendas add constraint pos_vendas_status_check CHECK ((status = ANY (ARRAY['aguardando_instalacao'::text, 'agendamento_realizado'::text, 'instalacao_pendente'::text, 'reclamacao'::text, 'pos_venda_realizado'::text, 'cliente_antigo'::text])));
alter table public.pos_vendas add constraint pos_vendas_venda_ou_cliente_antigo CHECK (((venda_id IS NOT NULL) OR (origem = 'cliente_antigo'::text)));
alter table public.postagens_marketing add constraint postagens_marketing_status_check CHECK ((status = ANY (ARRAY['planejado'::text, 'aguardando_aprovacao'::text, 'aprovado'::text, 'publicado'::text, 'rejeitado'::text])));
alter table public.premios add constraint premio_periodo_no_formato CHECK ((((escopo = 'mensal'::text) AND (periodo ~ '^\d{4}-\d{2}$'::text)) OR ((escopo = 'anual'::text) AND (periodo ~ '^\d{4}$'::text))));
alter table public.premios add constraint premios_escopo_check CHECK ((escopo = ANY (ARRAY['mensal'::text, 'anual'::text])));
alter table public.profiles add constraint profiles_empresa_check CHECK ((empresa = ANY (ARRAY['MF International'::text, 'LF Lareiras'::text, 'A&G Aquecimento'::text, 'Sole Aquecimento'::text])));
alter table public.ranking_config add constraint ranking_config_bonus_crm_minimo_check CHECK (((bonus_crm_minimo >= 0) AND (bonus_crm_minimo <= 100)));
alter table public.ranking_config add constraint ranking_config_id_check CHECK (id);
alter table public.ranking_criterios add constraint ranking_criterios_medida_check CHECK ((medida = ANY (ARRAY['avaliacao_conquistada'::text, 'avaliacao_enviada'::text, 'recompra'::text, 'prospeccao_fechada'::text, 'venda_nova'::text, 'venda_lead'::text, 'faturamento'::text, 'prospeccao'::text, 'lead_recebido'::text, 'negociacao'::text, 'atividades'::text, 'crm_em_dia'::text])));
alter table public.ranking_criterios add constraint ranking_criterios_meta_mes_check CHECK ((meta_mes > (0)::numeric));
alter table public.ranking_criterios add constraint ranking_criterios_peso_check CHECK (((peso >= (0)::numeric) AND (peso <= (10)::numeric)));
alter table public.relacionamentos add constraint relacionamentos_categoria_check CHECK ((categoria = ANY (ARRAY['Cliente Final'::text, 'Cliente'::text, 'Arquiteto'::text, 'Construtora'::text, 'Obra'::text, 'Consultor'::text, 'Revendedor'::text, 'Engenheiro'::text, 'Designer de Interiores'::text, 'Distribuidor'::text, 'Outro'::text])));
alter table public.relacionamentos add constraint relacionamentos_percentual_parceiro_faixa CHECK (((percentual_parceiro >= (0)::numeric) AND (percentual_parceiro <= (100)::numeric)));
alter table public.relacionamentos add constraint relacionamentos_temperatura_check CHECK ((temperatura = ANY (ARRAY['quente'::text, 'ativo'::text, 'esfriando'::text, 'frio'::text])));
alter table public.relatorios_periodicos add constraint relatorios_periodicos_tipo_check CHECK ((tipo = ANY (ARRAY['semanal_vendedor'::text, 'semanal_gestor'::text, 'mensal_diretor'::text])));
alter table public.site_chat_config add constraint site_chat_config_atalhos_check CHECK ((jsonb_typeof(atalhos) = 'array'::text));
alter table public.site_chat_config add constraint site_chat_config_cor_check CHECK ((cor ~ '^#[0-9A-Fa-f]{6}$'::text));
alter table public.site_conversas add constraint site_conversas_status_check CHECK ((status = ANY (ARRAY['aberta'::text, 'encerrada'::text])));
alter table public.site_envios add constraint site_envios_destino_check CHECK ((destino = ANY (ARRAY['lead'::text, 'cliente'::text])));
alter table public.site_envios add constraint site_envios_etapa_check CHECK ((etapa = ANY (ARRAY['novo'::text, 'em_atendimento'::text, 'resolvido'::text])));
alter table public.site_formularios add constraint site_formularios_campos_check CHECK ((jsonb_typeof(campos) = 'array'::text));
alter table public.site_formularios add constraint site_formularios_cor_check CHECK ((cor ~ '^#[0-9A-Fa-f]{6}$'::text));
alter table public.site_formularios add constraint site_formularios_destino_check CHECK ((destino = ANY (ARRAY['lead'::text, 'cliente'::text])));
alter table public.site_formularios add constraint site_formularios_slug_check CHECK ((slug ~ '^[a-z0-9][a-z0-9-]{1,60}$'::text));
alter table public.site_mensagens add constraint site_mensagens_autor_check CHECK ((autor = ANY (ARRAY['visitante'::text, 'equipe'::text, 'sistema'::text, 'assistente'::text])));
alter table public.site_mensagens add constraint site_mensagens_texto_check CHECK (((char_length(texto) <= 2000) AND ((char_length(texto) >= 1) OR (anexo_url IS NOT NULL))));
alter table public.site_paginas add constraint site_paginas_blocos_check CHECK ((jsonb_typeof(blocos) = 'array'::text));
alter table public.site_paginas add constraint site_paginas_cor_check CHECK ((cor ~ '^#[0-9A-Fa-f]{6}$'::text));
alter table public.site_paginas add constraint site_paginas_slug_check CHECK ((slug ~ '^[a-z0-9][a-z0-9-]{1,60}$'::text));
alter table public.site_paginas add constraint site_paginas_tema_check CHECK ((tema = ANY (ARRAY['escuro'::text, 'claro'::text])));
alter table public.tarefas add constraint tarefas_origem_check CHECK ((origem = ANY (ARRAY['vendedor'::text, 'aura'::text, 'gestor'::text])));
alter table public.transferencias_carteira add constraint transferencias_usuarios_diferentes_check CHECK ((usuario_origem_id <> usuario_destino_id));
alter table public.vendas add constraint vendas_percentual_parceiro_check CHECK (((percentual_parceiro >= (0)::numeric) AND (percentual_parceiro <= (100)::numeric)));
alter table public.vendas add constraint vendas_valores_check CHECK (((COALESCE(valor_original, (0)::numeric) >= (0)::numeric) AND (COALESCE(valor_fechado, (0)::numeric) >= (0)::numeric) AND (desconto_valor >= (0)::numeric) AND ((desconto_percentual >= (0)::numeric) AND (desconto_percentual <= (100)::numeric)) AND (quantidade_parcelas >= 1) AND (entrada_valor >= (0)::numeric) AND (taxa_financeira >= (0)::numeric) AND ((comissao_percentual IS NULL) OR ((comissao_percentual >= (0)::numeric) AND (comissao_percentual <= (100)::numeric))) AND ((comissao_valor IS NULL) OR (comissao_valor >= (0)::numeric))));
alter table public.whatsapp_conversas add constraint whatsapp_conversas_status_check CHECK ((status = ANY (ARRAY['aguardando_aceite'::text, 'em_atendimento'::text, 'encerrada'::text])));
alter table public.whatsapp_ia_leads add constraint whatsapp_ia_leads_natureza_valida CHECK (((natureza IS NULL) OR (natureza = ANY (ARRAY['lead'::text, 'nao_lead'::text, 'cliente'::text]))));
alter table public.whatsapp_mensagens add constraint whatsapp_mensagens_remetente_check CHECK ((remetente = ANY (ARRAY['cliente'::text, 'vendedor'::text])));
alter table public.whatsapp_status add constraint whatsapp_status_id_check CHECK ((id = 1));
alter table public.acoes_pendentes_aprovacao add constraint acoes_pendentes_aprovacao_aprovado_por_fkey FOREIGN KEY (aprovado_por) REFERENCES auth.users(id);
alter table public.acoes_pendentes_aprovacao add constraint acoes_pendentes_aprovacao_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.agent_auto_responses add constraint agent_auto_responses_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.agent_notifications add constraint agent_notifications_related_suggestion_id_fkey FOREIGN KEY (related_suggestion_id) REFERENCES agent_suggestions(id) ON DELETE CASCADE;
alter table public.agent_notifications add constraint agent_notifications_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.agent_suggestions add constraint agent_suggestions_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES whatsapp_conversas(id) ON DELETE CASCADE;
alter table public.agent_suggestions add constraint agent_suggestions_related_message_id_fkey FOREIGN KEY (related_message_id) REFERENCES whatsapp_mensagens(id) ON DELETE SET NULL;
alter table public.agent_suggestions add constraint agent_suggestions_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.atividades add constraint atividades_campanha_id_fkey FOREIGN KEY (campanha_id) REFERENCES campanhas_marketing(id) ON DELETE SET NULL;
alter table public.atividades add constraint atividades_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.atividades add constraint atividades_relacionamento_id_fkey FOREIGN KEY (relacionamento_id) REFERENCES relacionamentos(id) ON DELETE SET NULL;
alter table public.aura_agent_logs add constraint aura_agent_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.aura_aprendizado add constraint aura_aprendizado_revisado_por_fkey FOREIGN KEY (revisado_por) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.aura_aprendizado_origem add constraint aura_aprendizado_origem_aprendizado_id_fkey FOREIGN KEY (aprendizado_id) REFERENCES aura_aprendizado(id) ON DELETE CASCADE;
alter table public.aura_cobrancas add constraint aura_cobrancas_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.aura_feedback_fechamento add constraint aura_feedback_fechamento_oportunidade_id_fkey FOREIGN KEY (oportunidade_id) REFERENCES oportunidades(id) ON DELETE SET NULL;
alter table public.aura_feedback_fechamento add constraint aura_feedback_fechamento_relacionamento_id_fkey FOREIGN KEY (relacionamento_id) REFERENCES relacionamentos(id) ON DELETE SET NULL;
alter table public.aura_feedback_fechamento add constraint aura_feedback_fechamento_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.aura_materiais add constraint aura_materiais_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.aura_material_trechos add constraint aura_material_trechos_material_id_fkey FOREIGN KEY (material_id) REFERENCES aura_materiais(id) ON DELETE CASCADE;
alter table public.aura_recomendacoes add constraint aura_recomendacoes_supervisao_id_fkey FOREIGN KEY (supervisao_id) REFERENCES aura_supervisoes(id) ON DELETE CASCADE;
alter table public.aura_recomendacoes add constraint aura_recomendacoes_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.aura_supervisoes add constraint aura_supervisoes_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.campanhas_marketing add constraint campanhas_marketing_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id);
alter table public.coach_conversas add constraint coach_conversas_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.coach_mensagens add constraint coach_mensagens_conversa_id_fkey FOREIGN KEY (conversa_id) REFERENCES coach_conversas(id) ON DELETE CASCADE;
alter table public.coach_mensagens add constraint coach_mensagens_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.compromissos add constraint compromissos_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.compromissos add constraint compromissos_relacionamento_id_fkey FOREIGN KEY (relacionamento_id) REFERENCES relacionamentos(id) ON DELETE SET NULL;
alter table public.compromissos_mensais add constraint compromissos_mensais_aprovado_por_fkey FOREIGN KEY (aprovado_por) REFERENCES auth.users(id);
alter table public.compromissos_mensais add constraint compromissos_mensais_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.compromissos_mensais add constraint fk_compromissos_vendedor FOREIGN KEY (vendedor_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.config_atendimento add constraint config_atendimento_atualizado_por_fkey FOREIGN KEY (atualizado_por) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.emails_enviados add constraint emails_enviados_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.ia_creditos add constraint ia_creditos_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.ia_falhas add constraint ia_falhas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.ia_uso add constraint ia_uso_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.indicadores_semanais add constraint indicadores_semanais_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.leads_recebidos add constraint leads_recebidos_descartado_por_fkey FOREIGN KEY (descartado_por) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.leads_recebidos add constraint leads_recebidos_relacionamento_id_fkey FOREIGN KEY (relacionamento_id) REFERENCES relacionamentos(id) ON DELETE SET NULL;
alter table public.leads_recebidos add constraint leads_recebidos_respondido_por_fkey FOREIGN KEY (respondido_por) REFERENCES auth.users(id);
alter table public.leads_recebidos add constraint leads_recebidos_sdr_id_fkey FOREIGN KEY (sdr_id) REFERENCES auth.users(id);
alter table public.leads_recebidos add constraint leads_recebidos_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES auth.users(id);
alter table public.mensagens_whatsapp add constraint mensagens_whatsapp_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.meta_comentarios add constraint meta_comentarios_conta_id_fkey FOREIGN KEY (conta_id) REFERENCES meta_contas(id) ON DELETE CASCADE;
alter table public.meta_contas add constraint meta_contas_conectado_por_fkey FOREIGN KEY (conectado_por) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.meta_conversas add constraint meta_conversas_conta_id_fkey FOREIGN KEY (conta_id) REFERENCES meta_contas(id) ON DELETE CASCADE;
alter table public.meta_conversas add constraint meta_conversas_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.meta_conversas add constraint meta_conversas_relacionamento_id_fkey FOREIGN KEY (relacionamento_id) REFERENCES relacionamentos(id) ON DELETE SET NULL;
alter table public.meta_mensagens add constraint meta_mensagens_conversa_id_fkey FOREIGN KEY (conversa_id) REFERENCES meta_conversas(id) ON DELETE CASCADE;
alter table public.metas add constraint metas_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.metas_atividade add constraint metas_atividade_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.metas_indicadores add constraint metas_indicadores_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.notificacoes add constraint notificacoes_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES auth.users(id);
alter table public.oportunidades add constraint oportunidades_campanha_id_fkey FOREIGN KEY (campanha_id) REFERENCES campanhas_marketing(id) ON DELETE SET NULL;
alter table public.oportunidades add constraint oportunidades_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.oportunidades add constraint oportunidades_parceiro_id_fkey FOREIGN KEY (parceiro_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.oportunidades add constraint oportunidades_relacionamento_id_fkey FOREIGN KEY (relacionamento_id) REFERENCES relacionamentos(id) ON DELETE SET NULL;
alter table public.orcamentos_anexos add constraint orcamentos_anexos_oportunidade_id_fkey FOREIGN KEY (oportunidade_id) REFERENCES oportunidades(id) ON DELETE CASCADE;
alter table public.orcamentos_anexos add constraint orcamentos_anexos_relacionamento_id_fkey FOREIGN KEY (relacionamento_id) REFERENCES relacionamentos(id) ON DELETE SET NULL;
alter table public.pedidos_avaliacao add constraint pedidos_avaliacao_venda_id_fkey FOREIGN KEY (venda_id) REFERENCES vendas(id) ON DELETE CASCADE;
alter table public.planilha_leads_indicadores add constraint planilha_leads_indicadores_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.planilha_linhas add constraint planilha_linhas_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.pos_venda_notas add constraint pos_venda_notas_pos_venda_id_fkey FOREIGN KEY (pos_venda_id) REFERENCES pos_vendas(id) ON DELETE CASCADE;
alter table public.pos_vendas add constraint pos_vendas_venda_id_fkey FOREIGN KEY (venda_id) REFERENCES vendas(id) ON DELETE CASCADE;
alter table public.postagens_marketing add constraint postagens_marketing_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id);
alter table public.premios add constraint premios_definido_por_fkey FOREIGN KEY (definido_por) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.premios add constraint premios_vencedor_id_fkey FOREIGN KEY (vencedor_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.relacionamentos add constraint relacionamentos_campanha_id_fkey FOREIGN KEY (campanha_id) REFERENCES campanhas_marketing(id) ON DELETE SET NULL;
alter table public.relacionamentos add constraint relacionamentos_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.relacionamentos add constraint relacionamentos_parceiro_id_fkey FOREIGN KEY (parceiro_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.relatorios_periodicos add constraint relatorios_periodicos_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.site_chat_config add constraint site_chat_config_atendente_padrao_id_fkey FOREIGN KEY (atendente_padrao_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.site_conversas add constraint site_conversas_atendente_id_fkey FOREIGN KEY (atendente_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.site_conversas add constraint site_conversas_envio_id_fkey FOREIGN KEY (envio_id) REFERENCES site_envios(id) ON DELETE SET NULL;
alter table public.site_conversas add constraint site_conversas_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads_recebidos(id) ON DELETE SET NULL;
alter table public.site_envios add constraint site_envios_formulario_id_fkey FOREIGN KEY (formulario_id) REFERENCES site_formularios(id) ON DELETE SET NULL;
alter table public.site_envios add constraint site_envios_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads_recebidos(id) ON DELETE SET NULL;
alter table public.site_envios add constraint site_envios_pagina_id_fkey FOREIGN KEY (pagina_id) REFERENCES site_paginas(id) ON DELETE SET NULL;
alter table public.site_envios add constraint site_envios_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.site_envios add constraint site_envios_transferido_por_fkey FOREIGN KEY (transferido_por) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.site_formularios add constraint site_formularios_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.site_mensagens add constraint site_mensagens_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.site_mensagens add constraint site_mensagens_conversa_id_fkey FOREIGN KEY (conversa_id) REFERENCES site_conversas(id) ON DELETE CASCADE;
alter table public.site_paginas add constraint site_paginas_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.site_paginas add constraint site_paginas_formulario_id_fkey FOREIGN KEY (formulario_id) REFERENCES site_formularios(id) ON DELETE SET NULL;
alter table public.site_presenca add constraint site_presenca_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.tarefas add constraint tarefas_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES auth.users(id);
alter table public.transferencias_carteira add constraint transferencias_carteira_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES profiles(id) ON DELETE RESTRICT;
alter table public.transferencias_carteira add constraint transferencias_carteira_usuario_destino_id_fkey FOREIGN KEY (usuario_destino_id) REFERENCES profiles(id) ON DELETE RESTRICT;
alter table public.transferencias_carteira add constraint transferencias_carteira_usuario_origem_id_fkey FOREIGN KEY (usuario_origem_id) REFERENCES profiles(id) ON DELETE RESTRICT;
alter table public.treinamento_progresso add constraint treinamento_progresso_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.treinamento_progresso add constraint treinamento_progresso_treinamento_id_fkey FOREIGN KEY (treinamento_id) REFERENCES treinamentos(id) ON DELETE CASCADE;
alter table public.vendas add constraint vendas_campanha_id_fkey FOREIGN KEY (campanha_id) REFERENCES campanhas_marketing(id) ON DELETE SET NULL;
alter table public.vendas add constraint vendas_indicador_id_fkey FOREIGN KEY (indicador_id) REFERENCES relacionamentos(id) ON DELETE SET NULL;
alter table public.vendas add constraint vendas_oportunidade_id_fkey FOREIGN KEY (oportunidade_id) REFERENCES oportunidades(id) ON DELETE SET NULL;
alter table public.vendas add constraint vendas_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.vendas add constraint vendas_parceiro_id_fkey FOREIGN KEY (parceiro_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.vendas add constraint vendas_relacionamento_id_fkey FOREIGN KEY (relacionamento_id) REFERENCES relacionamentos(id) ON DELETE SET NULL;
alter table public.whatsapp_ia_leads add constraint whatsapp_ia_leads_campanha_id_fkey FOREIGN KEY (campanha_id) REFERENCES campanhas_marketing(id) ON DELETE SET NULL;
alter table public.whatsapp_ia_leads add constraint whatsapp_ia_leads_carteira_relacionamento_id_fkey FOREIGN KEY (carteira_relacionamento_id) REFERENCES relacionamentos(id) ON DELETE SET NULL;
alter table public.whatsapp_ia_leads add constraint whatsapp_ia_leads_classificado_por_fkey FOREIGN KEY (classificado_por) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.whatsapp_ia_leads add constraint whatsapp_ia_leads_oportunidade_id_fkey FOREIGN KEY (oportunidade_id) REFERENCES oportunidades(id) ON DELETE SET NULL;
alter table public.whatsapp_ia_leads add constraint whatsapp_ia_leads_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.whatsapp_ia_leads add constraint whatsapp_ia_leads_parceiro_id_fkey FOREIGN KEY (parceiro_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.whatsapp_ia_leads add constraint whatsapp_ia_leads_relacionamento_id_fkey FOREIGN KEY (relacionamento_id) REFERENCES relacionamentos(id) ON DELETE SET NULL;
alter table public.whatsapp_mensagens add constraint whatsapp_mensagens_conversa_id_fkey FOREIGN KEY (conversa_id) REFERENCES whatsapp_conversas(id) ON DELETE CASCADE;
alter table public.whatsapp_mensagens add constraint whatsapp_mensagens_quoted_message_id_fkey FOREIGN KEY (quoted_message_id) REFERENCES whatsapp_mensagens(id) ON DELETE SET NULL;
alter table public.whatsapp_mensagens add constraint whatsapp_mensagens_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.whatsapp_transcricoes add constraint whatsapp_transcricoes_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

create index if not exists idx_acoes_status ON public.acoes_pendentes_aprovacao USING btree (status);
create index if not exists idx_acoes_user ON public.acoes_pendentes_aprovacao USING btree (user_id);
create index if not exists idx_agent_auto_responses_is_approved ON public.agent_auto_responses USING btree (is_approved);
create index if not exists idx_agent_auto_responses_vendor_id ON public.agent_auto_responses USING btree (vendor_id);
create index if not exists idx_agent_notifications_created_at ON public.agent_notifications USING btree (created_at);
create index if not exists idx_agent_notifications_is_read ON public.agent_notifications USING btree (is_read);
create index if not exists idx_agent_notifications_vendor_id ON public.agent_notifications USING btree (vendor_id);
create index if not exists atividades_empresa_idx ON public.atividades USING btree (empresa);
create index if not exists atividades_empresa_origem_idx ON public.atividades USING btree (empresa, origem);
create index if not exists atividades_empresa_tipo_subtipo_idx ON public.atividades USING btree (empresa, tipo, subtipo);
create index if not exists atividades_owner_idx ON public.atividades USING btree (owner_id);
create index if not exists atividades_por_origem ON public.atividades USING btree (empresa, origem_lead, created_at DESC);
create index if not exists atividades_relacionamento_idx ON public.atividades USING btree (relacionamento_id);
create index if not exists idx_atividades_empresa_owner_data ON public.atividades USING btree (empresa, owner_id, ocorrida_em DESC);
create index if not exists idx_atividades_geolocalizadas ON public.atividades USING btree (empresa, ocorrida_em DESC) WHERE ((latitude IS NOT NULL) AND (longitude IS NOT NULL));
create index if not exists idx_atividades_relacionamento ON public.atividades USING btree (relacionamento_id);
create index if not exists idx_agent_logs_data ON public.aura_agent_logs USING btree (criado_em);
create index if not exists idx_agent_logs_empresa ON public.aura_agent_logs USING btree (empresa_id);
create index if not exists idx_agent_logs_tipo ON public.aura_agent_logs USING btree (tipo_acao);
create index if not exists idx_agent_logs_user ON public.aura_agent_logs USING btree (user_id);
CREATE UNIQUE INDEX aura_aprendizado_chave_unica ON public.aura_aprendizado USING btree (empresa, canal, tipo, chave);
create index if not exists aura_aprendizado_para_prompt ON public.aura_aprendizado USING btree (empresa, status, vezes_fechou DESC, vezes_visto DESC);
create index if not exists aura_aprendizado_origem_aberta_op ON public.aura_aprendizado_origem USING btree (oportunidade_id) WHERE (resultado IS NULL);
create index if not exists aura_aprendizado_origem_aberta_rel ON public.aura_aprendizado_origem USING btree (relacionamento_id) WHERE (resultado IS NULL);
create index if not exists aura_cobrancas_empresa_dia ON public.aura_cobrancas USING btree (empresa, dia DESC);
create index if not exists feedback_fechamento_da_loja ON public.aura_feedback_fechamento USING btree (empresa, criado_em DESC);
create index if not exists feedback_fechamento_do_vendedor ON public.aura_feedback_fechamento USING btree (vendedor_id, criado_em DESC);
create index if not exists aura_materiais_empresa_idx ON public.aura_materiais USING btree (empresa) WHERE ativo;
create index if not exists aura_material_trechos_busca ON public.aura_material_trechos USING gin (busca);
create index if not exists aura_material_trechos_da_loja ON public.aura_material_trechos USING btree (empresa, material_id, ordem);
create index if not exists aura_material_trechos_material_idx ON public.aura_material_trechos USING btree (material_id);
create index if not exists aura_material_trechos_nucleo_idx ON public.aura_material_trechos USING btree (empresa, nucleo) WHERE nucleo;
create index if not exists aura_recomendacoes_vendedor_status_idx ON public.aura_recomendacoes USING btree (vendedor_id, status, criado_em DESC);
create index if not exists aura_sugestoes_resultado_chat ON public.aura_sugestoes_resultado USING btree (owner_id, chat_jid, enviado_em DESC);
create index if not exists aura_sugestoes_resultado_loja ON public.aura_sugestoes_resultado USING btree (empresa, enviado_em DESC);
create index if not exists aura_supervisoes_vendedor_criado_idx ON public.aura_supervisoes USING btree (vendedor_id, criado_em DESC);
CREATE UNIQUE INDEX campanhas_marketing_chave_externa_idx ON public.campanhas_marketing USING btree (empresa, chave_externa) WHERE (chave_externa IS NOT NULL);
create index if not exists coach_conversas_owner_idx ON public.coach_conversas USING btree (owner_id);
create index if not exists coach_mensagens_conversa_idx ON public.coach_mensagens USING btree (conversa_id, created_at);
create index if not exists coach_mensagens_owner_idx ON public.coach_mensagens USING btree (owner_id, created_at);
create index if not exists compromissos_owner_data_idx ON public.compromissos USING btree (owner_id, data);
create index if not exists idx_email_status ON public.emails_enviados USING btree (status);
create index if not exists idx_email_user ON public.emails_enviados USING btree (user_id);
CREATE UNIQUE INDEX etapas_funil_chave_unica ON public.etapas_funil USING btree (empresa, chave) WHERE (chave IS NOT NULL);
create index if not exists etapas_funil_da_loja ON public.etapas_funil USING btree (empresa, ordem);
create index if not exists idx_ia_falhas_recentes ON public.ia_falhas USING btree (criado_em DESC);
create index if not exists ia_uso_criado_em_idx ON public.ia_uso USING btree (criado_em DESC);
create index if not exists ia_uso_funcao_idx ON public.ia_uso USING btree (funcao);
create index if not exists idx_leads_created_at ON public.leads_recebidos USING btree (created_at DESC);
create index if not exists idx_leads_recebidos_email ON public.leads_recebidos USING btree (empresa, email_normalizado) WHERE (email_normalizado IS NOT NULL);
create index if not exists idx_leads_status ON public.leads_recebidos USING btree (status);
create index if not exists idx_leads_telefone ON public.leads_recebidos USING btree (telefone);
create index if not exists idx_leads_vendedor_id ON public.leads_recebidos USING btree (vendedor_id);
create index if not exists leads_recebidos_empresa_status_idx ON public.leads_recebidos USING btree (empresa, status);
create index if not exists leads_recebidos_natureza_idx ON public.leads_recebidos USING btree (empresa, natureza);
create index if not exists leads_recebidos_relacionamento_idx ON public.leads_recebidos USING btree (relacionamento_id);
create index if not exists leads_recebidos_sdr_idx ON public.leads_recebidos USING btree (sdr_id);
create index if not exists idx_whatsapp_status ON public.mensagens_whatsapp USING btree (status);
create index if not exists idx_whatsapp_user ON public.mensagens_whatsapp USING btree (user_id);
create index if not exists idx_meta_comentarios_recentes ON public.meta_comentarios USING btree (empresa, criado_em DESC);
create index if not exists idx_meta_conversas_recentes ON public.meta_conversas USING btree (empresa, ultima_em DESC);
create index if not exists idx_meta_mensagens_conversa ON public.meta_mensagens USING btree (conversa_id, criado_em);
create index if not exists idx_metas_owner_periodo ON public.metas USING btree (owner_id, tipo_periodo, ano, mes);
CREATE UNIQUE INDEX metas_owner_mes_uidx ON public.metas USING btree (owner_id, mes);
create index if not exists idx_notificacoes_vendedor ON public.notificacoes USING btree (vendedor_id, lida);
create index if not exists idx_oportunidades_parceiro ON public.oportunidades USING btree (parceiro_id) WHERE (parceiro_id IS NOT NULL);
create index if not exists oportunidades_empresa_idx ON public.oportunidades USING btree (empresa);
create index if not exists oportunidades_owner_idx ON public.oportunidades USING btree (owner_id);
create index if not exists oportunidades_por_origem ON public.oportunidades USING btree (empresa, origem_lead, etapa);
create index if not exists oportunidades_relacionamento_idx ON public.oportunidades USING btree (relacionamento_id);
create index if not exists orcamentos_anexos_oportunidade_idx ON public.orcamentos_anexos USING btree (oportunidade_id, versao);
create index if not exists pedidos_avaliacao_pendente_idx ON public.pedidos_avaliacao USING btree (vendedor_id) WHERE (enviado_em IS NULL);
create index if not exists pedidos_avaliacao_venda_idx ON public.pedidos_avaliacao USING btree (venda_id);
create index if not exists pedidos_avaliacao_vendedor_idx ON public.pedidos_avaliacao USING btree (vendedor_id, criado_em DESC);
create index if not exists idx_planilha_marketing ON public.planilha_leads_indicadores USING btree (data_atualizacao DESC);
create index if not exists idx_planilha_mes_ano ON public.planilha_leads_indicadores USING btree (mes, ano);
create index if not exists idx_planilha_usuario ON public.planilha_leads_indicadores USING btree (usuario_id);
create index if not exists idx_planilha_linhas_empresa ON public.planilha_linhas USING btree (empresa, ativo, ordem);
CREATE UNIQUE INDEX pontuacao_regras_unica ON public.pontuacao_regras USING btree (empresa, mes, tipo, chave);
create index if not exists pos_venda_notas_pos_venda_idx ON public.pos_venda_notas USING btree (pos_venda_id);
create index if not exists idx_pos_vendas_empresa_status ON public.pos_vendas USING btree (empresa, status, updated_at DESC);
create index if not exists idx_pos_vendas_responsavel ON public.pos_vendas USING btree (responsavel_id, status, updated_at DESC);
CREATE UNIQUE INDEX idx_pos_vendas_venda_unica ON public.pos_vendas USING btree (venda_id);
create index if not exists idx_pos_vendas_vendedor ON public.pos_vendas USING btree (vendedor_id, created_at DESC);
CREATE UNIQUE INDEX pos_vendas_cliente_antigo_unico ON public.pos_vendas USING btree (relacionamento_id) WHERE (origem = 'cliente_antigo'::text);
create index if not exists pos_vendas_empresa_status_idx ON public.pos_vendas USING btree (empresa, status);
CREATE UNIQUE INDEX premio_unico_por_periodo ON public.premios USING btree (empresa, escopo, periodo);
CREATE UNIQUE INDEX profiles_agenda_token_idx ON public.profiles USING btree (agenda_token);
create index if not exists ranking_criterios_ordem_idx ON public.ranking_criterios USING btree (ativo, ordem);
create index if not exists idx_relacionamentos_email_normalizado ON public.relacionamentos USING btree (empresa, email_normalizado) WHERE (email_normalizado IS NOT NULL);
create index if not exists idx_relacionamentos_empresa_owner ON public.relacionamentos USING btree (empresa, owner_id);
create index if not exists idx_relacionamentos_parceiro ON public.relacionamentos USING btree (parceiro_id) WHERE (parceiro_id IS NOT NULL);
create index if not exists idx_relacionamentos_proximo_contato_em ON public.relacionamentos USING btree (proximo_contato_em);
create index if not exists idx_relacionamentos_telefone_normalizado ON public.relacionamentos USING btree (empresa, telefone_normalizado) WHERE (telefone_normalizado IS NOT NULL);
create index if not exists relacionamentos_empresa_idx ON public.relacionamentos USING btree (empresa);
create index if not exists relacionamentos_empresa_origem_idx ON public.relacionamentos USING btree (empresa, origem);
create index if not exists relacionamentos_owner_idx ON public.relacionamentos USING btree (owner_id);
CREATE UNIQUE INDEX relacionamentos_telefone_unico_por_empresa ON public.relacionamentos USING btree (empresa, telefone_normalizado) WHERE ((telefone_normalizado IS NOT NULL) AND (telefone_normalizado <> ''::text));
create index if not exists relatorios_periodicos_empresa_idx ON public.relatorios_periodicos USING btree (empresa, tipo, periodo_fim DESC);
create index if not exists site_conversas_envio_idx ON public.site_conversas USING btree (envio_id);
create index if not exists site_conversas_lista_idx ON public.site_conversas USING btree (empresa, ultima_em DESC);
create index if not exists site_envios_empresa_idx ON public.site_envios USING btree (empresa, created_at DESC);
create index if not exists site_envios_ip_idx ON public.site_envios USING btree (ip_hash, created_at DESC);
create index if not exists site_envios_lead_idx ON public.site_envios USING btree (lead_id);
create index if not exists site_mensagens_conversa_idx ON public.site_mensagens USING btree (conversa_id, created_at);
create index if not exists tarefas_vendedor_idx ON public.tarefas USING btree (vendedor_id);
create index if not exists idx_transferencias_empresa_data ON public.transferencias_carteira USING btree (empresa, created_at DESC);
create index if not exists idx_vendas_empresa_owner_data ON public.vendas USING btree (empresa, owner_id, data DESC);
create index if not exists idx_vendas_forma_pagamento ON public.vendas USING btree (empresa, forma_pagamento, data DESC);
create index if not exists idx_vendas_parceiro ON public.vendas USING btree (parceiro_id) WHERE (parceiro_id IS NOT NULL);
create index if not exists idx_vendas_parceiro_empresa ON public.vendas USING btree (parceiro_id, empresa) WHERE (parceiro_id IS NOT NULL);
create index if not exists idx_vendas_relacionamento ON public.vendas USING btree (relacionamento_id);
create index if not exists vendas_empresa_data_pagamento_idx ON public.vendas USING btree (empresa, data, forma_pagamento);
create index if not exists vendas_empresa_idx ON public.vendas USING btree (empresa);
create index if not exists vendas_oportunidade_idx ON public.vendas USING btree (oportunidade_id);
create index if not exists vendas_owner_data_oportunidade_idx ON public.vendas USING btree (owner_id, data, oportunidade_id);
create index if not exists vendas_por_origem ON public.vendas USING btree (empresa, origem_lead, data DESC);
create index if not exists idx_whatsapp_contactos_linha_nome ON public.whatsapp_contactos USING btree (phone_number_id, nome);
create index if not exists whatsapp_contactos_linha_idx ON public.whatsapp_contactos USING btree (phone_number_id);
create index if not exists idx_whatsapp_conversas_linha_data ON public.whatsapp_conversas USING btree (phone_number_id, ultima_mensagem_em DESC NULLS LAST);
create index if not exists idx_whatsapp_conversas_linha_nome ON public.whatsapp_conversas USING btree (phone_number_id, nome_cliente);
create index if not exists whatsapp_conversas_linha_idx ON public.whatsapp_conversas USING btree (phone_number_id, ultima_mensagem_em DESC);
create index if not exists idx_whatsapp_ia_leads_parceiro ON public.whatsapp_ia_leads USING btree (parceiro_id) WHERE (parceiro_id IS NOT NULL);
create index if not exists whatsapp_ia_leads_anuncio_sem_carteira ON public.whatsapp_ia_leads USING btree (owner_id) WHERE ((carteira_em IS NULL) AND (relacionamento_id IS NULL) AND ((anuncio_em IS NOT NULL) OR (campanha_id IS NOT NULL)));
create index if not exists whatsapp_ia_leads_campanha_idx ON public.whatsapp_ia_leads USING btree (campanha_id) WHERE (campanha_id IS NOT NULL);
create index if not exists whatsapp_ia_leads_natureza_idx ON public.whatsapp_ia_leads USING btree (owner_id, natureza);
create index if not exists whatsapp_ia_leads_op_idx ON public.whatsapp_ia_leads USING btree (oportunidade_id);
create index if not exists whatsapp_ia_leads_owner_idx ON public.whatsapp_ia_leads USING btree (owner_id);
create index if not exists whatsapp_ia_leads_pergunta_lead ON public.whatsapp_ia_leads USING btree (owner_id) WHERE ((carteira_relacionamento_id IS NOT NULL) AND (relacionamento_id IS NULL) AND (pergunta_lead_em IS NULL));
create index if not exists whatsapp_ia_leads_rel_idx ON public.whatsapp_ia_leads USING btree (relacionamento_id);
create index if not exists idx_whatsapp_mensagens_agent_processed ON public.whatsapp_mensagens USING btree (agent_processed);
create index if not exists idx_whatsapp_mensagens_conversa_data ON public.whatsapp_mensagens USING btree (conversa_id, created_at);
create index if not exists idx_whatsapp_mensagens_cotada ON public.whatsapp_mensagens USING btree (quoted_message_id);
create index if not exists idx_whatsapp_mensagens_linha_conversa_data ON public.whatsapp_mensagens USING btree (phone_number_id, conversa_id, created_at);
create index if not exists idx_whatsapp_mensagens_vendor_id ON public.whatsapp_mensagens USING btree (vendor_id);
create index if not exists whatsapp_mensagens_conversa_idx ON public.whatsapp_mensagens USING btree (conversa_id, created_at);
create index if not exists whatsapp_transcricoes_owner_idx ON public.whatsapp_transcricoes USING btree (owner_id, criado_em DESC);

CREATE OR REPLACE FUNCTION public.atualizar_meta_atualizada_em()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.aura_achar_ou_criar_relacionamento(p_owner uuid, p_empresa text, p_nome text, p_telefone text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_normalizado text;
  v_id uuid;
begin
  v_normalizado := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');

  if v_normalizado <> '' then
    select id into v_id
      from relacionamentos
     where empresa = p_empresa
       and telefone_normalizado = v_normalizado
     limit 1;

    if v_id is not null then
      -- Cliente que voltou: atualiza o contato e devolve a ficha de sempre.
      update relacionamentos
         set ultimo_contato_em = now(),
             nome = case
                      when coalesce(nome, '') = '' or nome ~ '^\+?[0-9 ()-]+$'
                      then coalesce(nullif(p_nome, ''), nome)
                      else nome
                    end
       where id = v_id;
      return v_id;
    end if;
  end if;

  insert into relacionamentos (owner_id, empresa, nome, telefone, categoria, origem, ultimo_contato_em)
  values (p_owner, p_empresa, coalesce(nullif(p_nome, ''), p_telefone, 'Sem nome'),
          p_telefone, 'Cliente Final', 'WhatsApp', now())
  returning id into v_id;

  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.aura_apagar_card_leva_a_venda()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from vendas
   where oportunidade_id = old.id
     and status = 'aguardando_detalhes';
  return old;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.aura_aprendizado_toca_atualizado_em()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  new.atualizado_em := now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.aura_atividade_move_pipeline()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  texto text;
  chave_alvo text;
  criar boolean := false;
begin
  if new.relacionamento_id is null then return new; end if;
  -- Ignora registros do próprio sistema (movimentações, IA do WhatsApp).
  if coalesce(new.origem, '') = 'whatsapp_ia'
     or new.titulo ilike 'Oportunidade %' or new.titulo ilike 'IA moveu%' or new.titulo ilike 'Etapa alterada%' then
    return new;
  end if;

  texto := lower(translate(coalesce(new.titulo,'') || ' ' || coalesce(new.contexto,'') || ' ' || coalesce(new.observacao,'') || ' ' ||
                           coalesce(new.resultado,'') || ' ' || coalesce(new.proximo_passo,'') || ' ' || coalesce(new.subtipo,''),
                           'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'));

  if new.tipo = 'Venda' or texto ~ '(venda fechada|negocio fechado|fechou|fechamos|pedido confirmado|contrato assinado|pagamento (confirmado|recebido))' then
    chave_alvo := 'fechamento';
  elsif texto ~ '(desconto|parcel|condicao de pagamento|negocia|contraproposta)' then
    chave_alvo := 'negociacao';
  elsif new.tipo = 'Orçamento' or texto ~ '(orcamento|proposta enviada|enviei (a )?proposta|cotacao)' then
    chave_alvo := 'followup'; criar := true;
  elsif new.tipo in ('Visita', 'Reunião') or texto ~ '(apresentacao|showroom|catalogo|visita tecnica|medicao)' then
    chave_alvo := 'apresentacao'; criar := true;
  else
    return new;
  end if;

  perform public.aura_avancar_oportunidade(null, new.relacionamento_id, chave_alvo,
    'Atividade: ' || coalesce(new.tipo,'') || ' — ' || coalesce(new.titulo,''), criar);
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.aura_avancar_oportunidade(p_oportunidade_id uuid, p_relacionamento_id uuid, p_etapa text, p_motivo text, p_criar_se_nao_existir boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  op record;
  rel record;
  nova_id uuid;
  v_empresa text;
  nome_alvo text;
  chave_atual text;
  -- coalesce é obrigatório: sem a bandeira ligada, current_setting devolve
  -- NULL, e "not NULL" não é verdadeiro — a trava seria pulada em silêncio
  -- (pego no teste de 21/10).
  em_venda boolean := coalesce(current_setting('aura.venda_em_curso', true), '') = 'sim';
begin
  if p_oportunidade_id is not null then
    select * into op from oportunidades where id = p_oportunidade_id;
  elsif p_relacionamento_id is not null then
    -- "Negócio ainda aberto" tem que ser perguntado à loja: as etapas de ganho
    -- e de perda têm nome escolhido pelo gestor.
    select o.* into op
      from oportunidades o
     where o.relacionamento_id = p_relacionamento_id
       and coalesce(public.aura_chave_da_etapa(o.empresa, o.etapa), '') not in ('fechamento', 'perda')
     order by o.updated_at desc nulls last, o.created_at desc
     limit 1;
  end if;

  if op.id is null then
    if not p_criar_se_nao_existir or p_relacionamento_id is null then return null; end if;
    -- Card novo nasce com valor 0: só pode nascer em Negociação/Fechamento
    -- quando é a venda que está criando (ela grava o valor em seguida).
    if p_etapa in ('negociacao', 'fechamento') and not em_venda then return null; end if;
    select * into rel from relacionamentos where id = p_relacionamento_id;
    if rel.id is null then return null; end if;

    nome_alvo := public.aura_etapa_da_chave(rel.empresa, p_etapa);
    if nome_alvo is null then return null; end if;

    insert into oportunidades (
      owner_id, empresa, cliente, valor, etapa, probabilidade, relacionamento_id, descricao,
      parceiro_id, percentual_parceiro
    )
    values (rel.owner_id, rel.empresa, rel.nome, 0, nome_alvo,
            public.aura_prob_da_chave(p_etapa), rel.id,
            'Criada automaticamente pela AURA: ' || coalesce(p_motivo, ''),
            -- Atendimento em dupla: o negócio nasce com a mesma dupla do cliente.
            case when rel.parceiro_id is distinct from rel.owner_id then rel.parceiro_id end,
            coalesce(rel.percentual_parceiro, 50))
    returning id into nova_id;

    insert into notificacoes (vendedor_id, titulo, mensagem, tipo, lida, acao_url, criada_em)
    values (rel.owner_id, '🤖 Nova oportunidade no pipeline',
            rel.nome || ' entrou em ' || nome_alvo || '. ' || coalesce(p_motivo,''),
            'ia', false, '/pipeline', now());

    if rel.parceiro_id is not null and rel.parceiro_id is distinct from rel.owner_id then
      insert into notificacoes (vendedor_id, titulo, mensagem, tipo, lida, acao_url, criada_em)
      values (rel.parceiro_id, '🤖 Nova oportunidade no atendimento em dupla',
              rel.nome || ' entrou em ' || nome_alvo || '. Você atende este cliente em dupla.',
              'ia', false, '/pipeline', now());
    end if;

    return nova_id;
  end if;

  v_empresa := op.empresa;
  nome_alvo := public.aura_etapa_da_chave(v_empresa, p_etapa);
  if nome_alvo is null then return op.id; end if;

  chave_atual := coalesce(public.aura_chave_da_etapa(v_empresa, op.etapa), '');

  -- Negócio já decidido não volta, e a automação só avança — nunca puxa para
  -- trás o que o vendedor adiantou à mão.
  if chave_atual in ('fechamento', 'perda')
     or public.aura_ordem_da_chave(p_etapa) <= public.aura_ordem_da_chave(chave_atual) then
    return op.id;
  end if;

  -- Sem valor não entra em Negociação/Fechamento (trava 091): avisa e para.
  -- Na venda, o valor chega na mesma transação, então ela segue.
  if p_etapa in ('negociacao', 'fechamento') and coalesce(op.valor, 0) <= 0 and not em_venda then
    if not exists (
      select 1 from notificacoes
       where vendedor_id = op.owner_id and lida = false
         and titulo = '💰 Falta o valor do negócio' and mensagem like op.cliente || ':%'
    ) then
      insert into notificacoes (vendedor_id, titulo, mensagem, tipo, lida, acao_url, criada_em)
      values (op.owner_id, '💰 Falta o valor do negócio',
              op.cliente || ': pelo que foi registrado, o negócio está em ' || nome_alvo
                || ', mas o card está sem valor. Abra o card e informe o valor estimado.',
              'ia', false, '/pipeline', now());
    end if;
    return op.id;
  end if;

  update oportunidades
     set etapa = nome_alvo,
         probabilidade = public.aura_prob_da_chave(p_etapa),
         dias_parado = 0,
         updated_at = now()
   where id = op.id;

  insert into notificacoes (vendedor_id, titulo, mensagem, tipo, lida, acao_url, criada_em)
  values (op.owner_id,
          case when p_etapa = 'fechamento' then '🎉 Negócio fechado' else '🤖 AURA moveu no pipeline' end,
          op.cliente || ': ' || op.etapa || ' → ' || nome_alvo || '. ' || coalesce(p_motivo, ''),
          'ia', false, '/pipeline', now());

  if op.parceiro_id is not null and op.parceiro_id is distinct from op.owner_id then
    insert into notificacoes (vendedor_id, titulo, mensagem, tipo, lida, acao_url, criada_em)
    values (op.parceiro_id,
            case when p_etapa = 'fechamento' then '🎉 Negócio da dupla fechado' else '🤖 O negócio da dupla andou' end,
            op.cliente || ': ' || op.etapa || ' → ' || nome_alvo || '. ' || coalesce(p_motivo, ''),
            'ia', false, '/pipeline', now());
  end if;

  return op.id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.aura_avisar_dono_do_lead()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_dono uuid;
  v_nome text;
  v_fone text;
  v_do_site boolean;
  v_recado text;
begin
  v_dono := coalesce(new.vendedor_id, new.sdr_id);
  if v_dono is null then return new; end if;
  if tg_op = 'UPDATE'
     and coalesce(old.vendedor_id, old.sdr_id) is not distinct from v_dono then
    return new;
  end if;

  v_nome := coalesce(nullif(btrim(new.nome), ''), new.telefone, 'Novo lead');
  v_fone := regexp_replace(coalesce(new.telefone, ''), '\D', '', 'g');
  v_do_site := coalesce(new.origem, '') ilike 'Site MF%';
  v_recado := nullif(btrim(regexp_replace(coalesce(new.mensagem_inicial, ''), '\s+', ' ', 'g')), '');
  if v_recado is not null and length(v_recado) > 220 then
    v_recado := left(v_recado, 217) || '...';
  end if;

  insert into public.notificacoes (vendedor_id, titulo, mensagem, tipo, acao_url)
  values (
    v_dono,
    case when v_do_site then '🌐 Lead do site para você chamar' else 'Lead novo para chamar' end,
    v_nome || ' · ' || coalesce(new.origem, 'origem não informada')
      || case when v_fone <> '' then ' · WhatsApp +' || v_fone else '' end
      || case when v_recado is not null then E'\n' || v_recado else '' end
      || E'\nToque para chamar no WhatsApp. Responda antes do prazo.',
    'lead',
    case when v_fone <> '' then '/whatsapp?numero=' || v_fone else '/leads' end
  );
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.aura_buscar_trechos(p_empresa text, p_conversa text, p_limite integer DEFAULT 6)
 RETURNS TABLE(origem text, texto text, nota real)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  consulta tsquery;
  termos text;
  total numeric;
begin
  select count(*) into total
  from public.aura_material_trechos t
  join public.aura_materiais m on m.id = t.material_id
  where t.empresa = p_empresa and m.ativo;

  if coalesce(total, 0) = 0 then
    return;
  end if;

  -- Palavras da conversa que sao RARAS no material, as 12 mais raras primeiro.
  -- As comuns nao discriminam: "projeto" esta em 41% dos trechos e "cliente"
  -- em 27% - buscar por elas e buscar por tudo.
  with corpus as (
    select unnest(string_to_array(replace(strip(t.busca)::text, '''', ''), ' ')) as lexema
    from public.aura_material_trechos t
    join public.aura_materiais m on m.id = t.material_id
    where t.empresa = p_empresa and m.ativo
  ),
  df as (
    select lexema, count(*) as n from corpus group by lexema
  ),
  lex as (
    select distinct unnest(
      string_to_array(replace(strip(to_tsvector('portuguese', p_conversa))::text, '''', ''), ' ')
    ) as lexema
  ),
  escolhidas as (
    select lex.lexema
    from lex join df using (lexema)
    where length(lex.lexema) > 2
      and df.n <= greatest(1, floor(total * 0.25))
    order by df.n
    limit 12
  )
  select string_agg(lexema, ' | ') into termos from escolhidas;

  if termos is null or termos = '' then
    return;
  end if;

  begin
    consulta := to_tsquery('portuguese', termos);
  exception when others then
    return;
  end;

  -- distinct on (texto): o material tem secoes com o mesmo corpo sob titulos
  -- diferentes. Sem isto, o mesmo paragrafo ocupava tres das seis vagas.
  return query
  select d.origem, d.texto, d.nota
  from (
    select distinct on (t.texto)
           t.origem, t.texto, ts_rank(t.busca, consulta) as nota, t.ordem
    from public.aura_material_trechos t
    join public.aura_materiais m on m.id = t.material_id
    where t.empresa = p_empresa
      and m.ativo
      and t.busca @@ consulta
    order by t.texto, ts_rank(t.busca, consulta) desc
  ) d
  order by d.nota desc, d.ordem
  limit greatest(1, least(p_limite, 20));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.aura_chave_da_etapa(p_empresa text, p_etapa text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (select chave from public.etapas_funil
      where empresa = p_empresa and nome = p_etapa
      order by ordem limit 1),
    case p_etapa
      when 'Leads frios'              then 'lead_frio'
      when 'Prospecção'               then 'prospeccao'
      when 'Qualificação'             then 'qualificacao'
      when 'Qualificação e Abordagem' then 'qualificacao'
      when 'Abordagem'                then 'qualificacao'
      when 'Apresentação'             then 'apresentacao'
      when 'Proposta'                 then 'followup'
      when 'Follow-up'                then 'followup'
      when 'Followup'                 then 'followup'
      when 'Negociação'               then 'negociacao'
      when 'Fechados'                 then 'fechamento'
      when 'Fechamento'               then 'fechamento'
      when 'Ganhos'                   then 'fechamento'
      when 'Pós-venda'                then 'posvenda'
      when 'Pos-venda'                then 'posvenda'
      when 'Perdidos'                 then 'perda'
      when 'Perdido'                  then 'perda'
    end
  );
$function$
;

CREATE OR REPLACE FUNCTION public.aura_criar_pedido_avaliacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cliente text;
  v_telefone text;
begin
  select r.nome, r.telefone into v_cliente, v_telefone
  from relacionamentos r where r.id = new.relacionamento_id;

  insert into pedidos_avaliacao (venda_id, vendedor_id, empresa, cliente, telefone)
  values (new.id, new.owner_id, new.empresa,
          coalesce(v_cliente, new.cliente), v_telefone);
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.aura_criar_pos_venda()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  relacionamento_registro public.relacionamentos%ROWTYPE;
BEGIN
  IF NEW.relacionamento_id IS NOT NULL THEN
    SELECT *
      INTO relacionamento_registro
    FROM public.relacionamentos
    WHERE id = NEW.relacionamento_id;
  END IF;

  INSERT INTO public.pos_vendas (
    venda_id,
    oportunidade_id,
    relacionamento_id,
    vendedor_id,
    empresa,
    cliente,
    telefone,
    email,
    produto,
    valor_fechado,
    status
  )
  VALUES (
    NEW.id,
    NEW.oportunidade_id,
    NEW.relacionamento_id,
    NEW.owner_id,
    NEW.empresa,
    NEW.cliente,
    relacionamento_registro.telefone,
    relacionamento_registro.email,
    NEW.produto,
    COALESCE(NEW.valor_fechado, NEW.valor, 0),
    'aguardando_instalacao'
  )
  ON CONFLICT (venda_id) DO UPDATE
  SET
    oportunidade_id = EXCLUDED.oportunidade_id,
    relacionamento_id = EXCLUDED.relacionamento_id,
    empresa = EXCLUDED.empresa,
    cliente = EXCLUDED.cliente,
    telefone = COALESCE(EXCLUDED.telefone, public.pos_vendas.telefone),
    email = COALESCE(EXCLUDED.email, public.pos_vendas.email),
    produto = EXCLUDED.produto,
    valor_fechado = EXCLUDED.valor_fechado,
    updated_at = now();

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.aura_distribuir_lead_ao_entrar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS NULL OR NEW.status = 'aguardando_sdr' THEN
    PERFORM public.distribuir_lead_novo(NEW.id);
  END IF;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.aura_esquema_ddl()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  saida text := '';
  r record;
begin
  saida := saida || '-- Esquema público do AURA gerado em ' || now()::text || E'\n\n';

  for r in
    select t.typname, string_agg(quote_literal(e.enumlabel), ', ' order by e.enumsortorder) as rotulos
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    join pg_enum e on e.enumtypid = t.oid
    where n.nspname = 'public'
    group by t.typname
  loop
    saida := saida || format('create type public.%I as enum (%s);', r.typname, r.rotulos) || E'\n';
  end loop;
  saida := saida || E'\n';

  for r in
    select c.relname,
      string_agg(
        format('  %I %s%s%s',
          a.attname,
          format_type(a.atttypid, a.atttypmod),
          case when a.attnotnull then ' not null' else '' end,
          case when d.adbin is not null then ' default ' || pg_get_expr(d.adbin, d.adrelid) else '' end
        ), E',\n' order by a.attnum) as colunas
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
    where n.nspname = 'public' and c.relkind = 'r'
    group by c.relname
    order by c.relname
  loop
    saida := saida || format('create table if not exists public.%I (', r.relname) || E'\n' || r.colunas || E'\n);\n\n';
  end loop;

  for r in
    select c.conname, cl.relname, pg_get_constraintdef(c.oid) as def
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_namespace n on n.oid = cl.relnamespace
    where n.nspname = 'public'
    order by case c.contype when 'p' then 1 when 'u' then 2 when 'c' then 3 else 4 end, cl.relname, c.conname
  loop
    saida := saida || format('alter table public.%I add constraint %I %s;', r.relname, r.conname, r.def) || E'\n';
  end loop;
  saida := saida || E'\n';

  for r in
    select i.indexdef
    from pg_indexes i
    where i.schemaname = 'public'
      and not exists (select 1 from pg_constraint c where c.conname = i.indexname)
    order by i.tablename, i.indexname
  loop
    saida := saida || replace(r.indexdef, 'CREATE INDEX', 'create index if not exists') || E';\n';
  end loop;
  saida := saida || E'\n';

  for r in
    select pg_get_functiondef(p.oid) as def, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
    order by p.proname
  loop
    saida := saida || r.def || E';\n\n';
  end loop;

  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args,
      string_agg(distinct g.grantee, ', ' order by g.grantee) as quem
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join information_schema.routine_privileges g
      on g.specific_schema = 'public' and g.specific_name = p.proname || '_' || p.oid
    where n.nspname = 'public' and g.privilege_type = 'EXECUTE'
    group by p.proname, p.oid
    order by p.proname
  loop
    saida := saida || format('revoke execute on function public.%I(%s) from public; grant execute on function public.%I(%s) to %s;',
      r.proname, r.args, r.proname, r.args, r.quem) || E'\n';
  end loop;
  saida := saida || E'\n';

  for r in
    select c.relname, pg_get_viewdef(c.oid, true) as def,
      coalesce(array_to_string(c.reloptions, ', '), '') as opcoes
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
    order by c.relname
  loop
    saida := saida || format('create or replace view public.%I%s as %s',
      r.relname,
      case when r.opcoes <> '' then ' with (' || r.opcoes || ')' else '' end,
      r.def) || E'\n\n';
  end loop;

  for r in
    select pg_get_triggerdef(t.oid) as def
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not t.tgisinternal
    order by c.relname, t.tgname
  loop
    saida := saida || r.def || E';\n';
  end loop;
  saida := saida || E'\n';

  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
    order by c.relname
  loop
    saida := saida || format('alter table public.%I enable row level security;', r.relname) || E'\n';
  end loop;
  saida := saida || E'\n';

  for r in
    select tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
    order by tablename, policyname
  loop
    saida := saida || format('create policy %I on public.%I as %s for %s to %s%s%s;',
      r.policyname, r.tablename,
      lower(r.permissive), lower(r.cmd),
      array_to_string(r.roles, ', '),
      case when r.qual is not null then ' using (' || r.qual || ')' else '' end,
      case when r.with_check is not null then ' with check (' || r.with_check || ')' else '' end
    ) || E'\n';
  end loop;
  saida := saida || E'\n';

  for r in
    select id, public as publico from storage.buckets order by id
  loop
    saida := saida || format('insert into storage.buckets (id, name, public) values (%L, %L, %s) on conflict (id) do nothing;',
      r.id, r.id, r.publico) || E'\n';
  end loop;

  return saida;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.aura_etapa_da_chave(p_empresa text, p_chave text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (select nome from public.etapas_funil
      where empresa = p_empresa and chave = p_chave
      order by ordem limit 1),
    case p_chave
      when 'lead_frio'    then 'Leads frios'
      when 'prospeccao'   then 'Prospecção'
      when 'qualificacao' then 'Qualificação e Abordagem'
      when 'apresentacao' then 'Apresentação'
      when 'followup'     then 'Follow-up'
      when 'negociacao'   then 'Negociação'
      when 'fechamento'   then 'Fechamento'
      when 'posvenda'     then 'Pós-venda'
      when 'perda'        then 'Perdidos'
    end
  );
$function$
;

CREATE OR REPLACE FUNCTION public.aura_etapa_de_ganho(p_empresa text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (select nome from public.etapas_funil
      where empresa = p_empresa and tipo = 'ganho'
      order by ordem limit 1),
    public.aura_etapa_da_chave(p_empresa, 'fechamento')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.aura_etapa_de_perda(p_empresa text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (select nome from public.etapas_funil
      where empresa = p_empresa and tipo = 'perda'
      order by ordem limit 1),
    public.aura_etapa_da_chave(p_empresa, 'perda')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.aura_etapa_existe_no_funil()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  tem_funil boolean;
begin
  if new.etapa is null or btrim(new.etapa) = '' then
    raise exception 'O negócio precisa de uma etapa.';
  end if;

  -- Nada mudou na etapa? Não custa nem uma consulta.
  if tg_op = 'UPDATE' and old.etapa is not distinct from new.etapa then
    return new;
  end if;

  select exists (select 1 from public.etapas_funil where empresa = new.empresa)
    into tem_funil;

  -- Loja que ainda não tem funil próprio usa o padrão do sistema, e o padrão
  -- não está no banco. Deixar passar é o que permite uma loja nova nascer.
  if not tem_funil then
    return new;
  end if;

  if not exists (
    select 1 from public.etapas_funil
     where empresa = new.empresa and nome = new.etapa
  ) then
    raise exception
      'A etapa "%" não existe no funil da loja %. Use uma das etapas configuradas em Painel do Gestor → Etapas do Funil.',
      new.etapa, new.empresa;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.aura_excluir_funcionario(p_executor uuid, p_alvo uuid, p_herdeiro uuid DEFAULT NULL::uuid, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  exec_p public.profiles%rowtype;
  alvo_p public.profiles%rowtype;
  tem_carteira int := 0;
  outros_mestres int := 0;
  movido jsonb := null;
begin
  select * into exec_p from public.profiles where id = p_executor;
  select * into alvo_p from public.profiles where id = p_alvo;

  if exec_p.id is null or exec_p.gestor_mestre is not true then
    raise exception 'Só um gestor mestre pode excluir alguém da equipe.';
  end if;
  if alvo_p.id is null then
    raise exception 'Não encontrei esta pessoa.';
  end if;
  if alvo_p.excluido_em is not null then
    raise exception '% já está excluído.', alvo_p.nome;
  end if;
  if p_alvo = p_executor then
    raise exception 'Você não pode excluir a sua própria conta.';
  end if;

  if alvo_p.gestor_mestre is true then
    select count(*) into outros_mestres from public.profiles
     where gestor_mestre = true and excluido_em is null and id <> p_alvo;
    if outros_mestres = 0 then
      raise exception 'Este é o último gestor mestre. Promova outra pessoa antes de excluir.';
    end if;
  end if;

  select count(*) into tem_carteira from public.relacionamentos where owner_id = p_alvo;
  -- "Carteira viva" é o que ainda está em aberto no funil DESTA loja. Contar
  -- negócio já fechado aqui faria o sistema exigir herdeiro de quem não tem
  -- mais nada para herdar.
  tem_carteira := tem_carteira + (
    select count(*) from public.oportunidades
     where owner_id = p_alvo
       and coalesce(public.aura_chave_da_etapa(empresa, etapa), '') not in ('fechamento', 'perda'));

  if p_herdeiro is not null then
    movido := public.aura_mover_carteira(p_executor, p_alvo, p_herdeiro,
      coalesce(nullif(btrim(p_motivo), ''), 'Exclusão de ' || alvo_p.nome), false);
  elsif tem_carteira > 0 then
    raise exception '% tem % registros na carteira. Escolha quem assume antes de excluir.',
      alvo_p.nome, tem_carteira;
  end if;

  update public.notificacoes set lida = true, lida_em = coalesce(lida_em, now())
   where vendedor_id = p_alvo and lida is not true;

  update public.profiles set
    excluido_em = now(), excluido_por = p_executor,
    excluido_motivo = nullif(btrim(p_motivo), ''),
    ativo = false, gestor_mestre = false, gestor_aprovado = false,
    permissoes = '{}'::jsonb
  where id = p_alvo;

  return jsonb_build_object('sucesso', true, 'nome', alvo_p.nome, 'carteira', movido);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.aura_fechar_card_cria_venda()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  etapa_ganho text;
begin
  etapa_ganho := public.aura_etapa_de_ganho(new.empresa);
  if new.etapa is distinct from etapa_ganho then return new; end if;
  if tg_op = 'UPDATE' and old.etapa = etapa_ganho then return new; end if;

  -- A venda é que está fechando este card: ela já existe (está sendo
  -- gravada nesta mesma transação). Criar outra aqui é o ciclo.
  if current_setting('aura.venda_em_curso', true) = 'sim' then return new; end if;

  if exists (select 1 from vendas where oportunidade_id = new.id) then return new; end if;

  insert into vendas (
    owner_id, empresa, cliente, produto,
    valor, valor_original, valor_fechado,
    desconto_valor, desconto_percentual,
    quantidade_parcelas, valor_parcela, entrada_valor, taxa_financeira,
    comissao_base, data, relacionamento_id, oportunidade_id, status,
    parceiro_id, percentual_parceiro
  ) values (
    new.owner_id, new.empresa, new.cliente, new.produto,
    coalesce(new.valor, 0), coalesce(new.valor, 0), coalesce(new.valor, 0),
    0, 0, 1, coalesce(new.valor, 0), 0, 0,
    coalesce(new.valor, 0), current_date, new.relacionamento_id, new.id,
    'aguardando_detalhes',
    case when new.parceiro_id is distinct from new.owner_id then new.parceiro_id end,
    case when new.parceiro_id is not null and new.parceiro_id is distinct from new.owner_id
         then coalesce(new.percentual_parceiro, 50) else 0 end
  );
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.aura_impedir_venda_duplicada()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.oportunidade_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.vendas
    WHERE oportunidade_id = NEW.oportunidade_id
      AND (TG_OP = 'INSERT' OR id <> NEW.id)
  ) THEN
    RAISE EXCEPTION 'Esta oportunidade já tem uma venda registrada.'
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.aura_lead_respondido_vira_pipeline()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_dono uuid;
  v_rel uuid;
  v_nome text;
  v_frio boolean;
  v_etapa_frio text;
  v_op uuid;
  v_op_etapa text;
begin
  v_frio := new.status = 'lead_frio';

  if v_frio then
    if coalesce(old.status, '') = 'lead_frio' then return new; end if;
  elsif new.status <> 'respondido' or coalesce(old.status, '') = 'respondido' then
    return new;
  end if;

  v_dono := coalesce(new.vendedor_id, new.respondido_por, new.sdr_id);
  if v_dono is null then return new; end if;

  v_nome := coalesce(nullif(btrim(new.nome), ''), new.telefone, 'Cliente sem nome');
  v_rel  := new.relacionamento_id;

  if v_rel is null and new.telefone is not null then
    select id into v_rel
    from public.relacionamentos
    where empresa = new.empresa
      and telefone_normalizado = public.aura_normalizar_telefone(new.telefone)
    limit 1;
  end if;

  if v_rel is null then
    insert into public.relacionamentos (owner_id, empresa, nome, telefone, email, categoria, origem, observacao)
    values (v_dono, new.empresa, v_nome, new.telefone, new.email, 'Cliente',
            coalesce(new.origem, 'Lead'),
            nullif(new.mensagem_inicial, ''))
    returning id into v_rel;
  end if;

  update public.leads_recebidos set relacionamento_id = v_rel where id = new.id;

  if v_frio then
    v_etapa_frio := public.aura_etapa_da_chave(new.empresa, 'lead_frio');
    update public.relacionamentos set temperatura = 'frio' where id = v_rel;

    select o.id, o.etapa into v_op, v_op_etapa
    from public.oportunidades o
    where o.relacionamento_id = v_rel
      and coalesce(public.aura_chave_da_etapa(o.empresa, o.etapa), '') not in ('fechamento', 'perda')
    order by o.updated_at desc nulls last
    limit 1;

    if v_op is null then
      insert into public.oportunidades (owner_id, empresa, cliente, produto, valor, etapa, probabilidade, relacionamento_id, descricao)
      values (v_dono, new.empresa, v_nome,
              coalesce(nullif(new.resumo_ia,''), nullif(new.mensagem_inicial,''), 'Lead recebido'),
              0, v_etapa_frio, 'Baixa', v_rel,
              'Lead frio / curioso, marcado na tela de Leads. Origem: ' || coalesce(new.origem,'não informada') || '.');
    elsif coalesce(public.aura_chave_da_etapa(new.empresa, v_op_etapa), '') in ('prospeccao', 'qualificacao') then
      update public.oportunidades
         set etapa = v_etapa_frio, probabilidade = 'Baixa', updated_at = now()
       where id = v_op;
    end if;
    return new;
  end if;

  if coalesce(old.status, '') = 'lead_frio' then
    update public.oportunidades o
       set etapa = public.aura_etapa_da_chave(new.empresa, 'prospeccao'), updated_at = now()
     where o.relacionamento_id = v_rel
       and public.aura_chave_da_etapa(o.empresa, o.etapa) = 'lead_frio';
  end if;

  if not exists (
    select 1 from public.oportunidades o
    where o.relacionamento_id = v_rel
      and coalesce(public.aura_chave_da_etapa(o.empresa, o.etapa), '') not in ('fechamento', 'perda')
  ) then
    insert into public.oportunidades (owner_id, empresa, cliente, produto, valor, etapa, probabilidade, relacionamento_id, descricao)
    values (v_dono, new.empresa, v_nome,
            coalesce(nullif(new.resumo_ia,''), nullif(new.mensagem_inicial,''), 'Lead recebido'),
            0, public.aura_etapa_da_chave(new.empresa, 'prospeccao'),
            case new.urgencia when 'alta' then 'Alta' when 'baixa' then 'Baixa' else 'Média' end,
            v_rel,
            'Criado automaticamente a partir de um lead de ' || coalesce(new.origem,'origem não informada') || '.');
  end if;

  insert into public.notificacoes (vendedor_id, titulo, mensagem, tipo, acao_url)
  values (v_dono, 'Lead virou negócio no pipeline',
          v_nome || ' entrou no pipeline. Registre o próximo passo.',
          'lead', '/pipeline');

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.aura_migracoes()
 RETURNS TABLE(versao text, nome text, sql text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  select m.version, m.name, array_to_string(m.statements, E'\n\n')
  from supabase_migrations.schema_migrations m
  order by m.version;
$function$
;

CREATE OR REPLACE FUNCTION public.aura_mover_carteira(p_executor uuid, p_origem uuid, p_destino uuid, p_motivo text DEFAULT NULL::text, p_desativar_origem boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  exec_p public.profiles%rowtype;
  org_p  public.profiles%rowtype;
  dst_p  public.profiles%rowtype;
  n_rel int := 0; n_opo int := 0; n_tar int := 0; n_com int := 0;
  n_wa  int := 0; n_lead int := 0; n_pos int := 0;
begin
  select * into exec_p from public.profiles where id = p_executor;
  select * into org_p  from public.profiles where id = p_origem;
  select * into dst_p  from public.profiles where id = p_destino;

  if exec_p.id is null or exec_p.cargo <> 'Gestor' or exec_p.gestor_aprovado is not true then
    raise exception 'Só um gestor aprovado pode transferir carteira.';
  end if;
  if org_p.id is null or dst_p.id is null then
    raise exception 'Não encontrei quem entrega ou quem recebe a carteira.';
  end if;
  if p_origem = p_destino then
    raise exception 'Escolha duas pessoas diferentes.';
  end if;
  if dst_p.ativo is not true or dst_p.excluido_em is not null then
    raise exception 'Quem recebe a carteira precisa estar ativo no sistema.';
  end if;
  if exec_p.gestor_mestre is not true
     and (exec_p.empresa <> org_p.empresa or exec_p.empresa <> dst_p.empresa) then
    raise exception 'O gestor só transfere carteira dentro da própria loja.';
  end if;
  if org_p.empresa <> dst_p.empresa then
    raise exception 'A carteira não atravessa lojas: quem recebe precisa ser da mesma loja de quem entrega.';
  end if;

  update public.relacionamentos set owner_id = p_destino, updated_at = now()
   where owner_id = p_origem and empresa = org_p.empresa;
  get diagnostics n_rel = row_count;

  -- Só o que ainda está em aberto, segundo o funil DESTA loja. Negócio já
  -- ganho ou perdido fica com quem o fechou: é o histórico dele.
  update public.oportunidades set owner_id = p_destino, updated_at = now()
   where owner_id = p_origem and empresa = org_p.empresa
     and coalesce(public.aura_chave_da_etapa(empresa, etapa), '') not in ('fechamento', 'perda');
  get diagnostics n_opo = row_count;

  update public.tarefas set vendedor_id = p_destino, updated_at = now()
   where vendedor_id = p_origem and concluida is not true;
  get diagnostics n_tar = row_count;

  update public.compromissos set owner_id = p_destino, atualizado_em = now()
   where owner_id = p_origem and concluido is not true;
  get diagnostics n_com = row_count;

  update public.whatsapp_ia_leads set owner_id = p_destino, updated_at = now()
   where owner_id = p_origem and empresa = org_p.empresa;
  get diagnostics n_wa = row_count;

  update public.leads_recebidos set vendedor_id = p_destino, updated_at = now()
   where vendedor_id = p_origem and respondido_em is null and descartado_em is null;
  get diagnostics n_lead = row_count;

  update public.pos_vendas set responsavel_id = p_destino, updated_at = now()
   where responsavel_id = p_origem and empresa = org_p.empresa;
  get diagnostics n_pos = row_count;

  if p_desativar_origem then
    update public.profiles set ativo = false where id = p_origem;
  end if;

  insert into public.transferencias_carteira (
    empresa, usuario_origem_id, usuario_destino_id, criado_por, motivo,
    relacionamentos_transferidos, oportunidades_transferidas, desativou_origem
  ) values (
    org_p.empresa, p_origem, p_destino, p_executor,
    coalesce(nullif(btrim(p_motivo), ''), 'Transferência pelo painel do gestor'),
    n_rel, n_opo, p_desativar_origem
  );

  return jsonb_build_object('sucesso', true,
    'relacionamentos', n_rel, 'oportunidades', n_opo, 'tarefas', n_tar,
    'compromissos', n_com, 'conversas', n_wa, 'leads_pendentes', n_lead,
    'pos_vendas', n_pos, 'desativou_origem', p_desativar_origem);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.aura_normalizar_email(valor text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
 SET search_path TO 'public'
AS $function$
  SELECT NULLIF(lower(btrim(COALESCE(valor, ''))), '');
$function$
;

CREATE OR REPLACE FUNCTION public.aura_normalizar_relacionamento()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.telefone_normalizado := public.aura_normalizar_telefone(NEW.telefone);
  NEW.email_normalizado := public.aura_normalizar_email(NEW.email);
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.aura_normalizar_telefone(valor text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
 SET search_path TO 'public'
AS $function$
  SELECT NULLIF(regexp_replace(COALESCE(valor, ''), '[^0-9]', '', 'g'), '');
$function$
;

CREATE OR REPLACE FUNCTION public.aura_ordem_da_chave(p_chave text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case p_chave
    when 'prospeccao'   then 0
    when 'qualificacao' then 1
    when 'apresentacao' then 2
    when 'followup'     then 3
    when 'negociacao'   then 4
    when 'fechamento'   then 5
    when 'posvenda'     then 6
    when 'perda'        then -1
    else -1
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.aura_ordem_etapa(e text)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.aura_ordem_da_chave(public.aura_chave_da_etapa('', e));
$function$
;

CREATE OR REPLACE FUNCTION public.aura_prob_da_chave(p_chave text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case p_chave
    when 'followup'   then 'Média'
    when 'negociacao' then 'Alta'
    when 'fechamento' then 'Alta'
    when 'posvenda'   then 'Alta'
    else 'Baixa'
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.aura_prob_etapa(e text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.aura_prob_da_chave(public.aura_chave_da_etapa('', e));
$function$
;

CREATE OR REPLACE FUNCTION public.aura_reabrir_card_desfaz_venda()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  etapa_ganho text;
begin
  etapa_ganho := public.aura_etapa_de_ganho(new.empresa);
  if old.etapa = etapa_ganho and new.etapa is distinct from etapa_ganho then
    -- Só a venda que o próprio fechamento criou e que ninguém completou. Uma
    -- venda com os detalhes preenchidos é trabalho de gente e não se apaga
    -- por causa de um card arrastado.
    delete from vendas
     where oportunidade_id = new.id
       and status = 'aguardando_detalhes';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.aura_responder_cobranca(p_id uuid, p_resposta jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_resposta is null or jsonb_typeof(p_resposta) <> 'object' then
    raise exception 'Resposta inválida.';
  end if;
  update public.aura_cobrancas
     set resposta = p_resposta, respondida_em = now()
   where id = p_id
     and vendedor_id = auth.uid();
  return found;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.aura_restaurar_funcionario(p_executor uuid, p_alvo uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  exec_p public.profiles%rowtype;
  alvo_p public.profiles%rowtype;
begin
  select * into exec_p from public.profiles where id = p_executor;
  select * into alvo_p from public.profiles where id = p_alvo;

  if exec_p.id is null or exec_p.gestor_mestre is not true then
    raise exception 'Só um gestor mestre pode trazer alguém de volta.';
  end if;
  if alvo_p.id is null then
    raise exception 'Não encontrei esta pessoa.';
  end if;
  if alvo_p.excluido_em is null then
    raise exception '% não está excluído.', alvo_p.nome;
  end if;

  -- Volta como estava no cargo, mas SEM os poderes: gestor volta esperando
  -- aprovacao e ninguem volta como mestre por conta propria. Devolver poder
  -- junto com o acesso seria dar de volta, sem ninguem decidir, o que a
  -- exclusao tirou.
  update public.profiles set
    excluido_em = null,
    excluido_por = null,
    excluido_motivo = null,
    ativo = true,
    gestor_mestre = false,
    gestor_aprovado = false
  where id = p_alvo;

  return jsonb_build_object(
    'sucesso', true,
    'nome', alvo_p.nome,
    'cargo', alvo_p.cargo,
    'empresa', alvo_p.empresa,
    'era_mestre', coalesce(alvo_p.gestor_mestre, false)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.aura_sync_atividade_relacionamento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  relacionamento_encontrado uuid;
  telefone_limpo text;
  email_limpo text;
  data_atividade timestamptz;
BEGIN
  telefone_limpo := public.aura_normalizar_telefone(NEW.cliente_telefone);
  email_limpo := public.aura_normalizar_email(NEW.cliente_email);
  data_atividade := COALESCE(NEW.ocorrida_em, NEW.created_at, now());

  -- Só vincula/cria relacionamento automaticamente quando a atividade é criada
  -- (ou quando ela nunca teve vínculo). Se o vínculo foi REMOVIDO de propósito
  -- (ex.: o relacionamento foi excluído e o ON DELETE SET NULL limpou a coluna),
  -- não recria o relacionamento — antes disso o contato "ressuscitava".
  IF NEW.relacionamento_id IS NULL
     AND (TG_OP = 'INSERT' OR OLD.relacionamento_id IS NULL)
     AND NULLIF(btrim(COALESCE(NEW.cliente_nome, NEW.contexto, '')), '') IS NOT NULL THEN
    SELECT r.id
      INTO relacionamento_encontrado
    FROM public.relacionamentos r
    WHERE r.empresa = NEW.empresa
      AND r.owner_id = NEW.owner_id
      AND (
        (telefone_limpo IS NOT NULL AND r.telefone_normalizado = telefone_limpo)
        OR (email_limpo IS NOT NULL AND r.email_normalizado = email_limpo)
        OR (
          telefone_limpo IS NULL
          AND email_limpo IS NULL
          AND lower(btrim(r.nome)) = lower(btrim(COALESCE(NEW.cliente_nome, NEW.contexto)))
        )
      )
    ORDER BY r.updated_at DESC NULLS LAST, r.created_at DESC
    LIMIT 1;

    IF relacionamento_encontrado IS NULL THEN
      INSERT INTO public.relacionamentos (
        owner_id, empresa, nome, categoria, cidade, telefone, email, temperatura,
        ultimo_contato, ultimo_contato_em, proximo_contato, proximo_contato_em,
        obras_indicadas, valor_gerado, tags
      )
      VALUES (
        NEW.owner_id,
        NEW.empresa,
        COALESCE(NULLIF(btrim(NEW.cliente_nome), ''), NULLIF(btrim(NEW.contexto), ''), 'Cliente sem nome'),
        COALESCE(NULLIF(btrim(NEW.cliente_categoria), ''), 'Cliente Final'),
        NULL,
        NULLIF(btrim(NEW.cliente_telefone), ''),
        NULLIF(btrim(NEW.cliente_email), ''),
        'ativo',
        to_char(data_atividade AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
        data_atividade,
        CASE WHEN NEW.proximo_contato_em IS NULL THEN NULL
             ELSE to_char(NEW.proximo_contato_em AT TIME ZONE 'UTC', 'YYYY-MM-DD') END,
        NEW.proximo_contato_em,
        0,
        0,
        ARRAY[]::text[]
      )
      RETURNING id INTO relacionamento_encontrado;
    END IF;

    NEW.relacionamento_id := relacionamento_encontrado;
  END IF;

  IF NEW.relacionamento_id IS NOT NULL THEN
    UPDATE public.relacionamentos
    SET
      nome = COALESCE(NULLIF(btrim(NEW.cliente_nome), ''), nome),
      telefone = COALESCE(NULLIF(btrim(NEW.cliente_telefone), ''), telefone),
      email = COALESCE(NULLIF(btrim(NEW.cliente_email), ''), email),
      categoria = COALESCE(NULLIF(btrim(NEW.cliente_categoria), ''), categoria),
      ultimo_contato = to_char(data_atividade AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
      ultimo_contato_em = data_atividade,
      proximo_contato = CASE
        WHEN NEW.proximo_contato_em IS NULL THEN proximo_contato
        ELSE to_char(NEW.proximo_contato_em AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      END,
      proximo_contato_em = COALESCE(NEW.proximo_contato_em, proximo_contato_em),
      updated_at = now()
    WHERE id = NEW.relacionamento_id
      AND empresa = NEW.empresa;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.aura_transferir_carteira(p_usuario_origem uuid, p_usuario_destino uuid, p_motivo text DEFAULT NULL::text, p_desativar_origem boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  perfil_executor public.profiles%ROWTYPE;
  perfil_origem public.profiles%ROWTYPE;
  perfil_destino public.profiles%ROWTYPE;
  total_relacionamentos integer := 0;
  total_oportunidades integer := 0;
BEGIN
  SELECT * INTO perfil_executor FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO perfil_origem FROM public.profiles WHERE id = p_usuario_origem;
  SELECT * INTO perfil_destino FROM public.profiles WHERE id = p_usuario_destino;

  IF perfil_executor.id IS NULL OR perfil_executor.cargo NOT IN ('Gestor', 'Diretor') THEN
    RAISE EXCEPTION 'Apenas Gestor ou Diretor pode transferir carteira.';
  END IF;

  IF perfil_origem.id IS NULL OR perfil_destino.id IS NULL THEN
    RAISE EXCEPTION 'Utilizador de origem ou destino não encontrado.';
  END IF;

  IF p_usuario_origem = p_usuario_destino THEN
    RAISE EXCEPTION 'Origem e destino devem ser utilizadores diferentes.';
  END IF;

  IF perfil_executor.cargo <> 'Diretor'
     AND (perfil_executor.empresa <> perfil_origem.empresa OR perfil_executor.empresa <> perfil_destino.empresa) THEN
    RAISE EXCEPTION 'O Gestor só pode transferir carteiras dentro da própria loja.';
  END IF;

  UPDATE public.relacionamentos
  SET owner_id = p_usuario_destino, updated_at = now()
  WHERE owner_id = p_usuario_origem
    AND empresa = perfil_origem.empresa;
  GET DIAGNOSTICS total_relacionamentos = ROW_COUNT;

  UPDATE public.oportunidades
  SET owner_id = p_usuario_destino, updated_at = now()
  WHERE owner_id = p_usuario_origem
    AND empresa = perfil_origem.empresa
    AND etapa NOT IN ('Fechados', 'Perdidos');
  GET DIAGNOSTICS total_oportunidades = ROW_COUNT;

  IF p_desativar_origem THEN
    UPDATE public.profiles SET ativo = false WHERE id = p_usuario_origem;
  END IF;

  INSERT INTO public.transferencias_carteira (
    empresa,
    usuario_origem_id,
    usuario_destino_id,
    criado_por,
    motivo,
    relacionamentos_transferidos,
    oportunidades_transferidas,
    desativou_origem
  )
  VALUES (
    perfil_origem.empresa,
    p_usuario_origem,
    p_usuario_destino,
    auth.uid(),
    p_motivo,
    total_relacionamentos,
    total_oportunidades,
    p_desativar_origem
  );

  RETURN jsonb_build_object(
    'sucesso', true,
    'relacionamentos_transferidos', total_relacionamentos,
    'oportunidades_transferidas', total_oportunidades,
    'usuario_origem_desativado', p_desativar_origem
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.aura_venda_fecha_pipeline()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_op uuid;
begin
  if new.oportunidade_id is not null or new.relacionamento_id is not null then
    -- Avisa o gatilho do card: esta transação já tem a venda; não crie outra.
    perform set_config('aura.venda_em_curso', 'sim', true);

    v_op := public.aura_avancar_oportunidade(
      new.oportunidade_id, new.relacionamento_id, 'fechamento',
      'Venda registrada: ' || to_char(coalesce(new.valor_fechado, new.valor), 'FM999G999G990D00'),
      true);

    if v_op is not null then
      if new.oportunidade_id is null then new.oportunidade_id := v_op; end if;
      update oportunidades
         set valor = case when coalesce(valor, 0) = 0 then coalesce(new.valor_fechado, new.valor) else valor end,
             produto = coalesce(produto, new.produto),
             updated_at = now()
       where id = v_op;
    end if;
  end if;
  if new.relacionamento_id is not null then
    update relacionamentos set temperatura = 'quente', ultimo_contato_em = now(), updated_at = now()
     where id = new.relacionamento_id;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.buscar_empresa_por_token(p_token uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select empresa from public.pos_vendas where token_avaliacao = p_token;
$function$
;

CREATE OR REPLACE FUNCTION public.campanha_do_anuncio(p_empresa text, p_chave text, p_nome text, p_canal text, p_criado_por uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
begin
  if p_empresa is null or p_chave is null or p_criado_por is null then
    return null;
  end if;

  insert into public.campanhas_marketing (empresa, nome, canal, status, chave_externa, criado_por, data_inicio)
  values (p_empresa, coalesce(p_nome, p_chave), coalesce(p_canal, 'meta'), 'ativa', p_chave, p_criado_por, current_date)
  on conflict (empresa, chave_externa) where chave_externa is not null
  do update set nome = excluded.nome
  returning id into v_id;

  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.cargo_atual()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select cargo from public.profiles where id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.contagem_atividades_recentes(dias integer DEFAULT 7)
 RETURNS TABLE(owner_id uuid, total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select a.owner_id, count(*)::bigint
  from public.atividades a
  join public.profiles p on p.id = a.owner_id
  where a.ocorrida_em >= now() - make_interval(days => greatest(dias, 0))
    and p.empresa = public.minha_empresa()
  group by a.owner_id;
$function$
;

CREATE OR REPLACE FUNCTION public.criar_pos_venda_apos_venda()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.pos_vendas (venda_id, empresa)
  values (new.id, new.empresa)
  on conflict (venda_id) do nothing;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.criar_pos_venda_automatico()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.pos_vendas (venda_id, empresa)
  values (new.id, new.empresa)
  on conflict (venda_id) do nothing;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.distribuir_lead_novo(p_lead_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_empresa text; v_sdr_id uuid; v_vendedor_id uuid; v_minutos int;
  v_dono uuid; v_rel uuid; v_tel text; v_tel_norm text; v_nome text;
  v_ja_tem_dono boolean;
begin
  select empresa, telefone, nome, relacionamento_id,
         (vendedor_id is not null or sdr_id is not null)
    into v_empresa, v_tel, v_nome, v_rel, v_ja_tem_dono
  from public.leads_recebidos where id = p_lead_id;

  if v_empresa is null then return; end if;

  if v_ja_tem_dono then
    select coalesce(vendedor_id, sdr_id) into v_dono
    from public.leads_recebidos where id = p_lead_id;
  else
    select coalesce(tempo_resposta_sdr_minutos, 15) into v_minutos
    from public.config_distribuicao_leads where empresa = v_empresa;
    if v_minutos is null then v_minutos := 15; end if;

    select p.id into v_sdr_id from public.profiles p
    where p.empresa = v_empresa and p.cargo = 'SDR'
      and p.ativo = true and p.excluido_em is null
    order by (select max(created_at) from public.leads_recebidos lr where lr.sdr_id = p.id) nulls first
    limit 1;

    if v_sdr_id is not null then
      update public.leads_recebidos
         set status = 'atribuido_sdr', sdr_id = v_sdr_id,
             prazo_resposta = now() + (v_minutos || ' minutes')::interval
       where id = p_lead_id;
      v_dono := v_sdr_id;
    else
      select p.id into v_vendedor_id from public.profiles p
      where p.empresa = v_empresa and p.cargo = 'Vendedor Interno'
        and p.ativo = true and p.excluido_em is null
      order by (select max(created_at) from public.leads_recebidos lr where lr.vendedor_id = p.id) nulls first
      limit 1;

      if v_vendedor_id is null then
        select p.id into v_vendedor_id from public.profiles p
        where p.empresa = v_empresa and p.cargo = 'Vendedor'
          and p.ativo = true and p.excluido_em is null
        order by (select max(created_at) from public.leads_recebidos lr where lr.vendedor_id = p.id) nulls first
        limit 1;
      end if;

      update public.leads_recebidos
         set status = 'repassado_vendedor', vendedor_id = v_vendedor_id,
             prazo_resposta = now() + (v_minutos || ' minutes')::interval
       where id = p_lead_id;
      v_dono := v_vendedor_id;
    end if;
  end if;

  if v_dono is null or v_rel is not null or v_tel is null then return; end if;

  v_tel_norm := public.aura_normalizar_telefone(v_tel);
  if v_tel_norm is null or v_tel_norm = '' then return; end if;

  select id into v_rel from public.relacionamentos
  where owner_id = v_dono and telefone_normalizado = v_tel_norm limit 1;

  if v_rel is null then
    insert into public.relacionamentos (
      owner_id, empresa, nome, categoria, cidade, telefone,
      temperatura, origem, observacao, ultimo_contato_em
    ) values (
      v_dono, v_empresa,
      coalesce(nullif(btrim(v_nome), ''), 'Lead WhatsApp ' || v_tel),
      'Cliente Final', 'Não informado', v_tel, 'quente', 'WhatsApp',
      'Lead recebido automaticamente e distribuído pelo AURA.', now()
    ) returning id into v_rel;
  end if;

  update public.leads_recebidos set relacionamento_id = v_rel where id = p_lead_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.equipe_do_site(p_empresa text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((
    select p.ativo is not false
       and (p.empresa = p_empresa or p.gestor_mestre = true)
    from public.profiles p
    where p.id = auth.uid()
  ), false);
$function$
;

CREATE OR REPLACE FUNCTION public.estampar_origem_da_venda()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  o public.origem_lead;
  c uuid;
begin
  if new.origem_lead is not null then
    return new;
  end if;
  if new.oportunidade_id is not null then
    select origem_lead, campanha_id into o, c
      from public.oportunidades where id = new.oportunidade_id;
  end if;
  if o is null and new.relacionamento_id is not null then
    select origem_lead, campanha_id into o, c
      from public.relacionamentos where id = new.relacionamento_id;
  end if;
  new.origem_lead := o;
  if new.campanha_id is null then
    new.campanha_id := c;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.estampar_origem_do_lead()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  o public.origem_lead;
  c uuid;
begin
  if new.origem_lead is not null then
    return new;
  end if;
  if new.relacionamento_id is not null then
    select origem_lead, campanha_id into o, c
      from public.relacionamentos where id = new.relacionamento_id;
  end if;
  new.origem_lead := o;
  if new.campanha_id is null then
    new.campanha_id := c;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.gestor_ativo()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (select p.cargo = 'Gestor' and p.gestor_aprovado and p.ativo is not false
       from profiles p where p.id = auth.uid()),
    false)
$function$
;

CREATE OR REPLACE FUNCTION public.gestor_mestre()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (select p.gestor_mestre and p.ativo is not false
       from profiles p where p.id = auth.uid()),
    false)
$function$
;

CREATE OR REPLACE FUNCTION public.impedir_venda_igual_no_dia()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_existente uuid;
begin
  select v.id into v_existente
  from public.vendas v
  where v.owner_id = new.owner_id
    and v.data = new.data
    and coalesce(v.valor_fechado, v.valor) = coalesce(new.valor_fechado, new.valor)
    and (
      (new.relacionamento_id is not null and v.relacionamento_id = new.relacionamento_id)
      or (new.relacionamento_id is null and lower(trim(v.cliente)) = lower(trim(new.cliente)))
    )
    and v.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  limit 1;

  if v_existente is not null then
    raise exception
      'Este cliente já tem uma venda igual registrada hoje (mesmo valor). Se for outra venda, use produto ou data diferente.'
      using errcode = '23505';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.meu_cargo()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select cargo from public.profiles where id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public.meu_gestor_aprovado()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.gestor_aprovado from public.profiles p where p.id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.meu_gestor_mestre()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.gestor_mestre from public.profiles p where p.id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.minha_empresa()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select empresa from public.profiles where id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.oportunidade_exige_valor()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_chave text;
begin
  if coalesce(current_setting('aura.venda_em_curso', true), '') = 'sim' then
    return new;
  end if;
  v_chave := coalesce(public.aura_chave_da_etapa(new.empresa, new.etapa), '');
  if v_chave not in ('negociacao', 'fechamento') then
    return new;
  end if;
  if coalesce(new.valor, 0) > 0 then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.etapa is not distinct from old.etapa and new.valor is not distinct from old.valor then
    return new;
  end if;
  raise exception 'Informe o valor do negócio antes de colocá-lo em %.', new.etapa
    using errcode = '23514',
          hint = 'A partir da Negociação o negócio precisa ter valor estimado.';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.orcamento_proxima_versao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  select coalesce(max(versao), 0) + 1 into new.versao
  from public.orcamentos_anexos where oportunidade_id = new.oportunidade_id;
  update public.oportunidades
     set orcamento_path = new.path, orcamento_nome = new.nome, updated_at = now()
   where id = new.oportunidade_id;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.pode_ver_marketing()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((
    select p.ativo is not false and p.cargo = 'Marketing'
    from public.profiles p where p.id = auth.uid()
  ), false) or public.vejo_a_loja_toda();
$function$
;

CREATE OR REPLACE FUNCTION public.pode_ver_todas_empresas()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((
    select p.ativo is not false
       and (p.cargo = 'Diretor'
            or (p.cargo = 'Gestor' and coalesce(p.gestor_mestre,false) and p.gestor_aprovado))
    from public.profiles p where p.id = auth.uid()
  ), false);
$function$
;

CREATE OR REPLACE FUNCTION public.preencher_empresa_compromisso()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.empresa is null then
    select empresa into new.empresa from public.profiles where id = new.owner_id;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_avaliacao_publica(p_token uuid, p_nota integer, p_comentario text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.pos_vendas
  set avaliou_loja = true, nota_avaliacao = p_nota, comentario_avaliacao = p_comentario, updated_at = now()
  where token_avaliacao = p_token and p_nota between 1 and 5;
  return found;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.repassar_leads_expirados()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  v_vendedor_id uuid;
  v_minutos int;
  v_total int := 0;
begin
  -- 1) SDR passou do prazo: o lead vai para um vendedor.
  for r in
    select id, empresa, nome, telefone from public.leads_recebidos
    where status = 'atribuido_sdr'
      and prazo_resposta is not null
      and prazo_resposta < now()
      and coalesce(natureza, 'lead') = 'lead'
  loop
    select coalesce(tempo_resposta_sdr_minutos, 15) into v_minutos
    from public.config_distribuicao_leads where empresa = r.empresa;
    if v_minutos is null then v_minutos := 15; end if;

    select p.id into v_vendedor_id
    from public.profiles p
    where p.empresa = r.empresa and p.cargo = 'Vendedor Interno' and p.ativo = true
    order by (
      select max(created_at) from public.leads_recebidos lr where lr.vendedor_id = p.id
    ) nulls first
    limit 1;

    if v_vendedor_id is null then
      select p.id into v_vendedor_id
      from public.profiles p
      where p.empresa = r.empresa and p.cargo = 'Vendedor' and p.ativo = true
      order by (
        select max(created_at) from public.leads_recebidos lr where lr.vendedor_id = p.id
      ) nulls first
      limit 1;
    end if;

    update public.leads_recebidos
    set status = 'repassado_vendedor',
        vendedor_id = v_vendedor_id,
        prazo_resposta = now() + (v_minutos || ' minutes')::interval
    where id = r.id;

    v_total := v_total + 1;
  end loop;

  -- 2) Vendedor também passou do prazo: agora o gestor é avisado de verdade.
  --    Cliente da casa e não-lead não são lead: não há prazo a cobrar.
  insert into public.notificacoes (vendedor_id, titulo, mensagem, tipo, acao_url)
  select g.id,
         'Lead sem resposta na ' || l.empresa,
         coalesce(nullif(btrim(l.nome), ''), l.telefone, 'Um lead')
           || ' passou do prazo de resposta. Origem: ' || coalesce(l.origem, 'não informada') || '.',
         'alerta',
         '/gestor'
  from public.leads_recebidos l
  join public.profiles g
    on g.cargo in ('Gestor', 'Diretor')
   and g.ativo = true
   and (g.cargo = 'Diretor' or g.empresa = l.empresa)
  where l.status = 'repassado_vendedor'
    and l.prazo_resposta is not null
    and l.prazo_resposta < now()
    and l.gestor_notificado = false
    and coalesce(l.natureza, 'lead') = 'lead';

  update public.leads_recebidos
  set gestor_notificado = true
  where status = 'repassado_vendedor'
    and prazo_resposta is not null
    and prazo_resposta < now()
    and gestor_notificado = false
    and coalesce(natureza, 'lead') = 'lead';

  return v_total;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tabelas_para_backup()
 RETURNS TABLE(tabela text, linhas bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Só o gestor mestre ou o diretor pode listar; o backup roda com a chave de
  -- serviço, que não passa por RLS, mas a função fica fechada para o resto.
  if not (coalesce(pode_ver_todas_empresas(), false) or auth.uid() is null) then
    raise exception 'sem permissão';
  end if;

  return query
  select c.relname::text,
         greatest(c.reltuples, 0)::bigint
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    -- Tabelas que se refazem sozinhas e só inchariam o arquivo de cada noite.
    and c.relname not in ('ia_uso', 'whatsapp_transcricoes')
  order by c.relname;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tocar_ultima_mensagem_conversa()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.whatsapp_conversas
  set ultima_mensagem_em = new.created_at,
      ultima_mensagem_preview = left(new.texto, 120)
  where id = new.conversa_id;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tocar_updated_at_compromisso_mensal()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tocar_updated_at_indicador()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.vejo_a_loja_toda()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((
    select p.ativo is not false
       and (p.cargo = 'Diretor' or (p.cargo = 'Gestor' and p.gestor_aprovado))
    from public.profiles p where p.id = auth.uid()
  ), false);
$function$
;

CREATE OR REPLACE FUNCTION public.venda_herda_campanha()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_campanha uuid;
  v_origem public.origem_lead;
begin
  -- Já atribuída (inclusive à mão por alguém): a decisão existente manda.
  if new.campanha_id is not null then
    return new;
  end if;

  if new.oportunidade_id is not null then
    select o.campanha_id, o.origem_lead into v_campanha, v_origem
    from public.oportunidades o where o.id = new.oportunidade_id;
  end if;

  if v_campanha is null and new.relacionamento_id is not null then
    select r.campanha_id, r.origem_lead into v_campanha, v_origem
    from public.relacionamentos r where r.id = new.relacionamento_id;
  end if;

  new.campanha_id := v_campanha;
  if new.origem_lead is null then new.origem_lead := v_origem; end if;

  return new;
end;
$function$
;

revoke execute on function public.atualizar_meta_atualizada_em() from public; grant execute on function public.atualizar_meta_atualizada_em() to postgres, service_role;
revoke execute on function public.aura_achar_ou_criar_relacionamento(p_owner uuid, p_empresa text, p_nome text, p_telefone text) from public; grant execute on function public.aura_achar_ou_criar_relacionamento(p_owner uuid, p_empresa text, p_nome text, p_telefone text) to postgres, service_role;
revoke execute on function public.aura_apagar_card_leva_a_venda() from public; grant execute on function public.aura_apagar_card_leva_a_venda() to postgres, service_role;
revoke execute on function public.aura_aprendizado_toca_atualizado_em() from public; grant execute on function public.aura_aprendizado_toca_atualizado_em() to postgres, service_role;
revoke execute on function public.aura_atividade_move_pipeline() from public; grant execute on function public.aura_atividade_move_pipeline() to postgres, service_role;
revoke execute on function public.aura_avancar_oportunidade(p_oportunidade_id uuid, p_relacionamento_id uuid, p_etapa text, p_motivo text, p_criar_se_nao_existir boolean) from public; grant execute on function public.aura_avancar_oportunidade(p_oportunidade_id uuid, p_relacionamento_id uuid, p_etapa text, p_motivo text, p_criar_se_nao_existir boolean) to postgres, service_role;
revoke execute on function public.aura_avisar_dono_do_lead() from public; grant execute on function public.aura_avisar_dono_do_lead() to postgres, service_role;
revoke execute on function public.aura_buscar_trechos(p_empresa text, p_conversa text, p_limite integer) from public; grant execute on function public.aura_buscar_trechos(p_empresa text, p_conversa text, p_limite integer) to postgres, service_role;
revoke execute on function public.aura_chave_da_etapa(p_empresa text, p_etapa text) from public; grant execute on function public.aura_chave_da_etapa(p_empresa text, p_etapa text) to authenticated, postgres, service_role;
revoke execute on function public.aura_criar_pedido_avaliacao() from public; grant execute on function public.aura_criar_pedido_avaliacao() to postgres, service_role;
revoke execute on function public.aura_criar_pos_venda() from public; grant execute on function public.aura_criar_pos_venda() to postgres, service_role;
revoke execute on function public.aura_distribuir_lead_ao_entrar() from public; grant execute on function public.aura_distribuir_lead_ao_entrar() to postgres, service_role;
revoke execute on function public.aura_esquema_ddl() from public; grant execute on function public.aura_esquema_ddl() to postgres, service_role;
revoke execute on function public.aura_etapa_da_chave(p_empresa text, p_chave text) from public; grant execute on function public.aura_etapa_da_chave(p_empresa text, p_chave text) to authenticated, postgres, service_role;
revoke execute on function public.aura_etapa_de_ganho(p_empresa text) from public; grant execute on function public.aura_etapa_de_ganho(p_empresa text) to authenticated, postgres, service_role;
revoke execute on function public.aura_etapa_de_perda(p_empresa text) from public; grant execute on function public.aura_etapa_de_perda(p_empresa text) to authenticated, postgres, service_role;
revoke execute on function public.aura_etapa_existe_no_funil() from public; grant execute on function public.aura_etapa_existe_no_funil() to authenticated, postgres, service_role;
revoke execute on function public.aura_excluir_funcionario(p_executor uuid, p_alvo uuid, p_herdeiro uuid, p_motivo text) from public; grant execute on function public.aura_excluir_funcionario(p_executor uuid, p_alvo uuid, p_herdeiro uuid, p_motivo text) to postgres, service_role;
revoke execute on function public.aura_fechar_card_cria_venda() from public; grant execute on function public.aura_fechar_card_cria_venda() to postgres, service_role;
revoke execute on function public.aura_impedir_venda_duplicada() from public; grant execute on function public.aura_impedir_venda_duplicada() to postgres, service_role;
revoke execute on function public.aura_lead_respondido_vira_pipeline() from public; grant execute on function public.aura_lead_respondido_vira_pipeline() to postgres, service_role;
revoke execute on function public.aura_migracoes() from public; grant execute on function public.aura_migracoes() to postgres, service_role;
revoke execute on function public.aura_mover_carteira(p_executor uuid, p_origem uuid, p_destino uuid, p_motivo text, p_desativar_origem boolean) from public; grant execute on function public.aura_mover_carteira(p_executor uuid, p_origem uuid, p_destino uuid, p_motivo text, p_desativar_origem boolean) to postgres, service_role;
revoke execute on function public.aura_normalizar_email(valor text) from public; grant execute on function public.aura_normalizar_email(valor text) to PUBLIC, anon, authenticated, postgres, service_role;
revoke execute on function public.aura_normalizar_relacionamento() from public; grant execute on function public.aura_normalizar_relacionamento() to postgres, service_role;
revoke execute on function public.aura_normalizar_telefone(valor text) from public; grant execute on function public.aura_normalizar_telefone(valor text) to PUBLIC, anon, authenticated, postgres, service_role;
revoke execute on function public.aura_ordem_da_chave(p_chave text) from public; grant execute on function public.aura_ordem_da_chave(p_chave text) to authenticated, postgres, service_role;
revoke execute on function public.aura_ordem_etapa(e text) from public; grant execute on function public.aura_ordem_etapa(e text) to authenticated, postgres, service_role;
revoke execute on function public.aura_prob_da_chave(p_chave text) from public; grant execute on function public.aura_prob_da_chave(p_chave text) to authenticated, postgres, service_role;
revoke execute on function public.aura_prob_etapa(e text) from public; grant execute on function public.aura_prob_etapa(e text) to authenticated, postgres, service_role;
revoke execute on function public.aura_reabrir_card_desfaz_venda() from public; grant execute on function public.aura_reabrir_card_desfaz_venda() to postgres, service_role;
revoke execute on function public.aura_responder_cobranca(p_id uuid, p_resposta jsonb) from public; grant execute on function public.aura_responder_cobranca(p_id uuid, p_resposta jsonb) to authenticated, postgres, service_role;
revoke execute on function public.aura_restaurar_funcionario(p_executor uuid, p_alvo uuid) from public; grant execute on function public.aura_restaurar_funcionario(p_executor uuid, p_alvo uuid) to postgres, service_role;
revoke execute on function public.aura_sync_atividade_relacionamento() from public; grant execute on function public.aura_sync_atividade_relacionamento() to postgres, service_role;
revoke execute on function public.aura_transferir_carteira(p_usuario_origem uuid, p_usuario_destino uuid, p_motivo text, p_desativar_origem boolean) from public; grant execute on function public.aura_transferir_carteira(p_usuario_origem uuid, p_usuario_destino uuid, p_motivo text, p_desativar_origem boolean) to postgres, service_role;
revoke execute on function public.aura_venda_fecha_pipeline() from public; grant execute on function public.aura_venda_fecha_pipeline() to postgres, service_role;
revoke execute on function public.buscar_empresa_por_token(p_token uuid) from public; grant execute on function public.buscar_empresa_por_token(p_token uuid) to PUBLIC, anon, authenticated, postgres, service_role;
revoke execute on function public.campanha_do_anuncio(p_empresa text, p_chave text, p_nome text, p_canal text, p_criado_por uuid) from public; grant execute on function public.campanha_do_anuncio(p_empresa text, p_chave text, p_nome text, p_canal text, p_criado_por uuid) to authenticated, postgres, service_role;
revoke execute on function public.cargo_atual() from public; grant execute on function public.cargo_atual() to authenticated, postgres, service_role;
revoke execute on function public.contagem_atividades_recentes(dias integer) from public; grant execute on function public.contagem_atividades_recentes(dias integer) to authenticated, postgres, service_role;
revoke execute on function public.criar_pos_venda_apos_venda() from public; grant execute on function public.criar_pos_venda_apos_venda() to postgres, service_role;
revoke execute on function public.criar_pos_venda_automatico() from public; grant execute on function public.criar_pos_venda_automatico() to postgres, service_role;
revoke execute on function public.distribuir_lead_novo(p_lead_id uuid) from public; grant execute on function public.distribuir_lead_novo(p_lead_id uuid) to postgres, service_role;
revoke execute on function public.equipe_do_site(p_empresa text) from public; grant execute on function public.equipe_do_site(p_empresa text) to authenticated, postgres, service_role;
revoke execute on function public.estampar_origem_da_venda() from public; grant execute on function public.estampar_origem_da_venda() to postgres, service_role;
revoke execute on function public.estampar_origem_do_lead() from public; grant execute on function public.estampar_origem_do_lead() to postgres, service_role;
revoke execute on function public.gestor_ativo() from public; grant execute on function public.gestor_ativo() to authenticated, postgres, service_role;
revoke execute on function public.gestor_mestre() from public; grant execute on function public.gestor_mestre() to authenticated, postgres, service_role;
revoke execute on function public.impedir_venda_igual_no_dia() from public; grant execute on function public.impedir_venda_igual_no_dia() to authenticated, postgres, service_role;
revoke execute on function public.meu_cargo() from public; grant execute on function public.meu_cargo() to authenticated, postgres, service_role;
revoke execute on function public.meu_gestor_aprovado() from public; grant execute on function public.meu_gestor_aprovado() to authenticated, postgres, service_role;
revoke execute on function public.meu_gestor_mestre() from public; grant execute on function public.meu_gestor_mestre() to authenticated, postgres, service_role;
revoke execute on function public.minha_empresa() from public; grant execute on function public.minha_empresa() to authenticated, postgres, service_role;
revoke execute on function public.oportunidade_exige_valor() from public; grant execute on function public.oportunidade_exige_valor() to postgres, service_role;
revoke execute on function public.orcamento_proxima_versao() from public; grant execute on function public.orcamento_proxima_versao() to authenticated, postgres, service_role;
revoke execute on function public.pode_ver_marketing() from public; grant execute on function public.pode_ver_marketing() to authenticated, postgres, service_role;
revoke execute on function public.pode_ver_todas_empresas() from public; grant execute on function public.pode_ver_todas_empresas() to authenticated, postgres, service_role;
revoke execute on function public.preencher_empresa_compromisso() from public; grant execute on function public.preencher_empresa_compromisso() to postgres, service_role;
revoke execute on function public.registrar_avaliacao_publica(p_token uuid, p_nota integer, p_comentario text) from public; grant execute on function public.registrar_avaliacao_publica(p_token uuid, p_nota integer, p_comentario text) to PUBLIC, anon, authenticated, postgres, service_role;
revoke execute on function public.repassar_leads_expirados() from public; grant execute on function public.repassar_leads_expirados() to postgres, service_role;
revoke execute on function public.tabelas_para_backup() from public; grant execute on function public.tabelas_para_backup() to authenticated, postgres, service_role;
revoke execute on function public.tocar_ultima_mensagem_conversa() from public; grant execute on function public.tocar_ultima_mensagem_conversa() to postgres, service_role;
revoke execute on function public.tocar_updated_at_compromisso_mensal() from public; grant execute on function public.tocar_updated_at_compromisso_mensal() to postgres, service_role;
revoke execute on function public.tocar_updated_at_indicador() from public; grant execute on function public.tocar_updated_at_indicador() to postgres, service_role;
revoke execute on function public.vejo_a_loja_toda() from public; grant execute on function public.vejo_a_loja_toda() to authenticated, postgres, service_role;
revoke execute on function public.venda_herda_campanha() from public; grant execute on function public.venda_herda_campanha() to authenticated, postgres, service_role;

create or replace view public.aura_ranking_vendas with (security_invoker=on) as  SELECT v.empresa,
    v.owner_id AS vendedor_id,
    p.nome AS vendedor_nome,
    date_trunc('month'::text, v.data::timestamp with time zone) AS mes,
    count(*)::integer AS total_vendas,
    COALESCE(sum(COALESCE(v.valor_fechado, v.valor)), 0::numeric)::numeric(14,2) AS valor_vendido,
    COALESCE(avg(COALESCE(v.valor_fechado, v.valor)), 0::numeric)::numeric(14,2) AS ticket_medio,
    count(*) FILTER (WHERE lower(COALESCE(v.forma_pagamento, ''::text)) = ANY (ARRAY['à vista'::text, 'a vista'::text, 'pix'::text, 'dinheiro'::text]))::integer AS vendas_a_vista,
    count(*) FILTER (WHERE COALESCE(v.quantidade_parcelas, 1) > 1)::integer AS vendas_parceladas,
    COALESCE(sum(COALESCE(v.comissao_valor, 0::numeric)), 0::numeric)::numeric(14,2) AS comissao_total
   FROM vendas v
     LEFT JOIN profiles p ON p.id = v.owner_id
  GROUP BY v.empresa, v.owner_id, p.nome, (date_trunc('month'::text, v.data::timestamp with time zone));

create or replace view public.aura_trechos_ativos with (security_invoker=true) as  SELECT t.id,
    t.material_id,
    t.empresa,
    t.ordem,
    t.origem,
    t.texto,
    t.nucleo
   FROM aura_material_trechos t
     JOIN aura_materiais m ON m.id = t.material_id
  WHERE m.ativo;

create or replace view public.campanhas_por_vendedor with (security_invoker=true) as  SELECT c.id AS campanha_id,
    c.empresa,
    c.nome AS campanha,
    c.canal,
    p.id AS vendedor_id,
    p.nome AS vendedor,
    count(DISTINCT r.id) AS leads,
    count(DISTINCT o.id) AS negocios,
    count(DISTINCT v.id) AS vendas_fechadas,
    COALESCE(sum(DISTINCT COALESCE(v.valor_fechado, v.valor)), 0::numeric) AS valor_gerado
   FROM campanhas_marketing c
     JOIN relacionamentos r ON r.campanha_id = c.id
     JOIN profiles p ON p.id = r.owner_id
     LEFT JOIN oportunidades o ON o.campanha_id = c.id AND o.owner_id = p.id
     LEFT JOIN vendas v ON v.campanha_id = c.id AND v.owner_id = p.id
  GROUP BY c.id, c.empresa, c.nome, c.canal, p.id, p.nome;

create or replace view public.campanhas_resumo with (security_invoker=true) as  SELECT id,
    empresa,
    nome,
    canal,
    status,
    data_inicio,
    data_fim,
    orcamento,
    leads_gerados,
    observacoes,
    criado_por,
    created_at,
    chave_externa,
    ( SELECT count(*) AS count
           FROM relacionamentos r
          WHERE r.campanha_id = c.id) AS leads,
    ( SELECT count(*) AS count
           FROM oportunidades o
          WHERE o.campanha_id = c.id) AS negocios,
    ( SELECT count(*) AS count
           FROM vendas v
          WHERE v.campanha_id = c.id) AS vendas_fechadas,
    ( SELECT COALESCE(sum(COALESCE(v.valor_fechado, v.valor)), 0::numeric) AS "coalesce"
           FROM vendas v
          WHERE v.campanha_id = c.id) AS valor_gerado,
    ( SELECT count(*) AS count
           FROM whatsapp_ia_leads w
          WHERE w.campanha_id = c.id) AS conversas
   FROM campanhas_marketing c;

create or replace view public.cliente_historico with (security_invoker=on) as  SELECT r.id AS relacionamento_id,
    r.owner_id,
    r.empresa,
    r.nome,
    r.categoria,
    count(v.id) AS compras,
    COALESCE(sum(COALESCE(v.valor_fechado, v.valor, 0::numeric)), 0::numeric) AS total_comprado,
    min(v.data) AS primeira_compra,
    max(v.data) AS ultima_compra,
    count(v.id) > 1 AS recorrente,
        CASE
            WHEN max(v.data) IS NOT NULL THEN CURRENT_DATE - max(v.data)
            ELSE NULL::integer
        END AS dias_desde_ultima_compra
   FROM relacionamentos r
     LEFT JOIN vendas v ON v.relacionamento_id = r.id
  GROUP BY r.id, r.owner_id, r.empresa, r.nome, r.categoria;

create or replace view public.meta_contas_visiveis with (security_invoker=on) as  SELECT id,
    empresa,
    ig_user_id,
    nome_usuario,
    conectado_em,
    ativo,
    token IS NOT NULL AND token <> ''::text AS conectada,
    token_expira_em
   FROM meta_contas;

create or replace view public.pontos_do_ano with (security_invoker=on) as  SELECT vendedor_id,
    empresa,
    "left"(mes, 4) AS ano,
    sum(pontos) AS pontos,
    sum(atividades) AS atividades,
    count(DISTINCT mes) AS meses_com_registro
   FROM pontos_do_mes p
  GROUP BY vendedor_id, empresa, ("left"(mes, 4));

create or replace view public.pontos_do_mes with (security_invoker=on) as  WITH de_atividade AS (
         SELECT a_1.owner_id,
            a_1.empresa,
            to_char(a_1.created_at, 'YYYY-MM'::text) AS mes,
            sum(COALESCE(r_mes.pontos, r_pad.pontos, 0::numeric)) AS pontos,
            count(*) AS quantidade
           FROM atividades a_1
             LEFT JOIN pontuacao_regras r_mes ON r_mes.empresa = a_1.empresa AND r_mes.tipo = 'atividade'::text AND r_mes.chave = a_1.tipo AND r_mes.mes = to_char(a_1.created_at, 'YYYY-MM'::text)
             LEFT JOIN pontuacao_regras r_pad ON r_pad.empresa = a_1.empresa AND r_pad.tipo = 'atividade'::text AND r_pad.chave = a_1.tipo AND r_pad.mes = 'padrao'::text
          WHERE a_1.owner_id IS NOT NULL
          GROUP BY a_1.owner_id, a_1.empresa, (to_char(a_1.created_at, 'YYYY-MM'::text))
        ), de_etapa AS (
         SELECT o.owner_id,
            o.empresa,
            to_char(COALESCE(o.updated_at, o.created_at), 'YYYY-MM'::text) AS mes,
            sum(COALESCE(r_mes.pontos, r_pad.pontos, 0::numeric)) AS pontos
           FROM oportunidades o
             LEFT JOIN pontuacao_regras r_mes ON r_mes.empresa = o.empresa AND r_mes.tipo = 'etapa'::text AND r_mes.chave = o.etapa AND r_mes.mes = to_char(COALESCE(o.updated_at, o.created_at), 'YYYY-MM'::text)
             LEFT JOIN pontuacao_regras r_pad ON r_pad.empresa = o.empresa AND r_pad.tipo = 'etapa'::text AND r_pad.chave = o.etapa AND r_pad.mes = 'padrao'::text
          WHERE o.owner_id IS NOT NULL
          GROUP BY o.owner_id, o.empresa, (to_char(COALESCE(o.updated_at, o.created_at), 'YYYY-MM'::text))
        )
 SELECT COALESCE(a.owner_id, e.owner_id) AS vendedor_id,
    COALESCE(a.empresa, e.empresa) AS empresa,
    COALESCE(a.mes, e.mes) AS mes,
    COALESCE(a.quantidade, 0::bigint) AS atividades,
    COALESCE(a.pontos, 0::numeric) AS pontos_atividades,
    COALESCE(e.pontos, 0::numeric) AS pontos_etapas,
    COALESCE(a.pontos, 0::numeric) + COALESCE(e.pontos, 0::numeric) AS pontos
   FROM de_atividade a
     FULL JOIN de_etapa e ON e.owner_id = a.owner_id AND e.empresa = a.empresa AND e.mes = a.mes;

create or replace view public.retorno_por_origem with (security_invoker=on) as  WITH leads AS (
         SELECT relacionamentos.empresa,
            relacionamentos.owner_id,
            relacionamentos.origem_lead,
            relacionamentos.campanha_id,
            to_char(relacionamentos.created_at, 'YYYY-MM'::text) AS mes,
            count(*) AS leads
           FROM relacionamentos
          WHERE relacionamentos.origem_lead IS NOT NULL
          GROUP BY relacionamentos.empresa, relacionamentos.owner_id, relacionamentos.origem_lead, relacionamentos.campanha_id, (to_char(relacionamentos.created_at, 'YYYY-MM'::text))
        ), fechadas AS (
         SELECT vendas.empresa,
            vendas.owner_id,
            vendas.origem_lead,
            vendas.campanha_id,
            to_char(vendas.data::timestamp with time zone, 'YYYY-MM'::text) AS mes,
            count(*) AS vendas,
            sum(COALESCE(vendas.valor_fechado, vendas.valor, 0::numeric)) AS faturamento
           FROM vendas
          WHERE vendas.origem_lead IS NOT NULL
          GROUP BY vendas.empresa, vendas.owner_id, vendas.origem_lead, vendas.campanha_id, (to_char(vendas.data::timestamp with time zone, 'YYYY-MM'::text))
        ), perdidas AS (
         SELECT oportunidades.empresa,
            oportunidades.owner_id,
            oportunidades.origem_lead,
            oportunidades.campanha_id,
            to_char(oportunidades.created_at, 'YYYY-MM'::text) AS mes,
            count(*) AS perdidas
           FROM oportunidades
          WHERE oportunidades.origem_lead IS NOT NULL AND oportunidades.etapa = 'Perdidos'::text
          GROUP BY oportunidades.empresa, oportunidades.owner_id, oportunidades.origem_lead, oportunidades.campanha_id, (to_char(oportunidades.created_at, 'YYYY-MM'::text))
        ), base AS (
         SELECT COALESCE(l.empresa, f.empresa, p.empresa) AS empresa,
            COALESCE(l.owner_id, f.owner_id, p.owner_id) AS owner_id,
            COALESCE(l.origem_lead, f.origem_lead, p.origem_lead) AS origem_lead,
            COALESCE(l.campanha_id, f.campanha_id, p.campanha_id) AS campanha_id,
            COALESCE(l.mes, f.mes, p.mes) AS mes,
            COALESCE(l.leads, 0::bigint) AS leads,
            COALESCE(f.vendas, 0::bigint) AS vendas,
            COALESCE(f.faturamento, 0::numeric) AS faturamento,
            COALESCE(p.perdidas, 0::bigint) AS perdidas
           FROM leads l
             FULL JOIN fechadas f ON f.empresa = l.empresa AND f.owner_id = l.owner_id AND f.origem_lead = l.origem_lead AND f.mes = l.mes AND NOT f.campanha_id IS DISTINCT FROM l.campanha_id
             FULL JOIN perdidas p ON p.empresa = COALESCE(l.empresa, f.empresa) AND p.owner_id = COALESCE(l.owner_id, f.owner_id) AND p.origem_lead = COALESCE(l.origem_lead, f.origem_lead) AND p.mes = COALESCE(l.mes, f.mes) AND NOT p.campanha_id IS DISTINCT FROM COALESCE(l.campanha_id, f.campanha_id)
        )
 SELECT b.empresa,
    b.owner_id,
    b.origem_lead,
    b.campanha_id,
    b.mes,
    b.leads,
    b.vendas,
    b.faturamento,
    b.perdidas,
    pr.nome AS vendedor,
    cm.nome AS campanha,
    cm.orcamento AS investido,
        CASE
            WHEN (b.vendas + b.perdidas) > 0 THEN round(100.0 * b.vendas::numeric / (b.vendas + b.perdidas)::numeric, 1)
            ELSE NULL::numeric
        END AS conversao_pct,
        CASE
            WHEN cm.orcamento IS NOT NULL AND cm.orcamento > 0::numeric THEN round(b.faturamento / cm.orcamento, 2)
            ELSE NULL::numeric
        END AS retorno_sobre_investido
   FROM base b
     LEFT JOIN profiles pr ON pr.id = b.owner_id
     LEFT JOIN campanhas_marketing cm ON cm.id = b.campanha_id;

CREATE TRIGGER atividades_estampa_origem BEFORE INSERT ON public.atividades FOR EACH ROW EXECUTE FUNCTION estampar_origem_do_lead();
CREATE TRIGGER trg_aura_atividade_move_pipeline AFTER INSERT ON public.atividades FOR EACH ROW EXECUTE FUNCTION aura_atividade_move_pipeline();
CREATE TRIGGER trg_aura_sync_atividade_relacionamento BEFORE INSERT OR UPDATE OF relacionamento_id, cliente_nome, cliente_telefone, cliente_email, cliente_categoria, ocorrida_em, proximo_contato_em ON public.atividades FOR EACH ROW EXECUTE FUNCTION aura_sync_atividade_relacionamento();
CREATE TRIGGER aura_aprendizado_atualizado_em BEFORE UPDATE ON public.aura_aprendizado FOR EACH ROW EXECUTE FUNCTION aura_aprendizado_toca_atualizado_em();
CREATE TRIGGER trg_preencher_empresa_compromisso BEFORE INSERT ON public.compromissos FOR EACH ROW EXECUTE FUNCTION preencher_empresa_compromisso();
CREATE TRIGGER trg_updated_at_compromisso_mensal BEFORE UPDATE ON public.compromissos_mensais FOR EACH ROW EXECUTE FUNCTION tocar_updated_at_compromisso_mensal();
CREATE TRIGGER trg_updated_at_indicador BEFORE UPDATE ON public.indicadores_semanais FOR EACH ROW EXECUTE FUNCTION tocar_updated_at_indicador();
CREATE TRIGGER trg_aura_avisar_dono_do_lead AFTER INSERT OR UPDATE OF sdr_id, vendedor_id ON public.leads_recebidos FOR EACH ROW EXECUTE FUNCTION aura_avisar_dono_do_lead();
CREATE TRIGGER trg_aura_distribuir_lead_ao_entrar AFTER INSERT ON public.leads_recebidos FOR EACH ROW EXECUTE FUNCTION aura_distribuir_lead_ao_entrar();
CREATE TRIGGER trg_aura_lead_respondido_vira_pipeline AFTER UPDATE OF status ON public.leads_recebidos FOR EACH ROW EXECUTE FUNCTION aura_lead_respondido_vira_pipeline();
CREATE TRIGGER metas_atualizado_em BEFORE UPDATE ON public.metas FOR EACH ROW EXECUTE FUNCTION atualizar_meta_atualizada_em();
CREATE TRIGGER oportunidades_estampa_origem BEFORE INSERT ON public.oportunidades FOR EACH ROW EXECUTE FUNCTION estampar_origem_do_lead();
CREATE TRIGGER trg_aura_apagar_card_leva_a_venda BEFORE DELETE ON public.oportunidades FOR EACH ROW EXECUTE FUNCTION aura_apagar_card_leva_a_venda();
CREATE TRIGGER trg_aura_etapa_existe_no_funil BEFORE INSERT OR UPDATE OF etapa ON public.oportunidades FOR EACH ROW EXECUTE FUNCTION aura_etapa_existe_no_funil();
CREATE TRIGGER trg_aura_fechar_card_cria_venda AFTER INSERT OR UPDATE OF etapa ON public.oportunidades FOR EACH ROW EXECUTE FUNCTION aura_fechar_card_cria_venda();
CREATE TRIGGER trg_aura_reabrir_card_desfaz_venda AFTER UPDATE OF etapa ON public.oportunidades FOR EACH ROW EXECUTE FUNCTION aura_reabrir_card_desfaz_venda();
CREATE TRIGGER trg_oportunidade_exige_valor BEFORE INSERT OR UPDATE ON public.oportunidades FOR EACH ROW EXECUTE FUNCTION oportunidade_exige_valor();
CREATE TRIGGER trg_orcamento_proxima_versao BEFORE INSERT ON public.orcamentos_anexos FOR EACH ROW EXECUTE FUNCTION orcamento_proxima_versao();
CREATE TRIGGER trg_aura_normalizar_relacionamento BEFORE INSERT OR UPDATE OF telefone, email, nome, ultimo_contato, proximo_contato ON public.relacionamentos FOR EACH ROW EXECUTE FUNCTION aura_normalizar_relacionamento();
CREATE TRIGGER trg_0_impedir_venda_igual_no_dia BEFORE INSERT ON public.vendas FOR EACH ROW EXECUTE FUNCTION impedir_venda_igual_no_dia();
CREATE TRIGGER trg_aura_criar_pedido_avaliacao AFTER INSERT ON public.vendas FOR EACH ROW EXECUTE FUNCTION aura_criar_pedido_avaliacao();
CREATE TRIGGER trg_aura_criar_pos_venda AFTER INSERT OR UPDATE OF relacionamento_id, oportunidade_id, cliente, produto, valor, valor_fechado ON public.vendas FOR EACH ROW EXECUTE FUNCTION aura_criar_pos_venda();
CREATE TRIGGER trg_aura_impedir_venda_duplicada BEFORE INSERT OR UPDATE OF oportunidade_id ON public.vendas FOR EACH ROW EXECUTE FUNCTION aura_impedir_venda_duplicada();
CREATE TRIGGER trg_aura_venda_fecha_pipeline BEFORE INSERT ON public.vendas FOR EACH ROW EXECUTE FUNCTION aura_venda_fecha_pipeline();
CREATE TRIGGER trg_criar_pos_venda AFTER INSERT ON public.vendas FOR EACH ROW EXECUTE FUNCTION criar_pos_venda_automatico();
CREATE TRIGGER trg_criar_pos_venda_apos_venda AFTER INSERT ON public.vendas FOR EACH ROW EXECUTE FUNCTION criar_pos_venda_apos_venda();
CREATE TRIGGER venda_herda_campanha_trg BEFORE UPDATE OF oportunidade_id, relacionamento_id ON public.vendas FOR EACH ROW EXECUTE FUNCTION venda_herda_campanha();
CREATE TRIGGER vendas_estampa_origem BEFORE INSERT ON public.vendas FOR EACH ROW EXECUTE FUNCTION estampar_origem_da_venda();

alter table public.acoes_pendentes_aprovacao enable row level security;
alter table public.agent_auto_responses enable row level security;
alter table public.agent_notifications enable row level security;
alter table public.agent_suggestions enable row level security;
alter table public.atividades enable row level security;
alter table public.aura_agent_logs enable row level security;
alter table public.aura_aprendizado enable row level security;
alter table public.aura_aprendizado_origem enable row level security;
alter table public.aura_cobrancas enable row level security;
alter table public.aura_feedback_fechamento enable row level security;
alter table public.aura_materiais enable row level security;
alter table public.aura_material_trechos enable row level security;
alter table public.aura_recomendacoes enable row level security;
alter table public.aura_sugestoes_resultado enable row level security;
alter table public.aura_supervisoes enable row level security;
alter table public.campanhas_marketing enable row level security;
alter table public.coach_conversas enable row level security;
alter table public.coach_mensagens enable row level security;
alter table public.compromisso_mensal_campos enable row level security;
alter table public.compromissos enable row level security;
alter table public.compromissos_mensais enable row level security;
alter table public.config_atendimento enable row level security;
alter table public.config_avaliacao enable row level security;
alter table public.config_distribuicao_leads enable row level security;
alter table public.emails_enviados enable row level security;
alter table public.etapas_funil enable row level security;
alter table public.ia_config enable row level security;
alter table public.ia_creditos enable row level security;
alter table public.ia_falhas enable row level security;
alter table public.ia_uso enable row level security;
alter table public.indicadores_semanais enable row level security;
alter table public.leads_recebidos enable row level security;
alter table public.links_uteis enable row level security;
alter table public.mensagens_whatsapp enable row level security;
alter table public.meta_comentarios enable row level security;
alter table public.meta_contas enable row level security;
alter table public.meta_conversas enable row level security;
alter table public.meta_mensagens enable row level security;
alter table public.metas enable row level security;
alter table public.metas_atividade enable row level security;
alter table public.metas_indicadores enable row level security;
alter table public.motivos_perda enable row level security;
alter table public.niveis_performance enable row level security;
alter table public.notificacoes enable row level security;
alter table public.oportunidades enable row level security;
alter table public.orcamentos_anexos enable row level security;
alter table public.pedidos_avaliacao enable row level security;
alter table public.perguntas_frequentes enable row level security;
alter table public.perguntas_qualificacao enable row level security;
alter table public.planilha_leads_indicadores enable row level security;
alter table public.planilha_linhas enable row level security;
alter table public.playbook enable row level security;
alter table public.pontuacao_regras enable row level security;
alter table public.pos_venda_notas enable row level security;
alter table public.pos_vendas enable row level security;
alter table public.postagens_marketing enable row level security;
alter table public.premios enable row level security;
alter table public.profiles enable row level security;
alter table public.ranking_config enable row level security;
alter table public.ranking_criterios enable row level security;
alter table public.relacionamentos enable row level security;
alter table public.relatorios_periodicos enable row level security;
alter table public.site_chat_config enable row level security;
alter table public.site_conversas enable row level security;
alter table public.site_envios enable row level security;
alter table public.site_formularios enable row level security;
alter table public.site_mensagens enable row level security;
alter table public.site_paginas enable row level security;
alter table public.site_presenca enable row level security;
alter table public.tarefas enable row level security;
alter table public.transferencias_carteira enable row level security;
alter table public.treinamento_progresso enable row level security;
alter table public.treinamentos enable row level security;
alter table public.vendas enable row level security;
alter table public.whatsapp_auth_state enable row level security;
alter table public.whatsapp_contactos enable row level security;
alter table public.whatsapp_conversas enable row level security;
alter table public.whatsapp_ia_leads enable row level security;
alter table public.whatsapp_mensagens enable row level security;
alter table public.whatsapp_status enable row level security;
alter table public.whatsapp_transcricoes enable row level security;

create policy "Vendors can read their own auto responses" on public.agent_auto_responses as permissive for select to public using ((( SELECT auth.uid() AS uid) = vendor_id));
create policy "Vendors can update their own auto responses" on public.agent_auto_responses as permissive for update to public using ((( SELECT auth.uid() AS uid) = vendor_id));
create policy "Vendors can read their own notifications" on public.agent_notifications as permissive for select to public using ((( SELECT auth.uid() AS uid) = vendor_id));
create policy "Vendors can update their own notifications" on public.agent_notifications as permissive for update to public using ((( SELECT auth.uid() AS uid) = vendor_id));
create policy "Vendors can read their own suggestions" on public.agent_suggestions as permissive for select to public using ((( SELECT auth.uid() AS uid) = vendor_id));
create policy "Vendors can update their own suggestions" on public.agent_suggestions as permissive for update to public using ((( SELECT auth.uid() AS uid) = vendor_id));
create policy "Atualizar atividade do próprio usuário" on public.atividades as permissive for update to public using ((owner_id = ( SELECT auth.uid() AS uid))) with check (((owner_id = ( SELECT auth.uid() AS uid)) AND (empresa = ( SELECT profiles.empresa
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));
create policy "Criar atividade na própria loja" on public.atividades as permissive for insert to authenticated with check (((owner_id = ( SELECT auth.uid() AS uid)) AND ((empresa = minha_empresa()) OR pode_ver_todas_empresas())));
create policy "Excluir atividade do próprio usuário" on public.atividades as permissive for delete to public using ((owner_id = ( SELECT auth.uid() AS uid)));
create policy "Gestor e diretor veem todas as empresas" on public.atividades as permissive for select to public using ((pode_ver_todas_empresas() OR (vejo_a_loja_toda() AND (empresa = minha_empresa())) OR (owner_id = ( SELECT auth.uid() AS uid))));
create policy "Ver atividades conforme papel" on public.atividades as permissive for select to public using ((pode_ver_todas_empresas() OR (vejo_a_loja_toda() AND (empresa = minha_empresa())) OR (owner_id = ( SELECT auth.uid() AS uid))));
create policy "Gestor revisa o aprendizado da loja" on public.aura_aprendizado as permissive for all to authenticated using ((pode_ver_todas_empresas() OR (vejo_a_loja_toda() AND (empresa = minha_empresa())))) with check ((pode_ver_todas_empresas() OR (vejo_a_loja_toda() AND (empresa = minha_empresa()))));
create policy "Ver aprendizado da própria loja" on public.aura_aprendizado as permissive for select to authenticated using (((empresa = minha_empresa()) OR pode_ver_todas_empresas()));
create policy "Ver cobranças conforme papel" on public.aura_cobrancas as permissive for select to public using (((vendedor_id = ( SELECT auth.uid() AS uid)) OR pode_ver_todas_empresas() OR (vejo_a_loja_toda() AND (empresa = minha_empresa()))));
create policy "Gestor administra o feedback da loja" on public.aura_feedback_fechamento as permissive for delete to authenticated using ((pode_ver_todas_empresas() OR (vejo_a_loja_toda() AND (empresa = minha_empresa()))));
create policy "Ver o proprio feedback de fechamento" on public.aura_feedback_fechamento as permissive for select to authenticated using (((vendedor_id = ( SELECT auth.uid() AS uid)) OR pode_ver_todas_empresas() OR (vejo_a_loja_toda() AND (empresa = minha_empresa()))));
create policy "Gestor gerencia materiais da loja" on public.aura_materiais as permissive for all to authenticated using ((pode_ver_todas_empresas() OR (vejo_a_loja_toda() AND (empresa = minha_empresa())))) with check ((pode_ver_todas_empresas() OR (vejo_a_loja_toda() AND (empresa = minha_empresa()))));
create policy "Ver materiais da própria loja" on public.aura_materiais as permissive for select to authenticated using (((empresa = minha_empresa()) OR pode_ver_todas_empresas()));
create policy "Gestor administra os trechos da loja" on public.aura_material_trechos as permissive for all to authenticated using ((pode_ver_todas_empresas() OR (vejo_a_loja_toda() AND (empresa = minha_empresa())))) with check ((pode_ver_todas_empresas() OR (vejo_a_loja_toda() AND (empresa = minha_empresa()))));
create policy "Ver trechos da propria loja" on public.aura_material_trechos as permissive for select to authenticated using (((empresa = minha_empresa()) OR pode_ver_todas_empresas()));
create policy "Gestor vê recomendações da loja" on public.aura_recomendacoes as permissive for select to public using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.empresa = aura_recomendacoes.empresa) AND (p.cargo = ANY (ARRAY['Gestor'::text, 'Diretor'::text]))))));
create policy "Vendedor atualiza suas recomendações" on public.aura_recomendacoes as permissive for update to public using ((vendedor_id = ( SELECT auth.uid() AS uid))) with check ((vendedor_id = ( SELECT auth.uid() AS uid)));
create policy "Vendedor vê suas recomendações" on public.aura_recomendacoes as permissive for select to public using ((vendedor_id = ( SELECT auth.uid() AS uid)));
create policy "Gestor vê supervisões da loja" on public.aura_supervisoes as permissive for select to public using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.empresa = aura_supervisoes.empresa) AND (p.cargo = ANY (ARRAY['Gestor'::text, 'Diretor'::text]))))));
create policy "Vendedor vê suas supervisões" on public.aura_supervisoes as permissive for select to public using ((vendedor_id = ( SELECT auth.uid() AS uid)));
create policy "Marketing gerencia campanhas da própria loja" on public.campanhas_marketing as permissive for all to public using ((((meu_cargo() = 'Marketing'::text) AND (empresa = minha_empresa())) OR vejo_a_loja_toda())) with check ((((meu_cargo() = 'Marketing'::text) AND (empresa = minha_empresa())) OR vejo_a_loja_toda()));
create policy "Ver campanhas conforme papel" on public.campanhas_marketing as permissive for select to public using (((empresa = minha_empresa()) OR vejo_a_loja_toda()));
create policy "Apagar minhas conversas" on public.coach_conversas as permissive for delete to public using ((owner_id = ( SELECT auth.uid() AS uid)));
create policy "Atualizar minhas conversas" on public.coach_conversas as permissive for update to public using ((owner_id = ( SELECT auth.uid() AS uid)));
create policy "Criar minhas conversas" on public.coach_conversas as permissive for insert to public with check ((owner_id = ( SELECT auth.uid() AS uid)));
create policy "Ver minhas conversas" on public.coach_conversas as permissive for select to public using ((owner_id = ( SELECT auth.uid() AS uid)));
create policy "Apagar minhas próprias mensagens" on public.coach_mensagens as permissive for delete to public using ((owner_id = ( SELECT auth.uid() AS uid)));
create policy "Criar minhas próprias mensagens" on public.coach_mensagens as permissive for insert to public with check ((owner_id = ( SELECT auth.uid() AS uid)));
create policy "Ver minhas próprias mensagens" on public.coach_mensagens as permissive for select to public using ((owner_id = ( SELECT auth.uid() AS uid)));
create policy campos_extras_gestor on public.compromisso_mensal_campos as permissive for all to public using (vejo_a_loja_toda()) with check (vejo_a_loja_toda());
create policy campos_extras_ler on public.compromisso_mensal_campos as permissive for select to public using (true);
create policy "Apagar meus compromissos" on public.compromissos as permissive for delete to public using ((owner_id = ( SELECT auth.uid() AS uid)));
create policy "Atualizar meus compromissos" on public.compromissos as permissive for update to public using ((owner_id = ( SELECT auth.uid() AS uid)));
create policy "Criar meus compromissos" on public.compromissos as permissive for insert to public with check ((owner_id = ( SELECT auth.uid() AS uid)));
create policy "Ver compromissos conforme papel" on public.compromissos as permissive for select to public using (((owner_id = ( SELECT auth.uid() AS uid)) OR vejo_a_loja_toda()));
create policy "Gestor remove meta do vendedor da sua loja" on public.compromissos_mensais as permissive for delete to public using ((vejo_a_loja_toda() AND (pode_ver_todas_empresas() OR (EXISTS ( SELECT 1
   FROM profiles alvo
  WHERE ((alvo.id = compromissos_mensais.vendedor_id) AND (alvo.empresa = minha_empresa())))))));
create policy "Vendedor cria o próprio compromisso" on public.compromissos_mensais as permissive for insert to public with check ((vendedor_id = ( SELECT auth.uid() AS uid)));
create policy "Vendedor edita o próprio compromisso enquanto não aprovado" on public.compromissos_mensais as permissive for update to public using ((((vendedor_id = ( SELECT auth.uid() AS uid)) AND (status = ANY (ARRAY['rascunho'::text, 'ajuste_solicitado'::text]))) OR vejo_a_loja_toda()));
create policy "Vendedor vê e edita o próprio compromisso" on public.compromissos_mensais as permissive for select to public using (((vendedor_id = ( SELECT auth.uid() AS uid)) OR vejo_a_loja_toda()));
create policy "Equipe ve a config de atendimento" on public.config_atendimento as permissive for select to public using (((empresa = minha_empresa()) OR pode_ver_todas_empresas()));
create policy "Gestor edita a config de atendimento" on public.config_atendimento as permissive for all to public using ((pode_ver_todas_empresas() OR (vejo_a_loja_toda() AND (empresa = minha_empresa()))));
create policy config_avaliacao_escrever on public.config_avaliacao as permissive for all to public using (vejo_a_loja_toda()) with check (vejo_a_loja_toda());
create policy config_avaliacao_ler on public.config_avaliacao as permissive for select to public using (true);
create policy "Gestor edita config da própria loja" on public.config_distribuicao_leads as permissive for all to public using (((empresa = minha_empresa()) AND vejo_a_loja_toda())) with check (((empresa = minha_empresa()) AND vejo_a_loja_toda()));
create policy "Ver config da própria loja" on public.config_distribuicao_leads as permissive for select to public using ((empresa = minha_empresa()));
create policy "Equipe ve as etapas da loja" on public.etapas_funil as permissive for select to public using (((empresa = minha_empresa()) OR pode_ver_todas_empresas()));
create policy "Gestor edita as etapas da loja" on public.etapas_funil as permissive for all to public using ((pode_ver_todas_empresas() OR (vejo_a_loja_toda() AND (empresa = minha_empresa()))));
create policy "Gestor ajusta a configuração da IA" on public.ia_config as permissive for all to authenticated using (vejo_a_loja_toda()) with check (vejo_a_loja_toda());
create policy "Gestor gerencia os créditos da IA" on public.ia_creditos as permissive for all to authenticated using (vejo_a_loja_toda()) with check (vejo_a_loja_toda());
create policy ia_falhas_gestor_le on public.ia_falhas as permissive for select to public using (vejo_a_loja_toda());
create policy "Gestor vê o consumo da IA" on public.ia_uso as permissive for select to authenticated using (vejo_a_loja_toda());
create policy "Trava de loja nos indicadores semanais" on public.indicadores_semanais as restrictive for select to authenticated using (((vendedor_id = ( SELECT auth.uid() AS uid)) OR vejo_a_loja_toda() OR ((meu_cargo() = 'Marketing'::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = indicadores_semanais.vendedor_id) AND (p.empresa = minha_empresa())))))));
create policy "Vendedor gerencia os próprios indicadores" on public.indicadores_semanais as permissive for all to public using (((vendedor_id = ( SELECT auth.uid() AS uid)) OR vejo_a_loja_toda())) with check (((vendedor_id = ( SELECT auth.uid() AS uid)) OR vejo_a_loja_toda()));
create policy "Ver indicadores conforme papel" on public.indicadores_semanais as permissive for select to public using (((vendedor_id = ( SELECT auth.uid() AS uid)) OR (meu_cargo() = ANY (ARRAY['Gestor'::text, 'Diretor'::text, 'Marketing'::text]))));
create policy "Atualizar leads conforme papel" on public.leads_recebidos as permissive for update to public using (((vendedor_id = ( SELECT auth.uid() AS uid)) OR (sdr_id = ( SELECT auth.uid() AS uid)) OR (vejo_a_loja_toda() AND (empresa = minha_empresa())) OR ((meu_cargo() = 'Marketing'::text) AND (empresa = minha_empresa())) OR pode_ver_todas_empresas()));
create policy "Criar leads na própria loja" on public.leads_recebidos as permissive for insert to authenticated with check (((empresa = minha_empresa()) OR pode_ver_todas_empresas()));
create policy "Excluir leads da própria empresa" on public.leads_recebidos as permissive for delete to public using (((vendedor_id = ( SELECT auth.uid() AS uid)) OR (sdr_id = ( SELECT auth.uid() AS uid)) OR (vejo_a_loja_toda() AND (empresa = minha_empresa())) OR pode_ver_todas_empresas()));
create policy "Marketing e gestão atualizam todos os leads" on public.leads_recebidos as permissive for update to public using (((vendedor_id = ( SELECT auth.uid() AS uid)) OR (sdr_id = ( SELECT auth.uid() AS uid)) OR (vejo_a_loja_toda() AND (empresa = minha_empresa())) OR ((meu_cargo() = 'Marketing'::text) AND (empresa = minha_empresa())) OR pode_ver_todas_empresas())) with check ((pode_ver_marketing() OR (empresa = minha_empresa())));
create policy "Marketing e gestão veem todos os leads" on public.leads_recebidos as permissive for select to public using ((pode_ver_todas_empresas() OR (vejo_a_loja_toda() AND (empresa = minha_empresa())) OR ((meu_cargo() = 'Marketing'::text) AND (empresa = minha_empresa())) OR (vendedor_id = ( SELECT auth.uid() AS uid)) OR (sdr_id = ( SELECT auth.uid() AS uid))));
create policy "Trava de loja nos leads" on public.leads_recebidos as restrictive for select to authenticated using ((pode_ver_todas_empresas() OR (vejo_a_loja_toda() AND (empresa = minha_empresa())) OR ((meu_cargo() = 'Marketing'::text) AND (empresa = minha_empresa())) OR (vendedor_id = ( SELECT auth.uid() AS uid)) OR (sdr_id = ( SELECT auth.uid() AS uid))));
create policy "Vendedores atualizam seus leads" on public.leads_recebidos as permissive for update to public using (((vendedor_id = ( SELECT auth.uid() AS uid)) OR (sdr_id = ( SELECT auth.uid() AS uid)) OR (vejo_a_loja_toda() AND (empresa = minha_empresa())) OR ((meu_cargo() = 'Marketing'::text) AND (empresa = minha_empresa())) OR pode_ver_todas_empresas())) with check ((( SELECT auth.uid() AS uid) = vendedor_id));
create policy "Vendedores criam leads" on public.leads_recebidos as permissive for insert to public with check ((( SELECT auth.uid() AS uid) = vendedor_id));
create policy "Vendedores veem seus leads" on public.leads_recebidos as permissive for select to public using ((pode_ver_todas_empresas() OR (vejo_a_loja_toda() AND (empresa = minha_empresa())) OR ((meu_cargo() = 'Marketing'::text) AND (empresa = minha_empresa())) OR (vendedor_id = ( SELECT auth.uid() AS uid)) OR (sdr_id = ( SELECT auth.uid() AS uid))));
create policy "Ver leads conforme papel" on public.leads_recebidos as permissive for select to public using ((pode_ver_todas_empresas() OR (vejo_a_loja_toda() AND (empresa = minha_empresa())) OR ((meu_cargo() = 'Marketing'::text) AND (empresa = minha_empresa())) OR (vendedor_id = ( SELECT auth.uid() AS uid)) OR (sdr_id = ( SELECT auth.uid() AS uid))));
create policy "Gestor apaga links da própria loja" on public.links_uteis as permissive for delete to public using (((empresa = minha_empresa()) AND vejo_a_loja_toda()));
create policy "Gestor cria links da própria loja" on public.links_uteis as permissive for insert to public with check (((empresa = minha_empresa()) AND vejo_a_loja_toda()));
create policy "Gestor edita links da própria loja" on public.links_uteis as permissive for update to public using (((empresa = minha_empresa()) AND vejo_a_loja_toda())) with check (((empresa = minha_empresa()) AND vejo_a_loja_toda()));
create policy "Ver links da própria loja" on public.links_uteis as permissive for select to public using ((empresa = minha_empresa()));
create policy meta_comentarios_da_loja on public.meta_comentarios as permissive for all to public using (((empresa = minha_empresa()) OR vejo_a_loja_toda())) with check (((empresa = minha_empresa()) OR vejo_a_loja_toda()));
create policy meta_conversas_da_loja on public.meta_conversas as permissive for all to public using (((empresa = minha_empresa()) OR vejo_a_loja_toda())) with check (((empresa = minha_empresa()) OR vejo_a_loja_toda()));
create policy meta_mensagens_da_loja on public.meta_mensagens as permissive for all to public using ((EXISTS ( SELECT 1
   FROM meta_conversas c
  WHERE ((c.id = meta_mensagens.conversa_id) AND ((c.empresa = minha_empresa()) OR vejo_a_loja_toda()))))) with check ((EXISTS ( SELECT 1
   FROM meta_conversas c
  WHERE ((c.id = meta_mensagens.conversa_id) AND ((c.empresa = minha_empresa()) OR vejo_a_loja_toda())))));
create policy "Atualizar metas conforme papel" on public.metas as permissive for update to public using (((owner_id = ( SELECT auth.uid() AS uid)) OR vejo_a_loja_toda()));
create policy "Criar metas conforme papel" on public.metas as permissive for insert to public with check (((owner_id = ( SELECT auth.uid() AS uid)) OR vejo_a_loja_toda()));
create policy "Usuário atualiza própria meta" on public.metas as permissive for update to public using ((owner_id = ( SELECT auth.uid() AS uid))) with check ((owner_id = ( SELECT auth.uid() AS uid)));
create policy "Usuário cria própria meta" on public.metas as permissive for insert to public with check ((owner_id = ( SELECT auth.uid() AS uid)));
create policy "Usuário exclui própria meta" on public.metas as permissive for delete to public using ((owner_id = ( SELECT auth.uid() AS uid)));
create policy "Usuário vê própria meta" on public.metas as permissive for select to public using ((owner_id = ( SELECT auth.uid() AS uid)));
create policy "Ver metas conforme papel" on public.metas as permissive for select to public using (((owner_id = ( SELECT auth.uid() AS uid)) OR pode_ver_todas_empresas() OR (EXISTS ( SELECT 1
   FROM profiles g,
    profiles d
  WHERE ((g.id = ( SELECT auth.uid() AS uid)) AND (g.cargo = ANY (ARRAY['Gestor'::text, 'Diretor'::text])) AND (d.id = metas.owner_id) AND (d.empresa = g.empresa))))));
create policy "Gestor gerencia metas de atividade" on public.metas_atividade as permissive for all to public using ((pode_ver_todas_empresas() OR (EXISTS ( SELECT 1
   FROM profiles g,
    profiles d
  WHERE ((g.id = ( SELECT auth.uid() AS uid)) AND (g.cargo = ANY (ARRAY['Gestor'::text, 'Diretor'::text])) AND (d.id = metas_atividade.vendedor_id) AND (d.empresa = g.empresa)))))) with check (vejo_a_loja_toda());
create policy "Ver metas de atividade conforme papel" on public.metas_atividade as permissive for select to public using (((vendedor_id = ( SELECT auth.uid() AS uid)) OR pode_ver_todas_empresas() OR (EXISTS ( SELECT 1
   FROM profiles g,
    profiles d
  WHERE ((g.id = ( SELECT auth.uid() AS uid)) AND (g.cargo = ANY (ARRAY['Gestor'::text, 'Diretor'::text])) AND (d.id = metas_atividade.vendedor_id) AND (d.empresa = g.empresa))))));
create policy metas_atividade_propria on public.metas_atividade as permissive for all to public using ((vendedor_id = ( SELECT auth.uid() AS uid))) with check ((vendedor_id = ( SELECT auth.uid() AS uid)));
create policy "Gestor gerencia metas de indicadores" on public.metas_indicadores as permissive for all to public using (vejo_a_loja_toda()) with check (vejo_a_loja_toda());
create policy "Ver metas de indicadores conforme papel" on public.metas_indicadores as permissive for select to public using (((vendedor_id = ( SELECT auth.uid() AS uid)) OR (meu_cargo() = ANY (ARRAY['Gestor'::text, 'Diretor'::text, 'Marketing'::text]))));
create policy "Gestor apaga níveis da própria loja" on public.niveis_performance as permissive for delete to public using (((empresa = minha_empresa()) AND vejo_a_loja_toda()));
create policy "Gestor cria níveis da própria loja" on public.niveis_performance as permissive for insert to public with check (((empresa = minha_empresa()) AND vejo_a_loja_toda()));
create policy "Ver níveis da própria loja" on public.niveis_performance as permissive for select to public using ((empresa = minha_empresa()));
create policy "Gestor notifica vendedor da sua loja" on public.notificacoes as permissive for insert to public with check (((vendedor_id = ( SELECT auth.uid() AS uid)) OR (vejo_a_loja_toda() AND (pode_ver_todas_empresas() OR (EXISTS ( SELECT 1
   FROM profiles alvo
  WHERE ((alvo.id = notificacoes.vendedor_id) AND (alvo.empresa = minha_empresa()))))))));
create policy "Vendedores gerenciam suas notificações" on public.notificacoes as permissive for all to public using ((( SELECT auth.uid() AS uid) = vendedor_id));
create policy "Vendedores veem só suas notificações" on public.notificacoes as permissive for select to public using ((( SELECT auth.uid() AS uid) = vendedor_id));
create policy "Atualizar oportunidades conforme papel" on public.oportunidades as permissive for update to public using (((owner_id = ( SELECT auth.uid() AS uid)) OR (parceiro_id = ( SELECT auth.uid() AS uid)) OR (vejo_a_loja_toda() AND (empresa = minha_empresa())) OR pode_ver_todas_empresas()));
create policy "Criar oportunidade na própria loja" on public.oportunidades as permissive for insert to authenticated with check (((owner_id = ( SELECT auth.uid() AS uid)) AND ((empresa = minha_empresa()) OR pode_ver_todas_empresas())));
create policy "Excluir oportunidades conforme papel" on public.oportunidades as permissive for delete to public using (((owner_id = ( SELECT auth.uid() AS uid)) OR (vejo_a_loja_toda() AND (empresa = minha_empresa())) OR pode_ver_todas_empresas()));
create policy "Gestor e diretor veem todas as empresas" on public.oportunidades as permissive for select to public using ((pode_ver_todas_empresas() OR (vejo_a_loja_toda() AND (empresa = minha_empresa())) OR (owner_id = ( SELECT auth.uid() AS uid)) OR (parceiro_id = ( SELECT auth.uid() AS uid))));
create policy "Ver oportunidades conforme papel" on public.oportunidades as permissive for select to public using ((pode_ver_todas_empresas() OR (vejo_a_loja_toda() AND (empresa = minha_empresa())) OR (owner_id = ( SELECT auth.uid() AS uid)) OR (parceiro_id = ( SELECT auth.uid() AS uid))));
create policy "Dono anexa orcamento" on public.orcamentos_anexos as permissive for insert to public with check (((owner_id = ( SELECT auth.uid() AS uid)) OR vejo_a_loja_toda()));
create policy "Dono ou gestor remove orcamento" on public.orcamentos_anexos as permissive for delete to public using (((owner_id = ( SELECT auth.uid() AS uid)) OR vejo_a_loja_toda()));
create policy "Dono ou gestor ve os orcamentos" on public.orcamentos_anexos as permissive for select to public using (((owner_id = ( SELECT auth.uid() AS uid)) OR vejo_a_loja_toda()));
create policy pedidos_avaliacao_atualizar on public.pedidos_avaliacao as permissive for update to public using (((vendedor_id = ( SELECT auth.uid() AS uid)) OR vejo_a_loja_toda())) with check (((vendedor_id = ( SELECT auth.uid() AS uid)) OR vejo_a_loja_toda()));
create policy pedidos_avaliacao_ler on public.pedidos_avaliacao as permissive for select to public using (((vendedor_id = ( SELECT auth.uid() AS uid)) OR vejo_a_loja_toda()));
create policy "Gestor apaga FAQ da própria loja" on public.perguntas_frequentes as permissive for delete to public using (((empresa = minha_empresa()) AND vejo_a_loja_toda()));
create policy "Gestor cria FAQ da própria loja" on public.perguntas_frequentes as permissive for insert to public with check (((empresa = minha_empresa()) AND vejo_a_loja_toda()));
create policy "Trava de loja no FAQ" on public.perguntas_frequentes as restrictive for select to authenticated using (((empresa = minha_empresa()) OR vejo_a_loja_toda()));
create policy "Usuário autenticado vê FAQ comercial" on public.perguntas_frequentes as permissive for select to public using ((( SELECT auth.uid() AS uid) IS NOT NULL));
create policy "Ver FAQ da própria loja" on public.perguntas_frequentes as permissive for select to public using ((empresa = minha_empresa()));
create policy "Gestores podem gerenciar" on public.perguntas_qualificacao as permissive for all to public using (((( SELECT auth.jwt() AS jwt) ->> 'cargo'::text) = 'Gestor'::text));
create policy "Trava de loja nas perguntas de qualificação" on public.perguntas_qualificacao as restrictive for select to authenticated using (((empresa = minha_empresa()) OR vejo_a_loja_toda()));
create policy "Vendedores podem ver perguntas" on public.perguntas_qualificacao as permissive for select to public using (true);
create policy "Marketing e gestão veem todos indicadores" on public.planilha_leads_indicadores as permissive for select to public using ((pode_ver_marketing() OR (usuario_id = ( SELECT auth.uid() AS uid))));
create policy "Marketing gerencia indicadores" on public.planilha_leads_indicadores as permissive for all to public using ((pode_ver_marketing() OR (usuario_id = ( SELECT auth.uid() AS uid)))) with check ((pode_ver_marketing() OR (usuario_id = ( SELECT auth.uid() AS uid))));
create policy "Trava de loja na planilha de indicadores" on public.planilha_leads_indicadores as restrictive for select to authenticated using (((usuario_id = ( SELECT auth.uid() AS uid)) OR vejo_a_loja_toda() OR ((meu_cargo() = 'Marketing'::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = planilha_leads_indicadores.usuario_id) AND (p.empresa = minha_empresa())))))));
create policy marketing_see_all on public.planilha_leads_indicadores as permissive for select to public using (((usuario_id = ( SELECT auth.uid() AS uid)) OR pode_ver_todas_empresas() OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.ativo IS NOT FALSE) AND (p.cargo = ANY (ARRAY['Gestor'::text, 'Diretor'::text, 'Marketing'::text])) AND (EXISTS ( SELECT 1
           FROM profiles d
          WHERE ((d.id = planilha_leads_indicadores.usuario_id) AND (d.empresa = p.empresa)))))))));
create policy vendedor_edit_own on public.planilha_leads_indicadores as permissive for update to public using ((( SELECT auth.uid() AS uid) = usuario_id));
create policy vendedor_insert_own on public.planilha_leads_indicadores as permissive for insert to public with check ((( SELECT auth.uid() AS uid) = usuario_id));
create policy vendedor_see_own on public.planilha_leads_indicadores as permissive for select to public using ((( SELECT auth.uid() AS uid) = usuario_id));
create policy planilha_linhas_gestor_escreve on public.planilha_linhas as permissive for all to public using (vejo_a_loja_toda()) with check (vejo_a_loja_toda());
create policy planilha_linhas_leitura on public.planilha_linhas as permissive for select to public using (((empresa = minha_empresa()) OR (meu_cargo() = ANY (ARRAY['Gestor'::text, 'Diretor'::text, 'Marketing'::text]))));
create policy "Atualizar playbook da própria loja" on public.playbook as permissive for update to public using ((empresa = ( SELECT profiles.empresa
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));
create policy "Criar playbook da própria loja" on public.playbook as permissive for insert to public with check ((empresa = ( SELECT profiles.empresa
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));
create policy "Ver playbook da própria loja" on public.playbook as permissive for select to public using ((empresa = ( SELECT profiles.empresa
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));
create policy "Equipe ve as regras de pontuacao" on public.pontuacao_regras as permissive for select to authenticated using (((empresa = minha_empresa()) OR pode_ver_todas_empresas()));
create policy "Gestor define a pontuacao" on public.pontuacao_regras as permissive for all to authenticated using ((pode_ver_todas_empresas() OR (vejo_a_loja_toda() AND (empresa = minha_empresa())))) with check ((pode_ver_todas_empresas() OR (vejo_a_loja_toda() AND (empresa = minha_empresa()))));
create policy "Criar notas conforme papel" on public.pos_venda_notas as permissive for insert to public with check ((EXISTS ( SELECT 1
   FROM pos_vendas pv
  WHERE ((pv.id = pos_venda_notas.pos_venda_id) AND ((meu_cargo() = 'Diretor'::text) OR ((meu_cargo() = ANY (ARRAY['Pós-venda'::text, 'Gestor'::text])) AND (pv.empresa = minha_empresa())))))));
create policy "Usuários consultam notas da empresa" on public.pos_venda_notas as permissive for select to public using ((EXISTS ( SELECT 1
   FROM pos_vendas pv
  WHERE ((pv.id = pos_venda_notas.pos_venda_id) AND (pv.empresa = ( SELECT p.empresa
           FROM profiles p
          WHERE (p.id = ( SELECT auth.uid() AS uid))))))));
create policy "Usuários criam notas da empresa" on public.pos_venda_notas as permissive for insert to public with check ((EXISTS ( SELECT 1
   FROM pos_vendas pv
  WHERE ((pv.id = pos_venda_notas.pos_venda_id) AND (pv.empresa = ( SELECT p.empresa
           FROM profiles p
          WHERE (p.id = ( SELECT auth.uid() AS uid))))))));
create policy "Ver notas conforme papel" on public.pos_venda_notas as permissive for select to public using ((EXISTS ( SELECT 1
   FROM pos_vendas pv
  WHERE ((pv.id = pos_venda_notas.pos_venda_id) AND ((meu_cargo() = 'Diretor'::text) OR ((meu_cargo() = ANY (ARRAY['Pós-venda'::text, 'Gestor'::text])) AND (pv.empresa = minha_empresa())))))));
create policy "Atualizar pós-vendas conforme papel" on public.pos_vendas as permissive for update to public using ((vejo_a_loja_toda() OR ((meu_cargo() = 'Pós-venda'::text) AND (empresa = minha_empresa()))));
create policy "Usuários atualizam pós-vendas da empresa" on public.pos_vendas as permissive for update to public using ((empresa = ( SELECT p.empresa
   FROM profiles p
  WHERE (p.id = ( SELECT auth.uid() AS uid)))));
create policy "Usuários consultam pós-vendas da empresa" on public.pos_vendas as permissive for select to public using (((vendedor_id = ( SELECT auth.uid() AS uid)) OR (responsavel_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM vendas v
  WHERE ((v.id = pos_vendas.venda_id) AND (v.owner_id = ( SELECT auth.uid() AS uid))))) OR ((meu_cargo() = 'Pós-venda'::text) AND (empresa = minha_empresa())) OR (vejo_a_loja_toda() AND (empresa = minha_empresa())) OR pode_ver_todas_empresas()));
create policy "Ver pós-vendas conforme papel" on public.pos_vendas as permissive for select to public using (((vendedor_id = ( SELECT auth.uid() AS uid)) OR (responsavel_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM vendas v
  WHERE ((v.id = pos_vendas.venda_id) AND (v.owner_id = ( SELECT auth.uid() AS uid))))) OR ((meu_cargo() = 'Pós-venda'::text) AND (empresa = minha_empresa())) OR (vejo_a_loja_toda() AND (empresa = minha_empresa())) OR pode_ver_todas_empresas()));
create policy pos_vendas_insert on public.pos_vendas as permissive for insert to authenticated with check (((vendedor_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.ativo = true) AND ((p.cargo = 'Diretor'::text) OR ((p.cargo = ANY (ARRAY['Gestor'::text, 'Pós-venda'::text])) AND (p.empresa = pos_vendas.empresa))))))));
create policy pos_vendas_select on public.pos_vendas as permissive for select to authenticated using (((vendedor_id = ( SELECT auth.uid() AS uid)) OR (responsavel_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM vendas v
  WHERE ((v.id = pos_vendas.venda_id) AND (v.owner_id = ( SELECT auth.uid() AS uid))))) OR ((meu_cargo() = 'Pós-venda'::text) AND (empresa = minha_empresa())) OR (vejo_a_loja_toda() AND (empresa = minha_empresa())) OR pode_ver_todas_empresas()));
create policy pos_vendas_update on public.pos_vendas as permissive for update to authenticated using (((responsavel_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.ativo = true) AND ((p.cargo = 'Diretor'::text) OR ((p.cargo = ANY (ARRAY['Gestor'::text, 'Pós-venda'::text])) AND (p.empresa = pos_vendas.empresa)))))))) with check (((responsavel_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.ativo = true) AND ((p.cargo = 'Diretor'::text) OR ((p.cargo = ANY (ARRAY['Gestor'::text, 'Pós-venda'::text])) AND (p.empresa = pos_vendas.empresa))))))));
create policy "Marketing gerencia postagens da própria loja" on public.postagens_marketing as permissive for all to public using ((((meu_cargo() = 'Marketing'::text) AND (empresa = minha_empresa())) OR vejo_a_loja_toda())) with check ((((meu_cargo() = 'Marketing'::text) AND (empresa = minha_empresa())) OR vejo_a_loja_toda()));
create policy "Ver postagens conforme papel" on public.postagens_marketing as permissive for select to public using (((empresa = minha_empresa()) OR vejo_a_loja_toda()));
create policy "Equipe ve os premios" on public.premios as permissive for select to authenticated using (((empresa = minha_empresa()) OR pode_ver_todas_empresas()));
create policy "Gestor define os premios" on public.premios as permissive for all to authenticated using ((pode_ver_todas_empresas() OR (vejo_a_loja_toda() AND (empresa = minha_empresa())))) with check ((pode_ver_todas_empresas() OR (vejo_a_loja_toda() AND (empresa = minha_empresa()))));
create policy "Equipe visível para a mesma empresa" on public.profiles as permissive for select to public using (((( SELECT auth.uid() AS uid) = id) OR (empresa = minha_empresa())));
create policy "Gestor desativa vendedor da própria loja" on public.profiles as permissive for update to public using (((meu_cargo() = 'Diretor'::text) OR (vejo_a_loja_toda() AND (empresa = minha_empresa())))) with check (((meu_cargo() = 'Diretor'::text) OR (vejo_a_loja_toda() AND (empresa = minha_empresa()))));
create policy "Gestor e diretor veem todos os perfis" on public.profiles as permissive for select to public using ((pode_ver_todas_empresas() OR (empresa = minha_empresa())));
create policy "Perfil visível apenas para o próprio usuário" on public.profiles as permissive for select to public using ((( SELECT auth.uid() AS uid) = id));
create policy "Usuário pode atualizar o próprio nome" on public.profiles as permissive for update to public using ((( SELECT auth.uid() AS uid) = id));
create policy "Usuário pode criar o próprio perfil" on public.profiles as permissive for insert to public with check (((( SELECT auth.uid() AS uid) = id) AND (gestor_mestre = false) AND (gestor_aprovado = false)));
create policy "Ver perfis conforme papel" on public.profiles as permissive for select to public using (((empresa = minha_empresa()) OR vejo_a_loja_toda()));
create policy profiles_nao_se_autopromove on public.profiles as restrictive for update to public using ((gestor_mestre() OR (id = ( SELECT auth.uid() AS uid)))) with check ((gestor_mestre() OR ((id = ( SELECT auth.uid() AS uid)) AND (NOT (cargo IS DISTINCT FROM meu_cargo())) AND (NOT (gestor_mestre IS DISTINCT FROM meu_gestor_mestre())) AND (NOT (gestor_aprovado IS DISTINCT FROM meu_gestor_aprovado())) AND ((COALESCE(minha_empresa(), ''::text) = ''::text) OR (NOT (empresa IS DISTINCT FROM minha_empresa()))))));
create policy ranking_config_gestor on public.ranking_config as permissive for all to public using (vejo_a_loja_toda()) with check (vejo_a_loja_toda());
create policy ranking_config_ler on public.ranking_config as permissive for select to public using (true);
create policy ranking_criterios_gestor on public.ranking_criterios as permissive for all to public using (vejo_a_loja_toda()) with check (vejo_a_loja_toda());
create policy ranking_criterios_ler on public.ranking_criterios as permissive for select to public using (true);
create policy "Atualizar relacionamentos conforme papel" on public.relacionamentos as permissive for update to public using (((owner_id = ( SELECT auth.uid() AS uid)) OR (parceiro_id = ( SELECT auth.uid() AS uid)) OR (vejo_a_loja_toda() AND (empresa = minha_empresa())) OR pode_ver_todas_empresas()));
create policy "Criar relacionamento na própria loja" on public.relacionamentos as permissive for insert to authenticated with check (((owner_id = ( SELECT auth.uid() AS uid)) AND ((empresa = minha_empresa()) OR pode_ver_todas_empresas())));
create policy "Excluir relacionamentos conforme papel" on public.relacionamentos as permissive for delete to public using (((owner_id = ( SELECT auth.uid() AS uid)) OR (vejo_a_loja_toda() AND (empresa = minha_empresa())) OR pode_ver_todas_empresas()));
create policy "Gestor e diretor veem todas as empresas" on public.relacionamentos as permissive for select to public using ((pode_ver_todas_empresas() OR (vejo_a_loja_toda() AND (empresa = minha_empresa())) OR (owner_id = ( SELECT auth.uid() AS uid)) OR (parceiro_id = ( SELECT auth.uid() AS uid))));
create policy "Ver relacionamentos conforme papel" on public.relacionamentos as permissive for select to public using ((pode_ver_todas_empresas() OR (vejo_a_loja_toda() AND (empresa = minha_empresa())) OR (owner_id = ( SELECT auth.uid() AS uid)) OR (parceiro_id = ( SELECT auth.uid() AS uid))));
create policy "Criar relatórios conforme papel" on public.relatorios_periodicos as permissive for insert to public with check (((vendedor_id = ( SELECT auth.uid() AS uid)) OR vejo_a_loja_toda()));
create policy "Ver relatórios conforme papel" on public.relatorios_periodicos as permissive for select to public using (((vendedor_id = ( SELECT auth.uid() AS uid)) OR vejo_a_loja_toda()));
create policy site_chat_config_ver on public.site_chat_config as permissive for select to authenticated using (equipe_do_site(empresa));
create policy site_conversas_ver on public.site_conversas as permissive for select to authenticated using (equipe_do_site(empresa));
create policy site_envios_ver on public.site_envios as permissive for select to authenticated using (equipe_do_site(empresa));
create policy site_formularios_apagar on public.site_formularios as permissive for delete to authenticated using (equipe_do_site(empresa));
create policy site_formularios_criar on public.site_formularios as permissive for insert to authenticated with check (equipe_do_site(empresa));
create policy site_formularios_editar on public.site_formularios as permissive for update to authenticated using (equipe_do_site(empresa)) with check (equipe_do_site(empresa));
create policy site_formularios_ver on public.site_formularios as permissive for select to authenticated using (equipe_do_site(empresa));
create policy site_mensagens_ver on public.site_mensagens as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM site_conversas c
  WHERE ((c.id = site_mensagens.conversa_id) AND equipe_do_site(c.empresa)))));
create policy site_paginas_apagar on public.site_paginas as permissive for delete to authenticated using (equipe_do_site(empresa));
create policy site_paginas_criar on public.site_paginas as permissive for insert to authenticated with check (equipe_do_site(empresa));
create policy site_paginas_editar on public.site_paginas as permissive for update to authenticated using (equipe_do_site(empresa)) with check (equipe_do_site(empresa));
create policy site_paginas_ver on public.site_paginas as permissive for select to authenticated using (equipe_do_site(empresa));
create policy site_presenca_ver on public.site_presenca as permissive for select to authenticated using (equipe_do_site(empresa));
create policy "Usuário atualiza próprias tarefas" on public.tarefas as permissive for update to public using ((vendedor_id = ( SELECT auth.uid() AS uid))) with check ((vendedor_id = ( SELECT auth.uid() AS uid)));
create policy "Usuário cria próprias tarefas" on public.tarefas as permissive for insert to public with check ((vendedor_id = ( SELECT auth.uid() AS uid)));
create policy "Usuário exclui próprias tarefas" on public.tarefas as permissive for delete to public using ((vendedor_id = ( SELECT auth.uid() AS uid)));
create policy "Usuário vê próprias tarefas" on public.tarefas as permissive for select to public using ((vendedor_id = ( SELECT auth.uid() AS uid)));
create policy "Vendedores gerenciam suas tarefas" on public.tarefas as permissive for all to public using ((( SELECT auth.uid() AS uid) = vendedor_id));
create policy "Vendedores veem só suas tarefas" on public.tarefas as permissive for select to public using ((( SELECT auth.uid() AS uid) = vendedor_id));
create policy tarefas_obrigatoria_nao_se_apaga on public.tarefas as restrictive for delete to public using ((origem = 'vendedor'::text));
create policy "Gestor consulta transferências da própria empresa" on public.transferencias_carteira as permissive for select to public using ((empresa = ( SELECT p.empresa
   FROM profiles p
  WHERE (p.id = ( SELECT auth.uid() AS uid)))));
create policy "Gestor registra transferência da própria empresa" on public.transferencias_carteira as permissive for insert to public with check (((empresa = ( SELECT p.empresa
   FROM profiles p
  WHERE (p.id = ( SELECT auth.uid() AS uid)))) AND (criado_por = ( SELECT auth.uid() AS uid))));
create policy transferencias_select on public.transferencias_carteira as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.ativo = true) AND ((p.cargo = 'Diretor'::text) OR ((p.cargo = 'Gestor'::text) AND (p.empresa = transferencias_carteira.empresa)))))));
create policy "Atualizar meu progresso" on public.treinamento_progresso as permissive for update to public using ((owner_id = ( SELECT auth.uid() AS uid)));
create policy "Criar meu progresso" on public.treinamento_progresso as permissive for insert to public with check ((owner_id = ( SELECT auth.uid() AS uid)));
create policy "Usuário atualiza seu progresso" on public.treinamento_progresso as permissive for insert to public with check ((owner_id = ( SELECT auth.uid() AS uid)));
create policy "Usuário edita seu progresso" on public.treinamento_progresso as permissive for update to public using ((owner_id = ( SELECT auth.uid() AS uid))) with check ((owner_id = ( SELECT auth.uid() AS uid)));
create policy "Usuário vê seu progresso" on public.treinamento_progresso as permissive for select to public using ((owner_id = ( SELECT auth.uid() AS uid)));
create policy "Ver meu progresso" on public.treinamento_progresso as permissive for select to public using ((owner_id = ( SELECT auth.uid() AS uid)));
create policy "Gestor apaga treinamentos da própria loja" on public.treinamentos as permissive for delete to public using (((empresa = minha_empresa()) AND vejo_a_loja_toda()));
create policy "Gestor cria treinamentos da própria loja" on public.treinamentos as permissive for insert to public with check (((empresa = minha_empresa()) AND vejo_a_loja_toda()));
create policy "Trava de loja nos treinamentos" on public.treinamentos as restrictive for select to authenticated using (((empresa = minha_empresa()) OR vejo_a_loja_toda()));
create policy "Usuário autenticado vê treinamentos comerciais" on public.treinamentos as permissive for select to public using ((( SELECT auth.uid() AS uid) IS NOT NULL));
create policy "Ver treinamentos da própria loja" on public.treinamentos as permissive for select to public using ((empresa = minha_empresa()));
create policy "Atualizar vendas conforme papel" on public.vendas as permissive for update to authenticated using (((owner_id = ( SELECT auth.uid() AS uid)) OR (vejo_a_loja_toda() AND (empresa = minha_empresa())) OR pode_ver_todas_empresas())) with check (((owner_id = ( SELECT auth.uid() AS uid)) OR pode_ver_todas_empresas()));
create policy "Criar venda na própria loja" on public.vendas as permissive for insert to authenticated with check (((owner_id = ( SELECT auth.uid() AS uid)) AND ((empresa = minha_empresa()) OR pode_ver_todas_empresas())));
create policy "Excluir vendas conforme papel" on public.vendas as permissive for delete to authenticated using (((owner_id = ( SELECT auth.uid() AS uid)) OR (vejo_a_loja_toda() AND (empresa = minha_empresa())) OR pode_ver_todas_empresas()));
create policy "Gestor e diretor veem todas as empresas" on public.vendas as permissive for select to public using ((pode_ver_todas_empresas() OR (vejo_a_loja_toda() AND (empresa = minha_empresa())) OR (owner_id = ( SELECT auth.uid() AS uid)) OR (parceiro_id = ( SELECT auth.uid() AS uid))));
create policy "Ver vendas conforme papel" on public.vendas as permissive for select to public using ((pode_ver_todas_empresas() OR (vejo_a_loja_toda() AND (empresa = minha_empresa())) OR (owner_id = ( SELECT auth.uid() AS uid)) OR (parceiro_id = ( SELECT auth.uid() AS uid))));
create policy "Usuário logado vê contatos WhatsApp" on public.whatsapp_contactos as permissive for select to authenticated using (true);
create policy "Ver conversas WhatsApp da própria loja" on public.whatsapp_conversas as permissive for select to authenticated using (((empresa = minha_empresa()) OR pode_ver_todas_empresas()));
create policy "Dono gerencia seus leads de WhatsApp" on public.whatsapp_ia_leads as permissive for all to public using ((owner_id = ( SELECT auth.uid() AS uid))) with check ((owner_id = ( SELECT auth.uid() AS uid)));
create policy "Gestor e diretor veem leads de WhatsApp" on public.whatsapp_ia_leads as permissive for select to authenticated using (pode_ver_todas_empresas());
create policy "Gestor ve as conversas da loja" on public.whatsapp_ia_leads as permissive for select to authenticated using ((vejo_a_loja_toda() AND (empresa = minha_empresa())));
create policy "Parceiro ve a analise da conversa" on public.whatsapp_ia_leads as permissive for select to authenticated using ((parceiro_id = ( SELECT auth.uid() AS uid)));
create policy "Atualizar mensagens WhatsApp da própria loja" on public.whatsapp_mensagens as permissive for update to authenticated using ((EXISTS ( SELECT 1
   FROM whatsapp_conversas c
  WHERE ((c.id = whatsapp_mensagens.conversa_id) AND ((c.empresa = minha_empresa()) OR pode_ver_todas_empresas()))))) with check ((EXISTS ( SELECT 1
   FROM whatsapp_conversas c
  WHERE ((c.id = whatsapp_mensagens.conversa_id) AND ((c.empresa = minha_empresa()) OR pode_ver_todas_empresas())))));
create policy "Ver mensagens WhatsApp da própria loja" on public.whatsapp_mensagens as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM whatsapp_conversas c
  WHERE ((c.id = whatsapp_mensagens.conversa_id) AND ((c.empresa = minha_empresa()) OR pode_ver_todas_empresas())))));
create policy "Usuário logado vê status WhatsApp" on public.whatsapp_status as permissive for select to authenticated using (true);
create policy "Transcricao: dono, parceiro e gestor da loja" on public.whatsapp_transcricoes as permissive for select to public using (((owner_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM whatsapp_ia_leads l
  WHERE ((l.chat_jid = whatsapp_transcricoes.chat_jid) AND (l.owner_id = whatsapp_transcricoes.owner_id) AND (l.parceiro_id = ( SELECT auth.uid() AS uid))))) OR (vejo_a_loja_toda() AND (empresa = minha_empresa())) OR pode_ver_todas_empresas()));

insert into storage.buckets (id, name, public) values ('avatares', 'avatares', t) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('backups', 'backups', f) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('orcamentos', 'orcamentos', f) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('site', 'site', t) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('site-chat', 'site-chat', t) on conflict (id) do nothing;
