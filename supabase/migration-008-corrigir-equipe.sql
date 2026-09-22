-- Corrige o carregamento da equipe sem recursão na RLS de profiles.
alter table public.profiles add column if not exists ativo boolean not null default true;
alter table public.atividades add column if not exists ocorrida_em timestamptz;
update public.atividades set ocorrida_em = created_at where ocorrida_em is null;

create or replace function public.minha_empresa()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select empresa from public.profiles where id = auth.uid();
$$;

revoke all on function public.minha_empresa() from public;
grant execute on function public.minha_empresa() to authenticated;

drop policy if exists "Perfis visíveis para ranking da empresa" on public.profiles;
drop policy if exists "Equipe visível para a mesma empresa" on public.profiles;
create policy "Equipe visível para a mesma empresa"
  on public.profiles for select
  using (auth.uid() = id or empresa = public.minha_empresa());

-- RPC usada pelo dashboard e pelo Meu Dia.
create or replace function public.contagem_atividades_recentes(dias integer default 7)
returns table(owner_id uuid, total bigint)
language sql
security definer
stable
set search_path = public
as $$
  select a.owner_id, count(*)::bigint
  from public.atividades a
  join public.profiles p on p.id = a.owner_id
  where a.ocorrida_em >= now() - make_interval(days => greatest(dias, 0))
    and p.empresa = public.minha_empresa()
  group by a.owner_id;
$$;

revoke all on function public.contagem_atividades_recentes(integer) from public;
grant execute on function public.contagem_atividades_recentes(integer) to authenticated;
