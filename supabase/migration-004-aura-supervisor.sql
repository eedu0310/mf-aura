-- AURA Supervisor: histórico de análises, riscos e recomendações rastreáveis.
create table if not exists public.aura_supervisoes (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references auth.users (id) on delete cascade,
  empresa text not null,
  janela_inicio timestamptz not null,
  janela_fim timestamptz not null,
  score integer not null default 0 check (score between 0 and 100),
  resumo text not null default '',
  riscos jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists aura_supervisoes_vendedor_criado_idx
  on public.aura_supervisoes (vendedor_id, criado_em desc);

create table if not exists public.aura_recomendacoes (
  id uuid primary key default gen_random_uuid(),
  supervisao_id uuid not null references public.aura_supervisoes (id) on delete cascade,
  vendedor_id uuid not null references auth.users (id) on delete cascade,
  empresa text not null,
  titulo text not null,
  descricao text not null,
  prioridade text not null default 'media' check (prioridade in ('urgente', 'alta', 'media', 'baixa')),
  origem text not null default 'regra',
  status text not null default 'pendente' check (status in ('pendente', 'concluida', 'dispensada')),
  entidade_tipo text,
  entidade_id uuid,
  prazo date,
  concluida_em timestamptz,
  criado_em timestamptz not null default now()
);

create index if not exists aura_recomendacoes_vendedor_status_idx
  on public.aura_recomendacoes (vendedor_id, status, criado_em desc);

alter table public.aura_supervisoes enable row level security;
alter table public.aura_recomendacoes enable row level security;

create policy "Vendedor vê suas supervisões"
  on public.aura_supervisoes for select
  using (vendedor_id = auth.uid());

create policy "Gestor vê supervisões da loja"
  on public.aura_supervisoes for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.empresa = aura_supervisoes.empresa and p.cargo in ('Gestor', 'Diretor')));

create policy "Vendedor vê suas recomendações"
  on public.aura_recomendacoes for select
  using (vendedor_id = auth.uid());

create policy "Vendedor atualiza suas recomendações"
  on public.aura_recomendacoes for update
  using (vendedor_id = auth.uid())
  with check (vendedor_id = auth.uid());

create policy "Gestor vê recomendações da loja"
  on public.aura_recomendacoes for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.empresa = aura_recomendacoes.empresa and p.cargo in ('Gestor', 'Diretor')));
