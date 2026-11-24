-- 20261013123823 079_tabelas_para_backup

-- Lista as tabelas que o backup noturno deve salvar.
--
-- Existe como função no banco em vez de uma lista escrita no código porque
-- lista escrita à mão envelhece em silêncio: tabela nova nasceria fora do
-- backup e ninguém descobriria até precisar restaurar. Aqui o banco responde
-- o que ele tem hoje.
create or replace function public.tabelas_para_backup()
returns table (tabela text, linhas bigint)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
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
$$;

revoke all on function public.tabelas_para_backup() from public;
grant execute on function public.tabelas_para_backup() to authenticated, service_role;
