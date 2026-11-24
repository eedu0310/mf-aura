-- 20260930133536 instagram_no_aura_fundacao

-- Instagram dentro do AURA: conversas e comentários, por loja.
--
-- Diferente do WhatsApp, que pareia lendo um QR, o Instagram só fala pela
-- API oficial da Meta: cada loja conecta a própria conta profissional e o
-- AURA guarda o token dela aqui.
--
-- O token é segredo: esta tabela não tem política de leitura para ninguém
-- logado. Só o serviço (service role) a lê, do lado do servidor. A tela usa
-- a visão `meta_contas_visiveis`, que mostra tudo menos o token.
create table if not exists meta_contas (
  id uuid primary key default gen_random_uuid(),
  empresa text not null unique,
  ig_user_id text,
  nome_usuario text,
  token text,
  token_expira_em timestamptz,
  conectado_em timestamptz,
  conectado_por uuid references auth.users(id) on delete set null,
  ativo boolean not null default true
);
alter table meta_contas enable row level security;

create or replace view meta_contas_visiveis
with (security_invoker = on) as
  select id, empresa, ig_user_id, nome_usuario, conectado_em, ativo,
         token is not null and token <> '' as conectada,
         token_expira_em
  from meta_contas;

-- A conversa (DM). `responde_ate` guarda a janela de 24h da Meta: passou
-- disso, o vendedor nao pode mais responder ate o cliente escrever de novo.
-- Sem isso na tela, ele escreve e leva erro sem entender por que.
create table if not exists meta_conversas (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  conta_id uuid references meta_contas(id) on delete cascade,
  ig_thread_id text not null,
  cliente_ig_id text,
  cliente_nome text,
  cliente_usuario text,
  cliente_foto text,
  ultima_mensagem text,
  ultima_em timestamptz,
  nao_lidas integer not null default 0,
  responde_ate timestamptz,
  owner_id uuid references auth.users(id) on delete set null,
  relacionamento_id uuid references relacionamentos(id) on delete set null,
  ignorado boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (conta_id, ig_thread_id)
);
alter table meta_conversas enable row level security;

create table if not exists meta_mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references meta_conversas(id) on delete cascade,
  mid text unique,
  de_mim boolean not null default false,
  texto text,
  tipo text not null default 'text',
  midia_url text,
  criado_em timestamptz not null default now()
);
alter table meta_mensagens enable row level security;

-- Comentários das publicações: o vendedor acompanha e responde sem sair daqui.
create table if not exists meta_comentarios (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  conta_id uuid references meta_contas(id) on delete cascade,
  comentario_id text not null unique,
  post_id text,
  post_url text,
  autor_usuario text,
  texto text,
  respondido boolean not null default false,
  oculto boolean not null default false,
  criado_em timestamptz not null default now()
);
alter table meta_comentarios enable row level security;

-- Quem enxerga: gente da mesma loja, e gestor/diretor em todas.
create policy meta_conversas_da_loja on meta_conversas for all
  using (empresa = minha_empresa() or meu_cargo() = any (array['Gestor','Diretor']))
  with check (empresa = minha_empresa() or meu_cargo() = any (array['Gestor','Diretor']));

create policy meta_mensagens_da_loja on meta_mensagens for all
  using (exists (select 1 from meta_conversas c where c.id = conversa_id
                 and (c.empresa = minha_empresa() or meu_cargo() = any (array['Gestor','Diretor']))))
  with check (exists (select 1 from meta_conversas c where c.id = conversa_id
                 and (c.empresa = minha_empresa() or meu_cargo() = any (array['Gestor','Diretor']))));

create policy meta_comentarios_da_loja on meta_comentarios for all
  using (empresa = minha_empresa() or meu_cargo() = any (array['Gestor','Diretor']))
  with check (empresa = minha_empresa() or meu_cargo() = any (array['Gestor','Diretor']));

create index if not exists idx_meta_conversas_recentes on meta_conversas (empresa, ultima_em desc);
create index if not exists idx_meta_mensagens_conversa on meta_mensagens (conversa_id, criado_em);
create index if not exists idx_meta_comentarios_recentes on meta_comentarios (empresa, criado_em desc);
