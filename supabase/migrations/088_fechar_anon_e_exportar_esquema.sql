-- 088: fecha ao público as funções que não são públicas, e dá ao servidor
-- um jeito de exportar o esquema inteiro (DDL) e as migrações aplicadas.
--
-- Por quê: a auditoria de 19/10 mostrou que (a) qualquer pessoa na internet
-- podia chamar campanha_do_anuncio e criar campanhas sem login, e (b) 92 das
-- 96 migrações só existiam dentro do Supabase. Com aura_esquema_ddl() e
-- aura_migracoes() o backup noturno passa a carregar o esquema junto com os
-- dados, e o repositório ganha uma cópia versionada.

-- 1. Funções SECURITY DEFINER que o anon não tem por que chamar.
--    Ficam abertas de propósito: buscar_empresa_por_token (agenda pública)
--    e registrar_avaliacao_publica (avaliação por link).
revoke execute on function public.campanha_do_anuncio(text, text, text, text, uuid) from anon, public;
revoke execute on function public.tabelas_para_backup() from anon, public;
revoke execute on function public.aura_etapa_existe_no_funil() from anon, public;
revoke execute on function public.aura_ordem_etapa(text) from anon, public;
revoke execute on function public.aura_prob_etapa(text) from anon, public;
revoke execute on function public.impedir_venda_igual_no_dia() from anon, public;
revoke execute on function public.orcamento_proxima_versao() from anon, public;
revoke execute on function public.venda_herda_campanha() from anon, public;

-- 2. Exportar o esquema como SQL executável (ordem: tipos, tabelas,
--    constraints, índices, views, funções, triggers, RLS, políticas).
create or replace function public.aura_esquema_ddl()
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  saida text := '';
  r record;
begin
  saida := saida || '-- Esquema público do AURA gerado em ' || now()::text || E'\n\n';

  -- tipos enumerados
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

  -- tabelas com colunas
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

  -- constraints (pk, unique, check, fk) — fk por último, depois de todas as tabelas
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

  -- índices que não vêm de constraint
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

  -- funções (antes das views, porque views podem usá-las; triggers depois)
  for r in
    select pg_get_functiondef(p.oid) as def, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
    order by p.proname
  loop
    saida := saida || r.def || E';\n\n';
  end loop;

  -- permissões de execução das funções
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

  -- views (security_invoker preservado via reloptions)
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

  -- triggers
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

  -- RLS ligado
  for r in
    select c.relname, c.relforcerowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
    order by c.relname
  loop
    saida := saida || format('alter table public.%I enable row level security;', r.relname) || E'\n';
  end loop;
  saida := saida || E'\n';

  -- políticas
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

  -- buckets de storage
  for r in
    select id, public as publico from storage.buckets order by id
  loop
    saida := saida || format('insert into storage.buckets (id, name, public) values (%L, %L, %s) on conflict (id) do nothing;',
      r.id, r.id, r.publico) || E'\n';
  end loop;

  return saida;
end;
$$;

revoke execute on function public.aura_esquema_ddl() from public, anon, authenticated;
grant execute on function public.aura_esquema_ddl() to service_role;

-- 3. Migrações aplicadas, com o SQL de cada uma.
create or replace function public.aura_migracoes()
returns table (versao text, nome text, sql text)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select m.version, m.name, array_to_string(m.statements, E'\n\n')
  from supabase_migrations.schema_migrations m
  order by m.version;
$$;

revoke execute on function public.aura_migracoes() from public, anon, authenticated;
grant execute on function public.aura_migracoes() to service_role;

-- 4. Bucket privado para o backup noturno sair da VPS. Sem política: só o
--    service_role (servidor) lê e grava.
insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;

comment on function public.aura_esquema_ddl() is 'Exporta o esquema público como SQL. Só o servidor (service_role) chama; usado pelo backup noturno.';
comment on function public.aura_migracoes() is 'Lista as migrações aplicadas com o SQL de cada uma. Só o servidor chama.';
