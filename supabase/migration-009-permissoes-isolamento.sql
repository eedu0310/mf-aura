-- AURA: isolamento por empresa e permissões por cargo.
-- Vendedor/SDR/Pós-venda: somente sua empresa.
-- Gestor/Diretor: todas as empresas nos módulos gerenciais.
-- Marketing: todos os leads e indicadores de marketing.

create or replace function public.cargo_atual()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select cargo from public.profiles where id = auth.uid();
$$;

create or replace function public.pode_ver_todas_empresas()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.cargo_atual() in ('Gestor', 'Diretor'), false);
$$;

create or replace function public.pode_ver_marketing()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.cargo_atual() in ('Marketing', 'Gestor', 'Diretor'), false);
$$;

revoke all on function public.cargo_atual() from public;
revoke all on function public.pode_ver_todas_empresas() from public;
revoke all on function public.pode_ver_marketing() from public;
grant execute on function public.cargo_atual() to authenticated;
grant execute on function public.pode_ver_todas_empresas() to authenticated;
grant execute on function public.pode_ver_marketing() to authenticated;

-- Perfis: gestores/diretores precisam identificar os vendedores; vendedores
-- continuam vendo apenas a própria empresa para recursos como equipe/ranking.
drop policy if exists "Gestor e diretor veem todos os perfis" on public.profiles;
create policy "Gestor e diretor veem todos os perfis"
  on public.profiles for select
  using (public.pode_ver_todas_empresas() or empresa = public.minha_empresa());

-- Dados comerciais: acrescenta visão global somente para gestão. A política
-- existente da própria empresa continua valendo para os demais cargos.
do $$
declare
  tabela text;
begin
  foreach tabela in array array['relacionamentos','oportunidades','vendas','atividades'] loop
    execute format('drop policy if exists %I on public.%I', 'Gestor e diretor veem todas as empresas', tabela);
    execute format('create policy %I on public.%I for select using (public.pode_ver_todas_empresas() or empresa = public.minha_empresa())', 'Gestor e diretor veem todas as empresas', tabela);
  end loop;
end $$;

-- Leads e indicadores podem não existir em instalações antigas. Se existirem,
-- o bloco aplica as regras sem interromper a migration.
do $$
begin
  if to_regclass('public.leads_recebidos') is not null then
    execute 'drop policy if exists "Marketing e gestão veem todos os leads" on public.leads_recebidos';
    execute 'create policy "Marketing e gestão veem todos os leads" on public.leads_recebidos for select using (public.pode_ver_marketing() or empresa = public.minha_empresa() or vendedor_id = auth.uid() or sdr_id = auth.uid())';
    execute 'drop policy if exists "Marketing e gestão atualizam todos os leads" on public.leads_recebidos';
    execute 'create policy "Marketing e gestão atualizam todos os leads" on public.leads_recebidos for update using (public.pode_ver_marketing() or empresa = public.minha_empresa() or vendedor_id = auth.uid() or sdr_id = auth.uid()) with check (public.pode_ver_marketing() or empresa = public.minha_empresa())';
  end if;
  if to_regclass('public.planilha_leads_indicadores') is not null then
    execute 'drop policy if exists "Marketing e gestão veem todos indicadores" on public.planilha_leads_indicadores';
    execute 'create policy "Marketing e gestão veem todos indicadores" on public.planilha_leads_indicadores for select using (public.pode_ver_marketing() or usuario_id = auth.uid())';
    execute 'drop policy if exists "Marketing gerencia indicadores" on public.planilha_leads_indicadores';
    execute 'create policy "Marketing gerencia indicadores" on public.planilha_leads_indicadores for all using (public.pode_ver_marketing() or usuario_id = auth.uid()) with check (public.pode_ver_marketing() or usuario_id = auth.uid())';
  end if;
end $$;
