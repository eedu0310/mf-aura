-- 073b — Fecha as bordas das funções criadas em 072
--
-- O linter do Supabase apontou duas coisas nas funções novas, e as duas são
-- de higiene, não de brecha aberta. Mas higiene em função SECURITY DEFINER é
-- o que separa uma função inofensiva de um degrau para alguém subir.
--
-- 1. aura_ordem_da_chave e aura_prob_da_chave estavam sem search_path fixo.
--    São funções puras, que só fazem um CASE sobre um texto e não tocam em
--    tabela nenhuma — mas função sem search_path fixo é o padrão que o resto
--    do banco já abandonou (migração 041), e deixar duas fora da regra é
--    como a exceção vira costume.
--
-- 2. aura_ordem_etapa e aura_prob_etapa ficaram chamáveis pelo papel `anon`,
--    isto é, por qualquer pessoa na internet, sem login. Elas não devolvem
--    dado de ninguém (só traduzem o nome de uma etapa para um número), então
--    não há vazamento — mas não existe motivo para estarem expostas, e
--    superfície que não serve a ninguém é superfície que se fecha.

create or replace function public.aura_ordem_da_chave(p_chave text)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p_chave
    when 'prospeccao'   then 0
    when 'qualificacao' then 1
    when 'apresentacao' then 2
    when 'followup'     then 3
    when 'negociacao'   then 4
    when 'fechamento'   then 5
    when 'posvenda'     then 6
    when 'perda'        then -1
    else -1
  end;
$$;

create or replace function public.aura_prob_da_chave(p_chave text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_chave
    when 'followup'   then 'Média'
    when 'negociacao' then 'Alta'
    when 'fechamento' then 'Alta'
    when 'posvenda'   then 'Alta'
    else 'Baixa'
  end;
$$;

revoke all on function public.aura_ordem_etapa(text) from anon;
revoke all on function public.aura_prob_etapa(text) from anon;
revoke all on function public.aura_ordem_da_chave(text) from anon;
revoke all on function public.aura_prob_da_chave(text) from anon;
revoke all on function public.aura_etapa_da_chave(text, text) from anon;
revoke all on function public.aura_chave_da_etapa(text, text) from anon;
revoke all on function public.aura_etapa_de_ganho(text) from anon;
revoke all on function public.aura_etapa_de_perda(text) from anon;

grant execute on function public.aura_ordem_da_chave(text) to authenticated, service_role;
grant execute on function public.aura_prob_da_chave(text) to authenticated, service_role;
grant execute on function public.aura_ordem_etapa(text) to authenticated, service_role;
grant execute on function public.aura_prob_etapa(text) to authenticated, service_role;
