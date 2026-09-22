-- ============================================================
-- AURA SALES OS — Schema do banco de dados (Supabase/PostgreSQL)
-- ============================================================
-- Como usar:
-- 1. Crie um projeto em https://supabase.com
-- 2. Vá em "SQL Editor" no painel do Supabase
-- 3. Cole este arquivo inteiro e clique em "Run"
-- 4. Copie a "Project URL" e a "anon public key" em
--    Project Settings > API para o seu .env.local
-- ============================================================

-- Extensão para gerar UUIDs
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- PROFILES — um perfil por usuário autenticado (nome + loja)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  empresa text not null check (
    empresa in ('MF International', 'LF Lareiras', 'A&G Aquecimento', 'Sole Aquecimento')
  ),
  cargo text not null default 'Vendedor',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Cada pessoa só pode ver e editar o próprio perfil.
create policy "Perfil visível apenas para o próprio usuário"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Usuário pode criar o próprio perfil"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Usuário pode atualizar o próprio nome"
  on public.profiles for update
  using (auth.uid() = id);

-- IMPORTANTE: a política de UPDATE acima permite, por padrão, também
-- alterar a coluna "empresa". Para travar a loja após o cadastro
-- inicial (como decidido no produto), a troca de empresa deve ser
-- bloqueada na camada de aplicação (o formulário de edição não expõe
-- esse campo). Se quiser reforçar no banco, é possível usar um
-- trigger BEFORE UPDATE que rejeita mudanças em "empresa".

-- ------------------------------------------------------------
-- RELACIONAMENTOS — CRM (clientes, arquitetos, construtoras, obras)
-- ------------------------------------------------------------
create table if not exists public.relacionamentos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  empresa text not null,
  nome text not null,
  categoria text not null check (categoria in ('Arquiteto', 'Construtora', 'Cliente', 'Obra')),
  cidade text,
  telefone text,
  instagram text,
  influencia smallint,
  potencial smallint,
  indice_relacionamento smallint,
  status_selo text,
  temperatura text not null default 'ativo' check (temperatura in ('quente', 'ativo', 'esfriando', 'frio')),
  ultimo_contato text default 'hoje',
  proximo_contato text default 'a definir',
  obras_indicadas int not null default 0,
  valor_gerado numeric not null default 0,
  observacao text default '',
  status_relacionamento text,
  created_at timestamptz not null default now()
);

create index if not exists relacionamentos_empresa_idx on public.relacionamentos (empresa);

alter table public.relacionamentos enable row level security;

create policy "Ver relacionamentos da própria loja"
  on public.relacionamentos for select
  using (empresa = (select empresa from public.profiles where id = auth.uid()));

create policy "Criar relacionamento na própria loja"
  on public.relacionamentos for insert
  with check (
    empresa = (select empresa from public.profiles where id = auth.uid())
    and owner_id = auth.uid()
  );

create policy "Atualizar relacionamentos da própria loja"
  on public.relacionamentos for update
  using (empresa = (select empresa from public.profiles where id = auth.uid()));

create policy "Excluir relacionamentos da própria loja"
  on public.relacionamentos for delete
  using (empresa = (select empresa from public.profiles where id = auth.uid()));

-- ------------------------------------------------------------
-- OPORTUNIDADES — Pipeline de vendas
-- ------------------------------------------------------------
create table if not exists public.oportunidades (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  empresa text not null,
  cliente text not null,
  produto text default 'Não especificado',
  valor numeric not null,
  etapa text not null default 'Prospecção'
    check (etapa in ('Prospecção', 'Apresentação', 'Proposta', 'Negociação', 'Fechados')),
  probabilidade text not null default 'Média' check (probabilidade in ('Baixa', 'Média', 'Alta')),
  dias_parado int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists oportunidades_empresa_idx on public.oportunidades (empresa);

alter table public.oportunidades enable row level security;

create policy "Ver oportunidades da própria loja"
  on public.oportunidades for select
  using (empresa = (select empresa from public.profiles where id = auth.uid()));

create policy "Criar oportunidade na própria loja"
  on public.oportunidades for insert
  with check (
    empresa = (select empresa from public.profiles where id = auth.uid())
    and owner_id = auth.uid()
  );

create policy "Atualizar oportunidades da própria loja"
  on public.oportunidades for update
  using (empresa = (select empresa from public.profiles where id = auth.uid()));

create policy "Excluir oportunidades da própria loja"
  on public.oportunidades for delete
  using (empresa = (select empresa from public.profiles where id = auth.uid()));

-- ------------------------------------------------------------
-- VENDAS — negócios fechados
-- ------------------------------------------------------------
create table if not exists public.vendas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  empresa text not null,
  cliente text not null,
  produto text default 'Não especificado',
  valor numeric not null,
  forma_pagamento text,
  origem text,
  data date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists vendas_empresa_idx on public.vendas (empresa);

alter table public.vendas enable row level security;

create policy "Ver vendas da própria loja"
  on public.vendas for select
  using (empresa = (select empresa from public.profiles where id = auth.uid()));

create policy "Criar venda na própria loja"
  on public.vendas for insert
  with check (
    empresa = (select empresa from public.profiles where id = auth.uid())
    and owner_id = auth.uid()
  );

-- ------------------------------------------------------------
-- ATIVIDADES — histórico (visitas, ligações, reuniões, etc.)
-- ------------------------------------------------------------
create table if not exists public.atividades (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  empresa text not null,
  tipo text not null,
  titulo text not null,
  contexto text,
  created_at timestamptz not null default now()
);

create index if not exists atividades_empresa_idx on public.atividades (empresa);

alter table public.atividades enable row level security;

create policy "Ver atividades da própria loja"
  on public.atividades for select
  using (empresa = (select empresa from public.profiles where id = auth.uid()));

create policy "Criar atividade na própria loja"
  on public.atividades for insert
  with check (
    empresa = (select empresa from public.profiles where id = auth.uid())
    and owner_id = auth.uid()
  );

-- ------------------------------------------------------------
-- DIRETORIA — visão consolidada das 4 empresas
-- ------------------------------------------------------------
-- As políticas acima restringem cada vendedor à própria loja, por
-- design. Para o Painel da Diretoria (que precisa ver as 4 empresas),
-- a forma correta é criar um papel "diretor" com uma política extra,
-- por exemplo adicionando uma coluna profiles.papel ('vendedor' |
-- 'gestor' | 'diretor') e uma policy adicional tipo:
--
--   create policy "Diretoria vê tudo"
--     on public.relacionamentos for select
--     using (
--       (select papel from public.profiles where id = auth.uid()) = 'diretor'
--     );
--
-- Isso fica marcado como próximo passo, para não travar o restante
-- do produto em cima de uma decisão de modelagem de permissões que
-- ainda não foi validada com você.
