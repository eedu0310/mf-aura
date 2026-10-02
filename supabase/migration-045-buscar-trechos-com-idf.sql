-- Busca os trechos do material que tem a ver com uma conversa. Versao 2.
--
-- A 044 unia todas as palavras da conversa com OU e piorava o resultado. O
-- motivo: as palavras do nosso proprio ramo nao distinguem nada. No material da
-- loja, "projeto" esta em 41% dos trechos, "cliente" em 27%, "obra" e "lareira"
-- em 24%. Buscar por elas e buscar por tudo. Pior: o titulo do documento entra
-- no indice de cada trecho, entao "scmf", "guia", "rapido" e "vendedor"
-- aparecem em 58% a 67% - qualquer conversa que mencionasse "vendedor" casava
-- com meio manual.
--
-- Agora cada palavra da conversa e medida contra o material antes de ser usada:
-- se aparece em mais de um quarto dos trechos, e descartada por nao
-- discriminar. Sobram as raras, que sao as que dizem do que a conversa trata -
-- engenheiro, predio, chamine, construtora. Das que sobram ficam as 12 mais
-- raras, o que tambem limita o tamanho da consulta.
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
  total numeric;
begin
  select count(*) into total from public.aura_material_trechos t where t.empresa = p_empresa;
  if coalesce(total, 0) = 0 then
    return;
  end if;

  with corpus as (
    select unnest(string_to_array(replace(strip(t.busca)::text, '''', ''), ' ')) as lexema
    from public.aura_material_trechos t
    where t.empresa = p_empresa
  ),
  df as (
    select lexema, count(*) as n from corpus group by lexema
  ),
  lex as (
    select distinct unnest(
      string_to_array(replace(strip(to_tsvector('portuguese', p_conversa))::text, '''', ''), ' ')
    ) as lexema
  ),
  escolhidas as (
    select lex.lexema
    from lex join df using (lexema)
    where length(lex.lexema) > 2
      and df.n <= greatest(1, floor(total * 0.25))
    order by df.n
    limit 12
  )
  select string_agg(lexema, ' | ') into termos from escolhidas;

  if termos is null or termos = '' then
    return;
  end if;

  begin
    consulta := to_tsquery('portuguese', termos);
  exception when others then
    -- texto estranho na conversa nao pode derrubar a analise
    return;
  end;

  -- distinct on (texto): o material tem trechos repetidos (secoes com o mesmo
  -- corpo sob titulos diferentes). Sem isto, o mesmo paragrafo ocupava tres das
  -- seis vagas e empurrava fora conteudo que fazia falta.
  return query
  select d.origem, d.texto, d.nota
  from (
    select distinct on (t.texto)
           t.origem, t.texto, ts_rank(t.busca, consulta) as nota, t.ordem
    from public.aura_material_trechos t
    where t.empresa = p_empresa
      and t.busca @@ consulta
    order by t.texto, ts_rank(t.busca, consulta) desc
  ) d
  order by d.nota desc, d.ordem
  limit greatest(1, least(p_limite, 20));
end;
$$;

revoke execute on function public.aura_buscar_trechos(text, text, integer) from anon;
