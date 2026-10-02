-- Primeira versao da busca de trechos. SUBSTITUIDA pela migration 045.
--
-- Esta versao pegava todas as palavras da conversa e unia com OU. Funcionava
-- com palavras escolhidas a mao ("caro | desconto | preco") e FALHAVA com o
-- texto cru de uma conversa real: "bom dia", "voces", "fazendo" puxavam secoes
-- genericas e afogavam a resposta certa. Uma pergunta sobre construtora e
-- chamine devolvia "ROTINA DIARIA" e "FOLLOW-UP".
--
-- Fica registrada porque o erro ensina: com OU, cada palavra a mais e um
-- convite a ruido, e as palavras do nosso proprio ramo sao as que mais
-- aparecem no nosso proprio manual.
--
-- A correcao esta na 045: medir cada palavra contra o material e usar so as
-- raras. Rode a 045 em seguida; aplicar apenas esta deixa a busca pior do que
-- nao ter busca.
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
    return;
  end;

  return query
  select t.origem, t.texto, ts_rank(t.busca, consulta) as nota
  from public.aura_material_trechos t
  where t.empresa = p_empresa and t.busca @@ consulta
  order by ts_rank(t.busca, consulta) desc, t.ordem
  limit greatest(1, least(p_limite, 20));
end;
$$;

revoke execute on function public.aura_buscar_trechos(text, text, integer) from anon;
