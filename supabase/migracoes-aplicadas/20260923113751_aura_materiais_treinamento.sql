-- 20260923113751 aura_materiais_treinamento

-- Materiais que a AURA estuda para ajudar o vendedor (manuais, playbooks,
-- tabelas de produto, scripts). O gestor envia pelo painel; o texto extraído
-- é usado nos prompts da IA.
create table if not exists public.aura_materiais (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  titulo text not null,
  descricao text,
  arquivo_nome text,
  tipo text,
  bytes integer,
  texto text not null,
  caracteres integer generated always as (length(texto)) stored,
  ativo boolean not null default true,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.aura_materiais enable row level security;

create policy "Ver materiais da própria loja" on public.aura_materiais
  for select to authenticated
  using (empresa = minha_empresa() or pode_ver_todas_empresas());

create policy "Gestor gerencia materiais da loja" on public.aura_materiais
  for all to authenticated
  using (pode_ver_todas_empresas() or (meu_cargo() = 'Gestor' and empresa = minha_empresa()))
  with check (pode_ver_todas_empresas() or (meu_cargo() = 'Gestor' and empresa = minha_empresa()));

create index if not exists aura_materiais_empresa_idx on public.aura_materiais(empresa) where ativo;
