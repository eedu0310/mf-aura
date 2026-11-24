-- 20261001142301 040b_views_de_pontuacao

-- Pontos de cada vendedor por mes.
--
-- Duas fontes somadas: as atividades que a pessoa registrou (visita, ligacao,
-- prospeccao...) e as etapas que os negocios dela alcancaram. A regra do mes
-- manda; se o mes nao tiver regra propria, cai na regra padrao (mes NULL).
--
-- A etapa e contada pela etapa ATUAL da oportunidade, uma vez cada. Contar a
-- passagem por cada etapa exigiria um historico de movimentacao que nao
-- existe, e inventar isso daria ponto errado - melhor uma conta simples e
-- honesta do que uma complicada e furada.
create or replace view public.pontos_do_mes
with (security_invoker = on) as
with regra as (
  -- resolve a regra valida: a do mes especifico ganha da padrao
  select empresa, tipo, chave, mes, pontos,
         row_number() over (
           partition by empresa, tipo, chave, coalesce(mes, 'padrao')
           order by (mes is not null) desc
         ) as rn
    from public.pontuacao_regras
),
de_atividade as (
  select a.owner_id, a.empresa,
         to_char(a.created_at, 'YYYY-MM') as mes,
         sum(coalesce(r_mes.pontos, r_pad.pontos, 0)) as pontos,
         count(*) as quantidade
    from public.atividades a
    left join public.pontuacao_regras r_mes
           on r_mes.empresa = a.empresa and r_mes.tipo = 'atividade'
          and r_mes.chave = a.tipo
          and r_mes.mes = to_char(a.created_at, 'YYYY-MM')
    left join public.pontuacao_regras r_pad
           on r_pad.empresa = a.empresa and r_pad.tipo = 'atividade'
          and r_pad.chave = a.tipo and r_pad.mes is null
   where a.owner_id is not null
   group by 1,2,3
),
de_etapa as (
  select o.owner_id, o.empresa,
         to_char(coalesce(o.updated_at, o.created_at), 'YYYY-MM') as mes,
         sum(coalesce(r_mes.pontos, r_pad.pontos, 0)) as pontos
    from public.oportunidades o
    left join public.pontuacao_regras r_mes
           on r_mes.empresa = o.empresa and r_mes.tipo = 'etapa'
          and r_mes.chave = o.etapa
          and r_mes.mes = to_char(coalesce(o.updated_at, o.created_at), 'YYYY-MM')
    left join public.pontuacao_regras r_pad
           on r_pad.empresa = o.empresa and r_pad.tipo = 'etapa'
          and r_pad.chave = o.etapa and r_pad.mes is null
   where o.owner_id is not null
   group by 1,2,3
)
select
  coalesce(a.owner_id, e.owner_id)  as vendedor_id,
  coalesce(a.empresa, e.empresa)    as empresa,
  coalesce(a.mes, e.mes)            as mes,
  coalesce(a.quantidade, 0)         as atividades,
  coalesce(a.pontos, 0)             as pontos_atividades,
  coalesce(e.pontos, 0)             as pontos_etapas,
  coalesce(a.pontos, 0) + coalesce(e.pontos, 0) as pontos
from de_atividade a
full join de_etapa e
  on e.owner_id = a.owner_id and e.empresa = a.empresa and e.mes = a.mes;

comment on view public.pontos_do_mes is
  'Pontos por vendedor e mes: atividades registradas mais etapas alcancadas, pela regra do mes (ou pela padrao quando o mes nao tem regra propria).';

-- O acumulado do ano, que e o que decide o premio maior de dezembro. O ranking
-- existente so olhava o mes, entao nao havia como apurar isto.
create or replace view public.pontos_do_ano
with (security_invoker = on) as
select
  p.vendedor_id,
  p.empresa,
  left(p.mes, 4)              as ano,
  sum(p.pontos)               as pontos,
  sum(p.atividades)           as atividades,
  count(distinct p.mes)       as meses_com_registro
from public.pontos_do_mes p
group by 1,2,3;

comment on view public.pontos_do_ano is
  'Soma dos pontos mensais por ano. Base do premio de fim de ano.';
