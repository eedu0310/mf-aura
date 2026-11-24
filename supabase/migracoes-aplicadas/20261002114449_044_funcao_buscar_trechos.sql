-- 20261002114449 044_funcao_buscar_trechos

-- Busca os trechos do material que tem a ver com uma conversa.
--
-- Recebe o texto cru da conversa e devolve os N trechos mais relevantes da
-- loja. Em vez de injetar o manual inteiro em toda analise, so o pedaco que
-- importa viaja - cliente falou de preco, vai a secao de desconto; falou de
-- obra, vai a de construtoras.
--
-- Como monta a consulta: passa o texto por to_tsvector, que ja faz o trabalho
-- do dicionario de portugues - tira "de", "para", "que", e reduz cada palavra
-- ao radical (orcamentos -> orcament). Os radicais resultantes sao unidos com
-- OU. Com E (que e o padrao de websearch_to_tsquery) a busca nao achava nada:
-- exigia que um unico trecho tivesse TODAS as palavras da conversa.
create or replace function public.aura_buscar_trechos(
  p_empresa text,
  p_conversa text,
  p_limite integer default 6
)
returns table (origem text, texto text, nota real)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  consulta tsquery;
  termos text;
begin
  -- lexemas da conversa, sem repetir, unidos por OU
  select string_agg(distinct lexema, ' | ')
    into termos
  from (
    select (unnest(string_to_array(replace(strip(to_tsvector('portuguese', p_conversa))::text, '''', ''), ' '))) as lexema
  ) x
  where length(lexema) > 2;

  if termos is null or termos = '' then
    return;
  end if;

  begin
    consulta := to_tsquery('portuguese', termos);
  exception when others then
    -- texto estranho nao pode derrubar a analise da conversa
    return;
  end;

  return query
  select t.origem, t.texto, ts_rank(t.busca, consulta) as nota
  from public.aura_material_trechos t
  where t.empresa = p_empresa
    and t.busca @@ consulta
  order by ts_rank(t.busca, consulta) desc, t.ordem
  limit greatest(1, least(p_limite, 20));
end;
$$;

revoke execute on function public.aura_buscar_trechos(text, text, integer) from anon;
