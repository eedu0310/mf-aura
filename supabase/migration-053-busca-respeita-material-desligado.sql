-- A busca passa a respeitar o material desligado.
--
-- O gestor desliga um material pelo painel (aura_materiais.ativo = false)
-- quando ele saiu de validade - tabela de preco do ano passado, processo que
-- mudou. Os trechos, porem, nao tinham essa marca: continuariam sendo achados
-- pela busca e a AURA seguiria ensinando o que a casa acabou de aposentar,
-- sem ninguem entender por que.
--
-- A funcao abaixo e a da migration 045 com o join em aura_materiais; a view
-- existe para o nucleo, que e lido pelo cliente do aplicativo, herdar a mesma
-- regra sem o codigo ter de lembrar de repeti-la em cada consulta.
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
  select count(*) into total
  from public.aura_material_trechos t
  join public.aura_materiais m on m.id = t.material_id
  where t.empresa = p_empresa and m.ativo;

  if coalesce(total, 0) = 0 then
    return;
  end if;

  with corpus as (
    select unnest(string_to_array(replace(strip(t.busca)::text, '''', ''), ' ')) as lexema
    from public.aura_material_trechos t
    join public.aura_materiais m on m.id = t.material_id
    where t.empresa = p_empresa and m.ativo
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
    return;
  end;

  return query
  select d.origem, d.texto, d.nota
  from (
    select distinct on (t.texto)
           t.origem, t.texto, ts_rank(t.busca, consulta) as nota, t.ordem
    from public.aura_material_trechos t
    join public.aura_materiais m on m.id = t.material_id
    where t.empresa = p_empresa
      and m.ativo
      and t.busca @@ consulta
    order by t.texto, ts_rank(t.busca, consulta) desc
  ) d
  order by d.nota desc, d.ordem
  limit greatest(1, least(p_limite, 20));
end;
$$;

revoke execute on function public.aura_buscar_trechos(text, text, integer) from anon;

create or replace view public.aura_trechos_ativos as
select t.id, t.material_id, t.empresa, t.ordem, t.origem, t.texto, t.nucleo
from public.aura_material_trechos t
join public.aura_materiais m on m.id = t.material_id
where m.ativo;
