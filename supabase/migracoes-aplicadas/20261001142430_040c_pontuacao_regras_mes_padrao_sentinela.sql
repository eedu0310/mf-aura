-- 20261001142430 040c_pontuacao_regras_mes_padrao_sentinela

-- O indice unico usava COALESCE(mes,''), uma expressao. Upsert com lista de
-- colunas (onConflict) nao consegue mirar indice de expressao, entao a gravacao
-- da regra falharia. Trocamos NULL por uma sentinela 'padrao' e usamos indice
-- normal, que o upsert alcanca.
update public.pontuacao_regras set mes = 'padrao' where mes is null;

alter table public.pontuacao_regras
  alter column mes set default 'padrao',
  alter column mes set not null;

drop index if exists public.pontuacao_regras_unica;
create unique index pontuacao_regras_unica
  on public.pontuacao_regras (empresa, mes, tipo, chave);

comment on column public.pontuacao_regras.mes is
  'YYYY-MM para a regra de um mes especifico, ou ''padrao'' para a regra usada em todo mes sem regra propria.';

-- As views liam "mes is null" para achar a regra padrao; agora e a sentinela.
create or replace view public.pontos_do_mes
with (security_invoker = on) as
with de_atividade as (
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
          and r_pad.chave = a.tipo and r_pad.mes = 'padrao'
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
          and r_pad.chave = o.etapa and r_pad.mes = 'padrao'
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
