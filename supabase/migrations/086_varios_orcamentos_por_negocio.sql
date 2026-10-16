-- 086: um negócio pode ter vários orçamentos.
--
-- Havia UMA coluna orcamento_path por oportunidade, e o upload usava
-- upsert: o segundo orçamento sobrescrevia o primeiro no storage e no banco.
-- Na prática a casa faz três, cinco, dez orçamentos para o mesmo cliente
-- até fechar — e só o último sobrevivia. O gestor nunca via a sequência.
--
-- Os anexos ganham tabela própria. A coluna antiga continua existindo e
-- apontando para o MAIS RECENTE, para nada que a leia hoje quebrar.

create table if not exists public.orcamentos_anexos (
  id uuid primary key default gen_random_uuid(),
  oportunidade_id uuid not null references public.oportunidades(id) on delete cascade,
  relacionamento_id uuid references public.relacionamentos(id) on delete set null,
  empresa text not null,
  owner_id uuid not null,
  nome text not null,
  path text not null,
  bytes bigint,
  -- Ordem em que entraram no negócio: 1, 2, 3... É o que o gestor olha
  -- para ver quantas vezes foi preciso reorçar.
  versao integer not null default 1,
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists orcamentos_anexos_oportunidade_idx
  on public.orcamentos_anexos (oportunidade_id, versao);

alter table public.orcamentos_anexos enable row level security;

-- Mesma régua da oportunidade: o dono vê a dele, o gestor aprovado vê a loja.
create policy "Dono ou gestor ve os orcamentos"
  on public.orcamentos_anexos for select
  using (owner_id = (select auth.uid()) or vejo_a_loja_toda());

create policy "Dono anexa orcamento"
  on public.orcamentos_anexos for insert
  with check (owner_id = (select auth.uid()) or vejo_a_loja_toda());

create policy "Dono ou gestor remove orcamento"
  on public.orcamentos_anexos for delete
  using (owner_id = (select auth.uid()) or vejo_a_loja_toda());

-- O que já estava anexado entra como versão 1, para não perder nada.
insert into public.orcamentos_anexos
  (oportunidade_id, relacionamento_id, empresa, owner_id, nome, path, versao, created_at)
select o.id, o.relacionamento_id, o.empresa, o.owner_id,
       coalesce(o.orcamento_nome, 'orcamento'), o.orcamento_path, 1,
       coalesce(o.updated_at, o.created_at, now())
from public.oportunidades o
where o.orcamento_path is not null
  and not exists (
    select 1 from public.orcamentos_anexos a
    where a.oportunidade_id = o.id and a.path = o.orcamento_path
  );

-- A versão é calculada no banco na hora de inserir, para duas abas abertas
-- não gravarem duas "versão 2".
create or replace function public.orcamento_proxima_versao()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  select coalesce(max(versao), 0) + 1 into new.versao
  from public.orcamentos_anexos where oportunidade_id = new.oportunidade_id;

  -- A coluna antiga segue apontando para o mais recente.
  update public.oportunidades
     set orcamento_path = new.path, orcamento_nome = new.nome, updated_at = now()
   where id = new.oportunidade_id;

  return new;
end;
$$;

create or replace trigger trg_orcamento_proxima_versao
  before insert on public.orcamentos_anexos
  for each row execute function public.orcamento_proxima_versao();
