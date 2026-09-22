-- ============================================================
-- ADIÇÃO: Base de Conhecimento (playbook de vendas)
-- ============================================================
-- Execute apenas este arquivo no SQL Editor do Supabase — não precisa
-- rodar o schema.sql inteiro de novo.
-- ============================================================

create table if not exists public.playbook (
  empresa text primary key,
  conteudo text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.playbook enable row level security;

create policy "Ver playbook da própria loja"
  on public.playbook for select
  using (empresa = (select empresa from public.profiles where id = auth.uid()));

create policy "Criar playbook da própria loja"
  on public.playbook for insert
  with check (empresa = (select empresa from public.profiles where id = auth.uid()));

create policy "Atualizar playbook da própria loja"
  on public.playbook for update
  using (empresa = (select empresa from public.profiles where id = auth.uid()));
